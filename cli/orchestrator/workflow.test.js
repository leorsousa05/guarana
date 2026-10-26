import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  STATES, STATE_SKILL, isState, isEvent, skillForState, stateForSkill,
  canTransition, apply, createWorkflow, load, save, workflowFile,
} from './state.js';
import { decide, resultFailed } from './decide.js';
import { buildSystemBlock, buildInjection, resolveSkillBody, completionAction } from './prompt.js';
import { ensureSpecs, taskSlug } from './specs.js';
import {
  clearPreferenceInjectionBudget, clearWorkflowPreference, readWorkflowSettings,
  setPreferenceInjectionBudget, setWorkflowPreference,
  validateWorkflowSettings, workflowSettingsPaths, writeWorkflowSettings,
} from './workflow-settings.js';

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-orch-'));
}

test('state machine: canonical states present', () => {
  assert.deepEqual(STATES, ['idle', 'planning', 'building', 'coding', 'verifying', 'debugging', 'completed']);
});

test('state<->skill mapping round-trips', () => {
  assert.equal(skillForState('coding'), 'code');
  assert.equal(stateForSkill('guarana:code'), 'coding');
  assert.equal(stateForSkill('code'), 'coding');
  assert.equal(stateForSkill('verify'), 'verifying');
  assert.equal(skillForState('idle'), null);
  assert.equal(skillForState('completed'), null);
});

test('legal transitions', () => {
  assert.ok(canTransition('new_task', 'idle'));
  assert.ok(canTransition('new_task', 'completed'));
  assert.ok(canTransition('plan_complete', 'planning'));
  assert.ok(canTransition('start_task', 'planning'));
  for (const state of ['idle', 'building', 'coding', 'verifying', 'debugging', 'completed']) {
    assert.ok(!canTransition('start_task', state), `start_task must reject ${state}`);
  }
  assert.ok(!canTransition('plan_complete', 'idle'));
  assert.ok(canTransition('run_start', 'building'));
  assert.ok(canTransition('code_complete', 'coding'));
  assert.ok(canTransition('verify_pass', 'verifying'));
  assert.ok(canTransition('verify_fail', 'verifying'));
  assert.ok(canTransition('verify_skip', 'coding'));
  assert.ok(canTransition('verify_skip', 'verifying'));
  assert.ok(!canTransition('verify_skip', 'debugging'));
  assert.ok(!canTransition('verify_pass', 'coding'));
  assert.ok(canTransition('fix_start', 'debugging'));
  assert.ok(canTransition('debug_complete', 'debugging'));
  assert.ok(canTransition('abort', 'coding'));
  assert.ok(canTransition('force', 'coding'));
});

test('verify_skip completes coding or verifying with its own event and explanatory note', () => {
  const coding = apply(createWorkflow(), 'force', { skill: 'code' });
  const fromCoding = apply(coding, 'verify_skip', { ts: 10 });
  assert.equal(fromCoding.state, 'completed');
  assert.equal(fromCoding.history.at(-1).event, 'verify_skip');
  assert.match(fromCoding.history.at(-1).note, /independent verification skipped/i);
  assert.notEqual(fromCoding.history.at(-1).event, 'verify_pass');

  const fromVerifying = apply(toVerifying(), 'verify_skip', { note: 'Disabled by project setting', ts: 11 });
  assert.equal(fromVerifying.state, 'completed');
  assert.equal(fromVerifying.history.at(-1).event, 'verify_skip');
  assert.equal(fromVerifying.history.at(-1).note, 'Disabled by project setting');
});

