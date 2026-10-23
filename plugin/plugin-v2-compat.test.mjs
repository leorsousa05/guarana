import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import MemoryPlugin, { GuaranaMemory } from './guarana-memory.js';
import OrchestratorPlugin, { GuaranaOrchestrator } from './guarana-orchestrator.js';
import TelemetryPlugin, { GuaranaTelemetry } from './guarana-telemetry.js';
import { apply, createWorkflow, load, save, workflowFile } from '../orchestrator/state.js';

const temporaryDirectories = [];
function temporaryDirectory(prefix) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

function mockContext(directory, events = [], session = {}) {
  const tools = new Map();
  const toolHooks = new Map();
  const sessionHooks = new Map();
  let setDefaultAgent;
  let finishEvents;
  let subscriptionSignal;
  const eventDrained = new Promise((resolve) => { finishEvents = resolve; });
  return {
    tools,
    toolHooks,
    sessionHooks,
    eventDrained,
    get setDefaultAgent() { return setDefaultAgent; },
    get subscriptionSignal() { return subscriptionSignal; },
    location: { directory },
    tool: {
      transform: async (register) => register({ add: (tool) => tools.set(tool.name, tool) }),
      hook: async (name, hook) => toolHooks.set(name, hook),
    },
    session: {
      ...session,
      hook: async (name, hook) => sessionHooks.set(name, hook),
    },
    agent: {
      transform: async (register) => register({ default: (id) => { setDefaultAgent = id; } }),
    },
    event: {
      subscribe: ({ signal }) => {
        subscriptionSignal = signal;
        return {
          async *[Symbol.asyncIterator]() {
            try {
              yield* events;
            } finally {
              finishEvents();
            }
          },
        };
      },
    },
  };
}

