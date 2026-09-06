import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { GuaranaOrchestrator } from './guarana-orchestrator.js';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { load, workflowFile } from '../orchestrator/state.js';

describe('GuaranaOrchestrator', () => {
  let tmpDir;
  let eventsFile;
  let api;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-orch-plugin-'));
    api = await GuaranaOrchestrator({ directory: tmpDir });
    eventsFile = path.join(tmpDir, '.specs', 'state', 'telemetry', 'events.jsonl');
  });

  afterEach(() => {
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
    assert.equal(wf.history.length, 1);
    const evs = readEvents().filter((e) => e.type === 'workflow');
    assert.equal(evs.length, 1);
    assert.equal(evs[0].event, 'new_task');
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