import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { summary, search, graph, drafts, review } from './memory.js';
import { initVault, initUserVault } from '../../../memory/vault.js';
import { createNode, createEdge } from '../../../memory/graph.js';

let oldHome;
let fakeHome;

beforeEach(() => {
  oldHome = process.env.HOME;
  fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-user-memory-'));
  process.env.HOME = fakeHome;
});

afterEach(() => {
  if (oldHome === undefined) delete process.env.HOME;
  else process.env.HOME = oldHome;
  fs.rmSync(fakeHome, { recursive: true, force: true });
});

function seedVault() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-mem-'));
  const projectDir = tmp;
  const vaultDir = initVault(projectDir);
  // one confirmed atom + one draft atom
  const confirmed = createNode(vaultDir, {
    type: 'atom',
    status: 'confirmed',
    intent: 'chose express',
    summary: 'express for the http server',
    tags: ['http'],
  });
  const draft = createNode(vaultDir, {
    type: 'atom',
    status: 'draft',
    intent: 'secret draft decision',
    summary: 'draft content should never leak',
    tags: ['draft'],
  });
  const confirmed2 = createNode(vaultDir, {
    type: 'decision',
    status: 'confirmed',
    intent: 'picked node test',
    summary: 'node --test for unit tests',
  });
  createEdge(vaultDir, { from: confirmed.id, to: confirmed2.id, rel: 'depends-on' });
  return { tmp, projectDir, vaultDir, confirmed, draft, confirmed2 };
}

