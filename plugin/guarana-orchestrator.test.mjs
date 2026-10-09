import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { GuaranaOrchestrator } from './guarana-orchestrator.js';
import { GuaranaOrchestrator as BundledOrchestrator } from '../cli/plugin/guarana-orchestrator.js';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { load, workflowFile } from '../orchestrator/state.js';
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

  it('same user message is processed once when global and project plugin instances are both loaded', async () => {
    const duplicate = await GuaranaOrchestrator({ directory: tmpDir });
    const input = { sessionID: 's1', messageID: 'same-user-message', agent: 'build' };
    const output = { message: { id: 'same-user-message', agent: 'build' }, parts: parts('Implement one exact task') };
    await api['chat.message'](input, output);
    await duplicate['chat.message'](input, output);

    assert.equal(workflow().state, 'planning');
    assert.equal(workflow().history.filter((entry) => entry.event === 'new_task').length, 1);
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
    assert.match(out.system.join('\n'), /"scope":"global"/);
    const injected = readEvents().find((event) => event.type === 'memory-injected');
    assert.equal(injected.sessionID, 'session-global-pref');
    assert.equal(injected.reason, 'session-start');
    assert.deepEqual(injected.memories, [{ id: listNodes(globalVault).find((n) => n.type === 'preference').id, type: 'preference', scope: 'global' }]);
    assert.equal('summary' in injected.memories[0], false);

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
    assert.match(out.system[0], /plan_complete/);
  });

  it('workflow_tick advances the state machine deterministically', async () => {
    const tick = async (action) => JSON.parse(await api.tool.workflow_tick.execute({ action }));
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

  it('Task child sessions cannot re-plan, inject the parent workflow, or advance its state', async () => {
    const tick = async (action) => JSON.parse(await api.tool.workflow_tick.execute({ action }));
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
      { action: 'code_complete' },
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
      await api.tool.workflow_tick.execute({ action });
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

  it('workflow_tick refreshes the active skill injection', async () => {
    await chat('Implement OAuth authentication');
    await api.tool.workflow_tick.execute({ action: 'plan_complete' });
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
      await api.tool.workflow_tick.execute({ action });
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
      await api.tool.workflow_tick.execute({ action });
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
    const res = JSON.parse(await api.tool.workflow_tick.execute({ action: 'code_complete' }));
    assert.equal(res.ok, false);
    assert.match(res.error, /illegal transition/);
    assert.equal(workflow().state, 'idle');
  });

  it('verify failure via tool result auto-moves to debugging', async () => {
    // Drive to verifying via ticks, then fire a failing tool result.
    for (const a of ['new_task', 'plan_complete', 'run_start', 'code_complete']) {
      await api.tool.workflow_tick.execute({ action: a });
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
      await api.tool.workflow_tick.execute({ action: a });
    }
    // coding active; a casual continuation must not re-plan.
    await chat('keep going');
    const wf = workflow();
    assert.equal(wf.state, 'coding');
    assert.equal(wf.history.filter((h) => h.event === 'new_task').length, 1);
  });

  it('never throws on corrupt persisted state', async () => {
    fs.mkdirSync(path.dirname(workflowFile(tmpDir)), { recursive: true });
    fs.writeFileSync(workflowFile(tmpDir), '{nope', 'utf8');
    await chat('Implement OAuth');
    assert.equal(workflow().state, 'planning');
  });
});
