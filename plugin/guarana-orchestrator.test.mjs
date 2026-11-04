import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import OrchestratorPlugin, { GuaranaOrchestrator, consumeEventStreamWithReconnect } from './guarana-orchestrator.js';
import { GuaranaOrchestrator as BundledOrchestrator } from '../cli/plugin/guarana-orchestrator.js';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { apply, createWorkflow, load, save, workflowFile } from '../orchestrator/state.js';
import {
  createRunManifest as makeRunManifest, integrateCodeSubtask, recordCodeWorktree, transitionSubtask,
} from '../orchestrator/parallel.js';
import { runManifestFile, saveRunManifest } from '../orchestrator/parallel-store.js';
import { createNode, createEdge, listNodes } from '../memory/graph.js';
import { initUserVault, initVault, paths } from '../memory/vault.js';
import { GuaranaMemory } from './guarana-memory.js';
import { serializeMemoryPayload } from '../orchestrator/prompt.js';

describe('GuaranaOrchestrator', () => {
  let tmpDir;
  let eventsFile;
  let api;
  let oldHome;
  let oldXdg;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-orch-plugin-'));
    oldHome = process.env.HOME;
    oldXdg = process.env.XDG_CONFIG_HOME;
    process.env.HOME = path.join(tmpDir, 'home');
    process.env.XDG_CONFIG_HOME = path.join(tmpDir, 'xdg');
    api = await GuaranaOrchestrator({ directory: tmpDir });
    eventsFile = path.join(tmpDir, '.specs', 'state', 'telemetry', 'events.jsonl');
  });

  afterEach(() => {
    if (oldHome === undefined) delete process.env.HOME;
    else process.env.HOME = oldHome;
    if (oldXdg === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = oldXdg;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function readEvents() {
    try {
      return fs.readFileSync(eventsFile, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
    } catch {
      return [];
    }
  }

  function workflow() {
    return load(tmpDir);
  }

  function primaryContext() {
    return { sessionID: 'workflow-tick-primary-test', agent: 'guarana' };
  }

  function parts(text) {
    return [{ type: 'text', text }];
  }

  function preferencePayloadFrom(injection) {
    const marker = '### Serialized records (JSON data)\n';
    const start = injection.indexOf(marker);
    assert.notEqual(start, -1, 'serialized memory section should exist');
    const from = start + marker.length;
    const end = injection.indexOf('\n<!-- end guarana memory -->', from);
    assert.notEqual(end, -1, 'memory section should close');
    const compact = JSON.parse(injection.slice(from, end));
    const fields = [
      'id', 'type', 'scope', 'category', 'priority', 'intent', 'summary', 'tags', 'rejectedAlternatives',
    ];
    assert.deepEqual(compact.fields, fields);
  return Object.fromEntries([
      'project_preferences', 'global_preferences', 'related_global_preferences', 'superseded_global_preferences',
    ].map((group) => [group, compact[group].map((values) => Object.fromEntries(fields.flatMap((field, index) =>
      values[index] === null ? [] : [[field, values[index]]])))]));
  }

  function writeSettings(scope, settings) {
    const file = scope === 'project'
      ? path.join(tmpDir, '.guarana', 'advisor.json')
      : path.join(process.env.XDG_CONFIG_HOME, 'guarana', 'advisor.json');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(settings));
  }

  function writeWorkflowSettings(scope, settings, directory = tmpDir) {
    const file = scope === 'project'
      ? path.join(directory, '.guarana', 'workflow.json')
      : path.join(process.env.XDG_CONFIG_HOME, 'guarana', 'workflow.json');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(settings));
    return file;
  }

  function assertNoHumanReadableSpecs(directory, context = 'workflow entry') {
    for (const relative of [
      'README.md',
      'state/project-state.md',
      'conventions.md',
      'features/initial-task/initial-task.md',
    ]) {
      assert.equal(
        fs.existsSync(path.join(directory, '.specs', relative)),
        false,
        `${context} must not create ${relative}`,
      );
    }
  }

  function allowPreferenceInjection(scope = 'global', tokens = 100000, directory = tmpDir) {
    return writeWorkflowSettings(scope, {
      memory: { preferenceInjectionBudgetTokens: tokens },
    }, directory);
  }

  function writePrimaryProfile(scope) {
    const file = scope === 'project'
      ? path.join(tmpDir, '.opencode', 'agents', 'guarana.md')
      : path.join(process.env.XDG_CONFIG_HOME, 'opencode', 'agents', 'guarana.md');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '<!-- guarana-managed-advisor-artifact -->');
  }

  function gitAt(directory, ...args) {
    return execFileSync('git', ['-C', directory, ...args], { encoding: 'utf8' }).trim();
  }

  function initGitRepo(directory) {
    fs.mkdirSync(directory, { recursive: true });
    gitAt(directory, 'init', '-q');
    gitAt(directory, 'config', 'user.email', 'parallel-tests@example.invalid');
    gitAt(directory, 'config', 'user.name', 'Parallel Test');
    fs.writeFileSync(path.join(directory, 'README.md'), 'fixture\n');
    gitAt(directory, 'add', 'README.md');
    gitAt(directory, 'commit', '-q', '-m', 'fixture base');
    return gitAt(directory, 'rev-parse', 'HEAD');
  }

  function addGitWorktree(repository, directory) {
    fs.mkdirSync(path.dirname(directory), { recursive: true });
    gitAt(repository, 'worktree', 'add', '-q', '--detach', directory, 'HEAD');
  }

  function setCodingWorkflow(directory, timestamp = 1700000000000) {
    let current = createWorkflow();
    for (const [index, event] of ['new_task', 'plan_complete', 'run_start'].entries()) {
      current = apply(current, event, {
        goal: 'Parallel lifecycle workflow',
        condition: 'Parallel lifecycle condition',
        activeTask: 'Parallel lifecycle workflow',
        ts: timestamp - 2 + index,
      });
      assert.ok(current, `${event} transition should be legal`);
    }
    assert.ok(save(directory, current));
    return { workflow: current, runId: `workflow-${timestamp}` };
  }

  async function parallelCall(hooks, name, args, context = primaryContext()) {
    return JSON.parse(await hooks.tool[name].execute(args, context));
  }

  it('canonical and bundled plugins leave conflicting session model/variant selections untouched', async () => {
    writeSettings('global', { primary: { provider: 'openai', model: 'gpt-6-luna', variant: 'xhigh' } });
    writeSettings('project', { primary: { variant: 'low' } });
    writePrimaryProfile('project');
    for (const plugin of [GuaranaOrchestrator, BundledOrchestrator]) {
      const hooks = await plugin({ directory: tmpDir });
      assert.equal(Object.hasOwn(hooks, 'chat.params'), false);
      for (const id of ['gpt-6-luna', 'session-selected-model']) {
        const input = {
          sessionID: `session-${plugin === GuaranaOrchestrator ? 'canonical' : 'bundled'}-${id}`,
          messageID: 'session-selection', agent: 'guarana', variant: 'xhigh',
          model: { providerID: 'openai', id, variants: { low: { reasoningEffort: 'low' }, xhigh: { reasoningEffort: 'xhigh' } } },
        };
        const output = {
          message: { id: input.messageID, agent: 'guarana', model: { providerID: 'openai', modelID: id, variant: 'xhigh' } },
          parts: parts('Implement session-selected work'),
          options: { reasoningEffort: 'xhigh', temperature: 0.4 },
        };
        const originalInput = structuredClone(input);
        const originalOutput = structuredClone(output);
        await hooks['chat.message'](input, output);
        assert.deepEqual(input, originalInput);
        assert.deepEqual(output, originalOutput);
      }
    }
  });

  it('defaults to Guarana for configured managed Primary profiles in either scope, without leaking settings', async () => {
    for (const scope of ['project', 'global']) {
      writeSettings(scope, { primary: { provider: 'private-provider', model: 'private-model' } });
      writePrimaryProfile(scope);
      const cfg = {};
      await api.config(cfg);
      assert.equal(cfg.default_agent, 'guarana');
    }
  });

  it('uses project-over-global Primary settings and preserves explicit custom defaults', async () => {
    writeSettings('global', { primary: { provider: 'global', model: 'global-model' } });
    writeSettings('project', { primary: { provider: 'project', model: 'project-model' } });
    writePrimaryProfile('project');
    const cfg = { default_agent: 'build' };
    await api.config(cfg);
    assert.equal(cfg.default_agent, 'guarana');
    const custom = { default_agent: 'my-agent' };
    await api.config(custom);
    assert.equal(custom.default_agent, 'my-agent');
  });

  it('leaves default unchanged when Primary configuration or managed profile is missing', async () => {
    const cfg = {};
    await api.config(cfg);
    assert.deepEqual(cfg, {});
    writeSettings('project', { primary: { provider: 'provider', model: 'model' } });
    await api.config(cfg);
    assert.deepEqual(cfg, {});
    writeSettings('project', { primary: { provider: 'provider', model: 'model' } });
    writePrimaryProfile('project');
    const missingModel = { default_agent: 'build' };
    writeSettings('project', { primary: { provider: 'provider' } });
    await api.config(missingModel);
    assert.equal(missingModel.default_agent, 'build');
  });

  async function chat(text) {
    await api['chat.message']({ sessionID: 's1' }, { parts: parts(text) });
  }

  it('exposes workflow_get and workflow_tick tools', () => {
    assert.ok(api.tool.workflow_get);
    assert.ok(api.tool.workflow_tick);
  });

  it('workflow_tick rejects missing caller identity and recognized workers without changing the workflow file', async () => {
    for (const [plugin, directory] of [
      [api, tmpDir],
      [await BundledOrchestrator({ directory: path.join(tmpDir, 'bundled') }), path.join(tmpDir, 'bundled')],
    ]) {
      const planned = apply(createWorkflow(), 'new_task', { goal: 'Identity guard test' });
      assert.ok(save(directory, planned));
      const file = workflowFile(directory);
      const before = fs.readFileSync(file);

      for (const context of [
        undefined,
        { agent: 'guarana' },
        { sessionID: 'primary-session' },
        { sessionID: '', agent: 'guarana' },
        { sessionID: 'primary-session', agent: '' },
      ]) {
        const rejected = JSON.parse(await plugin.tool.workflow_tick.execute({ action: 'plan_complete' }, context));
        assert.equal(rejected.ok, false);
        assert.match(rejected.error, /requires nonempty sessionID and agent caller identity/i);
        assert.deepEqual(fs.readFileSync(file), before);
      }

      const worker = JSON.parse(await plugin.tool.workflow_tick.execute(
        { action: 'plan_complete' }, { sessionID: 'worker-code-guard', agent: 'worker-code' },
      ));
      assert.equal(worker.ok, false);
      assert.equal(worker.error, 'Task workers cannot advance the parent workflow; return the worker contract to the primary context.');
      assert.deepEqual(fs.readFileSync(file), before);
    }
  });

  it('workflow_tick start_task requires a completed plan and persists kickoff without scaffolding specs', async () => {
    const tool = api.tool.workflow_tick;
    assert.ok(tool.args.action.enum.includes('start_task'));
    assert.match(tool.args.goal.description, /required and nonempty for start_task/i);
    assert.match(tool.args.condition.description, /required and nonempty for start_task/i);
    assert.match(tool.description, /only after guarana:plan discovery is closed and any required worker-specs record write is reported/i);
    assert.match(tool.description, /explicit nonempty goal and condition/i);
    assert.match(tool.description, /Do not skip planning or ask the user to accept a shortcut/i);

    const planned = apply(createWorkflow(), 'new_task', { goal: 'Initial planning goal' });
    assert.ok(save(tmpDir, planned));
    const before = fs.readFileSync(workflowFile(tmpDir));

    const missingCondition = JSON.parse(await tool.execute({ action: 'start_task', goal: 'Explicit goal' }, primaryContext()));
    assert.equal(missingCondition.ok, false);
    assert.match(missingCondition.error, /requires explicit nonempty goal and condition/i);
    assert.deepEqual(fs.readFileSync(workflowFile(tmpDir)), before);
    assert.deepEqual(readEvents().filter((event) => event.type === 'workflow'), []);

    const missingGoal = JSON.parse(await tool.execute({ action: 'start_task', condition: 'Explicit condition' }, primaryContext()));
    assert.equal(missingGoal.ok, false);
    assert.deepEqual(fs.readFileSync(workflowFile(tmpDir)), before);

    const idleDir = path.join(tmpDir, 'illegal-kickoff');
    const idleHooks = await GuaranaOrchestrator({ directory: idleDir });
    const illegal = JSON.parse(await idleHooks.tool.workflow_tick.execute({
      action: 'start_task', goal: 'goal', condition: 'condition',
    }, primaryContext()));
    assert.equal(illegal.ok, false);
    assert.match(illegal.error, /illegal transition start_task from idle/i);
    assert.equal(fs.existsSync(workflowFile(idleDir)), false);

    const planningPrompt = { system: [] };
    await api['experimental.chat.system.transform']({ sessionID: 'atomic-kickoff-planning' }, planningPrompt);
    assert.match(planningPrompt.system.join('\n'), /Use `workflow_tick` action `start_task` only after `guarana:plan` discovery is closed/);
    assert.match(planningPrompt.system.join('\n'), /Do not ask the user to accept a shortcut/);

    const started = JSON.parse(await tool.execute({
      action: 'start_task',
      goal: 'Explicit atomic-kickoff goal',
      condition: 'Reach coding with all three ordered history entries',
    }, primaryContext()));
    assert.equal(started.ok, true);
    assert.equal(started.state, 'coding');
    const persisted = workflow();
    assert.equal(persisted.state, 'coding');
    assert.equal(persisted.goal, 'Explicit atomic-kickoff goal');
    assert.equal(persisted.condition, 'Reach coding with all three ordered history entries');
    assert.deepEqual(persisted.history.slice(-3).map(({ event, from, to }) => ({ event, from, to })), [
      { event: 'new_task', from: 'planning', to: 'planning' },
      { event: 'plan_complete', from: 'planning', to: 'building' },
      { event: 'run_start', from: 'building', to: 'coding' },
    ]);
    const workflowEvents = readEvents().filter((event) => event.type === 'workflow');
    assert.deepEqual(workflowEvents.map(({ event, from, to, skill }) => ({ event, from, to, skill })), [
      { event: 'new_task', from: 'planning', to: 'planning', skill: 'plan' },
      { event: 'plan_complete', from: 'planning', to: 'building', skill: 'build' },
      { event: 'run_start', from: 'building', to: 'coding', skill: 'code' },
    ]);
    assert.equal(fs.existsSync(path.join(tmpDir, '.specs', 'README.md')), false,
      'start_task must not create a generic tracker after planning');
  });

  it('chat.message with a new task routes to planning and persists', async () => {
    await chat('Implement OAuth authentication');
    const wf = workflow();
    assert.equal(wf.state, 'planning');
    assert.equal(wf.skill, 'plan');
    assert.equal(wf.goal, 'Implement OAuth authentication');
    assert.equal(wf.activeTask, 'Implement OAuth authentication');
    assert.equal(wf.history.length, 1);
    const evs = readEvents().filter((e) => e.type === 'workflow');
    assert.equal(evs.length, 1);
    assert.equal(evs[0].event, 'new_task');
  });

  it('plugin startup and task-entry paths never scaffold human-readable specs', async () => {
    for (const [pluginIndex, plugin] of [GuaranaOrchestrator, BundledOrchestrator].entries()) {
      const entries = [
        {
          name: 'chat-new-task',
          run: (hooks, id) => hooks['chat.message'](
            { sessionID: id }, { parts: parts('Implement a fresh task') },
          ),
        },
        {
          name: 'chat-force',
          run: (hooks, id) => hooks['chat.message'](
            { sessionID: id }, { parts: parts('guarana:plan Implement a forced task') },
          ),
        },
        {
          name: 'tick-new-task',
          run: (hooks, id) => hooks.tool.workflow_tick.execute(
            { action: 'new_task', goal: 'Tick task' }, { sessionID: id, agent: 'guarana' },
          ),
        },
        {
          name: 'tick-force',
          run: (hooks, id) => hooks.tool.workflow_tick.execute(
            { action: 'force', skill: 'plan', goal: 'Forced tick task' }, { sessionID: id, agent: 'guarana' },
          ),
        },
      ];

      for (const entry of entries) {
        const projectDir = path.join(tmpDir, `empty-entry-${pluginIndex}-${entry.name}`);
        const hooks = await plugin({ directory: projectDir });
        assertNoHumanReadableSpecs(projectDir, `${entry.name} startup`);
        await entry.run(hooks, `${pluginIndex}-${entry.name}`);
        assertNoHumanReadableSpecs(projectDir, entry.name);
      }
    }
  });

  it('absent workflow settings preserve verification behavior without scaffolding specs', async () => {
    await chat('Implement the default workflow task');
    for (const action of ['plan_complete', 'run_start', 'code_complete']) {
      await api.tool.workflow_tick.execute({ action }, primaryContext());
    }

    const out = { system: [] };
    await api['experimental.chat.system.transform']({ sessionID: 'default-workflow-settings' }, out);
    assert.equal(fs.existsSync(path.join(tmpDir, '.specs', 'README.md')), false);
    assert.match(out.system.join('\n'), /worker-verify/);
    assert.doesNotMatch(out.system.join('\n'), /Workflow preference overrides/);
  });

  it('reads project-over-global workflow preferences and passes effective values to prompt injection', async () => {
    writeWorkflowSettings('global', {
      specs: { enabled: false },
      verify: { enabled: false },
    });

    for (const [index, plugin] of [GuaranaOrchestrator, BundledOrchestrator].entries()) {
      const projectDir = path.join(tmpDir, `workflow-preferences-${index}`);
      // Project specs overrides the global false; verify inherits global false.
      writeWorkflowSettings('project', { specs: { enabled: true } }, projectDir);
      const hooks = await plugin({ directory: projectDir });
      await hooks['chat.message'](
        { sessionID: `workflow-preferences-${index}` },
        { parts: parts('Implement a preference-aware workflow') },
      );
      assert.equal(fs.existsSync(path.join(projectDir, '.specs', 'README.md')), false,
        'enabling specs automation must not scaffold a placeholder at task entry');

      for (const action of ['plan_complete', 'run_start', 'code_complete']) {
        await hooks.tool.workflow_tick.execute({ action }, {
          sessionID: `workflow-preferences-${index}`, agent: 'guarana',
        });
      }
      const out = { system: [] };
      await hooks['experimental.chat.system.transform'](
        { sessionID: `workflow-preferences-${index}` }, out,
      );
      const injection = out.system.join('\n');
      assert.match(injection, /Independent verification preference \(disabled\)/);
      assert.match(injection, /workflow_tick.*verify_skip/s);
      assert.doesNotMatch(injection, /Specs automation preference \(disabled\)/);
    }
  });

  it('suppresses chat and workflow_tick specs bootstrap while preserving records and persisting workflow state', async () => {
    const scenarios = [
      {
        name: 'chat-new-task',
        run: (hooks, id) => hooks['chat.message'](
          { sessionID: id }, { parts: parts('Implement a chat-driven task') },
        ),
      },
      {
        name: 'chat-force',
        run: (hooks) => hooks['chat.message'](
          { sessionID: 'force-session' }, { parts: parts('guarana:plan Implement a forced task') },
        ),
      },
      {
        name: 'tick-new-task',
        run: (hooks, id) => hooks.tool.workflow_tick.execute(
          { action: 'new_task', goal: 'Tick task' }, { sessionID: id, agent: 'guarana' },
        ),
      },
      {
        name: 'tick-force',
        run: (hooks, id) => hooks.tool.workflow_tick.execute(
          { action: 'force', skill: 'plan', goal: 'Forced tick task' }, { sessionID: id, agent: 'guarana' },
        ),
      },
    ];

    for (const [pluginIndex, plugin] of [GuaranaOrchestrator, BundledOrchestrator].entries()) {
      for (const scenario of scenarios) {
        const projectDir = path.join(tmpDir, `specs-disabled-${pluginIndex}-${scenario.name}`);
        writeWorkflowSettings('project', { specs: { enabled: false } }, projectDir);
        const existingFiles = [
          ['README.md', Buffer.from('# Existing tracker bytes\n')],
          ['state/project-state.md', Buffer.from('# Existing project state bytes\n')],
          ['features/existing/existing.md', Buffer.from('# Existing feature bytes\n')],
        ];
        for (const [relative, bytes] of existingFiles) {
          const file = path.join(projectDir, '.specs', relative);
          fs.mkdirSync(path.dirname(file), { recursive: true });
          fs.writeFileSync(file, bytes);
        }

        const hooks = await plugin({ directory: projectDir });
        const id = `${pluginIndex}-${scenario.name}`;
        await scenario.run(hooks, id);

        const workflowPath = path.join(projectDir, '.specs', 'state', 'workflow.json');
        assert.ok(fs.existsSync(workflowPath), `${scenario.name} must persist operational workflow state`);
        assert.equal(JSON.parse(fs.readFileSync(workflowPath, 'utf8')).state, 'planning');
        for (const [relative, bytes] of existingFiles) {
          assert.deepEqual(
            fs.readFileSync(path.join(projectDir, '.specs', relative)),
            bytes,
            `${scenario.name} changed existing ${relative}`,
          );
        }
        for (const relative of [
          'conventions.md',
          'decisions',
          'features/initial-task/initial-task.md',
        ]) {
          assert.equal(
            fs.existsSync(path.join(projectDir, '.specs', relative)),
            false,
            `${scenario.name} must not bootstrap ${relative}`,
          );
        }

        const out = { system: [] };
        await hooks['experimental.chat.system.transform']({ sessionID: id }, out);
        assert.match(out.system.join('\n'), /explicit user request.*override this preference/i);
        // The preference remains prompt policy, not a runtime ban on explicit Specs work.
        await hooks['tool.execute.before'](
          { tool: 'task', sessionID: `${id}-explicit-specs` },
          { args: { subagent_type: 'worker-specs', prompt: 'User explicitly requested a specs record' } },
        );
      }
    }
  });

  it('malformed workflow settings log once and fall back to both enabled defaults', async () => {
    const file = writeWorkflowSettings('project', {
      specs: { enabled: false },
      verify: { enabled: 'false' },
    });
    const hooks = await GuaranaOrchestrator({ directory: tmpDir });
    await hooks['chat.message'](
      { sessionID: 'malformed-workflow-settings' },
      { parts: parts('Implement with malformed preferences') },
    );
    assert.equal(fs.existsSync(path.join(tmpDir, '.specs', 'README.md')), false,
      'malformed settings must not bootstrap human-readable specs');

    for (const action of ['plan_complete', 'run_start', 'code_complete']) {
      await hooks.tool.workflow_tick.execute({ action }, primaryContext());
    }
    const out = { system: [] };
    await hooks['experimental.chat.system.transform']({ sessionID: 'malformed-workflow-settings' }, out);
    assert.match(out.system.join('\n'), /worker-verify/);
    assert.doesNotMatch(out.system.join('\n'), /Workflow preference overrides/);
    const errors = readEvents().filter((event) => event.type === 'orchestrator-error');
    assert.equal(errors.length, 1);
    assert.match(errors[0].error, /Workflow setting verify\.enabled must be a boolean/);
    assert.ok(fs.existsSync(file));
  });

  it('informational and read-only requests do not create task records or tracker state', async () => {
    const plugins = [api, await BundledOrchestrator({ directory: tmpDir })];
    for (const [pluginIndex, plugin] of plugins.entries()) {
      for (const text of [
        'What does the OAuth endpoint do?',
        'Review the authentication flow',
        'Audit the API tests',
        'Inspect the login behavior',
        'Investigate why login fails',
        'Report the current integration behavior',
        'How do I add a login method?',
        'Should we update the documentation?',
        'Can you update me on the task status?',
        'Update me on the task status',
        'Review the task and update me on the task status',
        'I need an update on the task status',
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
        'Qual é a melhor forma de corrigir o login?',
        'Por quê devo implementar PKCE?',
      ]) {
        await plugin['chat.message']({ sessionID: `read-only-${pluginIndex}` }, { parts: parts(text) });
        assert.equal(workflow().state, 'idle', text);
        assert.equal(workflow().history.length, 0, text);
      }
    }
    for (const file of [
      '.specs/README.md',
      '.specs/state/project-state.md',
      '.specs/state/workflow.json',
      '.specs/features/initial-task/initial-task.md',
    ]) {
      assert.equal(fs.existsSync(path.join(tmpDir, file)), false, `${file} must not be created`);
    }
    assert.equal(fs.existsSync(path.join(tmpDir, '.guarana', 'memory')), false, 'read-only questions must not bootstrap the project memory vault');
    assert.equal(fs.existsSync(path.join(process.env.HOME, '.config', 'guarana', 'memory')), false, 'read-only questions must not bootstrap the user memory vault');
  });

  it('explicit guarana skill commands enter workflow without creating placeholder task records', async () => {
    await chat('guarana:plan');
    assert.equal(workflow().state, 'planning');
    assert.equal(fs.existsSync(path.join(tmpDir, '.specs', 'README.md')), false);
    assert.equal(fs.existsSync(path.join(tmpDir, '.specs', 'state', 'project-state.md')), false);
    assert.equal(fs.existsSync(path.join(tmpDir, '.specs', 'features', 'initial-task', 'initial-task.md')), false);
  });

  it('targeted README, docs, and config updates start without placeholder specs', async () => {
    const plugins = [GuaranaOrchestrator, BundledOrchestrator];
    for (const [pluginIndex, plugin] of plugins.entries()) {
      for (const [index, text] of [
        'Can you update the README?',
        'Update the project docs',
        'I need an update to the configuration file',
        'Can you update the config file?',
        'Implemente a autenticação OAuth',
        'Crie um teste para o endpoint',
        'Atualize o README do projeto',
        'Corrija o fluxo de login',
        'Desenvolva um relatório de status',
        'Escreva um teste de integração',
      ].entries()) {
        const projectDir = path.join(tmpDir, `targeted-update-${pluginIndex}-${index}`);
        const hooks = await plugin({ directory: projectDir });
        await hooks['chat.message']({ sessionID: 's1', messageID: `targeted-update-${pluginIndex}-${index}` }, { parts: parts(text) });

        const wf = load(projectDir);
        assert.equal(wf.state, 'planning', text);
        assert.equal(wf.skill, 'plan', text);
        assert.equal(wf.goal, text);
        for (const file of [
          '.specs/README.md',
          '.specs/state/project-state.md',
          '.specs/features/initial-task/initial-task.md',
        ]) {
          assert.equal(fs.existsSync(path.join(projectDir, file)), false,
            `${file} must not be bootstrapped before planning for ${text}`);
        }
      }
    }
  });

  it('same user message is processed once when global and project plugin instances are both loaded', async () => {
    const duplicate = await GuaranaOrchestrator({ directory: tmpDir });
    const input = { sessionID: 's1', messageID: 'same-user-message', agent: 'build' };
    const output = { message: { id: 'same-user-message', agent: 'build' }, parts: parts('Implement one exact task') };
    await api['chat.message'](input, output);
    await duplicate['chat.message'](input, output);

    assert.equal(workflow().state, 'planning');
    assert.equal(workflow().history.filter((entry) => entry.event === 'new_task').length, 1);
  });

  it('workflow telemetry records minimal provenance without user text, tool arguments, or tool output', async () => {
    const userText = 'Implement provenance task USER_TEXT_SECRET';
    const toolArgument = 'TOOL_ARGUMENT_SECRET';
    const toolOutput = 'TOOL_OUTPUT_SECRET';
    await api['chat.message'](
      { sessionID: 'provenance-session', messageID: 'provenance-message', agent: 'guarana' },
      { message: { id: 'provenance-message', agent: 'guarana' }, parts: parts(userText) },
    );

    for (const action of ['plan_complete', 'run_start', 'code_complete']) {
      await api.tool.workflow_tick.execute({ action, note: toolArgument }, primaryContext());
    }
    await api['tool.execute.after'](
      { tool: 'bash', sessionID: 'provenance-session', agent: 'guarana', callID: toolArgument },
      { output: `Error: ${toolOutput}` },
    );

    const workflowEvents = readEvents().filter((event) => event.type === 'workflow');
    assert.equal(workflowEvents.length, 5);
    assert.deepEqual(
      workflowEvents.map(({ source, sessionID, agent }) => ({ source, sessionID, agent })),
      [
        { source: 'chat.message', sessionID: 'provenance-session', agent: 'guarana' },
        ...['plan_complete', 'run_start', 'code_complete'].map(() => ({
          source: 'workflow_tick', sessionID: 'workflow-tick-primary-test', agent: 'guarana',
        })),
        { source: 'tool.execute.after', sessionID: 'provenance-session', agent: 'guarana' },
      ],
    );
    const serialized = JSON.stringify(workflowEvents);
    for (const secret of [userText, toolArgument, toolOutput]) assert.equal(serialized.includes(secret), false, secret);
    for (const event of workflowEvents) {
      assert.equal(Object.hasOwn(event, 'note'), false);
      assert.equal(Object.hasOwn(event, 'args'), false);
      assert.equal(Object.hasOwn(event, 'output'), false);
    }
  });

  it('new tasks bootstrap the memory vault but not placeholder specs', async () => {
    await chat('Implement OAuth authentication');
    assert.equal(fs.existsSync(path.join(tmpDir, '.specs', 'README.md')), false);
    assert.equal(fs.existsSync(path.join(tmpDir, '.specs', 'state', 'project-state.md')), false);
    assert.equal(fs.existsSync(path.join(tmpDir, '.specs', 'decisions')), false);
    assert.equal(fs.existsSync(path.join(tmpDir, '.specs', 'features', 'initial-task', 'initial-task.md')), false);
    assert.ok(fs.existsSync(path.join(tmpDir, '.guarana', 'memory', 'nodes.jsonl')));
    assert.ok(fs.existsSync(path.join(tmpDir, '.guarana', 'memory', 'config.json')));
    assert.equal(fs.readFileSync(path.join(tmpDir, '.guarana', 'memory', 'nodes.jsonl'), 'utf8').trim(), '');
  });

  it('keeps project knowledge searchable on demand but excludes project and legacy nodes from automatic context', async () => {
    await chat('Implement OAuth authentication');
    const projectVault = path.join(tmpDir, '.guarana', 'memory');
    const decision = createNode(projectVault, {
      type: 'decision', status: 'confirmed', scope: 'project',
      intent: 'OAuth authentication uses PKCE', summary: 'Use PKCE for the OAuth flow.',
    });
    const legacyNodes = [
      ['legacy-project-preference', 'preference', 'Legacy project preference for OAuth.'],
      ['legacy-project-atom', 'atom', 'Legacy atom for OAuth.'],
      ['legacy-project-supernode', 'supernode', 'Legacy supernode for OAuth.'],
    ];
    for (const [id, type, summary] of legacyNodes) {
      fs.appendFileSync(path.join(projectVault, 'nodes.jsonl'), `${JSON.stringify({
        id, type, status: 'confirmed', scope: 'project', ts: Date.now(),
        intent: 'OAuth authentication legacy compatibility', summary,
      })}\n`);
    }
    const explicitReader = await GuaranaMemory({ directory: tmpDir });
    const searched = JSON.parse(await explicitReader.tool.memory_search.execute({
      query: 'OAuth authentication PKCE', scope: 'project',
    }));
    assert.ok(searched.results.some((node) => node.id === decision.id));
    for (const [id, type] of legacyNodes) {
      const legacySearch = JSON.parse(await explicitReader.tool.memory_search.execute({
        query: 'OAuth authentication legacy compatibility', type, scope: 'project',
      }));
      assert.ok(legacySearch.results.some((node) => node.id === id), `${type} remains explicitly searchable`);
    }

    await chat('continue');
    const out = { system: [] };
    await api['experimental.chat.system.transform']({}, out);
    const injection = out.system.join('\n');
    assert.doesNotMatch(injection, /guarana memory \(automatic context\)/);
    for (const text of [
      'Use PKCE for the OAuth flow.',
      'Legacy project preference for OAuth.',
      'Legacy atom for OAuth.',
      'Legacy supernode for OAuth.',
    ]) assert.equal(injection.includes(text), false, `${text} must not be automatically injected`);
  });

  it('honors scoped memory auto-injection opt-out while retaining on-demand memory search', async () => {
    const globalVault = initUserVault();
    const preference = createNode(globalVault, {
      type: 'preference', status: 'confirmed', scope: 'global', category: 'communication',
      intent: 'response language', summary: 'AUTO-INJECT-OPT-OUT-PREFERENCE',
    });
    writeWorkflowSettings('global', { memory: { autoInject: false, preferenceInjectionBudgetTokens: 100000 } });
    await chat('Start an unrelated implementation task');

    const sessionID = 'memory-auto-inject-toggle';
    const disabled = { system: [] };
    await api['experimental.chat.system.transform']({ sessionID }, disabled);
    assert.doesNotMatch(disabled.system.join('\n'), /AUTO-INJECT-OPT-OUT-PREFERENCE/);
    assert.match(disabled.system.join('\n'), /Automatic memory preference injection is disabled/);
    assert.equal(readEvents().filter((event) => event.type === 'memory-injected' && event.sessionID === sessionID).length, 0);

    writeWorkflowSettings('project', { memory: { autoInject: true, preferenceInjectionBudgetTokens: 100000 } });
    await chat('continue');
    const overridden = { system: [] };
    await api['experimental.chat.system.transform']({ sessionID }, overridden);
    assert.match(overridden.system.join('\n'), /AUTO-INJECT-OPT-OUT-PREFERENCE/);
    assert.equal(readEvents().filter((event) => event.type === 'memory-injected' && event.sessionID === sessionID).length, 1);

    writeWorkflowSettings('project', { memory: { autoInject: false, preferenceInjectionBudgetTokens: 100000 } });
    await chat('continue with memory disabled');
    const disabledAgain = { system: [] };
    await api['experimental.chat.system.transform']({ sessionID }, disabledAgain);
    assert.doesNotMatch(disabledAgain.system.join('\n'), /AUTO-INJECT-OPT-OUT-PREFERENCE/);

    const memory = await GuaranaMemory({ directory: tmpDir });
    const explicit = JSON.parse(await memory.tool.memory_search.execute({ query: preference.summary, scope: 'global' }));
    assert.ok(explicit.results.some((node) => node.id === preference.id), 'on-demand search remains available');
  });

  it('injects global preferences even when their wording does not match the project task', async () => {
    allowPreferenceInjection();
    const globalVault = initUserVault();
    createNode(globalVault, {
      type: 'preference',
      status: 'confirmed',
      scope: 'global',
      category: 'communication',
      intent: 'response language',
      summary: 'Always answer me in Portuguese.',
    });
    await chat('Build an unrelated database migration tool');
    const out = { system: [] };
    await api['experimental.chat.system.transform']({ sessionID: 'session-global-pref' }, out);
    assert.match(out.system.join('\n'), /Always answer me in Portuguese/);
    assert.match(out.system.join('\n'), /### global_preferences/);
    assert.match(out.system.join('\n'), /saved user-level preferences[\s\S]*may guide behavior unless superseded by the current explicit user request or higher-priority system, developer, or security policy/i);
    const injectedPayload = preferencePayloadFrom(out.system.join('\n'));
    assert.equal(injectedPayload.global_preferences[0].scope, 'global');
    assert.equal(injectedPayload.global_preferences[0].category, 'communication');
    assert.doesNotMatch(out.system.join('\n'), /project_context/);
    const injected = readEvents().find((event) => event.type === 'memory-injected');
    assert.equal(injected.sessionID, 'session-global-pref');
    assert.equal(injected.reason, 'session-start');
    assert.deepEqual(injected.memories, [{ id: listNodes(globalVault).find((n) => n.type === 'preference').id, type: 'preference', scope: 'global' }]);
    assert.equal('summary' in injected.memories[0], false);
    assert.doesNotMatch(JSON.stringify(readEvents()), /Always answer me in Portuguese/);

    const repeated = { system: [] };
    await api['experimental.chat.system.transform']({ sessionID: 'session-global-pref' }, repeated);
    assert.doesNotMatch(repeated.system.join('\n'), /guarana memory \(automatic context\)/);
    assert.equal(readEvents().filter((event) => event.type === 'memory-injected').length, 1);

    const newPreference = createNode(globalVault, {
      type: 'preference',
      status: 'confirmed',
      scope: 'global',
      category: 'workflow',
      intent: 'answer structure',
      summary: 'Use short bullet lists.',
    });
    await chat('Continue with the current project task');
    const newMemory = { system: [] };
    await api['experimental.chat.system.transform']({ sessionID: 'session-global-pref' }, newMemory);
    assert.match(newMemory.system.join('\n'), /Use short bullet lists/);
    assert.doesNotMatch(newMemory.system.join('\n'), /Always answer me in Portuguese/);
    assert.equal(readEvents().filter((event) => event.type === 'memory-injected').length, 2);
    assert.deepEqual(readEvents().filter((event) => event.type === 'memory-injected')[1].memories, [
      { id: newPreference.id, type: 'preference', scope: 'global' },
    ]);

    await api.event({ event: { type: 'session.compacted', data: { sessionID: 'session-global-pref' } } });
    const afterCompact = { system: [] };
    await api['experimental.chat.system.transform']({ sessionID: 'session-global-pref' }, afterCompact);
    assert.match(afterCompact.system.join('\n'), /Always answer me in Portuguese/);
    assert.match(afterCompact.system.join('\n'), /Use short bullet lists/);
    assert.equal(readEvents().filter((event) => event.type === 'memory-injected').length, 3);
    assert.equal(readEvents().filter((event) => event.type === 'memory-injected')[2].reason, 'compacted');
  });

  it('persists session eviction recency when a repeated claim has no new memories', async () => {
    allowPreferenceInjection();
    const globalVault = initUserVault();
    const preference = createNode(globalVault, {
      id: 'session-lru-preference', type: 'preference', status: 'confirmed', scope: 'global',
      category: 'communication', intent: 'session LRU fixture', summary: 'SESSION-LRU-PREFERENCE',
    });
    await chat('Start a task for the session LRU fixture');

    const stateFile = path.join(tmpDir, '.specs', 'state', 'telemetry', 'memory-injection-state.json');
    const olderSession = 'session-lru-older';
    const newerSession = 'session-lru-newer';
    const first = { system: [] };
    await api['experimental.chat.system.transform']({ sessionID: olderSession }, first);
    assert.match(first.system.join('\n'), /SESSION-LRU-PREFERENCE/);
    const second = { system: [] };
    await api['experimental.chat.system.transform']({ sessionID: newerSession }, second);
    assert.match(second.system.join('\n'), /SESSION-LRU-PREFERENCE/);
    assert.deepEqual(Object.keys(JSON.parse(fs.readFileSync(stateFile, 'utf8')).sessions), [olderSession, newerSession]);

    globalThis[Symbol.for('guarana.orchestrator.memory-injection-cache')]
      .delete(`${path.resolve(tmpDir)}::${olderSession}`);
    const repeated = { system: [] };
    await api['experimental.chat.system.transform']({ sessionID: olderSession }, repeated);
    assert.doesNotMatch(repeated.system.join('\n'), /SESSION-LRU-PREFERENCE/);
    const persisted = JSON.parse(fs.readFileSync(stateFile, 'utf8')).sessions;
    assert.deepEqual(Object.keys(persisted), [newerSession, olderSession]);
    assert.deepEqual(persisted[olderSession].seen, [`global:${preference.id}`]);
    assert.equal(readEvents().filter((event) => event.type === 'memory-injected' && event.sessionID === olderSession).length, 1);
    assert.equal(preference.scope, 'global');
  });

  it('refreshes active LRU state on a deduplicated turn and preserves it across restart', async () => {
    allowPreferenceInjection();
    const globalVault = initUserVault();
    const preference = createNode(globalVault, {
      id: 'active-session-lru-preference', type: 'preference', status: 'confirmed', scope: 'global',
      category: 'communication', intent: 'active session LRU fixture', summary: 'ACTIVE-SESSION-LRU-PREFERENCE',
    });
    await chat('Start a task for the active session LRU fixture');

    const sessionID = 'active-session-lru';
    const first = { system: [] };
    await api['experimental.chat.system.transform']({ sessionID }, first);
    assert.match(first.system.join(' '), /ACTIVE-SESSION-LRU-PREFERENCE/);

    const stateFile = path.join(tmpDir, '.specs', 'state', 'telemetry', 'memory-injection-state.json');
    const persistedState = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    persistedState.sessions = Object.fromEntries(Array.from({ length: 128 }, (_, index) => [
      `newer-session-${index}`,
      { seen: [], nextReason: 'new-memories', updatedAt: index + 1 },
    ]));
    fs.writeFileSync(stateFile, JSON.stringify(persistedState));

    const repeated = { system: [] };
    await api['experimental.chat.system.transform']({ sessionID }, repeated);
    assert.doesNotMatch(repeated.system.join(' '), /ACTIVE-SESSION-LRU-PREFERENCE/);
    const refreshed = JSON.parse(fs.readFileSync(stateFile, 'utf8')).sessions;
    assert.ok(Object.hasOwn(refreshed, sessionID), 'the active session claim must be restored to persistent LRU state');
    assert.deepEqual(refreshed[sessionID].seen, [`global:${preference.id}`]);

    globalThis[Symbol.for('guarana.orchestrator.memory-injection-cache')]
      ?.delete(`${path.resolve(tmpDir)}::${sessionID}`);
    api = await GuaranaOrchestrator({ directory: tmpDir });
    await chat('Continue the active session after plugin restart');
    const afterRestart = { system: [] };
    await api['experimental.chat.system.transform']({ sessionID }, afterRestart);
    assert.doesNotMatch(afterRestart.system.join(' '), /ACTIVE-SESSION-LRU-PREFERENCE/);
    assert.equal(readEvents().filter((event) => event.type === 'memory-injected' && event.sessionID === sessionID).length, 1);
  });

  it('recovers compacted preference claims after the persistent state lock times out and the process restarts', async () => {
    allowPreferenceInjection();
    const globalVault = initUserVault();
    const preference = createNode(globalVault, {
      id: 'compaction-lock-recovery', type: 'preference', status: 'confirmed', scope: 'global',
      category: 'communication', intent: 'lock recovery fixture', summary: 'REINJECT-AFTER-COMPACTION-LOCK',
    });
    await chat('Start a task for the lock recovery fixture');

    const sessionID = 'compaction-lock-recovery-session';
    const first = { system: [] };
    await api['experimental.chat.system.transform']({ sessionID }, first);
    assert.match(first.system.join('\n'), /REINJECT-AFTER-COMPACTION-LOCK/);

    const telemetryDir = path.join(tmpDir, '.specs', 'state', 'telemetry');
    const lockFile = path.join(telemetryDir, 'memory-injection-state.lock');
    fs.mkdirSync(telemetryDir, { recursive: true });
    fs.writeFileSync(lockFile, 'held by regression fixture');
    const originalNow = Date.now;
    let nowCalls = 0;
    Date.now = () => originalNow() + nowCalls++ * 3000;
    try {
      await api.event({ event: { type: 'session.compacted', data: { sessionID } } });
    } finally {
      Date.now = originalNow;
    }

    const timeout = readEvents().find((event) => event.type === 'session-compacted' && event.outcome === 'reset-timeout');
    assert.ok(timeout, 'compaction reset lock timeout must be observable');
    assert.equal(timeout.sessionIDSource, 'event');
    assert.equal(Object.hasOwn(timeout, 'sessionID'), false);
    fs.unlinkSync(lockFile);
    assert.ok(fs.readdirSync(telemetryDir).some((name) => name.startsWith('memory-injection-reset-') && name.endsWith('.json')),
      'the reset intent must survive process restart after lock timeout');

    globalThis[Symbol.for('guarana.orchestrator.memory-injection-cache')]
      ?.delete(`${path.resolve(tmpDir)}::${sessionID}`);
    api = await GuaranaOrchestrator({ directory: tmpDir });
    await chat('Continue after compaction and plugin restart');
    const afterCompact = { system: [] };
    await api['experimental.chat.system.transform']({ sessionID }, afterCompact);
    assert.match(afterCompact.system.join('\n'), /REINJECT-AFTER-COMPACTION-LOCK/);
    const injections = readEvents().filter((event) => event.type === 'memory-injected' && event.sessionID === sessionID);
    assert.equal(injections.length, 2, 'the stale persisted seen ID is claimed again only once');
    assert.equal(injections[1].reason, 'compacted');
    assert.deepEqual(injections[1].memories, [
      { id: preference.id, type: 'preference', scope: 'global' },
    ]);

    const repeated = { system: [] };
    await api['experimental.chat.system.transform']({ sessionID }, repeated);
    assert.doesNotMatch(repeated.system.join('\n'), /REINJECT-AFTER-COMPACTION-LOCK/);
    assert.equal(readEvents().filter((event) => event.type === 'memory-injected' && event.sessionID === sessionID).length, 2);
  });

  it('publishes reset intent before waiting so a concurrent transform sees compaction', async () => {
    allowPreferenceInjection();
    const globalVault = initUserVault();
    createNode(globalVault, {
      id: 'compaction-intent-before-lock', type: 'preference', status: 'confirmed', scope: 'global',
      category: 'communication', intent: 'reset intent lock race fixture', summary: 'COMPACTION-INTENT-BEFORE-LOCK',
    });
    await chat('Start a task for reset intent lock race');

    const sessionID = 'compaction-intent-before-lock-session';
    const initial = { system: [] };
    await api['experimental.chat.system.transform']({ sessionID }, initial);
    assert.match(initial.system.join('\n'), /COMPACTION-INTENT-BEFORE-LOCK/);

    const telemetryDir = path.join(tmpDir, '.specs', 'state', 'telemetry');
    const lockFile = path.join(telemetryDir, 'memory-injection-state.lock');
    fs.writeFileSync(lockFile, 'held by reset-intent race fixture');
    const originalSetTimeout = globalThis.setTimeout;
    let releaseResetWait;
    globalThis.setTimeout = function (callback, delay, ...args) {
      if (delay === 5 && !releaseResetWait) {
        releaseResetWait = () => callback(...args);
        return { unref() {} };
      }
      return originalSetTimeout.call(this, callback, delay, ...args);
    };
    let resetPromise;
    try {
      resetPromise = api.event({ event: { type: 'session.compacted', data: { sessionID } } });
      const pendingMarkers = fs.readdirSync(telemetryDir)
        .filter((name) => name.startsWith('memory-injection-reset-') && name.endsWith('.json'));
      fs.unlinkSync(lockFile);

      const afterCompaction = { system: [] };
      await api['experimental.chat.system.transform']({ sessionID }, afterCompaction);
      assert.match(afterCompaction.system.join('\n'), /COMPACTION-INTENT-BEFORE-LOCK/);

      releaseResetWait?.();
      await resetPromise;
      const repeated = { system: [] };
      await api['experimental.chat.system.transform']({ sessionID }, repeated);
      assert.doesNotMatch(repeated.system.join('\n'), /COMPACTION-INTENT-BEFORE-LOCK/);
      assert.equal(pendingMarkers.length, 1, 'the reset marker must be visible while reset waits for the lock');
      assert.equal(readEvents().filter((event) => event.type === 'memory-injected' && event.sessionID === sessionID).length, 2);
    } finally {
      globalThis.setTimeout = originalSetTimeout;
      fs.rmSync(lockFile, { force: true });
      releaseResetWait?.();
      if (resetPromise) await resetPromise.catch(() => {});
    }
  });

  it('preserves a pending compaction reason when a session-start reset succeeds', async () => {
    allowPreferenceInjection();
    const globalVault = initUserVault();
    createNode(globalVault, {
      id: 'compaction-reset-precedence', type: 'preference', status: 'confirmed', scope: 'global',
      category: 'communication', intent: 'reset precedence fixture', summary: 'COMPACTED-RESET-TAKES-PRECEDENCE',
    });
    await chat('Start a task for reset precedence');

    const sessionID = 'compaction-reset-precedence-session';
    const first = { system: [] };
    await api['experimental.chat.system.transform']({ sessionID }, first);
    assert.match(first.system.join('\n'), /COMPACTED-RESET-TAKES-PRECEDENCE/);

    const telemetryDir = path.join(tmpDir, '.specs', 'state', 'telemetry');
    const fingerprint = createHash('sha256').update(sessionID).digest('hex');
    const marker = path.join(telemetryDir, `memory-injection-reset-${fingerprint}-pending-compaction.json`);
    fs.writeFileSync(marker, JSON.stringify({ fingerprint, reason: 'compacted', updatedAt: 1 }), { mode: 0o600 });
    await api.event({ event: { type: 'session.created', data: { sessionID, info: { id: sessionID } } } });

    const stateFile = path.join(telemetryDir, 'memory-injection-state.json');
    assert.equal(JSON.parse(fs.readFileSync(stateFile, 'utf8')).sessions[sessionID].nextReason, 'compacted');
    assert.equal(fs.existsSync(marker), false);
  });

  it('preserves a persisted compaction reason over a pending session-start marker during claim', async () => {
    allowPreferenceInjection();
    const globalVault = initUserVault();
    const preference = createNode(globalVault, {
      id: 'persisted-compaction-precedence', type: 'preference', status: 'confirmed', scope: 'global',
      category: 'communication', intent: 'persisted reset precedence fixture', summary: 'PERSISTED-COMPACTION-TAKES-PRECEDENCE',
    });
    await chat('Start a task for persisted reset precedence');

    const sessionID = 'persisted-compaction-precedence-session';
    const telemetryDir = path.join(tmpDir, '.specs', 'state', 'telemetry');
    const stateFile = path.join(telemetryDir, 'memory-injection-state.json');
    const fingerprint = createHash('sha256').update(sessionID).digest('hex');
    const marker = path.join(telemetryDir, `memory-injection-reset-${fingerprint}-pending-session-start.json`);
    fs.mkdirSync(telemetryDir, { recursive: true });
    fs.writeFileSync(stateFile, JSON.stringify({ sessions: {
      [sessionID]: { seen: [`global:${preference.id}`], nextReason: 'compacted', updatedAt: 1 },
    } }));
    fs.writeFileSync(marker, JSON.stringify({ fingerprint, reason: 'session-start', updatedAt: 2 }), { mode: 0o600 });

    const output = { system: [] };
    await api['experimental.chat.system.transform']({ sessionID }, output);
    assert.match(output.system.join('\n'), /PERSISTED-COMPACTION-TAKES-PRECEDENCE/);
    const injection = readEvents().find((event) => event.type === 'memory-injected' && event.sessionID === sessionID);
    assert.equal(injection.reason, 'compacted');
    assert.equal(fs.existsSync(marker), false);
  });

  it('preserves a newer pending compaction reset created while a claim persists', async () => {
    allowPreferenceInjection();
    const globalVault = initUserVault();
    const preference = createNode(globalVault, {
      id: 'racing-pending-reset-preference', type: 'preference', status: 'confirmed', scope: 'global',
      category: 'communication', intent: 'pending reset race fixture', summary: 'REINJECT-AFTER-NEWER-RESET',
    });
    await chat('Start a task for the pending reset race fixture');

    const sessionID = 'pending-reset-race-session';
    const initial = { system: [] };
    await api['experimental.chat.system.transform']({ sessionID }, initial);
    assert.match(initial.system.join(' '), /REINJECT-AFTER-NEWER-RESET/);

    const telemetryDir = path.join(tmpDir, '.specs', 'state', 'telemetry');
    const stateFile = path.join(telemetryDir, 'memory-injection-state.json');
    const fingerprint = createHash('sha256').update(sessionID).digest('hex');
    const oldMarker = path.join(telemetryDir, `memory-injection-reset-${fingerprint}.json`);
    const newerMarker = path.join(telemetryDir, `memory-injection-reset-${fingerprint}-concurrent.json`);
    fs.mkdirSync(telemetryDir, { recursive: true });
    fs.writeFileSync(oldMarker, JSON.stringify({ fingerprint, reason: 'session-start', updatedAt: 1 }), { mode: 0o600 });

    const originalRenameSync = fs.renameSync;
    let insertedNewerReset = false;
    fs.renameSync = function (source, target) {
      const result = originalRenameSync.call(this, source, target);
      if (!insertedNewerReset && target === stateFile) {
        fs.writeFileSync(newerMarker, JSON.stringify({ fingerprint, reason: 'compacted', updatedAt: 2 }), { mode: 0o600 });
        insertedNewerReset = true;
      }
      return result;
    };
    const consumingOldReset = { system: [] };
    try {
      await api['experimental.chat.system.transform']({ sessionID }, consumingOldReset);
    } finally {
      fs.renameSync = originalRenameSync;
    }
    assert.equal(insertedNewerReset, true);
    assert.match(consumingOldReset.system.join(' '), /REINJECT-AFTER-NEWER-RESET/);
    assert.equal(fs.existsSync(oldMarker), false);
    assert.equal(fs.existsSync(newerMarker), true, 'claim cleanup must only consume the marker it observed');

    const afterNewerReset = { system: [] };
    await api['experimental.chat.system.transform']({ sessionID }, afterNewerReset);
    assert.match(afterNewerReset.system.join(' '), /REINJECT-AFTER-NEWER-RESET/);
    const injections = readEvents().filter((event) => event.type === 'memory-injected' && event.sessionID === sessionID);
    assert.equal(injections.length, 3);
    assert.equal(injections[2].reason, 'compacted');
    assert.deepEqual(injections[2].memories, [{ id: preference.id, type: 'preference', scope: 'global' }]);
    assert.equal(fs.existsSync(newerMarker), false);
  });

  it('injects post-compaction preferences once across concurrent transforms', async () => {
    allowPreferenceInjection();
    initUserVault();
    const memoryText = 'CONCURRENT_COMPACTION_INJECTION';
    const preference = createNode(initUserVault(), {
      id: 'concurrent-compaction-claim', type: 'preference', status: 'confirmed', scope: 'global',
      category: 'communication', intent: 'concurrent compaction fixture', summary: memoryText,
    });
    await chat('Start a task for concurrent compaction behavior');

    const sessionID = 'concurrent-compaction-session';
    const first = { system: [] };
    await api['experimental.chat.system.transform']({ sessionID }, first);
    assert.match(first.system.join('\n'), new RegExp(memoryText));
    await api.event({ event: { type: 'session.compacted', data: { sessionID } } });

    const nextA = { system: [] };
    const nextB = { system: [] };
    await Promise.all([
      api['experimental.chat.system.transform']({ sessionID }, nextA),
      api['experimental.chat.system.transform']({ sessionID }, nextB),
    ]);
    const injected = [nextA, nextB].filter((output) => output.system.join('\n').includes(memoryText));
    assert.equal(injected.length, 1, 'a concurrent pair should inject the preference once');
    const events = readEvents().filter((event) => event.type === 'memory-injected' && event.sessionID === sessionID);
    assert.equal(events.length, 2);
    assert.equal(events[1].reason, 'compacted');
    assert.deepEqual(events[1].memories, [
      { id: preference.id, type: 'preference', scope: 'global' },
    ]);
  });

  it('persists compacted claim reset when the first post-timeout injection has no fitting records', async () => {
    allowPreferenceInjection();
    const globalVault = initUserVault();
    const preference = createNode(globalVault, {
      id: 'compaction-lock-zero-fit', type: 'preference', status: 'confirmed', scope: 'global',
      category: 'communication', intent: 'zero-fit lock recovery fixture', summary: 'ZERO-FIT-COMPACTION-RESET',
    });
    await chat('Start a task for the zero-fit lock recovery fixture');

    const sessionID = 'compaction-lock-zero-fit-session';
    const stateFile = path.join(tmpDir, '.specs', 'state', 'telemetry', 'memory-injection-state.json');
    const first = { system: [] };
    await api['experimental.chat.system.transform']({ sessionID }, first);
    assert.match(first.system.join('\n'), /ZERO-FIT-COMPACTION-RESET/);
    assert.deepEqual(JSON.parse(fs.readFileSync(stateFile, 'utf8')).sessions[sessionID].seen,
      [`global:${preference.id}`]);

    const lockFile = path.join(path.dirname(stateFile), 'memory-injection-state.lock');
    fs.writeFileSync(lockFile, 'held by regression fixture');
    const originalNow = Date.now;
    let nowCalls = 0;
    Date.now = () => originalNow() + nowCalls++ * 3000;
    try {
      await api.event({ event: { type: 'session.compacted', data: { sessionID } } });
    } finally {
      Date.now = originalNow;
    }
    fs.unlinkSync(lockFile);

    writeWorkflowSettings('project', { memory: { preferenceInjectionBudgetTokens: 1 } });
    const noFit = { system: [] };
    await api['experimental.chat.system.transform']({ sessionID }, noFit);
    assert.doesNotMatch(noFit.system.join('\n'), /ZERO-FIT-COMPACTION-RESET/);
    const resetState = JSON.parse(fs.readFileSync(stateFile, 'utf8')).sessions[sessionID];
    assert.deepEqual(resetState.seen, []);
    assert.equal(resetState.nextReason, 'compacted');
  });

  it('resets preference claims on successful v2 compaction end, but not on other lifecycle events', async () => {
    allowPreferenceInjection();
    const globalVault = initUserVault();
    const memorySecret = 'V2_COMPACTION_REINJECTION_SECRET';
    const preference = createNode(globalVault, {
      id: 'v2-compaction-reset', type: 'preference', status: 'confirmed', scope: 'global',
      category: 'communication', intent: 'v2 compaction fixture', summary: memorySecret,
    });
    await chat('Start a task for the v2 compaction fixture');

    const sessionID = 'V2_COMPACTION_RAW_SESSION_ID_SECRET';
    const stateFile = path.join(tmpDir, '.specs', 'state', 'telemetry', 'memory-injection-state.json');
    const first = { system: [] };
    await api['experimental.chat.system.transform']({ sessionID }, first);
    assert.match(first.system.join('\n'), new RegExp(memorySecret));
    const claimedState = JSON.parse(fs.readFileSync(stateFile, 'utf8')).sessions[sessionID];
    assert.deepEqual(claimedState.seen, [`global:${preference.id}`]);

    for (const [type, data] of [
      ['session.compaction.started', { sessionID }],
      ['session.compaction.delta', { sessionID, text: 'V2_COMPACTION_DELTA_SECRET' }],
      ['session.compaction.failed', { sessionID, error: 'V2_COMPACTION_FAILURE_SECRET' }],
    ]) {
      await api.event({ event: { type, data } });
      assert.deepEqual(JSON.parse(fs.readFileSync(stateFile, 'utf8')).sessions[sessionID], claimedState,
        `${type} must not reset persisted preference claims`);
    }
    const afterNonSuccess = { system: [] };
    await api['experimental.chat.system.transform']({ sessionID }, afterNonSuccess);
    assert.doesNotMatch(afterNonSuccess.system.join('\n'), new RegExp(memorySecret));
    assert.equal(readEvents().filter((entry) => entry.type === 'memory-injected' && entry.sessionID === sessionID).length, 1);

    const compactionTextSecret = 'V2_COMPACTION_TEXT_SECRET';
    await api.event({ event: {
      type: 'session.compaction.ended',
      data: { sessionID, text: compactionTextSecret },
    } });
    const diagnostics = readEvents().filter((entry) => entry.type === 'session-compacted');
    assert.deepEqual(diagnostics.map(({ outcome }) => outcome), ['received', 'reset-success']);
    assert.ok(diagnostics.every((entry) => entry.sessionIDSource === 'event'));
    assert.ok(diagnostics.every((entry) => /^[a-f0-9]{12}$/.test(entry.sessionFingerprint)));
    const diagnosticText = JSON.stringify(diagnostics);
    for (const secret of [sessionID, memorySecret, compactionTextSecret, 'V2_COMPACTION_DELTA_SECRET', 'V2_COMPACTION_FAILURE_SECRET']) {
      assert.equal(diagnosticText.includes(secret), false, `${secret} must not be persisted in diagnostics`);
    }

    const resetState = JSON.parse(fs.readFileSync(stateFile, 'utf8')).sessions[sessionID];
    assert.deepEqual(resetState.seen, []);
    assert.equal(resetState.nextReason, 'compacted');
    const afterCompaction = { system: [] };
    await api['experimental.chat.system.transform']({ sessionID }, afterCompaction);
    assert.match(afterCompaction.system.join('\n'), new RegExp(memorySecret));
    const injections = readEvents().filter((entry) => entry.type === 'memory-injected' && entry.sessionID === sessionID);
    assert.equal(injections.length, 2);
    assert.equal(injections[1].reason, 'compacted');
    assert.deepEqual(injections[1].memories, [
      { id: preference.id, type: 'preference', scope: 'global' },
    ]);
  });

  it('records redacted compacted-session receipt, child skip, and fallback reset diagnostics', async () => {
    const eventSessionID = 'COMPACTION_RAW_SESSION_ID_SECRET';
    const promptSecret = 'COMPACTION_RAW_PROMPT_SECRET';
    const memorySecret = 'COMPACTION_RAW_MEMORY_SECRET';
    await api.event({ event: {
      type: 'session.compacted',
      data: { sessionID: eventSessionID, prompt: promptSecret, memory: memorySecret },
    } });
    const eventDiagnostics = readEvents().filter((entry) => entry.type === 'session-compacted');
    assert.deepEqual(eventDiagnostics.map(({ outcome }) => outcome), ['received', 'reset-success']);
    assert.ok(eventDiagnostics.every((entry) => entry.sessionIDSource === 'event'));
    assert.ok(eventDiagnostics.every((entry) => /^[a-f0-9]{12}$/.test(entry.sessionFingerprint)));
    const eventDiagnosticText = JSON.stringify(eventDiagnostics);
    for (const secret of [eventSessionID, promptSecret, memorySecret]) {
      assert.equal(eventDiagnosticText.includes(secret), false, `${secret} must not be persisted in diagnostics`);
    }

    const childID = 'COMPACTION_CHILD_SESSION_ID_SECRET';
    await api.event({ event: { type: 'session.created', data: {
      sessionID: childID, info: { id: childID, parentID: 'primary', agent: 'worker-code' },
    } } });
    await api.event({ event: { type: 'session.compacted', data: { sessionID: childID } } });
    const allDiagnostics = readEvents().filter((entry) => entry.type === 'session-compacted');
    assert.deepEqual(allDiagnostics.slice(2).map(({ outcome }) => outcome), ['received', 'skipped-child']);
    assert.ok(allDiagnostics.slice(2).every((entry) => entry.sessionIDSource === 'event'));

    const fallbackID = 'COMPACTION_FALLBACK_SESSION_ID_SECRET';
    const fallbackPrompt = 'COMPACTION_FALLBACK_PROMPT_SECRET';
    await api['chat.message'](
      { sessionID: fallbackID, messageID: 'compaction-fallback-message' },
      { parts: parts(`Implement task ${fallbackPrompt}`) },
    );
    await api.event({ event: { type: 'session.compacted', data: {} } });
    const fallbackDiagnostics = readEvents().filter((entry) => entry.type === 'session-compacted').slice(-2);
    assert.deepEqual(fallbackDiagnostics.map(({ outcome }) => outcome), ['received', 'reset-success']);
    assert.ok(fallbackDiagnostics.every((entry) => entry.sessionIDSource === 'fallback'));
    const fallbackDiagnosticText = JSON.stringify(fallbackDiagnostics);
    assert.equal(fallbackDiagnosticText.includes(fallbackID), false);
    assert.equal(fallbackDiagnosticText.includes(fallbackPrompt), false);
  });

  it('records compacted reset errors without persisting session, prompt, memory, or error text', async () => {
    const sessionID = 'COMPACTION_RESET_ERROR_SESSION_SECRET';
    const telemetryDir = path.join(tmpDir, '.specs', 'state', 'telemetry');
    fs.mkdirSync(path.join(telemetryDir, 'memory-injection-state.json'), { recursive: true });
    await api.event({ event: { type: 'session.compacted', data: {
      sessionID, prompt: 'RESET_ERROR_PROMPT_SECRET', memory: 'RESET_ERROR_MEMORY_SECRET',
    } } });
    const diagnostics = readEvents().filter((entry) => entry.type === 'session-compacted');
    assert.deepEqual(diagnostics.map(({ outcome }) => outcome), ['received', 'reset-error']);
    const text = JSON.stringify(diagnostics);
    for (const secret of [sessionID, 'RESET_ERROR_PROMPT_SECRET', 'RESET_ERROR_MEMORY_SECRET']) {
      assert.equal(text.includes(secret), false);
    }
  });

  it('reconnects after stream errors and clean termination, resets delay on events, and caps backoff', async () => {
    const controller = new AbortController();
    const delays = [];
    const failures = [];
    const received = [];
    const stream = (steps = []) => {
      let index = 0;
      return {
        [Symbol.asyncIterator]() { return this; },
        next() {
          const step = steps[index++];
          if (!step) return Promise.resolve({ done: true });
          if (step.error) return Promise.reject(step.error);
          return Promise.resolve({ done: false, value: step.value });
        },
        return() { return Promise.resolve({ done: true }); },
      };
    };
    const sequence = [
      () => { throw new Error('RAW_EVENT_STREAM_ERROR_SECRET'); },
      () => stream(),
      () => stream([{ value: { type: 'test-event' } }, { error: new Error('RAW_EVENT_STREAM_ERROR_SECRET') }]),
    ];
    let subscriptions = 0;
    await consumeEventStreamWithReconnect({
      subscribe: ({ signal }) => {
        assert.equal(signal, controller.signal);
        subscriptions += 1;
        return sequence[subscriptions - 1]();
      },
      onEvent: async (event) => received.push(event),
      onFailure: (diagnostic) => failures.push(diagnostic),
      signal: controller.signal,
      sleep: async (ms) => {
        delays.push(ms);
        if (delays.length === 3) controller.abort();
      },
    });
    assert.equal(subscriptions, 3);
    assert.deepEqual(received, [{ type: 'test-event' }]);
    assert.deepEqual(failures, [
      { failure: 'thrown', attempt: 1, delayMs: 100, action: 'reconnect' },
      { failure: 'terminated', attempt: 2, delayMs: 200, action: 'reconnect' },
      { failure: 'thrown', attempt: 1, delayMs: 100, action: 'reconnect' },
    ]);
    assert.deepEqual(delays, [100, 200, 100], 'receiving an event resets the next reconnect delay');
    assert.equal(JSON.stringify(failures).includes('RAW_EVENT_STREAM_ERROR_SECRET'), false);

    const cappedController = new AbortController();
    const cappedDelays = [];
    const cappedFailures = [];
    await consumeEventStreamWithReconnect({
      subscribe: () => { throw new Error('private failure detail'); },
      onEvent: () => {},
      onFailure: (diagnostic) => cappedFailures.push(diagnostic),
      signal: cappedController.signal,
      sleep: async (ms) => {
        cappedDelays.push(ms);
        if (cappedDelays.length === 11) cappedController.abort();
      },
    });
    assert.deepEqual(cappedDelays, [100, 200, 400, 800, 1600, 3200, 6400, 12800, 25600, 30000, 30000]);
    assert.deepEqual(cappedFailures.map(({ attempt, delayMs }) => ({ attempt, delayMs })), cappedDelays.map((delayMs, index) => ({
      attempt: index + 1,
      delayMs,
    })));
    assert.ok(cappedFailures.every(({ failure, action }) => failure === 'thrown' && action === 'reconnect'));
    assert.equal(JSON.stringify(cappedFailures).includes('private failure detail'), false);
  });

  it('stops a blocked event stream promptly on abort and logs only sanitized failure metadata', async () => {
    const controller = new AbortController();
    let iteratorReturned = false;
    const running = consumeEventStreamWithReconnect({
      subscribe: async ({ signal }) => {
        assert.equal(signal, controller.signal);
        return {
          [Symbol.asyncIterator]() { return this; },
          next: () => new Promise(() => {}),
          return: () => { iteratorReturned = true; return Promise.resolve({ done: true }); },
        };
      },
      onEvent: () => {},
      signal: controller.signal,
    });
    await new Promise((resolve) => setImmediate(resolve));
    controller.abort();
    await running;
    assert.equal(iteratorReturned, true);

    const subscribeController = new AbortController();
    const waitingForSubscription = consumeEventStreamWithReconnect({
      subscribe: () => new Promise(() => {}),
      onEvent: () => {},
      signal: subscribeController.signal,
    });
    await new Promise((resolve) => setImmediate(resolve));
    subscribeController.abort();
    await waitingForSubscription;

    const setupCtx = {
      location: { directory: tmpDir },
      agent: { transform: async (transform) => transform({ default() {} }) },
      tool: {
        transform: async (transform) => transform({ add() {} }),
        hook: async () => {},
      },
      session: { hook: async () => {} },
      event: { subscribe: () => { throw new Error('RAW_EVENT_SUBSCRIBE_ERROR_SECRET'); } },
    };
    const dispose = await OrchestratorPlugin.setup(setupCtx);
    await new Promise((resolve) => setImmediate(resolve));
    dispose();
    const streamFailures = readEvents().filter((entry) => entry.operation === 'event-stream');
    assert.equal(streamFailures.length, 1);
    assert.equal(streamFailures[0].failure, 'thrown');
    assert.equal(streamFailures[0].attempt, 1);
    assert.equal(streamFailures[0].delayMs, 100);
    assert.equal(streamFailures[0].action, 'reconnect');
    assert.deepEqual(Object.keys(streamFailures[0]).sort(), [
      'action', 'attempt', 'delayMs', 'failure', 'operation', 'project', 'ts', 'type',
    ]);
    assert.equal(Object.hasOwn(streamFailures[0], 'error'), false);
    assert.equal(JSON.stringify(streamFailures).includes('RAW_EVENT_SUBSCRIBE_ERROR_SECRET'), false);
  });

  it('injects only categorized preferences from the current project vault, keeps scope-colliding Global records distinct, and deduplicates the session', async () => {
    allowPreferenceInjection();
    const projectVault = initVault(tmpDir);
    const projectPreference = createNode(projectVault, {
      id: 'same-raw-preference-id', type: 'preference', status: 'confirmed', scope: 'project',
      category: 'workflow', ts: 10, intent: 'synthetic project context', summary: 'Use this repository workflow.',
    });
    const linkedProjectDecision = createNode(projectVault, {
      id: 'project-decision-not-eligible', type: 'decision', status: 'confirmed', scope: 'project', ts: 9,
      intent: 'synthetic project context', summary: 'Project decisions remain excluded from automatic preference injection.',
    });
    createEdge(projectVault, { from: projectPreference.id, to: linkedProjectDecision.id, rel: 'relates-to' });
    const legacy = {
      id: 'legacy-project-pref-not-eligible', type: 'preference', status: 'confirmed', scope: 'project', ts: 11,
      intent: 'synthetic project context', summary: 'Uncategorized legacy preference remains searchable but excluded.',
    };
    fs.appendFileSync(paths(projectVault).nodes, `${JSON.stringify(legacy)}\n`);
    const otherProjectDir = path.join(tmpDir, 'different-project');
    const otherProjectVault = initVault(otherProjectDir);
    const otherProjectPreference = createNode(otherProjectVault, {
      id: 'other-project-only-pref', type: 'preference', status: 'confirmed', scope: 'project',
      category: 'communication', ts: 12, intent: 'other project sentinel', summary: 'Must not be read from another project vault.',
    });
    const globalVault = initUserVault();
    const globalPreference = createNode(globalVault, {
      id: projectPreference.id, type: 'preference', status: 'confirmed', scope: 'global',
      category: 'communication', ts: 13, intent: 'synthetic global context', summary: 'Use the saved Global preference.',
    });

    const fixtureFiles = [
      paths(projectVault).nodes, paths(projectVault).edges,
      paths(otherProjectVault).nodes, paths(otherProjectVault).edges,
      paths(globalVault).nodes, paths(globalVault).edges,
    ];
    const before = fixtureFiles.map((file) => fs.readFileSync(file));
    await chat('Implement synthetic project context');
    const out = { system: [] };
    await api['experimental.chat.system.transform']({ sessionID: 'project-global-collision' }, out);
    const injection = out.system.join('\n');
    const payload = preferencePayloadFrom(injection);

    assert.deepEqual(payload.project_preferences.map(({ id, category }) => [id, category]), [
      [projectPreference.id, 'workflow'],
    ]);
    assert.deepEqual(payload.global_preferences.map(({ id, category }) => [id, category]), [
      [globalPreference.id, 'communication'],
    ]);
    assert.deepEqual(payload.related_global_preferences, []);
    assert.deepEqual(payload.superseded_global_preferences, []);
    for (const excluded of [linkedProjectDecision, legacy, otherProjectPreference]) {
      assert.equal(injection.includes(excluded.summary), false, `${excluded.id} must remain excluded`);
    }
    const event = readEvents().find((entry) => entry.type === 'memory-injected' && entry.sessionID === 'project-global-collision');
    assert.deepEqual(event.memories, [
      { id: projectPreference.id, type: 'preference', scope: 'project' },
      { id: globalPreference.id, type: 'preference', scope: 'global' },
    ], 'scope-qualified references preserve two records with the same raw ID');
    assert.equal(JSON.stringify(event).includes(projectPreference.summary), false, 'telemetry stores no preference text');

    const repeated = { system: [] };
    await api['experimental.chat.system.transform']({ sessionID: 'project-global-collision' }, repeated);
    assert.doesNotMatch(repeated.system.join('\n'), /guarana memory \(automatic context\)/);
    assert.equal(readEvents().filter((entry) => entry.type === 'memory-injected' && entry.sessionID === 'project-global-collision').length, 1);
    assert.deepEqual(fixtureFiles.map((file) => fs.readFileSync(file)), before, 'injection reads do not mutate synthetic vaults');
  });

  it('fits project preferences before Global direct candidates within the shared complete-record budget', async () => {
    const projectVault = initVault(tmpDir);
    const projectPreference = createNode(projectVault, {
      id: 'combined-budget-project', type: 'preference', status: 'confirmed', scope: 'project',
      category: 'workflow', ts: 20, intent: 'budget fixture', summary: 'PROJECT-BUDGET-FIRST-☃',
    });
    const globalVault = initUserVault();
    const globalPreference = createNode(globalVault, {
      id: 'combined-budget-global', type: 'preference', status: 'confirmed', scope: 'global',
      category: 'communication', ts: 21, intent: 'budget fixture', summary: 'GLOBAL-BUDGET-LATER-☕',
    });
    const projectOnlyBytes = Buffer.byteLength(serializeMemoryPayload({ project_preferences: [
      { id: projectPreference.id, type: 'preference', scope: 'project', category: projectPreference.category,
        intent: projectPreference.intent, summary: projectPreference.summary },
    ] }).serialized, 'utf8');
    allowPreferenceInjection('project', projectOnlyBytes);

    await chat('Implement the combined preference budget fixture');
    const out = { system: [] };
    await api['experimental.chat.system.transform']({ sessionID: 'combined-project-budget' }, out);
    const injection = out.system.join('\n');
    const payload = preferencePayloadFrom(injection);

    assert.deepEqual(payload.project_preferences.map(({ id }) => id), [projectPreference.id]);
    assert.deepEqual(payload.global_preferences, []);
    assert.match(injection, /injected 1; omitted 1 of 2 eligible unseen records/i);
    assert.match(injection, /PROJECT-BUDGET-FIRST-☃/);
    assert.doesNotMatch(injection, /GLOBAL-BUDGET-LATER-☕/);
    assert.equal(globalPreference.scope, 'global');
  });

  it('fits complete preference records to configured/model budgets and fails closed without a usable budget', async () => {
    const globalVault = initUserVault();
    const first = createNode(globalVault, {
      id: 'budget-pref-one', type: 'preference', status: 'confirmed', scope: 'global',
      category: 'communication', ts: 20, intent: 'budget fixture', summary: 'FIRST-PREFERENCE-UNICODE-☃',
    });
    const second = createNode(globalVault, {
      id: 'budget-pref-two', type: 'preference', status: 'confirmed', scope: 'global',
      category: 'workflow', ts: 19, intent: 'budget fixture', summary: 'SECOND-PREFERENCE-—-“quoted”',
    });
    await chat('Continue the synthetic budget fixture');
    const serialized = serializeMemoryPayload({ global_preferences: [
      { id: first.id, type: 'preference', scope: 'global', category: 'communication', priority: 'normal', intent: first.intent, summary: first.summary },
      { id: second.id, type: 'preference', scope: 'global', category: 'workflow', priority: 'normal', intent: second.intent, summary: second.summary },
    ] });
    const byteBudget = Buffer.byteLength(serialized.serialized, 'utf8');
    const firstOnlyBytes = Buffer.byteLength(serializeMemoryPayload({ global_preferences: [
      { id: first.id, type: 'preference', scope: 'global', category: 'communication', priority: 'normal', intent: first.intent, summary: first.summary },
    ] }).serialized, 'utf8');
    const assertRepairPath = (output) => {
      const injection = output.system.join('\n');
      assert.match(injection, /Tell the user that no saved preference text was injected/i);
      assert.match(injection, /do not imply that saved preferences were applied/i);
      assert.match(injection, /Dashboard Settings → Workflow preferences → Current-project \+ Global preference injection budget \(tokens\)/);
      assert.match(injection, /guarana workflow set memory\.preferenceInjectionBudgetTokens <positive-integer>/);
      assert.match(injection, /add `--project` for a project override/);
    };

    allowPreferenceInjection('project', byteBudget);
    const configuredOnly = { system: [] };
    await api['experimental.chat.system.transform']({ sessionID: 'configured-budget' }, configuredOnly);
    assert.match(configuredOnly.system.join('\n'), /FIRST-PREFERENCE-UNICODE-☃/);
    assert.match(configuredOnly.system.join('\n'), /SECOND-PREFERENCE-—-“quoted”/);
    assert.match(configuredOnly.system.join('\n'), /injected 2; omitted 0 of 2 eligible unseen records/i);

    writeWorkflowSettings('global', {});
    writeWorkflowSettings('project', {});
    const globalSettingsFile = path.join(process.env.XDG_CONFIG_HOME, 'guarana', 'workflow.json');
    assert.deepEqual(JSON.parse(fs.readFileSync(globalSettingsFile, 'utf8')), {}, 'Global Automatic leaves the budget unset');
    const modelOnly = { system: [] };
    await api['experimental.chat.system.transform']({
      sessionID: 'model-budget', model: { limit: { context: byteBudget } },
    }, modelOnly);
    assert.match(modelOnly.system.join('\n'), /FIRST-PREFERENCE-UNICODE-☃/);
    assert.match(modelOnly.system.join('\n'), /SECOND-PREFERENCE-—-“quoted”/);
    assert.match(modelOnly.system.join('\n'), /injected 2; omitted 0 of 2 eligible unseen records/i);

    allowPreferenceInjection('project', byteBudget + 100);
    const lowerModelLimit = { system: [] };
    await api['experimental.chat.system.transform']({
      sessionID: 'lower-model-budget', model: { limit: { context: byteBudget - 1 } },
    }, lowerModelLimit);
    assert.match(lowerModelLimit.system.join('\n'), /injected 1; omitted 1 of 2 eligible unseen records/i);
    assert.match(lowerModelLimit.system.join('\n'), /FIRST-PREFERENCE-UNICODE-☃/);
    assert.doesNotMatch(lowerModelLimit.system.join('\n'), /SECOND-PREFERENCE-—-“quoted”/);

    writeWorkflowSettings('project', {});
    const noBudget = { system: [] };
    await api['experimental.chat.system.transform']({ sessionID: 'missing-budget' }, noBudget);
    assert.match(noBudget.system.join('\n'), /no usable configured token budget or model context limit/i);
    assert.match(noBudget.system.join('\n'), /Injected: 0; omitted: 2 eligible unseen records/i);
    assert.doesNotMatch(noBudget.system.join('\n'), /### Serialized records \(JSON data\)|FIRST-PREFERENCE-UNICODE|SECOND-PREFERENCE/);
    assertRepairPath(noBudget);

    allowPreferenceInjection('project', firstOnlyBytes);
    const wholePayloadOverflow = { system: [] };
    await api['experimental.chat.system.transform']({
      sessionID: 'whole-payload-overflow', model: { limit: { context: byteBudget + 100 } },
    }, wholePayloadOverflow);
    assert.match(wholePayloadOverflow.system.join('\n'), /injected 1; omitted 1 of 2 eligible unseen records/i);
    assert.match(wholePayloadOverflow.system.join('\n'), /FIRST-PREFERENCE-UNICODE-☃/);
    assert.doesNotMatch(wholePayloadOverflow.system.join('\n'), /SECOND-PREFERENCE-—-“quoted”/);

    allowPreferenceInjection('project', 1);
    const zeroFit = { system: [] };
    await api['experimental.chat.system.transform']({ sessionID: 'zero-fit-budget' }, zeroFit);
    assert.match(zeroFit.system.join('\n'), /none of the 2 eligible unseen records fit/i);
    assert.match(zeroFit.system.join('\n'), /Injected: 0; omitted: 2/i);
    assert.match(zeroFit.system.join('\n'), /No preference text was included/i);
    assert.doesNotMatch(zeroFit.system.join('\n'), /### Serialized records \(JSON data\)|FIRST-PREFERENCE-UNICODE|SECOND-PREFERENCE/);
    assertRepairPath(zeroFit);
  });

  it('injects more than ten complete global preferences and preserves historical trust groups without leaking text to telemetry', async () => {
    allowPreferenceInjection();
    const globalVault = initUserVault();
    const projectVault = initVault(tmpDir);
    const addPreference = (id, ts, summary) => createNode(globalVault, {
      id, type: 'preference', status: 'confirmed', scope: 'global', category: 'communication', ts,
      intent: `synthetic ${id}`, summary,
    });
    const direct = Array.from({ length: 12 }, (_, index) => {
      const ordinal = index + 1;
      return addPreference(
        `direct-${String(ordinal).padStart(2, '0')}`,
        100 - index,
        `Full preference ${ordinal} start — ${'Retain every synthetic preference byte. '.repeat(26)}DIRECT-END-${ordinal}`,
      );
    });
    assert.ok(direct.length > 3, 'fixture exceeds the former direct-three selection limit');
    assert.ok(direct.every(({ summary }) => Buffer.byteLength(summary, 'utf8') > 1000),
      'each direct fixture exceeds the former per-entry text limit');
    const related = addPreference('shared-neighbor-id', 20, 'One-hop global related sentinel not mentioned by the task.');
    const unmatchedRelated = addPreference('related-unmatched', 19, 'Another one-hop active sentinel not in the task text.');
    const old = addPreference('superseded-neighbor', 18, 'Historical sentinel, not current guidance.');
    const secondHop = addPreference('second-hop-neighbor', 17, 'Every active global preference is selected.');
    const draft = {
      id: 'global-draft-preference', type: 'preference', status: 'draft', scope: 'global',
      category: 'communication', ts: 16, intent: 'draft preference intent sentinel',
      summary: 'Draft preference content must remain excluded.',
    };
    fs.appendFileSync(paths(globalVault).nodes, `${JSON.stringify(draft)}\n`);
    createEdge(globalVault, { from: direct[0].id, to: related.id, rel: 'relates-to' });
    createEdge(globalVault, { from: direct[1].id, to: unmatchedRelated.id, rel: 'depends-on' });
    createEdge(globalVault, { from: direct[0].id, to: old.id, rel: 'supersedes' });
    createEdge(globalVault, { from: direct[0].id, to: draft.id, rel: 'relates-to' });
    createEdge(globalVault, { from: related.id, to: secondHop.id, rel: 'fixes' });

    const legacyGlobal = {
      id: 'legacy-global-decision', type: 'decision', status: 'confirmed', scope: 'global', ts: 16,
      intent: 'global legacy non-preference sentinel', summary: 'must remain excluded',
    };
    fs.appendFileSync(paths(globalVault).nodes, `${JSON.stringify(legacyGlobal)}\n`);
    fs.appendFileSync(paths(globalVault).edges, `${JSON.stringify({ from: direct[0].id, to: legacyGlobal.id, rel: 'fixes', ts: 15 })}\n`);

    const projectCollision = createNode(projectVault, {
      id: related.id, type: 'decision', status: 'confirmed', scope: 'project', ts: 14,
      intent: 'project collision sentinel', summary: 'Project-only text must not cross into global injection.',
    });
    const projectOnly = createNode(projectVault, {
      id: 'project-only-linked-id', type: 'decision', status: 'confirmed', scope: 'project', ts: 13,
      intent: 'cross-scope sentinel', summary: 'A global-vault dangling edge must not resolve this project text.',
    });
    const legacyProjectPreference = {
      id: 'legacy-project-preference', type: 'preference', status: 'confirmed', scope: 'project', ts: 12,
      intent: 'legacy project preference sentinel', summary: 'Not a global preference.',
    };
    fs.appendFileSync(paths(projectVault).nodes, `${JSON.stringify(legacyProjectPreference)}\n`);
    fs.appendFileSync(paths(globalVault).edges, `${JSON.stringify({ from: direct[0].id, to: projectOnly.id, rel: 'caused-by', ts: 11 })}\n`);

    const fixtureFiles = [
      paths(globalVault).nodes, paths(globalVault).edges, paths(globalVault).config,
      paths(projectVault).nodes, paths(projectVault).edges, paths(projectVault).config,
    ];
    const before = fixtureFiles.map((file) => fs.readFileSync(file));
    await chat('Build an unrelated migration tool');
    const output = { system: [] };
    await api['experimental.chat.system.transform']({ sessionID: 'one-hop-injection' }, output);
    const injection = output.system.join('\n');
    const payload = preferencePayloadFrom(injection);

    assert.deepEqual(payload.global_preferences.map(({ id }) => id), [
      ...direct.map(({ id }) => id), related.id, unmatchedRelated.id, secondHop.id,
    ]);
    assert.ok(payload.global_preferences.length > 10, 'complete active global set exceeds the former total-ten cap');
    assert.deepEqual(payload.related_global_preferences.map(({ id }) => id), []);
    assert.deepEqual(payload.superseded_global_preferences.map(({ id }) => id), [old.id]);
    assert.match(injection, /related context, not additional direct selections/i);
    assert.match(injection, /not current active guidance/i);
    assert.equal(Object.values(payload).reduce((sum, group) => sum + group.length, 0), 16);
    assert.ok(Buffer.byteLength(JSON.stringify(payload), 'utf8') > 6000,
      'fixture payload also exceeds the former total serialized-text cap');
    const sourcePreferences = [...direct, related, unmatchedRelated, secondHop, old];
    const renderedPreferences = [
      ...payload.global_preferences,
      ...payload.related_global_preferences,
      ...payload.superseded_global_preferences,
    ];
    assert.deepEqual(renderedPreferences.map(({ id, intent, summary }) => ({ id, intent, summary })),
      sourcePreferences.map(({ id, intent, summary }) => ({ id, intent, summary })),
      'all active and historical preference intent and summary text is retained in its trust group');
    assert.match(injection, /Every active global preference is selected/);
    assert.match(injection, /injected 16; omitted 0 of 16 eligible unseen records/i);
    for (const sentinel of [
      legacyGlobal.intent, legacyGlobal.summary, projectCollision.intent, projectCollision.summary,
      projectOnly.intent, projectOnly.summary, legacyProjectPreference.intent, legacyProjectPreference.summary,
      draft.intent, draft.summary,
    ]) {
      assert.ok(!injection.includes(sentinel), `${sentinel} remains absent`);
    }

    const injected = readEvents().find((event) => event.type === 'memory-injected' && event.sessionID === 'one-hop-injection');
    assert.deepEqual(injected.memories, [
      ...direct.map(({ id }) => ({ id, type: 'preference', scope: 'global' })),
      { id: related.id, type: 'preference', scope: 'global' },
      { id: unmatchedRelated.id, type: 'preference', scope: 'global' },
      { id: secondHop.id, type: 'preference', scope: 'global' },
      { id: old.id, type: 'preference', scope: 'global' },
    ]);
    assert.ok(injected.memories.every((reference) => Object.keys(reference).sort().join(',') === 'id,scope,type'),
      'telemetry stores references only');
    const eventText = JSON.stringify(readEvents());
    for (const { intent, summary } of [...sourcePreferences, draft]) {
      assert.ok(!eventText.includes(intent), 'telemetry retains no preference intent text');
      assert.ok(!eventText.includes(summary), 'telemetry retains no preference summary text');
    }
    assert.deepEqual(fixtureFiles.map((file) => fs.readFileSync(file)), before,
      'prompt context reads leave all synthetic project/global fixture bytes unchanged');
  });

  it('avoids duplicate memory injection when both plugin scopes transform one prompt', async () => {
    allowPreferenceInjection();
    const globalVault = initUserVault();
    createNode(globalVault, {
      type: 'preference', status: 'confirmed', scope: 'global', category: 'communication',
      intent: 'response format', summary: 'Use concise bullet points.',
    });
    const duplicate = await GuaranaOrchestrator({ directory: tmpDir });
    await chat('Implement a dashboard filter');
    await duplicate['chat.message']({ sessionID: 's1' }, { parts: parts('Implement a dashboard filter') });
    const out = { system: [] };
    await api['experimental.chat.system.transform']({ sessionID: 's1' }, out);
    // Separate plugin isolates do not share the in-memory cache. The durable claim must still suppress the second injection.
    globalThis[Symbol.for('guarana.orchestrator.memory-injection-cache')].delete(`${path.resolve(tmpDir)}::s1`);
    const duplicateOut = { system: [] };
    await duplicate['experimental.chat.system.transform']({ sessionID: 's1' }, duplicateOut);
    assert.equal((out.system.join('\n').match(/guarana memory \(automatic context\)/g) || []).length, 1);
    assert.doesNotMatch(duplicateOut.system.join('\n'), /guarana memory \(automatic context\)/);
    assert.equal(readEvents().filter((event) => event.type === 'memory-injected').length, 1);
  });

  it('injects global preferences on an idle non-task turn', async () => {
    allowPreferenceInjection();
    const globalVault = initUserVault();
    createNode(globalVault, {
      type: 'preference',
      status: 'confirmed',
      scope: 'global',
      category: 'agent_behavior',
      intent: 'answer style',
      summary: 'Always use concise answers.',
    });
    await chat('Oi, uma pergunta rápida');
    assert.equal(workflow().state, 'idle');
    const out = { system: [] };
    await api['experimental.chat.system.transform']({}, out);
    assert.match(out.system.join('\n'), /Always use concise answers/);
    assert.equal(preferencePayloadFrom(out.system.join('\n')).global_preferences[0].scope, 'global');
  });

  it('renders category-less global legacy preferences as general without rewriting them', async () => {
    allowPreferenceInjection();
    const globalVault = initUserVault();
    const legacy = {
      id: 'legacy-global-general', type: 'preference', status: 'confirmed', scope: 'global', ts: 1,
      intent: 'answer style', summary: 'Use clear short sentences.',
    };
    fs.appendFileSync(path.join(globalVault, 'nodes.jsonl'), `${JSON.stringify(legacy)}\n`);
    const files = ['nodes.jsonl', 'edges.jsonl', 'config.json'].map((name) => path.join(globalVault, name));
    const before = files.map((file) => fs.readFileSync(file));

    await chat('Oi, uma pergunta rápida');
    const out = { system: [] };
    await api['experimental.chat.system.transform']({ sessionID: 'legacy-general' }, out);
    assert.equal(preferencePayloadFrom(out.system.join('\n')).global_preferences[0].category, 'general');
    assert.match(out.system.join('\n'), /Use clear short sentences/);
    assert.deepEqual(files.map((file) => fs.readFileSync(file)), before);
  });

  it('explicit guarana:verify forces the verifying state', async () => {
    await chat('guarana:verify');
    assert.equal(workflow().state, 'verifying');
  });

  it('system transform injects the active skill full body', async () => {
    await chat('Implement OAuth authentication'); // -> planning
    const out = { system: [] };
    await api['experimental.chat.system.transform']({}, out);
    assert.ok(out.system.length >= 1);
    assert.match(out.system[0], /Guarana workflow/);
    assert.match(out.system[0], /guarana:plan \(injected\)/);
    assert.match(out.system[0], /# guarana:plan/);
    assert.match(out.system[0], /action `start_task`/);
  });

  it('workflow_tick advances the state machine deterministically', async () => {
    const tick = async (action) => JSON.parse(await api.tool.workflow_tick.execute({ action }, primaryContext()));
    const r1 = await tick('new_task');
    assert.equal(r1.state, 'planning');
    const r2 = await tick('plan_complete');
    assert.equal(r2.state, 'building');
    const r3 = await tick('run_start');
    assert.equal(r3.state, 'coding');
    const r4 = await tick('code_complete');
    assert.equal(r4.state, 'verifying');
    const r5 = await tick('verify_pass');
    assert.equal(r5.state, 'completed');
  });

  it('public workflow_tick exposes verify_skip and persists its distinct completion transition', async () => {
    const tool = api.tool.workflow_tick;
    assert.match(tool.description, /\bverify_skip\b/);
    assert.ok(tool.args.action.enum.includes('verify_skip'));

    for (const action of ['new_task', 'plan_complete', 'run_start']) {
      await tool.execute({ action }, { sessionID: 'verify-skip-primary', agent: 'guarana' });
    }
    const result = JSON.parse(await tool.execute(
      { action: 'verify_skip' },
      { sessionID: 'verify-skip-primary', agent: 'guarana' },
    ));

    assert.equal(result.ok, true);
    assert.equal(result.state, 'completed');
    const persisted = workflow();
    assert.equal(persisted.state, 'completed');
    assert.equal(persisted.history.at(-1).event, 'verify_skip');
    assert.equal(persisted.history.at(-1).from, 'coding');
    assert.equal(persisted.history.at(-1).to, 'completed');
    assert.notEqual(persisted.history.at(-1).event, 'verify_pass');
  });

  it('Task child sessions cannot re-plan, inject the parent workflow, or advance its state', async () => {
    const tick = async (action) => JSON.parse(await api.tool.workflow_tick.execute({ action }, primaryContext()));
    await chat('Implement OAuth authentication');
    await tick('plan_complete');
    await tick('run_start');
    assert.equal(workflow().state, 'coding');

    await api.event({ event: { type: 'session.created', properties: { sessionID: 'worker-code-1', info: { id: 'worker-code-1', parentID: 's1', agent: 'worker-code' } } } });
    await api['chat.message'](
      { sessionID: 'worker-code-1', agent: 'worker-code' },
      { parts: parts('Implement the delegated condition') },
    );
    assert.equal(workflow().state, 'coding');

    const childSystem = { system: [] };
    await api['experimental.chat.system.transform']({ sessionID: 'worker-code-1' }, childSystem);
    assert.deepEqual(childSystem.system, []);

    const childTick = JSON.parse(await api.tool.workflow_tick.execute(
      { action: 'start_task', goal: 'child goal', condition: 'child condition' },
      { sessionID: 'worker-code-1', agent: 'worker-code' },
    ));
    assert.equal(childTick.ok, false);
    assert.match(childTick.error, /cannot advance the parent workflow/i);
    assert.equal(workflow().state, 'coding');

    await tick('code_complete');
    assert.equal(workflow().state, 'verifying');
    await api.event({ event: { type: 'session.created', properties: { sessionID: 'worker-verify-1', info: { id: 'worker-verify-1', parentID: 's1', agent: 'worker-verify' } } } });
    await api['tool.execute.after'](
      { tool: 'bash', sessionID: 'worker-verify-1', callID: 'verify-child' },
      { output: 'Error: assertion failed' },
    );
    assert.equal(workflow().state, 'verifying');
  });

  it('chat.message resolves an unregistered agentless Task child from session metadata before classification', async () => {
    let persisted = createWorkflow();
    for (const action of ['new_task', 'plan_complete', 'run_start']) {
      persisted = apply(persisted, action);
    }
    assert.ok(save(tmpDir, persisted));
    const workflowPath = workflowFile(tmpDir);
    const before = fs.readFileSync(workflowPath);
    const lookups = [];
    const childSessionID = 'metadata-only-task-child';
    const childHooks = await GuaranaOrchestrator({
      directory: tmpDir,
      client: {
        session: {
          get: async (params) => {
            lookups.push(params);
            return { data: { id: childSessionID, parentID: 'primary-session', agent: 'worker-code' } };
          },
        },
      },
    });

    // No session.created registration and no agent in either hook payload.
    await childHooks['chat.message'](
      { sessionID: childSessionID, messageID: 'child-message' },
      { parts: parts('Implement a different task CHILD_PROMPT_SECRET') },
    );
    const childSystem = { system: [] };
    await childHooks['experimental.chat.system.transform']({ sessionID: childSessionID }, childSystem);

    assert.deepEqual(lookups, [{
      path: { id: childSessionID },
      query: { directory: tmpDir },
    }]);
    assert.deepEqual(fs.readFileSync(workflowPath), before);
    assert.deepEqual(childSystem.system, []);
    assert.equal(fs.existsSync(path.join(tmpDir, '.specs', 'README.md')), false);
    assert.equal(fs.existsSync(path.join(tmpDir, '.guarana', 'memory')), false);
    assert.equal(readEvents().filter((event) => event.type === 'workflow').length, 0);
  });

  it('agentless primary sessions keep classifying with metadata and gracefully fall back when lookup is unavailable', async () => {
    const primaryLookups = [];
    const primaryHooks = await GuaranaOrchestrator({
      directory: tmpDir,
      client: {
        session: {
          get: async (params) => {
            primaryLookups.push(params);
            return { data: { id: params.path.id, agent: 'guarana' } };
          },
        },
      },
    });
    await primaryHooks['chat.message'](
      { sessionID: 'metadata-primary', messageID: 'primary-message' },
      { parts: parts('Implement a primary-session task') },
    );
    await primaryHooks['chat.message'](
      { sessionID: 'metadata-primary', messageID: 'primary-follow-up' },
      { parts: parts('Continue') },
    );
    assert.equal(primaryLookups.length, 1, 'resolved session role is cached');
    assert.equal(primaryLookups[0].query.directory, tmpDir);
    assert.equal(workflow().state, 'planning');
    assert.equal(workflow().goal, 'Implement a primary-session task');

    for (const [suffix, lookup] of [
      ['missing', async () => ({ data: undefined })],
      ['failure', async () => { throw new Error('LOOKUP_TOOL_SECRET'); }],
    ]) {
      const directory = path.join(tmpDir, `metadata-${suffix}`);
      const hooks = await GuaranaOrchestrator({
        directory,
        client: { session: { get: lookup } },
      });
      const prompt = `Implement fallback task ${suffix} LOOKUP_PROMPT_SECRET`;
      await hooks['chat.message'](
        { sessionID: `metadata-primary-${suffix}`, messageID: `fallback-${suffix}` },
        { parts: parts(prompt) },
      );
      assert.equal(load(directory).state, 'planning');
      const events = fs.readFileSync(path.join(directory, '.specs', 'state', 'telemetry', 'events.jsonl'), 'utf8');
      assert.equal(events.includes('LOOKUP_PROMPT_SECRET'), false);
      assert.equal(events.includes('LOOKUP_TOOL_SECRET'), false);
    }
  });

  it('worker-specs is recognized as an isolated Task child', async () => {
    await chat('Implement OAuth authentication');
    assert.equal(workflow().state, 'planning');
    await api.event({ event: { type: 'session.created', properties: {
      sessionID: 'worker-specs-1', info: { id: 'worker-specs-1', parentID: 's1', agent: 'worker-specs' },
    } } });
    await api['chat.message'](
      { sessionID: 'worker-specs-1', agent: 'worker-specs' },
      { parts: parts('Do not start another task') },
    );
    assert.equal(workflow().state, 'planning');

    const childSystem = { system: [] };
    await api['experimental.chat.system.transform']({ sessionID: 'worker-specs-1' }, childSystem);
    assert.deepEqual(childSystem.system, []);

    const childTick = JSON.parse(await api.tool.workflow_tick.execute(
      { action: 'plan_complete' }, { sessionID: 'worker-specs-1', agent: 'worker-specs' },
    ));
    assert.equal(childTick.ok, false);
    assert.match(childTick.error, /cannot advance the parent workflow/i);
    assert.equal(workflow().state, 'planning');
  });

  it('advisor Task child is isolated from parent prompts, workflow ticks, and tool-error transitions', async () => {
    for (const action of ['new_task', 'plan_complete', 'run_start', 'code_complete']) {
      await api.tool.workflow_tick.execute({ action }, primaryContext());
    }
    assert.equal(workflow().state, 'verifying');

    await api.event({ event: { type: 'session.created', properties: {
      sessionID: 'advisor-child', info: { id: 'advisor-child', parentID: 's1', agent: 'guarana-advisor' },
    } } });
    await api['chat.message'](
      { sessionID: 'advisor-child', agent: 'guarana-advisor' },
      { parts: parts('Start a different task') },
    );
    assert.equal(workflow().state, 'verifying');

    const childSystem = { system: [] };
    await api['experimental.chat.system.transform']({ sessionID: 'advisor-child' }, childSystem);
    assert.deepEqual(childSystem.system, []);

    const childTick = JSON.parse(await api.tool.workflow_tick.execute(
      { action: 'verify_fail' }, { sessionID: 'advisor-child', agent: 'guarana-advisor' },
    ));
    assert.equal(childTick.ok, false);
    assert.match(childTick.error, /cannot advance the parent workflow/i);

    await api['tool.execute.after'](
      { tool: 'bash', sessionID: 'advisor-child', agent: 'guarana-advisor', callID: 'advisor-failure' },
      { output: 'Error: advisor-side failure' },
    );
    assert.equal(workflow().state, 'verifying');
  });

  it('runtime advisor Task gate blocks repeated unchanged context across plugin copies and resets on new evidence or opt-in', async () => {
    writeSettings('project', { advisor: { enabled: true, provider: 'advisor-provider', model: 'advisor-model' } });
    const globalPlugin = await BundledOrchestrator({ directory: tmpDir });
    const parentSession = 'advisor-guard-parent';
    const originalArgs = {
      description: 'Diagnose blocked implementation',
      subagent_type: 'guarana-advisor',
      prompt: 'The primary is blocked: repeated test run fails with Error: missing export. Suggest next steps only.',
    };
    const runBefore = (plugin, sessionID, args, tool = 'task', callID) => plugin['tool.execute.before'](
      { tool, sessionID, callID },
      { args },
    );

    await runBefore(api, parentSession, originalArgs, 'task', 'call-advisor-first');
    // Both globally and project-loaded plugin instances see the same native call.
    await runBefore(globalPlugin, parentSession, originalArgs, 'task', 'call-advisor-first');
    await assert.rejects(
      runBefore(globalPlugin, parentSession, { ...originalArgs, description: 'A different label only' }, 'task', 'call-advisor-repeat'),
      /unchanged blocker has already used its advisor consultation/i,
    );

    const changedBlocker = {
      ...originalArgs,
      prompt: 'New evidence: after fixing the missing export, the test now fails with Error: invalid state transition. Suggest next steps only.',
    };
    await runBefore(globalPlugin, parentSession, changedBlocker, 'task', 'call-advisor-changed');
    await assert.rejects(
      runBefore(api, parentSession, changedBlocker, 'task', 'call-advisor-changed-repeat'),
      /unchanged blocker has already used its advisor consultation/i,
    );

    // Ordinary Task workers and non-Task tools do not consume or hit this guard.
    await runBefore(api, parentSession, { ...originalArgs, subagent_type: 'worker-code' }, 'task', 'call-worker');
    await runBefore(api, parentSession, originalArgs, 'bash', 'call-bash');

    // A Task in an advisor child has its own session budget, not the parent's.
    await api.event({ event: { type: 'session.created', properties: {
      sessionID: 'advisor-guard-child', info: { id: 'advisor-guard-child', parentID: parentSession, agent: 'guarana-advisor' },
    } } });
    await runBefore(globalPlugin, 'advisor-guard-child', originalArgs, 'task', 'call-advisor-child');

    // The generated opt-in marker resets the consultation budget for a new command.
    await api['chat.message'](
      { sessionID: parentSession },
      { parts: parts('<!-- guarana-advisor-opt-in -->\nStart the new opt-in task') },
    );
    await runBefore(globalPlugin, parentSession, originalArgs, 'task', 'call-advisor-new-opt-in');
    await assert.rejects(
      runBefore(api, parentSession, originalArgs, 'task', 'call-advisor-after-opt-in-repeat'),
      /unchanged blocker has already used its advisor consultation/i,
    );
  });

  it('refuses Advisor Task dispatch when disabled or not configured, and accepts enabled configured dispatch', async () => {
    const args = { subagent_type: 'guarana-advisor', prompt: 'New blocker evidence' };
    const dispatch = () => api['tool.execute.before']({ tool: 'task', sessionID: 'advisor-gate' }, { args });
    await assert.rejects(dispatch(), /Advisor consultation is disabled/i);
    writeSettings('project', { advisor: { enabled: true } });
    await assert.rejects(dispatch(), /Advisor is not configured/i);
    writeSettings('project', { advisor: { enabled: true, provider: 'provider', model: 'model' } });
    await dispatch();
  });

  it('uses project Advisor settings in preference to global settings', async () => {
    writeSettings('global', { advisor: { enabled: true, provider: 'provider', model: 'model' } });
    writeSettings('project', { advisor: { enabled: false } });
    const dispatch = () => api['tool.execute.before'](
      { tool: 'task', sessionID: 'advisor-precedence' },
      { args: { subagent_type: 'guarana-advisor', prompt: 'A blocker' } },
    );
    await assert.rejects(dispatch(), /Advisor consultation is disabled/i);
  });

  it('generic OpenCode session events register child-session metadata', async () => {
    await api.event({
      event: {
        type: 'session.created',
        properties: {
          sessionID: 'event-worker',
          info: { id: 'event-worker', parentID: 's1', agent: 'worker-code' },
        },
      },
    });
    const output = { system: [] };
    await api['experimental.chat.system.transform']({ sessionID: 'event-worker' }, output);
    assert.deepEqual(output.system, []);
  });

  it('recognizes V2 Task child metadata and withholds parent workflow injection', async () => {
    await chat('Implement OAuth authentication');
    assert.equal(workflow().state, 'planning');

    await api.event({ event: {
      id: 'evt_v2_child_created',
      type: 'session.created',
      data: {
        sessionID: 'v2-worker-child',
        info: { id: 'v2-worker-child', parentID: 's1', agent: 'worker-code' },
      },
    } });

    const childSystem = { system: [] };
    await api['experimental.chat.system.transform']({ sessionID: 'v2-worker-child' }, childSystem);
    assert.deepEqual(childSystem.system, []);
    assert.equal(workflow().state, 'planning');

    await api.event({ event: {
      id: 'evt_v2_root_created',
      type: 'session.created',
      data: { sessionID: 'v2-root', info: { id: 'v2-root', agent: 'guarana' } },
    } });
    const rootSystem = { system: [] };
    await api['experimental.chat.system.transform']({ sessionID: 'v2-root' }, rootSystem);
    assert.match(rootSystem.system.join('\n'), /Guarana workflow/);
  });

  it('workflow_tick refreshes the active skill injection', async () => {
    await chat('Implement OAuth authentication');
    await api.tool.workflow_tick.execute({ action: 'plan_complete' }, primaryContext());
    const out = { system: [] };
    await api['experimental.chat.system.transform']({}, out);
    assert.match(out.system[0], /Current state: \*\*building\*\*/);
    assert.match(out.system[0], /guarana:build \(injected\)/);
  });

  it('verified completion does not create generic memory', async () => {
    await chat('Implement OAuth authentication');
    const memoryDir = path.join(tmpDir, '.guarana', 'memory');
    const existing = createNode(memoryDir, {
      type: 'decision',
      status: 'confirmed',
      intent: 'keep durable memory',
      summary: 'Only intentional knowledge belongs in memory.',
    });
    for (const action of ['plan_complete', 'run_start', 'code_complete', 'verify_pass']) {
      await api.tool.workflow_tick.execute({ action }, primaryContext());
    }
    const raw = fs.readFileSync(path.join(tmpDir, '.guarana', 'memory', 'nodes.jsonl'), 'utf8');
    const nodes = raw.trim().split('\n').map(JSON.parse);
    assert.equal(nodes.length, 1);
    assert.equal(nodes[0].id, existing.id);
    assert.doesNotMatch(raw, /completed task: Implement OAuth authentication/);
  });

  it('chat-driven verified completion does not create generic memory', async () => {
    await chat('Implement OAuth authentication');
    for (const action of ['plan_complete', 'run_start', 'code_complete']) {
      await api.tool.workflow_tick.execute({ action }, primaryContext());
    }
    const memoryDir = path.join(tmpDir, '.guarana', 'memory');
    const existing = createNode(memoryDir, {
      type: 'decision',
      status: 'confirmed',
      intent: 'keep durable memory',
      summary: 'Only intentional knowledge belongs in memory.',
    });
    await chat('verified, all good');
    assert.equal(workflow().state, 'completed');
    const nodes = fs.readFileSync(path.join(memoryDir, 'nodes.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
    assert.equal(nodes.length, 1);
    assert.equal(nodes[0].id, existing.id);
  });

  it('workflow_tick rejects an illegal transition without changing state', async () => {
    const res = JSON.parse(await api.tool.workflow_tick.execute({ action: 'code_complete' }, primaryContext()));
    assert.equal(res.ok, false);
    assert.match(res.error, /illegal transition/);
    assert.equal(workflow().state, 'idle');
  });

  it('verify failure via tool result auto-moves to debugging', async () => {
    // Drive to verifying via ticks, then fire a failing tool result.
    for (const a of ['new_task', 'plan_complete', 'run_start', 'code_complete']) {
      await api.tool.workflow_tick.execute({ action: a }, primaryContext());
    }
    assert.equal(workflow().state, 'verifying');
    await api['tool.execute.after']({ tool: 'bash', sessionID: 's1', callID: 'c1' }, { output: 'Error: assertion failed' });
    assert.equal(workflow().state, 'debugging');
    const evs = readEvents().filter((e) => e.type === 'workflow' && e.event === 'verify_fail');
    assert.equal(evs.length, 1);
  });

  it('tool result error outside verifying does not change state', async () => {
    await chat('Implement OAuth'); // planning
    await api['tool.execute.after']({ tool: 'bash', sessionID: 's1', callID: 'c1' }, { output: 'Error: boom' });
    assert.equal(workflow().state, 'planning');
  });

  it('resume: an unfinished workflow is recognized on the next turn', async () => {
    for (const a of ['new_task', 'plan_complete', 'run_start']) {
      await api.tool.workflow_tick.execute({ action: a }, primaryContext());
    }
    // coding active; a casual continuation must not re-plan.
    await chat('keep going');
    const wf = workflow();
    assert.equal(wf.state, 'coding');
    assert.equal(wf.history.filter((h) => h.event === 'new_task').length, 1);
  });

  it('resumes the project-shared persisted workflow across distinct sessions without re-planning', async () => {
    await api['chat.message'](
      { sessionID: 'first-session', messageID: 'start-shared', agent: 'guarana' },
      { parts: parts('Implement a project-shared workflow') },
    );
    assert.equal(load(tmpDir).state, 'planning');
    assert.ok(fs.existsSync(workflowFile(tmpDir)));

    const restartedPlugin = await GuaranaOrchestrator({ directory: tmpDir });
    await restartedPlugin['chat.message'](
      { sessionID: 'second-session', messageID: 'resume-shared', agent: 'guarana' },
      { parts: parts('Como funciona a etapa atual?') },
    );

    const resumed = load(tmpDir);
    assert.equal(resumed.state, 'planning');
    assert.equal(resumed.history.filter((entry) => entry.event === 'new_task').length, 1);
    assert.equal(resumed.goal, 'Implement a project-shared workflow');
  });

  it('primary parallel tools create and inspect a deterministic DAG without persisting task instructions or changing workflow v1', async () => {
    const repository = path.join(tmpDir, 'parallel-primary-repo');
    initGitRepo(repository);
    const hooks = await GuaranaOrchestrator({ directory: repository });
    const { runId } = setCodingWorkflow(repository);
    const workflowPath = workflowFile(repository);
    const workflowBefore = fs.readFileSync(workflowPath);
    const secretGoal = 'EPHEMERAL_TASK_GOAL_SECRET';
    const secretCondition = 'EPHEMERAL_TASK_CONDITION_SECRET';
    const created = await parallelCall(hooks, 'parallel_run_create', {
      subtasks: [
        { id: 'audit', mode: 'read-only', ownedPaths: [], goal: secretGoal, condition: secretCondition },
        { id: 'code-a', mode: 'code', ownedPaths: ['src/a.js'], goal: 'Implement A', condition: 'A is implemented' },
        { id: 'code-b', mode: 'code', ownedPaths: ['src/b.js'], goal: 'Implement B', condition: 'B is implemented' },
        { id: 'after-a', mode: 'code', ownedPaths: ['src/c.js'], dependsOn: ['code-a'], goal: 'Implement C', condition: 'C follows A' },
      ],
    });
    assert.equal(created.ok, true);
    assert.equal(created.runId, runId);
    assert.deepEqual(created.ready, ['audit', 'code-a']);
    assert.deepEqual(created.taskRequirements[0], { id: 'audit', goal: secretGoal, condition: secretCondition });
    assert.equal(hooks.tool.parallel_run_create.description.includes('does not spawn Tasks'), true);

    const sidecar = path.join(repository, '.specs', 'state', 'parallel-runs', `${runId}.json`);
    let rawManifest = fs.readFileSync(sidecar, 'utf8');
    assert.equal(rawManifest.includes(secretGoal), false);
    assert.equal(rawManifest.includes(secretCondition), false);
    const originalManifest = fs.readFileSync(sidecar);
    const duplicate = await parallelCall(hooks, 'parallel_run_create', {
      subtasks: [{ id: 'different', mode: 'read-only', ownedPaths: [], goal: 'No overwrite', condition: 'Still absent' }],
    });
    assert.equal(duplicate.ok, false);
    assert.match(duplicate.error, /already exists/i);
    assert.deepEqual(fs.readFileSync(sidecar), originalManifest, 'duplicate create cannot replace the existing manifest');
    const inspected = await parallelCall(hooks, 'parallel_run_get', { runId });
    assert.equal(inspected.ok, true);
    assert.deepEqual(inspected.ready, ['audit', 'code-a']);
    assert.equal(inspected.run.status, 'pending');

    const missingInstructions = await parallelCall(hooks, 'parallel_task_start', {
      runId, taskId: 'audit', goal: ' ', condition: 'condition',
    });
    assert.equal(missingInstructions.ok, false);
    const unpreparedCode = await parallelCall(hooks, 'parallel_task_start', {
      runId, taskId: 'code-a', goal: 'Implement A', condition: 'A is implemented',
    });
    assert.equal(unpreparedCode.ok, false);
    assert.match(unpreparedCode.error, /worktree preflight/i);

    const sharedCheckout = await parallelCall(hooks, 'parallel_task_preflight', {
      runId, taskId: 'code-a', worktreePath: repository,
    });
    assert.equal(sharedCheckout.ok, false);
    assert.match(sharedCheckout.error, /separate from the primary checkout/i);

    const codeWorktree = path.join(tmpDir, 'parallel-worktrees', 'code-a');
    addGitWorktree(repository, codeWorktree);
    fs.mkdirSync(path.join(codeWorktree, 'nested'), { recursive: true });
    const nonTopLevel = await parallelCall(hooks, 'parallel_task_preflight', {
      runId, taskId: 'code-a', worktreePath: path.join(codeWorktree, 'nested'),
    });
    assert.equal(nonTopLevel.ok, false);
    assert.match(nonTopLevel.error, /exact Git top-level/i);
    const foreignRepository = path.join(tmpDir, 'parallel-foreign-repo');
    initGitRepo(foreignRepository);
    const wrongCommonDir = await parallelCall(hooks, 'parallel_task_preflight', {
      runId, taskId: 'code-a', worktreePath: foreignRepository,
    });
    assert.equal(wrongCommonDir.ok, false);
    assert.match(wrongCommonDir.error, /Git common directory/i);
    fs.writeFileSync(path.join(codeWorktree, 'DIRTY_SENTINEL'), 'dirty');
    const dirty = await parallelCall(hooks, 'parallel_task_preflight', {
      runId, taskId: 'code-a', worktreePath: codeWorktree,
    });
    assert.equal(dirty.ok, false);
    assert.match(dirty.error, /must be clean/i);
    fs.rmSync(path.join(codeWorktree, 'DIRTY_SENTINEL'));
    const wrongBase = await parallelCall(hooks, 'parallel_task_preflight', {
      runId, taskId: 'code-a', worktreePath: codeWorktree, baseCommit: '0'.repeat(40),
    });
    assert.equal(wrongBase.ok, false);
    assert.match(wrongBase.error, /does not match the primary checkout HEAD/i);

    const preflight = await parallelCall(hooks, 'parallel_task_preflight', {
      runId, taskId: 'code-a', worktreePath: codeWorktree,
    });
    assert.equal(preflight.ok, true);
    assert.equal(preflight.run.tasks.find((task) => task.id === 'code-a').worktreePath, codeWorktree);
    assert.equal(preflight.run.tasks.find((task) => task.id === 'code-a').baseCommit, gitAt(repository, 'rev-parse', 'HEAD'));

    const preflightBase = gitAt(codeWorktree, 'rev-parse', 'HEAD');
    fs.writeFileSync(path.join(codeWorktree, 'README.md'), 'changed after preflight\n');
    gitAt(codeWorktree, 'add', 'README.md');
    gitAt(codeWorktree, 'commit', '-q', '-m', 'unexpected post-preflight commit');
    const changedBase = await parallelCall(hooks, 'parallel_task_start', {
      runId, taskId: 'code-a', goal: 'Implement A', condition: 'A is implemented',
    });
    assert.equal(changedBase.ok, false);
    assert.match(changedBase.error, /recorded base commit/i);
    gitAt(codeWorktree, 'reset', '--hard', preflightBase);

    const auditStart = await parallelCall(hooks, 'parallel_task_start', {
      runId, taskId: 'audit', goal: 'Read the module', condition: 'Return findings only',
    });
    assert.equal(auditStart.ok, true, 'read-only work starts without a worktree');
    assert.equal(auditStart.dispatchContract.mode, 'read-only');
    assert.match(auditStart.dispatchContract.beforeEdits, /read-only/i);
    const codeStart = await parallelCall(hooks, 'parallel_task_start', {
      runId, taskId: 'code-a', goal: 'Implement A', condition: 'A is implemented',
    });
    assert.equal(codeStart.ok, true);
    assert.equal(codeStart.dispatchContract.worktreePath, codeWorktree);
    const expectedCommonDir = gitAt(repository, 'rev-parse', '--path-format=absolute', '--git-common-dir');
    assert.equal(codeStart.dispatchContract.commonDir, expectedCommonDir);
    assert.ok(codeStart.dispatchContract.beforeEdits.includes(
      `git -C '${codeWorktree}' rev-parse --path-format=absolute --git-common-dir equals ${expectedCommonDir}`,
    ));
    assert.match(codeStart.dispatchContract.beforeEdits, /Before any edits/);
    assert.match(codeStart.dispatchContract.beforeEdits, new RegExp(codeStart.dispatchContract.baseCommit));
    assert.match(codeStart.dispatchContract.beforeEdits, /stop without editing/i);

    const beforeRejectedOutput = fs.readFileSync(sidecar);
    const rejectedOutput = await parallelCall(hooks, 'parallel_task_outcome', {
      runId, taskId: 'audit', outcome: 'completed',
      workerOutput: 'RAW_WORKER_OUTPUT_SECRET',
    });
    assert.equal(rejectedOutput.ok, false);
    assert.match(rejectedOutput.error, /Unknown parallel tool argument/i);
    assert.deepEqual(fs.readFileSync(sidecar), beforeRejectedOutput);

    const auditDone = await parallelCall(hooks, 'parallel_task_outcome', {
      runId, taskId: 'audit', outcome: 'completed', evidence: ['audit-note'],
    });
    assert.equal(auditDone.ok, true);
    const codeDone = await parallelCall(hooks, 'parallel_task_outcome', {
      runId, taskId: 'code-a', outcome: 'integration-pending', evidence: ['review-note'],
    });
    assert.equal(codeDone.ok, true);
    const unreviewedIntegration = await parallelCall(hooks, 'parallel_task_integrate', {
      runId, taskId: 'code-a', primaryReviewed: false,
    });
    assert.equal(unreviewedIntegration.ok, false);
    const integrated = await parallelCall(hooks, 'parallel_task_integrate', {
      runId, taskId: 'code-a', primaryReviewed: true,
    });
    assert.equal(integrated.ok, true);
    assert.equal(integrated.run.tasks.find((task) => task.id === 'code-a').status, 'integrated');
    assert.deepEqual(integrated.ready, ['after-a', 'code-b']);

    rawManifest = fs.readFileSync(sidecar, 'utf8');
    for (const secret of [secretGoal, secretCondition, 'RAW_WORKER_OUTPUT_SECRET']) assert.equal(rawManifest.includes(secret), false);
    assert.deepEqual(fs.readFileSync(workflowPath), workflowBefore, 'sidecar operations leave workflow.json v1 byte-for-byte unchanged');
  });

  it('surfaces a real serial integration conflict and keeps its DAG blocked', async () => {
    const repository = path.join(tmpDir, 'parallel-conflict-repo');
    initGitRepo(repository);
    const conflictPath = 'src/conflict.txt';
    fs.mkdirSync(path.dirname(path.join(repository, conflictPath)), { recursive: true });
    fs.writeFileSync(path.join(repository, conflictPath), 'before\nbase\nafter\n');
    gitAt(repository, 'add', conflictPath);
    gitAt(repository, 'commit', '-q', '-m', 'add shared conflict fixture');

    const codeWorktree = path.join(tmpDir, 'parallel-conflict-worktree');
    addGitWorktree(repository, codeWorktree);
    const hooks = await GuaranaOrchestrator({ directory: repository });
    const { runId } = setCodingWorkflow(repository, 1700000000360);
    const created = await parallelCall(hooks, 'parallel_run_create', {
      subtasks: [
        { id: 'code', mode: 'code', ownedPaths: [conflictPath], goal: 'Edit shared file', condition: 'The edit is integrated' },
        { id: 'dependent', mode: 'read-only', ownedPaths: [], dependsOn: ['code'], goal: 'Inspect integration', condition: 'Report the result' },
      ],
    });
    assert.deepEqual(created.ready, ['code']);
    const preflight = await parallelCall(hooks, 'parallel_task_preflight', {
      runId, taskId: 'code', worktreePath: codeWorktree,
    });
    assert.equal(preflight.ok, true);
    assert.equal((await parallelCall(hooks, 'parallel_task_start', {
      runId, taskId: 'code', goal: 'Edit shared file', condition: 'The edit is integrated',
    })).ok, true);

    // The worker diff is deliberately left uncommitted, as it is on worker return.
    fs.writeFileSync(path.join(codeWorktree, conflictPath), 'before\nworker edit\nafter\n');
    const patch = execFileSync('git', ['-C', codeWorktree, 'diff', '--binary', 'HEAD', '--', conflictPath], {
      encoding: 'utf8',
    });
    assert.match(patch, /worker edit/);

    // The primary advanced the same file after the code worktree's recorded base.
    fs.writeFileSync(path.join(repository, conflictPath), 'before\nprimary edit\nafter\n');
    gitAt(repository, 'add', conflictPath);
    gitAt(repository, 'commit', '-q', '-m', 'primary edits same line');

    const apply = spawnSync('git', ['-C', repository, 'apply', '--3way', '--index', '-'], {
      encoding: 'utf8', input: patch,
    });
    const applyOutput = `${apply.stdout ?? ''}${apply.stderr ?? ''}`;
    const unmergedPaths = [...new Set(gitAt(repository, 'ls-files', '-u').split('\n').filter(Boolean)
      .map((entry) => entry.slice(entry.indexOf('\t') + 1)))];
    assert.notEqual(apply.status, 0, `3-way apply unexpectedly succeeded: ${applyOutput}`);
    assert.match(applyOutput, new RegExp(conflictPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(applyOutput, /conflict/i);
    assert.deepEqual(unmergedPaths, [conflictPath], 'surface the exact unresolved path');

    assert.equal((await parallelCall(hooks, 'parallel_task_outcome', {
      runId, taskId: 'code', outcome: 'integration-pending', evidence: ['worker-diff-reviewed'],
    })).ok, true);
    const refusedIntegration = await parallelCall(hooks, 'parallel_task_integrate', {
      runId, taskId: 'code', primaryReviewed: false,
    });
    assert.equal(refusedIntegration.ok, false);
    assert.match(refusedIntegration.error, /primary review confirmation/i);

    const inspection = await parallelCall(hooks, 'parallel_run_get', { runId });
    assert.equal(inspection.run.tasks.find((task) => task.id === 'code').status, 'integration-pending');
    assert.deepEqual(inspection.ready, [], 'the dependent remains blocked by unresolved integration');
    const completion = await parallelCall(hooks, 'workflow_tick', { action: 'code_complete' });
    assert.equal(completion.ok, false);
    assert.equal(completion.runStatus, 'integration-pending');
    assert.equal(load(repository).state, 'coding');
  });

  it('exposes primary-only explicit stale-lock inspection and recovery with inspected-token and dead-owner proof', async () => {
    const directory = path.join(tmpDir, 'parallel-lock-tools-repo');
    fs.mkdirSync(directory, { recursive: true });
    const { runId } = setCodingWorkflow(directory, 1700000000350);
    const hooks = await GuaranaOrchestrator({ directory });
    const created = await parallelCall(hooks, 'parallel_run_create', {
      subtasks: [{ id: 'read', mode: 'read-only', ownedPaths: [], goal: 'Read', condition: 'Report' }],
    });
    assert.equal(created.ok, true);

    const manifestFile = runManifestFile(directory, runId);
    const lockFile = `${manifestFile}.lock`;
    const emptyInspection = await parallelCall(hooks, 'parallel_run_lock_inspect', { runId });
    assert.deepEqual(emptyInspection, { ok: true, marker: null });
    const wrongRun = await parallelCall(hooks, 'parallel_run_lock_inspect', { runId: 'workflow-1699999999999' });
    assert.equal(wrongRun.ok, false);
    assert.match(wrongRun.error, /not bound to the current workflow/i);

    const liveMarker = {
      version: 1, token: 'a'.repeat(32), pid: process.pid, host: os.hostname(), createdAt: 1700000000351,
    };
    fs.mkdirSync(path.dirname(lockFile), { recursive: true });
    fs.writeFileSync(lockFile, `${JSON.stringify(liveMarker)}\n`, { mode: 0o600 });
    const inspected = await parallelCall(hooks, 'parallel_run_lock_inspect', { runId });
    assert.equal(inspected.ok, true);
    assert.deepEqual(inspected.marker, liveMarker);
    assert.deepEqual(Object.keys(inspected.marker).sort(), ['createdAt', 'host', 'pid', 'token', 'version']);

    for (const [tool, args] of [
      ['parallel_run_lock_inspect', { runId }],
      ['parallel_run_lock_recover', { runId, primaryReviewed: true, expectedToken: liveMarker.token }],
    ]) {
      const worker = await parallelCall(hooks, tool, args, { sessionID: 'worker-lock-tools', agent: 'worker-code' });
      assert.equal(worker.ok, false);
      assert.match(worker.error, /Task workers cannot inspect or mutate/i);
      assert.equal(fs.existsSync(lockFile), true);
    }

    const missingReview = await parallelCall(hooks, 'parallel_run_lock_recover', {
      runId, expectedToken: liveMarker.token,
    });
    assert.equal(missingReview.ok, false);
    assert.match(missingReview.error, /primary review confirmation/i);
    const falseReview = await parallelCall(hooks, 'parallel_run_lock_recover', {
      runId, primaryReviewed: false, expectedToken: liveMarker.token,
    });
    assert.equal(falseReview.ok, false);
    assert.match(falseReview.error, /primary review confirmation/i);
    const missingToken = await parallelCall(hooks, 'parallel_run_lock_recover', {
      runId, primaryReviewed: true,
    });
    assert.equal(missingToken.ok, false);
    assert.match(missingToken.error, /expected lock token/i);
    const tokenMismatch = await parallelCall(hooks, 'parallel_run_lock_recover', {
      runId, primaryReviewed: true, expectedToken: 'b'.repeat(32),
    });
    assert.equal(tokenMismatch.ok, false);
    assert.match(tokenMismatch.error, /changed since it was inspected/i);
    const liveOwner = await parallelCall(hooks, 'parallel_run_lock_recover', {
      runId, primaryReviewed: true, expectedToken: inspected.marker.token,
    });
    assert.equal(liveOwner.ok, false);
    assert.match(liveOwner.error, /owner is still alive/i);
    assert.equal(fs.existsSync(lockFile), true, 'live owner refusal leaves the lock intact');

    const deadPid = 2147483647;
    const staleMarker = {
      ...liveMarker, token: 'c'.repeat(32), pid: deadPid, createdAt: 1700000000352,
    };
    fs.writeFileSync(lockFile, `${JSON.stringify(staleMarker)}\n`, { mode: 0o600 });
    const staleInspection = await parallelCall(hooks, 'parallel_run_lock_inspect', { runId });
    assert.deepEqual(staleInspection.marker, staleMarker);

    const originalKill = process.kill;
    let provenDeadPid;
    let recovered;
    process.kill = function killWithDeadFixture(pid, signal) {
      if (pid === deadPid && signal === 0) {
        provenDeadPid = pid;
        const error = new Error('fixture process is terminated');
        error.code = 'ESRCH';
        throw error;
      }
      return originalKill.call(process, pid, signal);
    };
    try {
      recovered = await parallelCall(hooks, 'parallel_run_lock_recover', {
        runId, primaryReviewed: true, expectedToken: staleInspection.marker.token,
      });
    } finally {
      process.kill = originalKill;
    }
    assert.equal(provenDeadPid, deadPid, 'recovery proceeded only after the dead-owner probe');
    assert.equal(recovered.ok, true);
    assert.equal(recovered.recovered, true);
    assert.equal(recovered.runId, runId);
    assert.equal(recovered.token, staleInspection.marker.token);
    assert.equal(fs.existsSync(lockFile), false);

    const operationAfterRecovery = await parallelCall(hooks, 'parallel_task_start', {
      runId, taskId: 'read', goal: 'Read the code', condition: 'Return findings',
    });
    assert.equal(operationAfterRecovery.ok, true);
    assert.equal(operationAfterRecovery.run.tasks[0].status, 'running');
  });

  it('binds exactly one DAG to the current run_start workflow and rejects historical or caller-chosen run IDs', async () => {
    const repository = path.join(tmpDir, 'parallel-binding-repo');
    fs.mkdirSync(repository, { recursive: true });
    const hooks = await GuaranaOrchestrator({ directory: repository });
    const planning = apply(createWorkflow(), 'new_task', { goal: 'Not coding yet', ts: 1699999999990 });
    assert.ok(save(repository, planning));
    const outsideCoding = await parallelCall(hooks, 'parallel_run_create', {
      subtasks: [{ id: 'read', mode: 'read-only', ownedPaths: [], goal: 'Read', condition: 'Report' }],
    });
    assert.equal(outsideCoding.ok, false);
    assert.match(outsideCoding.error, /coding workflow whose latest event is run_start/i);

    setCodingWorkflow(repository, 1700000000400);
    let notAtRunStart = apply(load(repository), 'code_complete', { ts: 1700000000410 });
    notAtRunStart = apply(notAtRunStart, 'verify_fail', { ts: 1700000000420 });
    notAtRunStart = apply(notAtRunStart, 'fix_start', { ts: 1700000000430 });
    assert.ok(save(repository, notAtRunStart));
    const lateCreate = await parallelCall(hooks, 'parallel_run_create', {
      subtasks: [{ id: 'read', mode: 'read-only', ownedPaths: [], goal: 'Read', condition: 'Report' }],
    });
    assert.equal(lateCreate.ok, false);
    assert.match(lateCreate.error, /latest event is run_start/i);

    const { runId } = setCodingWorkflow(repository, 1700000000450);
    const arbitrary = await parallelCall(hooks, 'parallel_run_create', {
      runId: 'invented-second-run',
      subtasks: [{ id: 'read', mode: 'read-only', ownedPaths: [], goal: 'Read', condition: 'Report' }],
    });
    assert.equal(arbitrary.ok, false);
    assert.match(arbitrary.error, /cannot be supplied/i);
    assert.equal(fs.existsSync(path.join(repository, '.specs', 'state', 'parallel-runs', 'invented-second-run.json')), false);

    const created = await parallelCall(hooks, 'parallel_run_create', {
      subtasks: [{ id: 'read', mode: 'read-only', ownedPaths: [], goal: 'Read', condition: 'Report' }],
    });
    assert.equal(created.ok, true);
    assert.equal(created.runId, runId);
    assert.equal(Object.hasOwn(created.run, 'taskRequirements'), false);

    const historicalId = 'workflow-1699999999999';
    saveRunManifest(repository, makeRunManifest(historicalId, [
      { id: 'old', mode: 'read-only', ownedPaths: [] },
    ], { now: 1 }));
    for (const [tool, args] of [
      ['parallel_run_get', { runId: historicalId }],
      ['parallel_run_cancel', { runId: historicalId }],
      ['parallel_task_retry', { runId: historicalId, taskId: 'old', primaryReviewed: true }],
    ]) {
      const rejected = await parallelCall(hooks, tool, args);
      assert.equal(rejected.ok, false, `${tool} must reject a historical run`);
      assert.match(rejected.error, /not bound to the current workflow/i);
    }
    assert.equal((await parallelCall(hooks, 'parallel_run_get', { runId })).ok, true);

    const oldWorkflowBytes = fs.readFileSync(workflowFile(repository));
    const nextWorkflow = apply(load(repository), 'new_task', { goal: 'A new primary workflow', ts: 1700000000500 });
    assert.ok(save(repository, nextWorkflow));
    const staleAccess = await parallelCall(hooks, 'parallel_run_get', { runId });
    assert.equal(staleAccess.ok, false);
    assert.match(staleAccess.error, /no active workflow run bound/i);
    assert.notDeepEqual(fs.readFileSync(workflowFile(repository)), oldWorkflowBytes);
  });

  it('blocks workflow code_complete for active, integration-pending, or failed DAGs, but allows completed and non-DAG workflows', async () => {
    const blockedCases = [
      {
        name: 'active',
        manifest: (runId, timestamp) => transitionSubtask(
          makeRunManifest(runId, [{ id: 'read', mode: 'read-only', ownedPaths: [] }], { now: timestamp }),
          'read', 'running', { now: timestamp + 1 },
        ),
        expectedStatus: 'running',
      },
      {
        name: 'integration-pending',
        manifest: (runId, timestamp) => {
          let current = makeRunManifest(runId, [{ id: 'code', mode: 'code', ownedPaths: ['src/change.js'] }], { now: timestamp });
          current = recordCodeWorktree(current, 'code', {
            baseCommit: 'a'.repeat(40), worktreePath: `/tmp/${runId}`, now: timestamp + 1,
          });
          current = transitionSubtask(current, 'code', 'running', { now: timestamp + 2 });
          return transitionSubtask(current, 'code', 'integration-pending', { now: timestamp + 3 });
        },
        expectedStatus: 'integration-pending',
      },
      {
        name: 'failed',
        manifest: (runId, timestamp) => {
          let current = makeRunManifest(runId, [{ id: 'read', mode: 'read-only', ownedPaths: [] }], { now: timestamp });
          current = transitionSubtask(current, 'read', 'running', { now: timestamp + 1 });
          return transitionSubtask(current, 'read', 'failed', { now: timestamp + 2 });
        },
        expectedStatus: 'failed',
      },
    ];

    for (const [index, scenario] of blockedCases.entries()) {
      const directory = path.join(tmpDir, `parallel-code-complete-${scenario.name}`);
      fs.mkdirSync(directory, { recursive: true });
      const timestamp = 1700000000600 + index * 100;
      const { runId } = setCodingWorkflow(directory, timestamp);
      const hooks = await GuaranaOrchestrator({ directory });
      const manifest = scenario.manifest(runId, timestamp + 10);
      assert.equal(manifest.status, scenario.expectedStatus);
      saveRunManifest(directory, manifest);
      const workflowPath = workflowFile(directory);
      const before = fs.readFileSync(workflowPath);
      const result = await parallelCall(hooks, 'workflow_tick', { action: 'code_complete' });
      assert.equal(result.ok, false, scenario.name);
      assert.equal(result.runStatus, scenario.expectedStatus);
      assert.equal(load(directory).state, 'coding');
      assert.deepEqual(fs.readFileSync(workflowPath), before, `${scenario.name} rejection must not persist workflow changes`);
    }

    const completedDirectory = path.join(tmpDir, 'parallel-code-complete-success');
    fs.mkdirSync(completedDirectory, { recursive: true });
    const completedTimestamp = 1700000001000;
    const { runId: completedRunId } = setCodingWorkflow(completedDirectory, completedTimestamp);
    const completedHooks = await GuaranaOrchestrator({ directory: completedDirectory });
    let completed = makeRunManifest(completedRunId, [
      { id: 'audit', mode: 'read-only', ownedPaths: [] },
      { id: 'code', mode: 'code', ownedPaths: ['src/change.js'] },
    ], { now: completedTimestamp + 10 });
    completed = recordCodeWorktree(completed, 'code', {
      baseCommit: 'b'.repeat(40), worktreePath: `/tmp/${completedRunId}`, now: completedTimestamp + 11,
    });
    completed = transitionSubtask(completed, 'code', 'running', { now: completedTimestamp + 12 });
    completed = transitionSubtask(completed, 'code', 'integration-pending', { now: completedTimestamp + 13 });
    completed = integrateCodeSubtask(completed, 'code', { primaryReviewed: true, now: completedTimestamp + 14 });
    completed = transitionSubtask(completed, 'audit', 'running', { now: completedTimestamp + 15 });
    completed = transitionSubtask(completed, 'audit', 'completed', { now: completedTimestamp + 16 });
    assert.equal(completed.status, 'completed');
    saveRunManifest(completedDirectory, completed);
    const success = await parallelCall(completedHooks, 'workflow_tick', { action: 'code_complete' });
    assert.equal(success.ok, true);
    assert.equal(success.state, 'verifying');

    const ordinaryDirectory = path.join(tmpDir, 'normal-code-complete-without-dag');
    fs.mkdirSync(ordinaryDirectory, { recursive: true });
    setCodingWorkflow(ordinaryDirectory, 1700000001200);
    const ordinaryHooks = await GuaranaOrchestrator({ directory: ordinaryDirectory });
    const ordinary = await parallelCall(ordinaryHooks, 'workflow_tick', { action: 'code_complete' });
    assert.equal(ordinary.ok, true);
    assert.equal(ordinary.state, 'verifying');
  });

  it('workflow force events keep code_complete bound to the current incomplete DAG', async () => {
    const directory = path.join(tmpDir, 'parallel-force-binding');
    fs.mkdirSync(directory, { recursive: true });
    const { runId } = setCodingWorkflow(directory, 1700000001300);
    const hooks = await GuaranaOrchestrator({ directory });
    assert.equal((await parallelCall(hooks, 'parallel_run_create', {
      subtasks: [{ id: 'active-read', mode: 'read-only', ownedPaths: [], goal: 'Read', condition: 'Report' }],
    })).ok, true);
    assert.equal((await parallelCall(hooks, 'parallel_task_start', {
      runId, taskId: 'active-read', goal: 'Read', condition: 'Report',
    })).ok, true);

    const forceVerify = await parallelCall(hooks, 'workflow_tick', { action: 'force', skill: 'verify' });
    assert.equal(forceVerify.ok, false);
    assert.equal(forceVerify.runStatus, 'running');
    assert.equal(load(directory).state, 'coding');
    const forceCoding = await parallelCall(hooks, 'workflow_tick', { action: 'force', skill: 'code' });
    assert.equal(forceCoding.ok, true);
    assert.equal(forceCoding.state, 'coding');

    const before = fs.readFileSync(workflowFile(directory));
    const completion = await parallelCall(hooks, 'workflow_tick', { action: 'code_complete' });
    assert.equal(completion.ok, false);
    assert.equal(completion.runStatus, 'running');
    assert.equal(load(directory).state, 'coding');
    assert.deepEqual(fs.readFileSync(workflowFile(directory)), before);
    assert.equal((await parallelCall(hooks, 'parallel_run_get', { runId })).run.status, 'running');
  });

  it('blocks every plugin transition into verifying or completed until the bound DAG is completed and integrated', async () => {
    const cases = [
      { name: 'code_complete', action: { action: 'code_complete' }, source: 'coding' },
      { name: 'verify_skip-from-coding', action: { action: 'verify_skip' }, source: 'coding' },
      { name: 'verify_skip-from-verifying', action: { action: 'verify_skip' }, source: 'verifying' },
      { name: 'force-verify-from-coding', action: { action: 'force', skill: 'verify' }, source: 'coding' },
      { name: 'debug_complete', action: { action: 'debug_complete' }, source: 'debugging' },
      { name: 'verify_pass', action: { action: 'verify_pass' }, source: 'verifying' },
    ];

    for (const [index, scenario] of cases.entries()) {
      const directory = path.join(tmpDir, `parallel-transition-barrier-${scenario.name}`);
      fs.mkdirSync(directory, { recursive: true });
      const timestamp = 1700000002000 + index * 100;
      const { runId } = setCodingWorkflow(directory, timestamp);
      if (scenario.source !== 'coding') {
        let workflow = apply(load(directory), 'code_complete', { ts: timestamp + 10 });
        assert.ok(workflow);
        if (scenario.source === 'debugging') {
          workflow = apply(workflow, 'verify_fail', { ts: timestamp + 11 });
          assert.ok(workflow);
        }
        assert.equal(workflow.state, scenario.source);
        assert.ok(save(directory, workflow));
      }

      const hooks = await GuaranaOrchestrator({ directory });
      saveRunManifest(directory, makeRunManifest(runId, [
        { id: 'pending', mode: 'read-only', ownedPaths: [] },
      ], { now: timestamp + 20 }));
      const workflowPath = workflowFile(directory);
      const before = fs.readFileSync(workflowPath);
      const workflowEventCount = fs.existsSync(path.join(directory, '.specs', 'state', 'telemetry', 'events.jsonl'))
        ? fs.readFileSync(path.join(directory, '.specs', 'state', 'telemetry', 'events.jsonl'), 'utf8')
          .split('\n').filter((line) => line && JSON.parse(line).type === 'workflow').length
        : 0;

      const rejected = await parallelCall(hooks, 'workflow_tick', scenario.action);
      assert.equal(rejected.ok, false, scenario.name);
      assert.equal(rejected.runStatus, 'pending', scenario.name);
      assert.match(rejected.error, /completed and integrated/i, scenario.name);
      assert.deepEqual(fs.readFileSync(workflowPath), before, `${scenario.name} must not persist workflow state/history`);
      const afterEvents = fs.existsSync(path.join(directory, '.specs', 'state', 'telemetry', 'events.jsonl'))
        ? fs.readFileSync(path.join(directory, '.specs', 'state', 'telemetry', 'events.jsonl'), 'utf8')
          .split('\n').filter((line) => line && JSON.parse(line).type === 'workflow').length
        : 0;
      assert.equal(afterEvents, workflowEventCount, `${scenario.name} must not append workflow history telemetry`);
    }

    // chat.message has its own state-apply path; it must use the same gate.
    const { runId } = setCodingWorkflow(tmpDir, 1700000002600);
    saveRunManifest(tmpDir, makeRunManifest(runId, [
      { id: 'chat-pending', mode: 'read-only', ownedPaths: [] },
    ], { now: 1700000002610 }));
    const beforeChat = fs.readFileSync(workflowFile(tmpDir));
    const beforeWorkflowEvents = readEvents().filter((event) => event.type === 'workflow').length;
    await api['chat.message'](
      { sessionID: 'dag-chat-force', messageID: 'dag-chat-force-message', agent: 'guarana' },
      { parts: parts('guarana:verify') },
    );
    assert.deepEqual(fs.readFileSync(workflowFile(tmpDir)), beforeChat);
    assert.equal(readEvents().filter((event) => event.type === 'workflow').length, beforeWorkflowEvents);
  });

  it('fails closed for missing or unreadable manifests after a workflow DAG was bound', async () => {
    for (const [index, mode] of ['missing', 'unreadable'].entries()) {
      const directory = path.join(tmpDir, `parallel-transition-${mode}`);
      fs.mkdirSync(directory, { recursive: true });
      const { runId } = setCodingWorkflow(directory, 1700000002700 + index * 100);
      const hooks = await GuaranaOrchestrator({ directory });
      const created = await parallelCall(hooks, 'parallel_run_create', {
        subtasks: [{ id: 'bound', mode: 'read-only', ownedPaths: [], goal: 'Read', condition: 'Report' }],
      });
      assert.equal(created.ok, true);
      const manifestPath = runManifestFile(directory, runId);
      if (mode === 'missing') fs.rmSync(manifestPath);
      else fs.writeFileSync(manifestPath, '{unreadable-json');

      const workflowPath = workflowFile(directory);
      const before = fs.readFileSync(workflowPath);
      const afterRestart = await GuaranaOrchestrator({ directory });
      const rejected = await parallelCall(afterRestart, 'workflow_tick', { action: 'code_complete' });
      assert.equal(rejected.ok, false, mode);
      assert.equal(rejected.runStatus, mode === 'missing' ? 'missing' : 'unavailable', mode);
      assert.match(rejected.error, mode === 'missing' ? /is missing/i : /unreadable/i, mode);
      assert.deepEqual(fs.readFileSync(workflowPath), before, `${mode} rejection must not persist workflow state/history`);
    }
  });

  it('allows final transitions for a completed-and-integrated DAG and for ordinary no-DAG workflows', async () => {
    const completedDirectory = path.join(tmpDir, 'parallel-transition-completed');
    fs.mkdirSync(completedDirectory, { recursive: true });
    const completedTimestamp = 1700000002900;
    const { runId } = setCodingWorkflow(completedDirectory, completedTimestamp);
    const completedHooks = await GuaranaOrchestrator({ directory: completedDirectory });
    let manifest = makeRunManifest(runId, [
      { id: 'audit', mode: 'read-only', ownedPaths: [] },
      { id: 'code', mode: 'code', ownedPaths: ['src/change.js'] },
    ], { now: completedTimestamp + 10 });
    manifest = recordCodeWorktree(manifest, 'code', {
      baseCommit: 'c'.repeat(40), worktreePath: `/tmp/${runId}`, now: completedTimestamp + 11,
    });
    manifest = transitionSubtask(manifest, 'code', 'running', { now: completedTimestamp + 12 });
    manifest = transitionSubtask(manifest, 'code', 'integration-pending', { now: completedTimestamp + 13 });
    manifest = integrateCodeSubtask(manifest, 'code', { primaryReviewed: true, now: completedTimestamp + 14 });
    manifest = transitionSubtask(manifest, 'audit', 'running', { now: completedTimestamp + 15 });
    manifest = transitionSubtask(manifest, 'audit', 'completed', { now: completedTimestamp + 16 });
    assert.equal(manifest.status, 'completed');
    saveRunManifest(completedDirectory, manifest);

    const enterVerification = await parallelCall(completedHooks, 'workflow_tick', { action: 'code_complete' });
    assert.equal(enterVerification.ok, true);
    assert.equal(enterVerification.state, 'verifying');
    const finishVerification = await parallelCall(completedHooks, 'workflow_tick', { action: 'verify_pass' });
    assert.equal(finishVerification.ok, true);
    assert.equal(finishVerification.state, 'completed');
    assert.equal(load(completedDirectory).history.at(-1).event, 'verify_pass');

    const ordinaryDirectory = path.join(tmpDir, 'ordinary-transition-no-dag');
    fs.mkdirSync(ordinaryDirectory, { recursive: true });
    setCodingWorkflow(ordinaryDirectory, 1700000003100);
    const ordinaryHooks = await GuaranaOrchestrator({ directory: ordinaryDirectory });
    assert.equal((await parallelCall(ordinaryHooks, 'workflow_tick', { action: 'code_complete' })).state, 'verifying');
    assert.equal((await parallelCall(ordinaryHooks, 'workflow_tick', { action: 'verify_pass' })).state, 'completed');

    // An old run's sidecar/binding is history, not a DAG for the task started
    // after new_task; workflowRunId binds only the latest run_start after it.
    const restartedTaskDirectory = path.join(tmpDir, 'parallel-transition-new-task');
    fs.mkdirSync(restartedTaskDirectory, { recursive: true });
    const oldRun = setCodingWorkflow(restartedTaskDirectory, 1700000003200);
    const restartedHooks = await GuaranaOrchestrator({ directory: restartedTaskDirectory });
    assert.equal((await parallelCall(restartedHooks, 'parallel_run_create', {
      subtasks: [{ id: 'old', mode: 'read-only', ownedPaths: [], goal: 'Old', condition: 'Old report' }],
    })).ok, true);
    for (const action of ['new_task', 'plan_complete', 'run_start']) {
      const result = await parallelCall(restartedHooks, 'workflow_tick', {
        action, ...(action === 'new_task' ? { goal: 'New ordinary task' } : {}),
      });
      assert.equal(result.ok, true, action);
    }
    assert.ok(fs.existsSync(runManifestFile(restartedTaskDirectory, oldRun.runId)), 'historical DAG remains intact');
    assert.equal((await parallelCall(restartedHooks, 'workflow_tick', { action: 'code_complete' })).state, 'verifying');
  });

  it('guards completed-to-verifying force against its incomplete DAG without rebinding it after new_task', async () => {
    const directory = path.join(tmpDir, 'parallel-completed-force-guard');
    fs.mkdirSync(directory, { recursive: true });
    const timestamp = 1700000003300;
    const { runId } = setCodingWorkflow(directory, timestamp);
    const hooks = await GuaranaOrchestrator({ directory });
    const created = await parallelCall(hooks, 'parallel_run_create', {
      subtasks: [{ id: 'legacy-pending', mode: 'read-only', ownedPaths: [], goal: 'Read', condition: 'Report' }],
    });
    assert.equal(created.ok, true);

    // Model an imported/legacy completed workflow whose prior verification
    // bypassed the still-incomplete DAG.
    let legacyCompleted = apply(load(directory), 'code_complete', { ts: timestamp + 10 });
    legacyCompleted = apply(legacyCompleted, 'verify_pass', { ts: timestamp + 11 });
    assert.equal(legacyCompleted.state, 'completed');
    assert.ok(save(directory, legacyCompleted));
    const workflowPath = workflowFile(directory);
    const eventsPath = path.join(directory, '.specs', 'state', 'telemetry', 'events.jsonl');
    const workflowEventCount = () => {
      try {
        return fs.readFileSync(eventsPath, 'utf8').split('\n')
          .filter((line) => line && JSON.parse(line).type === 'workflow').length;
      } catch {
        return 0;
      }
    };
    const before = fs.readFileSync(workflowPath);
    const beforeEventCount = workflowEventCount();

    const rejected = await parallelCall(hooks, 'workflow_tick', { action: 'force', skill: 'verify' });
    assert.equal(rejected.ok, false);
    assert.equal(rejected.runStatus, 'pending');
    assert.match(rejected.error, /completed and integrated/i);
    assert.deepEqual(fs.readFileSync(workflowPath), before, 'rejected force must preserve workflow bytes/history');
    assert.equal(workflowEventCount(), beforeEventCount,
    'rejection must not append workflow telemetry');
    const activeRunInspection = await parallelCall(hooks, 'parallel_run_get', { runId });
    assert.equal(activeRunInspection.ok, false, 'normal parallel tools remain unavailable after completed');
    assert.match(activeRunInspection.error, /no active workflow run bound/i);

    for (const [index, action] of ['new_task', 'plan_complete', 'run_start', 'code_complete', 'verify_pass'].entries()) {
      const result = await parallelCall(hooks, 'workflow_tick', {
        action, ...(action === 'new_task' ? { goal: 'Start a new ordinary task' } : {}),
      });
      assert.equal(result.ok, true, `${action} after new_task`);
      if (index === 4) assert.equal(result.state, 'completed');
    }
    assert.ok(fs.existsSync(runManifestFile(directory, runId)), 'the historical DAG marker remains present');
    const newTaskForce = await parallelCall(hooks, 'workflow_tick', { action: 'force', skill: 'verify' });
    assert.equal(newTaskForce.ok, true, 'the later task must not inherit its predecessor DAG binding');
    assert.equal(newTaskForce.state, 'verifying');
  });

  it('cancellation, restart reconciliation, and explicit outcome review retain active capacity without claiming host cancellation', async () => {
    const repository = path.join(tmpDir, 'parallel-cancel-repo');
    initGitRepo(repository);
    const hooks = await GuaranaOrchestrator({ directory: repository });
    const { runId } = setCodingWorkflow(repository, 1700000000100);
    await parallelCall(hooks, 'parallel_run_create', {
      subtasks: ['alpha', 'beta', 'queued'].map((id) => ({
        id, mode: 'read-only', ownedPaths: [], goal: `Goal ${id}`, condition: `Condition ${id}`,
      })),
    });
    for (const taskId of ['alpha', 'beta']) {
      const started = await parallelCall(hooks, 'parallel_task_start', {
        runId, taskId, goal: `Goal ${taskId}`, condition: `Condition ${taskId}`,
      });
      assert.equal(started.ok, true);
    }
    const requested = await parallelCall(hooks, 'parallel_task_outcome', {
      runId, taskId: 'alpha', outcome: 'cancel-requested',
    });
    assert.equal(requested.run.tasks.find((task) => task.id === 'alpha').status, 'cancel-requested');
    assert.deepEqual(requested.ready, [], 'both running and cancel-requested tasks reserve the two slots');
    const noHostHandle = await parallelCall(hooks, 'parallel_task_confirm_termination', {
      runId, taskId: 'alpha', hostConfirmed: false,
    });
    assert.equal(noHostHandle.ok, false);
    assert.match(noHostHandle.error, /host termination confirmation/i);
    assert.equal((await parallelCall(hooks, 'parallel_run_get', { runId })).run.tasks
      .find((task) => task.id === 'alpha').status, 'cancel-requested');

    const restarted = await GuaranaOrchestrator({ directory: repository });
    const noReview = await parallelCall(restarted, 'parallel_run_reconcile', { runId, primaryReviewed: false });
    assert.equal(noReview.ok, false);
    const reconciledRun = await parallelCall(restarted, 'parallel_run_reconcile', { runId, primaryReviewed: true });
    assert.equal(reconciledRun.run.tasks.find((task) => task.id === 'alpha').status, 'cancel-requested');
    assert.equal(reconciledRun.run.tasks.find((task) => task.id === 'beta').status, 'needs-reconciliation');
    assert.deepEqual(reconciledRun.ready, [], 'restart reconciliation retains both occupied slots');
    const resolvedAlpha = await parallelCall(restarted, 'parallel_task_reconcile', {
      runId, taskId: 'alpha', primaryReviewed: true, outcome: 'cancelled', evidence: ['termination-observed'],
    });
    assert.equal(resolvedAlpha.ok, true);
    const resolvedBeta = await parallelCall(restarted, 'parallel_task_reconcile', {
      runId, taskId: 'beta', primaryReviewed: true, outcome: 'completed',
    });
    assert.deepEqual(resolvedBeta.ready, ['queued']);
    const canceled = await parallelCall(restarted, 'parallel_run_cancel', { runId });
    assert.equal(canceled.run.tasks.find((task) => task.id === 'queued').status, 'cancelled');
  });

  it('code retry requires primary review and a fresh verified worktree before another start', async () => {
    const repository = path.join(tmpDir, 'parallel-retry-repo');
    initGitRepo(repository);
    const worktree = path.join(tmpDir, 'parallel-retry-worktree');
    addGitWorktree(repository, worktree);
    const hooks = await GuaranaOrchestrator({ directory: repository });
    const { runId } = setCodingWorkflow(repository, 1700000000200);
    await parallelCall(hooks, 'parallel_run_create', {
      subtasks: [{ id: 'patch', mode: 'code', ownedPaths: ['src/patch.js'], goal: 'Patch it', condition: 'Patch passes' }],
    });
    assert.equal((await parallelCall(hooks, 'parallel_task_preflight', {
      runId, taskId: 'patch', worktreePath: worktree,
    })).ok, true);
    assert.equal((await parallelCall(hooks, 'parallel_task_start', {
      runId, taskId: 'patch', goal: 'Patch it', condition: 'Patch passes',
    })).ok, true);
    assert.equal((await parallelCall(hooks, 'parallel_task_outcome', {
      runId, taskId: 'patch', outcome: 'failed', evidence: ['failed-check'],
    })).ok, true);
    assert.equal((await parallelCall(hooks, 'parallel_task_retry', {
      runId, taskId: 'patch', primaryReviewed: false,
    })).ok, false);
    const retried = await parallelCall(hooks, 'parallel_task_retry', {
      runId, taskId: 'patch', primaryReviewed: true,
    });
    assert.equal(retried.ok, true);
    assert.equal(Object.hasOwn(retried.run.tasks.find((task) => task.id === 'patch'), 'worktreePath'), false);
    const withoutFreshPreflight = await parallelCall(hooks, 'parallel_task_start', {
      runId, taskId: 'patch', goal: 'Patch it', condition: 'Patch passes',
    });
    assert.equal(withoutFreshPreflight.ok, false);
    const reusedWorktree = await parallelCall(hooks, 'parallel_task_preflight', {
      runId, taskId: 'patch', worktreePath: worktree,
    });
    assert.equal(reusedWorktree.ok, false);
    assert.match(reusedWorktree.error, /already used/i);
    const freshWorktree = path.join(tmpDir, 'parallel-retry-worktree-second-attempt');
    addGitWorktree(repository, freshWorktree);
    assert.equal((await parallelCall(hooks, 'parallel_task_preflight', {
      runId, taskId: 'patch', worktreePath: freshWorktree,
    })).ok, true);
    assert.equal((await parallelCall(hooks, 'parallel_task_start', {
      runId, taskId: 'patch', goal: 'Patch it', condition: 'Patch passes',
    })).ok, true);
  });

  it('worker-research is a native worker role and cannot mutate primary-owned parallel sidecars', async () => {
    const repository = path.join(tmpDir, 'parallel-worker-repo');
    initGitRepo(repository);
    const hooks = await GuaranaOrchestrator({ directory: repository });
    const { runId } = setCodingWorkflow(repository, 1700000000300);
    const create = await parallelCall(hooks, 'parallel_run_create', {
      subtasks: [{ id: 'read', mode: 'read-only', ownedPaths: [], goal: 'Read', condition: 'Report' }],
    });
    assert.equal(create.ok, true);
    assert.equal(create.runId, runId);
    const manifestFile = path.join(repository, '.specs', 'state', 'parallel-runs', `${runId}.json`);
    const before = fs.readFileSync(manifestFile);
    for (const [index, agent] of ['worker-code', 'worker-research'].entries()) {
      const worker = await parallelCall(hooks, 'parallel_task_start', {
        runId, taskId: 'read', goal: 'Read', condition: 'Report',
      }, { sessionID: `native-${agent}-${index}`, agent });
      assert.equal(worker.ok, false);
      assert.match(worker.error, /Task workers cannot inspect or mutate/i);
      assert.deepEqual(fs.readFileSync(manifestFile), before);
    }
    await hooks.event({ event: { type: 'session.created', properties: {
      sessionID: 'worker-research-session-2', info: { id: 'worker-research-session-2', parentID: 'primary', agent: 'worker-research' },
    } } });
    const workflowBefore = fs.existsSync(workflowFile(repository)) ? fs.readFileSync(workflowFile(repository)) : null;
    await hooks['chat.message'](
      { sessionID: 'worker-research-session-2', agent: 'worker-research' },
      { parts: parts('Do not start another workflow') },
    );
    const childSystem = { system: [] };
    await hooks['experimental.chat.system.transform']({ sessionID: 'worker-research-session-2' }, childSystem);
    assert.deepEqual(childSystem.system, []);
    assert.deepEqual(fs.existsSync(workflowFile(repository)) ? fs.readFileSync(workflowFile(repository)) : null, workflowBefore);
    assert.deepEqual(fs.readFileSync(manifestFile), before);
  });

  it('never throws on corrupt persisted state', async () => {
    fs.mkdirSync(path.dirname(workflowFile(tmpDir)), { recursive: true });
    fs.writeFileSync(workflowFile(tmpDir), '{nope', 'utf8');
    await chat('Implement OAuth');
    assert.equal(workflow().state, 'planning');
  });
});