test('workflow settings default on, use isolated XDG paths, and merge fields independently', () => {
  const root = tmp();
  const home = path.join(root, 'home');
  const config = path.join(root, 'xdg');
  const options = { directory: path.join(root, 'project'), env: { XDG_CONFIG_HOME: config }, home };
  const empty = readWorkflowSettings(options);
  assert.deepEqual(empty.effective, {
    specs: { enabled: true }, verify: { enabled: true },
    memory: { preferenceInjectionBudgetTokens: null },
  });
  assert.deepEqual(empty.sources, {
    specs: 'default', verify: 'default',
    memory: { preferenceInjectionBudgetTokens: 'default' },
  });
  assert.equal(workflowSettingsPaths(options).global, path.join(config, 'guarana', 'workflow.json'));
  assert.equal(workflowSettingsPaths({ directory: options.directory, env: {}, home }).global,
    path.join(home, '.config', 'guarana', 'workflow.json'));

  writeWorkflowSettings('global', { specs: { enabled: false }, verify: { enabled: false } }, options);
  writeWorkflowSettings('project', { verify: { enabled: true } }, options);
  let resolved = readWorkflowSettings(options);
  assert.deepEqual(resolved.effective, {
    specs: { enabled: false }, verify: { enabled: true }, memory: { preferenceInjectionBudgetTokens: null },
  });
  assert.deepEqual(resolved.sources, {
    specs: 'global', verify: 'project', memory: { preferenceInjectionBudgetTokens: 'default' },
  });

  clearWorkflowPreference('project', 'verify', options);
  resolved = readWorkflowSettings(options);
  assert.deepEqual(resolved.effective, {
    specs: { enabled: false }, verify: { enabled: false }, memory: { preferenceInjectionBudgetTokens: null },
  });
  assert.equal(resolved.sources.verify, 'global');

  writeWorkflowSettings('global', { specs: { enabled: true }, verify: { enabled: true } }, options);
  setWorkflowPreference('project', 'specs', false, options);
  resolved = readWorkflowSettings(options);
  assert.deepEqual(resolved.effective, {
    specs: { enabled: false }, verify: { enabled: true }, memory: { preferenceInjectionBudgetTokens: null },
  });
  clearWorkflowPreference('project', 'specs', options);
  assert.equal(readWorkflowSettings(options).effective.specs.enabled, true);

  setPreferenceInjectionBudget('global', 4096, options);
  setPreferenceInjectionBudget('project', 1024, options);
  resolved = readWorkflowSettings(options);
  assert.equal(resolved.effective.memory.preferenceInjectionBudgetTokens, 1024);
  assert.equal(resolved.sources.memory.preferenceInjectionBudgetTokens, 'project');
  clearPreferenceInjectionBudget('project', options);
  resolved = readWorkflowSettings(options);
  assert.equal(resolved.effective.memory.preferenceInjectionBudgetTokens, 4096);
  assert.equal(resolved.sources.memory.preferenceInjectionBudgetTokens, 'global');
  assert.equal(JSON.parse(fs.readFileSync(workflowSettingsPaths(options).global, 'utf8'))
    .memory.preferenceInjectionBudgetTokens, 4096);
  assert.equal(Object.hasOwn(JSON.parse(fs.readFileSync(workflowSettingsPaths(options).project, 'utf8')), 'memory'), false);
});

test('workflow settings reject unknown sections, fields, and non-booleans without partial writes', () => {
  for (const invalid of [
    { advisor: { enabled: false } },
    { specs: { automatic: false } },
    { verify: { enabled: 'false' } },
    { specs: null },
    { memory: { preferenceInjectionBudgetTokens: 0 } },
    { memory: { preferenceInjectionBudgetTokens: -1 } },
    { memory: { preferenceInjectionBudgetTokens: 1.5 } },
    { memory: { preferenceInjectionBudgetTokens: '100' } },
    { memory: { extra: 100 } },
  ]) assert.throws(() => validateWorkflowSettings(invalid), TypeError);

  const root = tmp();
  const options = { directory: root, env: { XDG_CONFIG_HOME: path.join(root, 'config') }, home: path.join(root, 'home') };
  const target = workflowSettingsPaths(options).project;
  writeWorkflowSettings('project', { specs: { enabled: false } }, options);
  const before = fs.readFileSync(target);
  assert.throws(() => writeWorkflowSettings('project', { specs: { enabled: false }, extra: true }, options), /Unknown workflow settings section/);
  assert.deepEqual(fs.readFileSync(target), before);
  const malformedProject = path.join(root, 'malformed');
  const malformedFile = path.join(malformedProject, '.guarana', 'workflow.json');
  fs.mkdirSync(path.dirname(malformedFile), { recursive: true });
  fs.writeFileSync(malformedFile, '{', 'utf8');
  assert.throws(() => readWorkflowSettings({ ...options, directory: malformedProject }), SyntaxError);
});

test('workflow settings writes atomically and removes temporary files on rename failure', () => {
  const root = tmp();
  const options = { directory: root, env: { XDG_CONFIG_HOME: path.join(root, 'config') }, home: path.join(root, 'home') };
  const target = workflowSettingsPaths(options).project;
  const advisorFile = path.join(root, '.guarana', 'advisor.json');
  const advisorBytes = Buffer.from('{"primary":{"model":"untouched"}}\n');
  fs.mkdirSync(path.dirname(advisorFile), { recursive: true });
  fs.writeFileSync(advisorFile, advisorBytes);
  writeWorkflowSettings('project', { specs: { enabled: true } }, options);
  const original = fs.readFileSync(target);
  const originalRename = fs.renameSync;
  fs.renameSync = function (source, destination, ...args) {
    if (destination === target) throw new Error('injected rename failure');
    return originalRename.call(this, source, destination, ...args);
  };
  try {
    assert.throws(() => writeWorkflowSettings('project', { verify: { enabled: false } }, options), /injected rename failure/);
  } finally {
    fs.renameSync = originalRename;
  }
  assert.deepEqual(fs.readFileSync(target), original);
  assert.deepEqual(fs.readdirSync(path.dirname(target)).sort(), ['advisor.json', 'workflow.json']);

  writeWorkflowSettings('project', { verify: { enabled: false } }, options);
  assert.deepEqual(JSON.parse(fs.readFileSync(target, 'utf8')), { verify: { enabled: false } });
  assert.equal(fs.statSync(target).mode & 0o777, 0o600);
  assert.deepEqual(fs.readFileSync(advisorFile), advisorBytes);
});