describe('memory lib — summary', () => {
  it('counts nodes by type and draft/confirmed breakdown', async () => {
    const { tmp, vaultDir } = seedVault();
    try {
      const s = await summary(vaultDir);
      assert.equal(s.nodes.total, 3);
      assert.equal(s.nodes.draft, 1);
      assert.equal(s.nodes.confirmed, 2);
      assert.equal(s.nodes.byType.atom, 2);
      assert.equal(s.nodes.byType.decision, 1);
      assert.deepEqual(s.nodes.byScope, { project: 3, global: 0 });
      assert.equal(s.edges, 1);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('hides metadata-only legacy supernodes from memory summaries and search', async () => {
    const { tmp, vaultDir, confirmed2 } = seedVault();
    try {
      const junk = createNode(vaultDir, {
        type: 'supernode',
        status: 'confirmed',
        summary: 'supernode summarizing 1 atom node(s) ts range: 1788977598260..1788977598260',
      });
      createEdge(vaultDir, { from: junk.id, to: confirmed2.id, rel: 'summarizes' });
      const s = await summary(vaultDir);
      assert.equal(s.nodes.total, 3);
      assert.equal(s.supernodes, 0);
      assert.equal(s.edges, 1);
      const res = await search(vaultDir, { q: 'supernode summarizing' });
      assert.equal(res.results.length, 0);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('returns a neutral empty shape for a missing vault (never throws)', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-mem-'));
    try {
      const s = await summary(path.join(tmp, '.guarana', 'memory'));
      assert.deepEqual(s, {
        nodes: { total: 0, byType: {}, byScope: { project: 0, global: 0 }, draft: 0, confirmed: 0 },
        edges: 0,
        supernodes: 0,
      });
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe('memory lib — search', () => {
  it('returns only confirmed matches, never drafts', async () => {
    const { tmp, vaultDir } = seedVault();
    try {
      const res = await search(vaultDir, { q: 'express' });
      assert.ok(res.results.length >= 1);
      for (const n of res.results) assert.equal(n.status, 'confirmed');
      const hit = res.results.find((n) => n.intent === 'chose express');
      assert.ok(hit);
      assert.equal(res.results.some((n) => n.intent === 'secret draft decision'), false);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('returns empty for a missing vault', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-mem-'));
    try {
      const res = await search(path.join(tmp, '.guarana', 'memory'), { q: 'x' });
      assert.deepEqual(res, { results: [], count: 0 });
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe('memory lib — graph', () => {
  it('bounded confirmed nodes and edges between them', async () => {
    const { tmp, vaultDir, confirmed2 } = seedVault();
    try {
      const g = await graph(vaultDir, { limit: 2 });
      assert.equal(g.nodes.length, 2);
      for (const n of g.nodes) assert.equal(n.status, 'confirmed');
      // edge between the two confirmed nodes is included; draft never appears
      assert.ok(g.edges.some((e) => e.from === confirmed2.id || e.to === confirmed2.id));
      for (const e of g.edges) {
        assert.ok(g.nodes.some((n) => n.id === e.from));
        assert.ok(g.nodes.some((n) => n.id === e.to));
      }
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('includes confirmed global nodes and labels each scope without mixing edge IDs', async () => {
    const { tmp, vaultDir, confirmed2 } = seedVault();
    try {
      const globalVault = initUserVault();
      const preference = createNode(globalVault, {
        type: 'preference', status: 'confirmed', scope: 'global',
        intent: 'response language', summary: 'Use Portuguese.',
      });
      const globalDecision = createNode(globalVault, {
        type: 'decision', status: 'confirmed', scope: 'global',
        intent: 'keep answers concise', summary: 'Prefer short replies.',
      });
      createEdge(globalVault, { from: preference.id, to: globalDecision.id, rel: 'depends-on' });

      const result = await graph(vaultDir, { limit: 10 });
      assert.ok(result.nodes.some((n) => n.id === preference.id && n.scope === 'global'));
      assert.ok(result.nodes.some((n) => n.id === confirmed2.id && n.scope === 'project'));
      assert.ok(result.edges.some((e) => e.scope === 'global' && e.from === preference.id && e.to === globalDecision.id));
      assert.ok(result.edges.some((e) => e.scope === 'project' && (e.from === confirmed2.id || e.to === confirmed2.id)));
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('omits metadata-only legacy supernodes and connected edges', async () => {
    const { tmp, vaultDir, confirmed2 } = seedVault();
    try {
      const junk = createNode(vaultDir, {
        type: 'supernode',
        status: 'confirmed',
        summary: 'supernode summarizing 1 atom node(s) ts range: 1..1',
      });
      createEdge(vaultDir, { from: junk.id, to: confirmed2.id, rel: 'summarizes' });
      const g = await graph(vaultDir);
      assert.equal(g.nodes.some((n) => n.id === junk.id), false);
      assert.equal(g.edges.some((e) => e.from === junk.id || e.to === junk.id), false);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('returns empty arrays for a missing vault', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-mem-'));
    try {
      const g = await graph(path.join(tmp, '.guarana', 'memory'));
      assert.deepEqual(g, { nodes: [], edges: [] });
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe('memory lib — drafts', () => {
  it('lists only draft nodes with the draft shape', async () => {
    const { tmp, vaultDir, draft } = seedVault();
    try {
      const res = await drafts(vaultDir);
      assert.equal(res.drafts.length, 1);
      assert.equal(res.drafts[0].id, draft.id);
      assert.equal(res.drafts[0].intent, 'secret draft decision');
      assert.equal(typeof res.drafts[0].ts, 'number');
      assert.deepEqual(res.drafts[0].tags, ['draft']);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('returns empty for a missing vault', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-mem-'));
    try {
      const res = await drafts(path.join(tmp, '.guarana', 'memory'));
      assert.deepEqual(res, { drafts: [] });
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe('memory lib — review', () => {
  it('confirm flips the draft status and discard removes it', async () => {
    const { tmp, vaultDir, draft } = seedVault();
    try {
      const confirmed = await review(vaultDir, { id: draft.id, action: 'confirm', edits: { intent: 'confirmed intent' } });
      assert.equal(confirmed.node.status, 'confirmed');
      assert.equal(confirmed.node.intent, 'confirmed intent');
      assert.equal((await drafts(vaultDir)).drafts.length, 0);

      const again = await review(vaultDir, { id: draft.id, action: 'discard' });
      assert.equal(again.error !== undefined, true);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('returns an error for a missing vault (never 500)', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-mem-'));
    try {
      const res = await review(path.join(tmp, '.guarana', 'memory'), { id: 'x', action: 'confirm' });
      assert.ok(res.error);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