const eventsFile = (directory) => path.join(directory, '.specs', 'state', 'telemetry', 'events.jsonl');
const readEvents = (directory) => {
  try {
    return fs.readFileSync(eventsFile(directory), 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
  } catch {
    return [];
  }
};

describe('hybrid V1/V2 plugin entrypoints', () => {
  const plugins = [
    [MemoryPlugin, GuaranaMemory, 'guarana.memory'],
    [OrchestratorPlugin, GuaranaOrchestrator, 'guarana.orchestrator'],
    [TelemetryPlugin, GuaranaTelemetry, 'guarana.telemetry'],
  ];

  for (const [definition, legacyFactory, id] of plugins) {
    it(`${id} exposes a stable V2 setup and the V1 server factory`, async () => {
      assert.equal(definition.id, id);
      assert.equal(typeof definition.setup, 'function');
      assert.equal(typeof definition.server, 'function');
      const hooks = await definition.server({ directory: temporaryDirectory('guarana-v1-entrypoint-') });
      if (id === 'guarana.memory') {
        assert.ok(hooks.tool.memory_search);
        assert.equal(typeof hooks['session.created'], 'function');
      } else if (id === 'guarana.orchestrator') {
        assert.ok(hooks.tool.workflow_get);
        assert.equal(typeof hooks['chat.message'], 'function');
      } else {
        assert.equal(typeof hooks['tool.execute.after'], 'function');
        assert.equal(typeof hooks.event, 'function');
      }
    });
  }

  it('memory setup registers V2 tools, context, and lifecycle event behavior', async () => {
    const directory = temporaryDirectory('guarana-v2-memory-');
    const context = mockContext(directory, [
      { type: 'session.created', properties: { info: { id: 'memory-v2-session' } } },
    ]);
    const cleanup = await MemoryPlugin.setup(context);
    await context.eventDrained;

    assert.ok(context.tools.has('memory_save_node'));
    const result = await context.tools.get('memory_search').execute({ query: 'missing' }, {});
    assert.deepEqual(JSON.parse(result.content), { results: [], count: 0 });
    const request = { system: [] };
    await context.sessionHooks.get('context')(request);
    assert.match(request.system.map((item) => item.text).join('\n'), /Guarana automatic memory/);
    assert.ok(readEvents(directory).some((event) => event.type === 'memory-session' && event.status === 'created'));
    cleanup();
    assert.equal(context.subscriptionSignal.aborted, true);
  });

  it('orchestrator setup adapts prompt, context, tools, and agent default transforms', async () => {
    const directory = temporaryDirectory('guarana-v2-orchestrator-');
    const oldXdg = process.env.XDG_CONFIG_HOME;
    process.env.XDG_CONFIG_HOME = path.join(directory, 'xdg');
    try {
      fs.mkdirSync(path.join(directory, '.guarana'), { recursive: true });
      fs.writeFileSync(path.join(directory, '.guarana', 'advisor.json'), JSON.stringify({
        primary: { provider: 'test-provider', model: 'test-model' },
      }));
      fs.mkdirSync(path.join(directory, '.opencode', 'agents'), { recursive: true });
      fs.writeFileSync(path.join(directory, '.opencode', 'agents', 'guarana.md'), '<!-- guarana-managed-advisor-artifact -->');

      const context = mockContext(directory);
      const cleanup = await OrchestratorPlugin.setup(context);
      await context.eventDrained;
      assert.equal(context.setDefaultAgent, 'guarana');
      assert.ok(context.tools.has('workflow_get'));

      await context.sessionHooks.get('prompt')({
        sessionID: 'v2-orchestrator-session',
        messageID: 'v2-orchestrator-message',
        agent: 'build',
        prompt: { text: 'Implement the V2 workflow adapter' },
      });
      assert.equal(load(directory).state, 'planning');

      const request = { sessionID: 'v2-orchestrator-session', agent: 'build', system: [] };
      await context.sessionHooks.get('context')(request);
      assert.match(request.system.map((item) => item.text).join('\n'), /Guarana workflow/);
      const workflow = await context.tools.get('workflow_get').execute({}, {});
      assert.equal(JSON.parse(workflow.content).state, 'planning');

      await assert.rejects(
        context.toolHooks.get('execute.before')({
          tool: 'task', sessionID: 'v2-orchestrator-session',
          input: { subagent_type: 'guarana-advisor', prompt: 'blocked' },
        }),
        /Advisor consultation is disabled/i,
      );
      const tick = context.tools.get('workflow_tick').execute;
      for (const action of ['plan_complete', 'run_start', 'code_complete']) {
        await tick({ action }, { sessionID: 'v2-orchestrator-session', agent: 'build' });
      }
      await context.toolHooks.get('execute.after')({
        tool: 'bash', sessionID: 'v2-orchestrator-session', input: {},
        output: { output: 'Error: v2 verification failed' },
      });
      assert.equal(load(directory).state, 'debugging');
      cleanup();
      assert.equal(context.subscriptionSignal.aborted, true);
    } finally {
      if (oldXdg === undefined) delete process.env.XDG_CONFIG_HOME;
      else process.env.XDG_CONFIG_HOME = oldXdg;
    }
  });

  it('orchestrator V2 setup resolves agentless children using V2 session metadata before prompt processing', async () => {
    const directory = temporaryDirectory('guarana-v2-orchestrator-child-');
    const oldXdg = process.env.XDG_CONFIG_HOME;
    process.env.XDG_CONFIG_HOME = path.join(directory, 'xdg');
    const childSessionID = 'v2-agentless-child';
    const envelopedChildSessionID = 'v2-enveloped-agentless-child';
    const primarySessionID = 'v2-agentless-primary';
    const failedSessionID = 'v2-agentless-lookup-failure';
    const workflowPath = workflowFile(directory);
    const startingWorkflow = ['new_task', 'plan_complete', 'run_start']
      .reduce((workflow, event) => apply(workflow, event), createWorkflow());
    assert.equal(startingWorkflow.state, 'coding');
    assert.ok(save(directory, startingWorkflow));
    const workflowBeforeChild = fs.readFileSync(workflowPath);
    const sessionLookups = [];
    const context = mockContext(directory, [], {
      get: async (args) => {
        sessionLookups.push(args);
        if (args.sessionID === childSessionID) {
          return { id: childSessionID, parentID: 'v2-parent-session', agent: 'worker-code' };
        }
        if (args.sessionID === envelopedChildSessionID) {
          return { data: { id: envelopedChildSessionID, parentID: 'v2-parent-session', agent: 'worker-code' } };
        }
        if (args.sessionID === primarySessionID) {
          return { id: primarySessionID, agent: 'guarana' };
        }
        return { error: { name: 'NotFoundError' } };
      },
    });
    let cleanup;

    try {
      cleanup = await OrchestratorPlugin.setup(context);
      await context.eventDrained;
      assert.equal(Object.hasOwn(context, 'client'), false);
      assert.equal(typeof context.session.get, 'function');
      const promptHook = context.sessionHooks.get('prompt');
      const contextHook = context.sessionHooks.get('context');

      await promptHook({
        sessionID: childSessionID,
        messageID: 'v2-agentless-child-message',
        prompt: { text: 'Implement a child-only task' },
      });
      const childContext = {
        sessionID: childSessionID,
        system: [{ type: 'text', text: 'existing system instructions' }],
      };
      const systemBeforeChild = structuredClone(childContext.system);
      await contextHook(childContext);

      assert.deepEqual(sessionLookups, [{ sessionID: childSessionID, directory }]);
      assert.deepEqual(fs.readFileSync(workflowPath), workflowBeforeChild);
      assert.deepEqual(load(directory), startingWorkflow);
      assert.equal(fs.existsSync(path.join(directory, '.specs', 'README.md')), false);
      assert.equal(fs.existsSync(path.join(directory, '.guarana', 'memory')), false);
      assert.deepEqual(childContext.system, systemBeforeChild);

      await promptHook({
        sessionID: envelopedChildSessionID,
        messageID: 'v2-enveloped-agentless-child-message',
        prompt: { text: 'Implement an enveloped child-only task' },
      });
      const envelopedChildContext = {
        sessionID: envelopedChildSessionID,
        system: [{ type: 'text', text: 'existing enveloped-child system instructions' }],
      };
      const systemBeforeEnvelopedChild = structuredClone(envelopedChildContext.system);
      await contextHook(envelopedChildContext);
      assert.deepEqual(fs.readFileSync(workflowPath), workflowBeforeChild);
      assert.deepEqual(load(directory), startingWorkflow);
      assert.equal(fs.existsSync(path.join(directory, '.specs', 'README.md')), false);
      assert.equal(fs.existsSync(path.join(directory, '.guarana', 'memory')), false);
      assert.deepEqual(envelopedChildContext.system, systemBeforeEnvelopedChild);

      await promptHook({
        sessionID: primarySessionID,
        messageID: 'v2-agentless-primary-message',
        prompt: { text: 'Implement a V2 primary metadata task' },
      });
      assert.equal(load(directory).state, 'planning');
      assert.equal(load(directory).goal, 'Implement a V2 primary metadata task');

      await promptHook({
        sessionID: failedSessionID,
        messageID: 'v2-agentless-lookup-failure-message',
        prompt: { text: 'Implement after metadata lookup failure' },
      });
      assert.equal(load(directory).state, 'planning');
      assert.equal(load(directory).goal, 'Implement after metadata lookup failure');
      assert.deepEqual(sessionLookups, [
        { sessionID: childSessionID, directory },
        { sessionID: envelopedChildSessionID, directory },
        { sessionID: primarySessionID, directory },
        { sessionID: failedSessionID, directory },
      ]);

      cleanup();
      cleanup = null;
      assert.equal(context.subscriptionSignal.aborted, true);
    } finally {
      cleanup?.();
      if (oldXdg === undefined) delete process.env.XDG_CONFIG_HOME;
      else process.env.XDG_CONFIG_HOME = oldXdg;
    }
  });

  it('telemetry setup adapts V2 tool hooks and the public event stream', async () => {
    const directory = temporaryDirectory('guarana-v2-telemetry-');
    const context = mockContext(directory, [
      {
        type: 'message.updated',
        properties: { info: { sessionID: 'telemetry-v2-session', tokens: { input: 2, output: 3 } } },
      },
    ]);
    const cleanup = await TelemetryPlugin.setup(context);
    await context.eventDrained;
    await context.toolHooks.get('execute.before')({
      tool: 'task', sessionID: 'telemetry-v2-session', callID: 'telemetry-v2-call',
      input: { subagent_type: 'guarana-advisor', description: 'Review the migration' },
    });
    await context.toolHooks.get('execute.after')({
      tool: 'task', sessionID: 'telemetry-v2-session', callID: 'telemetry-v2-call',
      input: { subagent_type: 'guarana-advisor', description: 'Review the migration' },
      output: { output: 'ok', metadata: { sessionID: 'telemetry-v2-child' } },
    });

    const events = readEvents(directory);
    assert.ok(events.some((event) => event.type === 'tokens' && event.tokens === 5));
    assert.ok(events.some((event) => event.type === 'tool' && event.tool === 'task' && event.ok));
    assert.ok(events.some((event) => event.type === 'advisor-dispatch' && event.status === 'completed' && event.childSessionID === 'telemetry-v2-child'));
    cleanup();
    assert.equal(context.subscriptionSignal.aborted, true);
  });
});