function toVerifying() {
  let w = createWorkflow();
  for (const e of ['new_task', 'plan_complete', 'run_start', 'code_complete']) w = apply(w, e);
  return w;
}

test('full happy path: idle -> ... -> completed', () => {
  let w = createWorkflow();
  for (const e of ['new_task', 'plan_complete', 'run_start', 'code_complete', 'verify_pass']) w = apply(w, e);
  assert.equal(w.state, 'completed');
  assert.equal(w.skill, null);
});

test('start_task atomically records the three ordinary kickoff transitions and preserves goal/condition', () => {
  const dir = tmp();
  const planning = apply(createWorkflow(), 'new_task', {
    goal: 'draft goal', condition: 'draft condition', ts: 1,
  });
  assert.ok(save(dir, planning));

  const started = apply(planning, 'start_task', {
    goal: 'Explicit implementation goal',
    condition: 'The public kickoff reaches coding with all events persisted',
    skill: 'verify',
    ts: 2,
  });
  assert.ok(started);
  assert.equal(started.state, 'coding');
  assert.equal(started.skill, 'code');
  assert.equal(started.goal, 'Explicit implementation goal');
  assert.equal(started.condition, 'The public kickoff reaches coding with all events persisted');
  assert.equal(started.activeTask, 'Explicit implementation goal');
  assert.deepEqual(started.history.slice(-3).map(({ event, from, to }) => ({ event, from, to })), [
    { event: 'new_task', from: 'planning', to: 'planning' },
    { event: 'plan_complete', from: 'planning', to: 'building' },
    { event: 'run_start', from: 'building', to: 'coding' },
  ]);
  assert.ok(started.history.slice(-3).every((entry) => entry.event !== 'start_task'));

  assert.ok(save(dir, started));
  assert.deepEqual(load(dir), started);
});

test('start_task rejects missing goal/condition and illegal states without partial state or history', () => {
  const planning = apply(createWorkflow(), 'new_task', { goal: 'planned task' });
  for (const options of [
    { condition: 'condition without goal' },
    { goal: 'goal without condition' },
    { goal: '', condition: 'condition' },
    { goal: 'goal', condition: '   ' },
  ]) {
    assert.equal(apply(planning, 'start_task', options), null);
    assert.deepEqual(planning.history.map((entry) => entry.event), ['new_task']);
    assert.equal(planning.state, 'planning');
  }

  const building = apply(planning, 'plan_complete');
  assert.equal(apply(building, 'start_task', { goal: 'goal', condition: 'condition' }), null);
  assert.equal(building.state, 'building');
  assert.deepEqual(building.history.map((entry) => entry.event), ['new_task', 'plan_complete']);
});

test('verification failure routes to debugging, then back to verification', () => {
  let w = toVerifying();
  assert.equal(w.state, 'verifying');
  w = apply(w, 'verify_fail');
  assert.equal(w.state, 'debugging');
  assert.equal(w.skill, 'debug');
  w = apply(w, 'debug_complete');
  assert.equal(w.state, 'verifying');
});

test('debug Task delegation occurs after a verification failure, not on a green result', () => {
  const failed = decide({ userText: 'the test failed', workflow: toVerifying() });
  assert.equal(failed.event, 'verify_fail');
  assert.equal(failed.skill, 'debug');
  const debugging = apply(toVerifying(), failed.event, { skill: failed.skill });
  const debugInjection = buildInjection(debugging);
  assert.match(debugInjection, /call `worker-debug` in native Task/);
  assert.doesNotMatch(debugInjection, /guarana:debug \(injected\)/);

  const green = decide({ userText: 'all good', workflow: toVerifying() });
  assert.equal(green.state, 'completed');
  const completed = apply(toVerifying(), green.event);
  const greenInjection = buildInjection(completed);
  assert.doesNotMatch(greenInjection, /guarana:(?:debug|measure) \(injected\)/);
});

test('remember and memory descriptions route state recovery separately from graph knowledge', () => {
  const index = fs.readFileSync(path.resolve('skills/guarana/SKILL.md'), 'utf8');
  const remember = fs.readFileSync(path.resolve('skills/guarana/skills/remember/SKILL.md'), 'utf8');
  const memory = fs.readFileSync(path.resolve('skills/guarana/skills/memory/SKILL.md'), 'utf8');

  assert.match(index, /the linked skill body owns its procedure/i);
  assert.match(index, /Resuming project work; restoring state after context loss/i);
  assert.match(index, /Searching\/reviewing decisions, bugs, or solutions/i);
  assert.match(remember.split('---')[1], /restoring or recording project workflow state/i);
  assert.match(memory.split('---')[1], /searching, reviewing, or saving durable knowledge/i);
  assert.match(remember.split('---')[1], /checkpoint/i);
  assert.match(memory.split('---')[1], /memory graph/i);
});

