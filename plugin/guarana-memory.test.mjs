import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { GuaranaMemory } from './guarana-memory.js';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { initVault } from '../memory/vault.js';

describe('GuaranaMemory', () => {
  let tmpDir;
  let eventsFile;
  let api;
  const vaultDir = () => path.join(tmpDir, '.guarana', 'memory');
  const nodesFile = () => path.join(vaultDir(), 'nodes.jsonl');

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-mem-plugin-'));
    api = await GuaranaMemory({ directory: tmpDir });
    eventsFile = path.join(tmpDir, '.specs', 'state', 'telemetry', 'events.jsonl');
  });

  afterEach(() => {
    // restore perms in case a test made the vault read-only
    try {
      fs.chmodSync(nodesFile(), 0o644);
      fs.chmodSync(vaultDir(), 0o755);
    } catch { /* ignore */ }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function readEvents() {
    try {
      return fs.readFileSync(eventsFile, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
    } catch {
      return [];
    }
  }

  function readNodes() {
    try {
      return fs.readFileSync(nodesFile(), 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
    } catch {
      return [];
    }
  }

  it('does not register automatic capture hooks', () => {
    assert.equal(api['tool.execute.before'], undefined);
    assert.equal(api['tool.execute.after'], undefined);
    assert.equal(api['file.edited'], undefined);
  });

  it('injects automatic memory rules distinguishing global preferences from project decisions', async () => {
    const output = { system: [] };
    await api['experimental.chat.system.transform']({}, output);
    assert.match(output.system.join('\n'), /automatically.*clear/i);
    assert.match(output.system.join('\n'), /scope: "global"/);
    assert.match(output.system.join('\n'), /scope: "project"/);
    assert.match(output.system.join('\n'), /ordinary task requests/);
  });

  it('keeps normal tool activity out of the memory vault', async () => {
    initVault(tmpDir);
    await api['session.created']({ properties: { info: { id: 's1' } } });
    assert.equal(readNodes().length, 0);
    assert.equal(readEvents().filter((e) => e.type === 'memory-captured').length, 0);
    assert.equal(readEvents().filter((e) => e.type === 'memory-session').length, 1);
  });

  it('creates confirmed memory only through the explicit decision tool', async () => {
    const result = JSON.parse(await api.tool.memory_save_decision.execute({
      intent: 'choose explicit memory',
      decision: 'Only deliberate decisions enter long-term memory.',
      rejectedAlternatives: ['Capture every tool call'],
      tags: ['policy'],
      author: 'test',
    }));
    assert.equal(result.status, 'confirmed');
    assert.equal(result.type, 'decision');
    assert.equal(readNodes().length, 1);
  });

  it('saves a typed bug and connects its solution with a fixes edge', async () => {
    const bug = JSON.parse(await api.tool.memory_save_node.execute({
      type: 'bug',
      intent: 'memory retrieval loses related bugs',
      summary: 'The context tool returns only the matching decision.',
      tags: ['memory'],
    }));
    const solution = JSON.parse(await api.tool.memory_save_node.execute({
      type: 'solution',
      intent: 'include related bug context',
      summary: 'Expand task context across explicit fixes links.',
      relatedTo: [{ id: bug.id, rel: 'fixes' }],
    }));
    assert.equal(bug.type, 'bug');
    assert.equal(solution.type, 'solution');
    assert.equal(solution.edges[0].rel, 'fixes');
    assert.equal(solution.edges[0].to, bug.id);
    const edges = fs.readFileSync(path.join(vaultDir(), 'edges.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
    assert.equal(edges.length, 1);
  });

  it('stores an automatic standing preference in the user vault, not the project vault', async () => {
    const oldHome = process.env.HOME;
    const fakeHome = path.join(tmpDir, 'user-home');
    fs.mkdirSync(fakeHome, { recursive: true });
    process.env.HOME = fakeHome;
    try {
      const result = JSON.parse(await api.tool.memory_save_node.execute({
        type: 'preference',
        scope: 'global',
        intent: 'response language',
        summary: 'Always answer me in Portuguese.',
      }));
      const globalNodes = fs.readFileSync(path.join(fakeHome, '.config', 'guarana', 'memory', 'nodes.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
      assert.equal(result.scope, 'global');
      assert.equal(globalNodes.length, 1);
      assert.equal(readNodes().length, 0);
      const context = JSON.parse(await api.tool.memory_get_context_for_task.execute({
        task: 'build a database migration',
        scope: 'both',
      }));
      assert.equal(context.preferences.length, 1);
      assert.equal(context.preferences[0].id, result.id);
      const search = JSON.parse(await api.tool.memory_search.execute({
        query: 'Portuguese',
        scope: 'both',
      }));
      assert.equal(search.results.length, 1);
      assert.equal(search.results[0].scope, 'global');
    } finally {
      if (oldHome === undefined) delete process.env.HOME;
      else process.env.HOME = oldHome;
    }
  });
});
