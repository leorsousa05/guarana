import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  STATES, STATE_SKILL, isState, isEvent, skillForState, stateForSkill,
  canTransition, apply, createWorkflow, load, save, workflowFile,
} from './state.js';
import { decide, resultFailed } from './decide.js';
import { buildSystemBlock, buildInjection, resolveSkillBody, completionAction } from './prompt.js';
import { ensureSpecs, taskSlug } from './specs.js';

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
  assert.ok(!canTransition('plan_complete', 'idle'));
  assert.ok(canTransition('run_start', 'building'));
  assert.ok(canTransition('code_complete', 'coding'));
  assert.ok(canTransition('verify_pass', 'verifying'));
  assert.ok(canTransition('verify_fail', 'verifying'));
  assert.ok(!canTransition('verify_pass', 'coding'));
  assert.ok(canTransition('fix_start', 'debugging'));
  assert.ok(canTransition('debug_complete', 'debugging'));
  assert.ok(canTransition('abort', 'coding'));
  assert.ok(canTransition('force', 'coding'));
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

test('verification failure routes to debugging, then back to verification', () => {
  let w = toVerifying();
  assert.equal(w.state, 'verifying');
  w = apply(w, 'verify_fail');
  assert.equal(w.state, 'debugging');
  assert.equal(w.skill, 'debug');
  w = apply(w, 'debug_complete');
  assert.equal(w.state, 'verifying');
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
  w = apply(w, 'force', { skill: 'code' });
  assert.equal(w.state, 'coding');
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

test('decide: problem report from idle routes to planning', () => {
  const d = decide({
    userText: 'Guarana never uses memory without an explicit command',
    workflow: createWorkflow(),
  });
  assert.equal(d.event, 'new_task');
  assert.equal(d.skill, 'plan');
});

test('automatic specs bootstrap is idempotent and task-specific', () => {
  const dir = tmp();
  const first = ensureSpecs(dir, 'Implement OAuth authentication', 0);
  const second = ensureSpecs(dir, 'Implement OAuth authentication', 1);
  assert.equal(taskSlug('Implement OAuth authentication'), 'implement-oauth-authentication');
  assert.equal(first.created.length, 3);
  assert.equal(second.created.length, 0);
  assert.ok(fs.existsSync(first.featureFile));
  assert.match(fs.readFileSync(first.featureFile, 'utf8'), /Implement OAuth authentication/);
});

test('automatic specs bootstrap preserves multiline task Markdown', () => {
  const dir = tmp();
  const task = '# Big goal\n\n## Details\n\n- first step';
  const result = ensureSpecs(dir, task, 0);
  const read = (file) => fs.readFileSync(path.join(dir, '.specs', file), 'utf8');

  assert.match(read('README.md'), /\*\*NEXT:\*\* # Big goal\n\n## Details/);
  assert.match(read('state/project-state.md'), /- Goal: # Big goal\n\n## Details/);
  assert.match(fs.readFileSync(result.featureFile, 'utf8'), /## Goal\n# Big goal\n\n## Details/);
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
  assert.ok(!resultFailed({ output: 'all good' }));
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
});

test('resolveSkillBody returns the plan SKILL.md body', () => {
  const body = resolveSkillBody('plan');
  assert.ok(body.length > 0);
  assert.match(body, /# guarana:plan/);
});

test('completionAction maps states to tick actions', () => {
  assert.equal(completionAction('planning'), 'plan_complete');
  assert.equal(completionAction('coding'), 'code_complete');
  assert.equal(completionAction('verifying'), 'verify_pass|verify_fail');
  assert.equal(completionAction('debugging'), 'debug_complete');
  assert.equal(completionAction('idle'), null);
});

test('injection includes the active skill full body (ponytail mechanism)', () => {
  let w = apply(createWorkflow(), 'new_task');
  const inj = buildInjection(w);
  assert.match(inj, /Guarana workflow/);
  assert.match(inj, /guarana:plan \(injected\)/);
  assert.match(inj, /# guarana:plan/);
  assert.match(inj, /plan_complete/);
});

test('injection includes automatic memory context when supplied', () => {
  const w = apply(createWorkflow(), 'new_task', { goal: 'OAuth' });
  const inj = buildInjection(w, {
    memoryContext: { count: 1, decisions: [{ summary: 'Use PKCE' }] },
  });
  assert.match(inj, /guarana memory \(automatic context\)/);
  assert.match(inj, /Use PKCE/);
});

test('injection for completed state has no skill body', () => {
  let w = createWorkflow();
  for (const e of ['new_task', 'plan_complete', 'run_start', 'code_complete', 'verify_pass']) w = apply(w, e);
  const inj = buildInjection(w);
  assert.match(inj, /Guarana workflow/);
  assert.doesNotMatch(inj, /\(injected\)/);
});