test('measure is discoverable for telemetry/cost work and remains outside workflow states', () => {
  const index = fs.readFileSync(path.resolve('skills/guarana/SKILL.md'), 'utf8');
  const measure = fs.readFileSync(path.resolve('skills/guarana/skills/measure/SKILL.md'), 'utf8');
  assert.match(index, /guarana:measure.*OPTIONAL.*telemetry, stop-reason logs, budget health.*ONLY when tuning cost or reading telemetry/i);
  assert.match(measure.split('---')[1], /ONLY when tuning cost or reading telemetry/i);
  assert.equal(stateForSkill('measure'), null);
  assert.equal(decide({ userText: 'hello', workflow: createWorkflow() }).skill, null);
  assert.doesNotMatch(buildInjection(createWorkflow()), /guarana:(?:debug|measure) \(injected\)/);
});

test('correction path: debugging -> coding -> verifying', () => {
  let w = toVerifying();
  w = apply(w, 'verify_fail');
  assert.equal(w.state, 'debugging');
  w = apply(w, 'fix_start');
  assert.equal(w.state, 'coding');
  w = apply(w, 'code_complete');
  assert.equal(w.state, 'verifying');
});

test('illegal transition returns null (no state change)', () => {
  const w = apply(createWorkflow(), 'code_complete');
  assert.equal(w, null);
});

test('apply records history and skill for the new state', () => {
  let w = apply(createWorkflow(), 'new_task', { goal: 'implement OAuth', ts: 5 });
  assert.equal(w.state, 'planning');
  assert.equal(w.skill, 'plan');
  assert.equal(w.goal, 'implement OAuth');
  assert.equal(w.history.length, 1);
  assert.equal(w.history[0].event, 'new_task');
  assert.equal(w.updatedAt, 5);
});

test('force via explicit skill', () => {
  let w = createWorkflow();
  w = apply(w, 'force', { skill: 'guarana:verify' });
  assert.equal(w.state, 'verifying');
  assert.equal(w.verificationOverride, true);
  w = apply(w, 'force', { skill: 'code' });
  assert.equal(w.state, 'coding');
  assert.equal(w.verificationOverride, false);
});

test('verification override survives failure and debug retry, then clears at task boundaries', () => {
  let w = apply(toVerifying(), 'force', { skill: 'guarana:verify' });
  w = apply(w, 'verify_fail');
  assert.equal(w.verificationOverride, true);
  w = apply(w, 'debug_complete');
  assert.equal(w.verificationOverride, true);

  const dir = tmp();
  assert.ok(save(dir, w));
  w = load(dir);
  assert.equal(w.verificationOverride, true);

  for (const terminal of ['verify_pass', 'verify_skip', 'abort', 'new_task']) {
    const ended = apply(w, terminal);
    assert.equal(ended.verificationOverride, false, terminal);
  }

  let nextTask = apply(w, 'new_task');
  for (const event of ['plan_complete', 'run_start', 'code_complete']) nextTask = apply(nextTask, event);
  assert.equal(nextTask.verificationOverride, false);
  assert.equal(completionAction(nextTask.state, { verify: { enabled: false } }, nextTask.verificationOverride), 'verify_skip');
});

test('load/save round-trip persists state to disk', () => {
  const dir = tmp();
  const wf = apply(createWorkflow(), 'new_task', { goal: 'persist me' });
  assert.ok(save(dir, wf));
  const back = load(dir);
  assert.equal(back.state, 'planning');
  assert.equal(back.goal, 'persist me');
  assert.equal(back.history.length, 1);
});

test('load remains compatible with workflow JSON saved before verify_skip existed', () => {
  const dir = tmp();
  fs.mkdirSync(path.dirname(workflowFile(dir)), { recursive: true });
  fs.writeFileSync(workflowFile(dir), JSON.stringify({
    version: 1,
    state: 'verifying',
    activeTask: 'legacy-task',
    goal: 'legacy goal',
    updatedAt: 42,
    history: [{ event: 'code_complete', from: 'coding', to: 'verifying', ts: 41 }],
  }));
  const loaded = load(dir);
  assert.equal(loaded.state, 'verifying');
  assert.equal(loaded.verificationOverride, false);
  assert.equal(loaded.activeTask, 'legacy-task');
  assert.equal(loaded.history[0].event, 'code_complete');
});

test('load on missing file returns idle workflow', () => {
  const dir = tmp();
  const wf = load(dir);
  assert.equal(wf.state, 'idle');
});

test('load on corrupt file returns idle workflow (never throws)', () => {
  const dir = tmp();
  fs.mkdirSync(path.dirname(workflowFile(dir)), { recursive: true });
  fs.writeFileSync(workflowFile(dir), '{not json', 'utf8');
  assert.equal(load(dir).state, 'idle');
});

