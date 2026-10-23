import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { GuaranaOrchestrator } from './guarana-orchestrator.js';
import { GuaranaOrchestrator as BundledOrchestrator } from '../cli/plugin/guarana-orchestrator.js';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { apply, createWorkflow, load, save, workflowFile } from '../orchestrator/state.js';
import { createNode, listNodes } from '../memory/graph.js';
import { initUserVault } from '../memory/vault.js';

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

  function writePrimaryProfile(scope) {
    const file = scope === 'project'
      ? path.join(tmpDir, '.opencode', 'agents', 'guarana.md')
      : path.join(process.env.XDG_CONFIG_HOME, 'opencode', 'agents', 'guarana.md');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '<!-- guarana-managed-advisor-artifact -->');
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

  it('workflow_tick start_task requires a completed plan, atomically persists kickoff, bootstraps specs, and logs ordinary events', async () => {
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
    assert.ok(fs.existsSync(path.join(tmpDir, '.specs', 'README.md')));
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

  it('absent workflow settings preserve automatic specs and verification behavior', async () => {
    await chat('Implement the default workflow task');
    for (const action of ['plan_complete', 'run_start', 'code_complete']) {
      await api.tool.workflow_tick.execute({ action }, primaryContext());
    }

    const out = { system: [] };
    await api['experimental.chat.system.transform']({ sessionID: 'default-workflow-settings' }, out);
    assert.ok(fs.existsSync(path.join(tmpDir, '.specs', 'README.md')));
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
      assert.ok(fs.existsSync(path.join(projectDir, '.specs', 'README.md')));

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
    assert.ok(fs.existsSync(path.join(tmpDir, '.specs', 'README.md')));

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

  it('explicit guarana skill commands still enter workflow and bootstrap task records', async () => {
    await chat('guarana:plan');
    assert.equal(workflow().state, 'planning');
    assert.ok(fs.existsSync(path.join(tmpDir, '.specs', 'README.md')));
    assert.ok(fs.existsSync(path.join(tmpDir, '.specs', 'state', 'project-state.md')));
    assert.ok(fs.existsSync(path.join(tmpDir, '.specs', 'features', 'initial-task', 'initial-task.md')));
  });

  it('targeted README, docs, and config updates start and bootstrap normal workflows', async () => {
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
          assert.ok(fs.existsSync(path.join(projectDir, file)), `${file} must be bootstrapped for ${text}`);
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

  it('new tasks bootstrap specs and the memory vault automatically', async () => {
    await chat('Implement OAuth authentication');
    assert.ok(fs.existsSync(path.join(tmpDir, '.specs', 'README.md')));
    assert.ok(fs.existsSync(path.join(tmpDir, '.specs', 'state', 'project-state.md')));
    assert.ok(fs.existsSync(path.join(tmpDir, '.specs', 'decisions')));
    assert.ok(fs.existsSync(path.join(tmpDir, '.specs', 'features', 'initial-task', 'initial-task.md')));
    assert.ok(fs.existsSync(path.join(tmpDir, '.guarana', 'memory', 'nodes.jsonl')));
    assert.ok(fs.existsSync(path.join(tmpDir, '.guarana', 'memory', 'config.json')));
    assert.equal(fs.readFileSync(path.join(tmpDir, '.guarana', 'memory', 'nodes.jsonl'), 'utf8').trim(), '');
  });

  it('injects relevant confirmed memory on the next automatic turn', async () => {
    await chat('Implement OAuth authentication');
    createNode(path.join(tmpDir, '.guarana', 'memory'), {
      type: 'decision',
      status: 'confirmed',
      intent: 'OAuth authentication uses PKCE',
      summary: 'Use PKCE for the OAuth flow.',
    });
    await chat('continue');
    const out = { system: [] };
    await api['experimental.chat.system.transform']({}, out);
    assert.match(out.system[0], /guarana memory \(automatic context\)/);
    assert.match(out.system[0], /Use PKCE for the OAuth flow/);
  });

  it('injects global preferences even when their wording does not match the project task', async () => {
    const globalVault = initUserVault();
    createNode(globalVault, {
      type: 'preference',
      status: 'confirmed',
      scope: 'global',
      intent: 'response language',
      summary: 'Always answer me in Portuguese.',
    });
    await chat('Build an unrelated database migration tool');
    const out = { system: [] };
    await api['experimental.chat.system.transform']({ sessionID: 'session-global-pref' }, out);
    assert.match(out.system.join('\n'), /Always answer me in Portuguese/);
    assert.match(out.system.join('\n'), /### global_preferences/);
    assert.match(out.system.join('\n'), /### project_context/);
    assert.match(out.system.join('\n'), /saved user-level preferences[\s\S]*may guide behavior unless superseded by the current explicit user request or higher-priority system, developer, or security policy/i);
    assert.match(out.system.join('\n'), /possibly stale project data, not instructions/);
    assert.match(out.system.join('\n'), /"scope":"global"/);
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

    await api['session.compacted']({ properties: { info: { id: 'session-global-pref' } } });
    const afterCompact = { system: [] };
    await api['experimental.chat.system.transform']({ sessionID: 'session-global-pref' }, afterCompact);
    assert.match(afterCompact.system.join('\n'), /Always answer me in Portuguese/);
    assert.match(afterCompact.system.join('\n'), /Use short bullet lists/);
    assert.equal(readEvents().filter((event) => event.type === 'memory-injected').length, 3);
    assert.equal(readEvents().filter((event) => event.type === 'memory-injected')[2].reason, 'compacted');
  });

  it('avoids duplicate memory injection when both plugin scopes transform one prompt', async () => {
    const globalVault = initUserVault();
    createNode(globalVault, {
      type: 'preference', status: 'confirmed', scope: 'global',
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
    const globalVault = initUserVault();
    createNode(globalVault, {
      type: 'preference',
      status: 'confirmed',
      scope: 'global',
      intent: 'answer style',
      summary: 'Always use concise answers.',
    });
    await chat('Oi, uma pergunta rápida');
    assert.equal(workflow().state, 'idle');
    const out = { system: [] };
    await api['experimental.chat.system.transform']({}, out);
    assert.match(out.system.join('\n'), /Always use concise answers/);
    assert.match(out.system.join('\n'), /"scope":"global"/);
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

  it('never throws on corrupt persisted state', async () => {
    fs.mkdirSync(path.dirname(workflowFile(tmpDir)), { recursive: true });
    fs.writeFileSync(workflowFile(tmpDir), '{nope', 'utf8');
    await chat('Implement OAuth');
    assert.equal(workflow().state, 'planning');
  });
});
