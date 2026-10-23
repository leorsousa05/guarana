import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { GuaranaMemory } from './guarana-memory.js';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { initVault } from '../memory/vault.js';
import { createNode, createEdge, getNode, listEdges } from '../memory/graph.js';

// Slice 3 contract tests (criteria 11/12/13): memory_* tools, called
// through the plugin's registered `tool` interface (not the engine directly).
describe('GuaranaMemory tools (slice 3)', () => {
  let tmpDir;
  let api;
  let oldHome;
  const vaultDir = () => path.join(tmpDir, '.guarana', 'memory');

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-mem-tools-'));
    oldHome = process.env.HOME;
    process.env.HOME = path.join(tmpDir, 'home');
    initVault(tmpDir);
    api = await GuaranaMemory({ directory: tmpDir });
  });

  afterEach(() => {
    if (oldHome === undefined) delete process.env.HOME;
    else process.env.HOME = oldHome;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const call = async (name, args) => {
    const t = api.tool[name];
    assert.ok(t, `tool ${name} registered`);
    assert.equal(typeof t.description, 'string');
    assert.equal(typeof t.execute, 'function');
    return JSON.parse(await t.execute(args, {}));
  };

  // Seeds: confirmed decision (jwt, with rejected alternatives), an old
  // decision superseded by it, a bug caused by it, and a draft atom.
  function seedGraph() {
    const dec = createNode(vaultDir(), {
      type: 'decision',
      status: 'confirmed',
      intent: 'chose jwt authentication for the api',
      summary: 'stateless jwt tokens avoid server session storage',
      rejectedAlternatives: ['server sessions', 'basic auth'],
      tags: ['auth'],
    });
    const old = createNode(vaultDir(), {
      type: 'decision',
      status: 'confirmed',
      intent: 'originally picked server session authentication',
      summary: 'sessions were simpler initially',
    });
    const bug = createNode(vaultDir(), {
      type: 'bug',
      status: 'confirmed',
      intent: 'jwt token expiry not refreshed on authentication retry',
      summary: 'users get logged out abruptly',
    });
    const draft = createNode(vaultDir(), {
      type: 'atom',
      status: 'draft',
      intent: 'captured jwt authentication tool call',
      output: 'ok',
    });
    createEdge(vaultDir(), { from: dec.id, to: old.id, rel: 'supersedes' });
    createEdge(vaultDir(), { from: bug.id, to: dec.id, rel: 'caused-by' });
    return { dec, old, bug, draft };
  }

  describe('memory_search (criterion 11)', () => {
    it('returns schema-valid results, drafts never appear', async () => {
      const { draft } = seedGraph();
      const res = await call('memory_search', { query: 'jwt authentication' });
      assert.equal(typeof res.count, 'number');
      assert.ok(Array.isArray(res.results));
      assert.equal(res.count, res.results.length);
      assert.ok(res.count >= 2); // decision + bug + old decision match
      for (const r of res.results) {
        assert.equal(typeof r.id, 'string');
        assert.equal(typeof r.type, 'string');
        assert.equal(typeof r.intent, 'string');
        assert.equal(typeof r.summary, 'string');
        assert.ok(Array.isArray(r.tags));
        assert.equal(typeof r.ts, 'number');
        assert.equal(typeof r.score, 'number');
      }
      assert.ok(!res.results.some((r) => r.id === draft.id));
    });

    it('respects the type filter', async () => {
      seedGraph();
      const res = await call('memory_search', { query: 'authentication', type: 'bug' });
      assert.ok(res.results.every((r) => r.type === 'bug'));
    });
  });

  describe('memory_save_decision (criterion 12)', () => {
    it('writes a confirmed decision node with rejected alternatives', async () => {
      const node = await call('memory_save_decision', {
        intent: 'pick a queue library',
        decision: 'use in-memory queue, no external broker needed',
        rejectedAlternatives: ['rabbitmq', 'kafka'],
        tags: ['infra'],
      });
      assert.equal(node.type, 'decision');
      assert.equal(node.status, 'confirmed');
      assert.equal(node.author, 'agent');
      assert.deepEqual(node.rejectedAlternatives, ['rabbitmq', 'kafka']);
      const stored = getNode(vaultDir(), node.id);
      assert.equal(stored.status, 'confirmed');
      // immediately searchable (confirmed)
      const res = await call('memory_search', { query: 'queue library' });
      assert.ok(res.results.some((r) => r.id === node.id));
    });

    it('redacts secret-shaped assignments in decision text', async () => {
      const node = await call('memory_save_decision', {
        intent: 'configure auth',
        decision: 'hardcode api_key = supersecretvalue123 for the demo',
      });
      assert.ok(!node.summary.includes('supersecretvalue123'));
      assert.ok(node.summary.includes('[REDACTED]'));
      const raw = fs.readFileSync(path.join(vaultDir(), 'nodes.jsonl'), 'utf8');
      assert.ok(!raw.includes('supersecretvalue123'));
    });
  });

  describe('memory_review_draft (criterion 12)', () => {
    it('confirm flips draft -> confirmed (with edits)', async () => {
      const { draft } = seedGraph();
      const res = await call('memory_review_draft', {
        id: draft.id,
        action: 'confirm',
        edits: { summary: 'reviewed jwt capture' },
      });
      assert.deepEqual({ id: res.id, action: res.action }, { id: draft.id, action: 'confirm' });
      const stored = getNode(vaultDir(), draft.id);
      assert.equal(stored.status, 'confirmed');
      assert.equal(stored.summary, 'reviewed jwt capture');
    });

    it('discard removes the node and its edges', async () => {
      const { bug, draft } = seedGraph();
      createEdge(vaultDir(), { from: draft.id, to: bug.id, rel: 'depends-on' });
      const res = await call('memory_review_draft', { id: draft.id, action: 'discard' });
      assert.deepEqual(res, { id: draft.id, action: 'discard', removed: true });
      assert.equal(getNode(vaultDir(), draft.id), null);
      assert.ok(!listEdges(vaultDir()).some((e) => e.from === draft.id || e.to === draft.id));
    });

    it('unknown id -> clean error result, never throws', async () => {
      const res = await call('memory_review_draft', { id: 'mem-nope', action: 'confirm' });
      assert.ok(typeof res.error === 'string');
      assert.ok(res.error.includes('unknown node id'));
    });

    it('non-draft -> clean error result', async () => {
      const { dec } = seedGraph();
      const res = await call('memory_review_draft', { id: dec.id, action: 'discard' });
      assert.ok(res.error.includes('not a draft'));
      assert.ok(getNode(vaultDir(), dec.id)); // untouched
    });
  });

  describe('memory_delete_node (confirmed-memory hardening)', () => {
    it('requires exact scope and explicit confirmation, rejects unknown IDs and protects drafts', async () => {
      const { dec, draft } = seedGraph();
      const noScope = await call('memory_delete_node', { id: dec.id, confirm: true });
      assert.match(noScope.error, /scope is required/);
      const noConfirm = await call('memory_delete_node', { id: dec.id, scope: 'project' });
      assert.match(noConfirm.error, /confirmation is required/);
      const wrongScope = await call('memory_delete_node', { id: dec.id, scope: 'global', confirm: true });
      assert.match(wrongScope.error, /unknown node id/);
      assert.equal(fs.existsSync(path.join(tmpDir, 'home', '.config', 'guarana', 'memory')), false, 'failed deletion must not initialize another scope');
      const unknown = await call('memory_delete_node', { id: 'mem-missing', scope: 'project', confirm: true });
      assert.match(unknown.error, /unknown node id/);
      const protectedDraft = await call('memory_delete_node', { id: draft.id, scope: 'project', confirm: true });
      assert.match(protectedDraft.error, /not confirmed/);
      assert.ok(getNode(vaultDir(), dec.id));
      assert.ok(getNode(vaultDir(), draft.id));
    });

    it('deletes the exact confirmed node and incident edges without logging memory text', async () => {
      const target = createNode(vaultDir(), {
        type: 'decision', status: 'confirmed', scope: 'project',
        intent: 'private-delete-sentinel', summary: 'unlogged memory text',
      });
      const other = createNode(vaultDir(), {
        type: 'bug', status: 'confirmed', scope: 'project', intent: 'unrelated', summary: 'unrelated',
      });
      createEdge(vaultDir(), { from: target.id, to: other.id, rel: 'fixes' });
      createEdge(vaultDir(), { from: other.id, to: target.id, rel: 'relates-to' });
      const result = await call('memory_delete_node', { id: target.id, scope: 'project', confirm: true });
      assert.deepEqual(result, { id: target.id, deleted: true });
      assert.equal(getNode(vaultDir(), target.id), null);
      assert.ok(!listEdges(vaultDir()).some((edge) => edge.from === target.id || edge.to === target.id));
      const eventsFile = path.join(tmpDir, '.specs', 'state', 'telemetry', 'events.jsonl');
      const telemetry = fs.existsSync(eventsFile) ? fs.readFileSync(eventsFile, 'utf8') : '';
      assert.doesNotMatch(telemetry, /private-delete-sentinel|unlogged memory text/);
    });
  });

  describe('memory_get_context_for_task (criterion 13)', () => {
    it('returns a bounded grouped subgraph via 1-hop expansion', async () => {
      const { dec, old, bug, draft } = seedGraph();
      const res = await call('memory_get_context_for_task', { task: 'jwt authentication' });
      for (const k of ['decisions', 'bugs', 'solutions', 'refactors', 'preferences', 'superseded', 'atoms']) assert.ok(Array.isArray(res[k]));
      assert.ok(res.decisions.some((n) => n.id === dec.id));
      assert.ok(res.bugs.some((n) => n.id === bug.id)); // via caused-by edge
      assert.ok(res.superseded.some((n) => n.id === old.id)); // via supersedes edge
      const rejected = res.decisions.find((n) => n.id === dec.id).rejectedAlternatives;
      assert.deepEqual(rejected, ['server sessions', 'basic auth']);
      const total = ['decisions', 'bugs', 'solutions', 'refactors', 'preferences', 'superseded', 'atoms']
        .reduce((sum, key) => sum + res[key].length, 0);
      assert.equal(res.count, total);
      assert.ok(total <= 10);
      assert.ok(!res.atoms.some((n) => n.id === draft.id)); // drafts never returned
    });

    it('respects the explicit size cap', async () => {
      seedGraph();
      const res = await call('memory_get_context_for_task', { task: 'jwt authentication', limit: 2 });
      assert.ok(res.count <= 2);
    });
  });

  describe('plugin boundary robustness', () => {
    it('tools initialize a missing vault and return an empty result', async () => {
      fs.rmSync(vaultDir(), { recursive: true, force: true });
      const res = await call('memory_search', { query: 'anything' });
      assert.deepEqual(res, { results: [], count: 0 });
      assert.ok(fs.existsSync(path.join(vaultDir(), 'nodes.jsonl')));
    });
  });
});