test('decide: new task from idle routes to planning', () => {
  const d = decide({ userText: 'Implement OAuth authentication', workflow: createWorkflow() });
  assert.equal(d.state, 'planning');
  assert.equal(d.skill, 'plan');
  assert.equal(d.event, 'new_task');
  assert.equal(d.goal, 'Implement OAuth authentication');
});

test('read-only questions, audits, reviews, investigations, and reports do not start tasks', () => {
  for (const userText of [
    'What does the OAuth endpoint do?',
    'Review the authentication flow',
    'Audit the API tests',
    'Inspect the login behavior',
    'Investigate why login fails',
    'Report what the current integration does',
    'How do I add a login method?',
    'Should we update the documentation?',
    'Can you update me on the task status?',
    'Update me on the task status',
    'Review the task and update me on the task status',
    'I need an update on the task status',
    'Guarana never uses memory without an explicit command',
    'What does guarana:code do?',
    'Como funciona o endpoint OAuth?',
    'Como seria implementar uma fila local?',
    'O que faz a integração atual?',
    'Você pode me explicar como implementar PKCE?',
    'Pode me explicar como implementar PKCE?',
    'Me ajuda a entender como atualizar o README?',
    'Quais mudanças são necessárias para corrigir o login?',
    'Me diga como atualizar o README',
    'Revise o fluxo de autenticação',
    'Por que o teste falha?',
  ]) {
    const d = decide({ userText, workflow: createWorkflow() });
    assert.equal(d.event, null, userText);
    assert.equal(d.state, 'idle', userText);

    const active = decide({ userText, workflow: toVerifying() });
    assert.notEqual(active.event, 'new_task', userText);
    assert.equal(active.state, 'verifying', userText);
  }
});

test('exact Portuguese interrogative questions stay read-only from idle and active workflows', () => {
  for (const userText of [
    'Qual é a melhor forma de corrigir o login?',
    'Por quê devo implementar PKCE?',
  ]) {
    const idle = createWorkflow();
    const idleDecision = decide({ userText, workflow: idle });
    assert.equal(idleDecision.event, null, userText);
    assert.equal(idleDecision.state, 'idle', userText);
    assert.deepEqual(idle, createWorkflow(), userText);

    const active = toVerifying();
    const activeBefore = structuredClone(active);
    const activeDecision = decide({ userText, workflow: active });
    assert.equal(activeDecision.event, null, userText);
    assert.equal(activeDecision.state, 'verifying', userText);
    assert.deepEqual(active, activeBefore, userText);
  }
});

test('clear mutation requests and explicit skill commands still enter workflow', () => {
  const mutation = decide({ userText: 'Fix the OAuth login flow', workflow: createWorkflow() });
  assert.equal(mutation.event, 'new_task');
  assert.equal(mutation.skill, 'plan');

  const documentation = decide({ userText: 'Write a README for the OAuth integration', workflow: createWorkflow() });
  assert.equal(documentation.event, 'new_task');
  assert.equal(documentation.skill, 'plan');

  for (const userText of [
    'Implemente a autenticação OAuth',
    'Crie um teste para o endpoint',
    'Atualize o README do projeto',
    'Corrija o fluxo de login',
    'Desenvolva um relatório de status',
    'Escreva um teste de integração',
  ]) {
    const portugueseMutation = decide({ userText, workflow: createWorkflow() });
    assert.equal(portugueseMutation.event, 'new_task', userText);
    assert.equal(portugueseMutation.skill, 'plan', userText);
  }

  const politeMutation = decide({ userText: 'Can you add a validation test?', workflow: createWorkflow() });
  assert.equal(politeMutation.event, 'new_task');

  for (const userText of [
    'Can you update the README?',
    'Update the project docs',
    'Can you update the config file?',
    'I need an update to the configuration file',
  ]) {
    const targetedMutation = decide({ userText, workflow: createWorkflow() });
    assert.equal(targetedMutation.event, 'new_task', userText);
    assert.equal(targetedMutation.skill, 'plan', userText);
  }

  const politeWrite = decide({ userText: 'Can you write a README?', workflow: createWorkflow() });
  assert.equal(politeWrite.event, 'new_task');

  const compoundMutation = decide({ userText: 'Review the login flow and fix the missing route', workflow: createWorkflow() });
  assert.equal(compoundMutation.event, 'new_task');

  const forced = decide({ userText: 'guarana:code implement the OAuth flow', workflow: createWorkflow() });
  assert.equal(forced.event, 'force');
  assert.equal(forced.skill, 'code');
  assert.equal(forced.goal, 'implement the OAuth flow');

  const forcedPortuguese = decide({ userText: 'guarana:verify confira o fluxo', workflow: createWorkflow() });
  assert.equal(forcedPortuguese.event, 'force');
  assert.equal(forcedPortuguese.skill, 'verify');
  assert.equal(forcedPortuguese.state, 'verifying');
});

test('automatic specs bootstrap uses a generic spec path and is idempotent', () => {
  const dir = tmp();
  const request = 'Implement OAuth authentication';
  const first = ensureSpecs(dir, request, 0);
  const second = ensureSpecs(dir, request, 1);
  const conventionsFile = path.join(dir, '.specs', 'conventions.md');
  assert.equal(taskSlug('Implement OAuth authentication'), 'implement-oauth-authentication');
  assert.equal(first.created.length, 4);
  assert.ok(first.created.includes(conventionsFile));
  assert.equal(second.created.length, 0);
  const conventions = fs.readFileSync(conventionsFile, 'utf8');
  assert.match(conventions, /stable, concise lowercase kebab-case names/i);
  assert.match(conventions, /search for an existing record with the same scope/i);
  assert.match(conventions, /features\/<category>/);
  assert.match(conventions, /decisions\/ADR-NNN-/);
  assert.match(conventions, /changes\/YYYY-MM-DD-/);
  assert.match(conventions, /\.specs\/state/);
  assert.match(conventions, /audits\//);
  assert.match(conventions, /Fixed docs and indexes/);
  assert.match(conventions, /Never rename, move, migrate, or normalize/);
  assert.doesNotMatch(conventions, /guarana|version|namespace/i);
  assert.equal(first.featureFile, path.join(dir, '.specs', 'features', 'initial-task', 'initial-task.md'));
  assert.doesNotMatch(first.featureFile, /implement-oauth-authentication/);
  assert.ok(fs.existsSync(first.featureFile));
  const spec = fs.readFileSync(first.featureFile, 'utf8');
  assert.match(spec, /## Planning required/);
  assert.match(spec, /## Request context\nImplement OAuth authentication/);
  assert.doesNotMatch(spec, /^# Feature spec: Implement OAuth authentication/m);
});

test('automatic specs bootstrap preserves custom conventions bytes', () => {
  const dir = tmp();
  const conventionsFile = path.join(dir, '.specs', 'conventions.md');
  const customBytes = Buffer.from('# My rules\r\ncustom \u2603\n', 'utf8');
  fs.mkdirSync(path.dirname(conventionsFile), { recursive: true });
  fs.writeFileSync(conventionsFile, customBytes);

  const result = ensureSpecs(dir, 'Implement OAuth authentication', 0);

  assert.deepEqual(fs.readFileSync(conventionsFile), customBytes);
  assert.ok(!result.created.includes(conventionsFile));
});

test('fresh automatic specs bootstrap passes the shipped specs validator', () => {
  const dir = tmp();
  ensureSpecs(dir, 'Implement OAuth authentication', 0);
  const bin = path.resolve('bin/guarana.js');
  const result = spawnSync(process.execPath, [bin, 'specs', 'validate', dir, '--json'], {
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(JSON.parse(result.stdout).ok, true);
});

test('automatic specs bootstrap preserves multiline task Markdown', () => {
  const dir = tmp();
  const task = '# Big goal\n\n## Details\n\n- first step';
  const result = ensureSpecs(dir, task, 0);
  const read = (file) => fs.readFileSync(path.join(dir, '.specs', file), 'utf8');

  assert.match(read('README.md'), /\*\*NEXT:\*\* Interpret the incoming request/);
  assert.match(read('state/project-state.md'), /- Request context: # Big goal\n\n## Details/);
  assert.match(fs.readFileSync(result.featureFile, 'utf8'), /## Request context\n# Big goal\n\n## Details/);
});

test('decide: explicit guarana:code forces coding', () => {
  const d = decide({ userText: 'guarana:code', workflow: createWorkflow() });
  assert.equal(d.state, 'coding');
  assert.equal(d.skill, 'code');
  assert.equal(d.event, 'force');
});

test('decide: continuation of active workflow does not re-plan', () => {
  let w = toVerifying();
  const d = decide({ userText: 'hmm wait', workflow: w });
  assert.equal(d.event, null);
  assert.equal(d.state, 'verifying');

  const question = decide({ userText: 'How do I add a new login step?', workflow: w });
  assert.equal(question.event, null);
  assert.equal(question.state, 'verifying');
});

test('decide: natural completion of coding advances to verifying', () => {
  let w = createWorkflow();
  for (const e of ['new_task', 'plan_complete', 'run_start']) w = apply(w, e, { activeTask: 't' });
  const d = decide({ userText: 'done, implemented', workflow: w });
  assert.equal(d.event, 'code_complete');
  assert.equal(d.state, 'verifying');
});

test('decide: verify failure signal routes to debugging', () => {
  let w = createWorkflow();
  for (const e of ['new_task', 'plan_complete', 'run_start', 'code_complete']) w = apply(w, e, { activeTask: 't' });
  const d = decide({ userText: 'the test failed', workflow: w });
  assert.equal(d.event, 'verify_fail');
  assert.equal(d.state, 'debugging');
});

test('decide: previous tool result failure auto-routes verifying -> debugging', () => {
  let w = createWorkflow();
  for (const e of ['new_task', 'plan_complete', 'run_start', 'code_complete']) w = apply(w, e, { activeTask: 't' });
  const d = decide({ userText: '', workflow: w, lastResult: { error: 'assert failed' } });
  assert.equal(d.event, 'verify_fail');
  assert.equal(d.state, 'debugging');
});

test('resultFailed detects errors', () => {
  assert.ok(resultFailed({ error: 'boom' }));
  assert.ok(resultFailed('Error: exit code 1'));
  assert.ok(resultFailed('not ok 1 - rejects invalid input'));
  assert.ok(resultFailed('{"error":"boom"}'));
  assert.ok(!resultFailed('+ Failed checks lead to debugging'));
  assert.ok(!resultFailed('The report explains why a test failed.'));
  assert.ok(!resultFailed(''));
  assert.ok(!resultFailed({ output: 'all good' }));
  assert.ok(!resultFailed({ output: '' }));
  assert.ok(!resultFailed(null));
});

test('idle + non-task text stays idle', () => {
  const d = decide({ userText: 'hello', workflow: createWorkflow() });
  assert.equal(d.state, 'idle');
  assert.equal(d.skill, null);
});

test('system block is always-on and names the skill', () => {
  let w = apply(createWorkflow(), 'new_task');
  const block = buildSystemBlock(w);
  assert.match(block, /Guarana workflow/);
  assert.match(block, /Current state: \*\*planning\*\*/);
  assert.match(block, /guarana:plan/);
  assert.match(block, /Plan only explicit `guarana:<skill>` commands or clear product\/doc\/config changes/i);
  assert.match(block, /read-only\/info requests create no task spec or tracker\/project-state writes/i);
  assert.match(block, /Primary owns requirements, acceptance, transitions, and verification/i);
  assert.match(block, /workers use isolated native Task contexts and never call `workflow_tick`/i);
  assert.match(block, /Use `worker-debug` only for actionable confirmed failures/i);
  assert.match(block, /Dispatch `worker-specs` only for durable human-readable record changes/i);
  assert.match(block, /Stage\/budget\/current-step data stays in workflow JSON/i);
  assert.match(block, /Follow `guarana:plan` for discovery, worker ownership, records, ADRs, and known-issue policy/i);

  for (const preferences of [undefined, { verify: { enabled: false } }]) {
    let current = apply(createWorkflow(), 'new_task');
    for (const event of [null, 'plan_complete', 'run_start', 'code_complete', 'verify_fail', 'debug_complete', 'verify_pass']) {
      if (event) current = apply(current, event);
      const currentBlock = buildSystemBlock(current, preferences);
      assert.ok(currentBlock.length < 2000, `always-on block unexpectedly long: ${currentBlock.length} chars`);
    }
  }
});

test('planning injection asks about consequential unknowns before code dispatch', () => {
  const workflow = apply(createWorkflow(), 'new_task', { goal: 'Build a multi-surface product' });
  const injection = buildInjection(workflow);
  assert.match(injection, /Requirements discovery gate/);
  assert.match(injection, /Do not dispatch worker-code or begin implementation while a critical unknown/i);
  assert.match(injection, /up to five per\s+round/i);
  assert.match(injection, /acceptance condition/i);
  assert.match(injection, /System-of-record writes/i);
  assert.match(injection, /Informational questions, audits, reviews,[\s\S]*create no task spec, tracker, or project-state entry/i);
  assert.match(injection, /Dispatch\s+it only when a human-readable record will materially change/i);
  assert.match(injection, /Do not dispatch for every[\s\S]*workflow\/run state/i);
  assert.match(injection, /only after a human-readable record write/i);
});

test('resolveSkillBody returns the plan SKILL.md body', () => {
  const body = resolveSkillBody('plan');
  assert.ok(body.length > 0);
  assert.match(body, /# guarana:plan/);
});

test('recording policies limit ADRs and known issues to durable actionable cases', () => {
  const readSkill = (name) => fs.readFileSync(path.resolve(`skills/guarana/skills/${name}/SKILL.md`), 'utf8');
  const plan = readSkill('plan');
  const remember = readSkill('remember');
  const debug = readSkill('debug');
  const measure = readSkill('measure');
  const specs = readSkill('specs');
  const failures = fs.readFileSync(path.resolve('docs/reference/failure-modes.md'), 'utf8');

  assert.match(plan, /durable architectural, contract, data, security, privacy,\s+or integration decision/i);
  assert.match(plan, /material alternatives/i);
  assert.match(plan, /tactical implementation\s+choices do not need ADRs/i);
  assert.match(plan, /Evidence\/source map/);
  assert.match(plan, /authoritative source, supported alternative source[\s\S]*access\/scope limit/i);
  assert.match(plan, /Search feasible supported sources before asking/);
  assert.match(plan, /routine authorized safe steps do not need user approval/i);
  const verify = readSkill('verify');
  assert.match(verify, /bounded searches of supported authoritative and alternative sources/i);
  assert.match(verify, /`not checked`, `unavailable in this context`, `contradictory`, or `absent`/);
  assert.match(verify, /A null\/empty result from a scoped query does not establish absence/i);
  assert.match(verify, /Continue independent checks/i);
  assert.match(verify, /Missing proof remains FAIL/i);
  const build = readSkill('build');
  assert.match(build, /continue independent safe work/i);
  assert.match(build, /Do not repeat an identical denied request/i);
  assert.match(build, /smallest ordinary checks that map to the changed acceptance criteria/i);
  assert.match(build, /no\s+smoke tests or elaborate\/full E2E by default/i);
  const code = readSkill('code');
  assert.match(code, /smallest ordinary checks mapped to changed acceptance criteria/i);
  assert.match(code, /Do not run smoke tests/i);
  assert.match(remember, /record task start\/end and material blockers or status changes in\s+`state\/project-state\.md`/i);
  assert.match(remember, /checkpoint[\s\S]*operational workflow\/run state/i);
  assert.match(remember, /actual build run/i);
  assert.match(debug, /confirmed,\s+reproducible\s+product failure/i);
  assert.match(debug, /durable mitigation/i);
  assert.match(debug, /tool\/verifier scope errors/i);
  assert.match(debug, /transient\s+permission\/environment failures/i);
  assert.match(measure, /`error` share.*investigate/i);
  assert.match(measure, /aggregate rate alone is\s+not a known issue/i);
  assert.match(failures, /confirmed, reproducible product failure/i);
  assert.match(failures, /tool\/verifier scope errors/i);
  assert.match(specs, /dispatched only when a durable human-readable `.specs` record will\s+change/i);
  assert.match(specs, /material\s+alternatives/i);
  assert.match(specs, /confirmed\s+reproducible\s+product failure/i);
});

test('completionAction maps states to tick actions', () => {
  assert.equal(completionAction('planning'), 'start_task');
  assert.equal(completionAction('coding'), 'code_complete');
  assert.equal(completionAction('verifying'), 'verify_pass|verify_fail');
  assert.equal(completionAction('verifying', { verify: { enabled: false } }), 'verify_skip');
  assert.equal(completionAction('debugging'), 'debug_complete');
  assert.equal(completionAction('idle'), null);
});

test('injection includes the active skill full body (ponytail mechanism)', () => {
  let w = apply(createWorkflow(), 'new_task');
  const inj = buildInjection(w);
  assert.match(inj, /Guarana workflow/);
  assert.match(inj, /guarana:plan \(injected\)/);
  assert.match(inj, /# guarana:plan/);
  assert.match(inj, /action `start_task`/);
});

test('coding, verification, and debugging delegate to native Task workers without injecting worker bodies in the parent', () => {
  let workflow = createWorkflow();
  for (const event of ['new_task', 'plan_complete', 'run_start']) workflow = apply(workflow, event);
  const codeInjection = buildInjection(workflow);
  assert.match(codeInjection, /Call `worker-code` in native Task with exact condition, budget, and state pointers/);
  assert.match(codeInjection, /inspect its diff\/stop reason/);
  assert.doesNotMatch(codeInjection, /guarana:code \(injected\)/);
  assert.match(codeInjection, /workers use isolated native Task contexts and never call `workflow_tick`/i);

  workflow = apply(workflow, 'code_complete');
  const verifyInjection = buildInjection(workflow);
  assert.match(verifyInjection, /In a fresh native Task, call `worker-verify`/);
  assert.match(verifyInjection, /criterion verdict\/proofs/);
  assert.doesNotMatch(verifyInjection, /guarana:verify \(injected\)/);

  workflow = apply(workflow, 'verify_fail');
  const debugInjection = buildInjection(workflow);
  assert.match(debugInjection, /After a confirmed failure, call `worker-debug` in native Task/);
  assert.doesNotMatch(debugInjection, /guarana:debug \(injected\)/);

  const blocked = buildSystemBlock(workflow);
  assert.match(blocked, /if Task is unavailable\/denied, report the blocker and stop/i);
});

test('automatic context omits supplied project memory', () => {
  const w = apply(createWorkflow(), 'new_task', { goal: 'OAuth' });
  const inj = buildInjection(w, {
    memoryContext: {
      count: 1,
      global_preferences: [],
      project_context: [{ id: 'mem-pkce', type: 'decision', scope: 'project', summary: 'Use PKCE' }],
    },
  });
  assert.doesNotMatch(inj, /guarana memory \(automatic context\)/);
  assert.doesNotMatch(inj, /Use PKCE/);
});

test('injection for completed state has no skill body', () => {
  let w = createWorkflow();
  for (const e of ['new_task', 'plan_complete', 'run_start', 'code_complete', 'verify_pass']) w = apply(w, e);
  const inj = buildInjection(w);
  assert.match(inj, /Guarana workflow/);
  assert.doesNotMatch(inj, /\(injected\)/);
});
