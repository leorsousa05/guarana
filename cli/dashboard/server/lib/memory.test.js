import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { summary, search, graph, injections, preferences, drafts, review, createRelationship, deleteRelationship } from './memory.js';
import { initVault, initUserVault } from '../../../memory/vault.js';
import { createNode, createEdge, listEdges } from '../../../memory/graph.js';

function seedLegacyNode(vaultDir, node) {
  const seeded = { id: node.id || `legacy-${Date.now()}-${Math.random()}`, ts: Date.now(), tags: [], ...node };
  fs.appendFileSync(path.join(vaultDir, 'nodes.jsonl'), `${JSON.stringify(seeded)}\n`);
  return seeded;
}

let oldHome;
let oldXdg;
let fakeHome;
let fakeXdg;

beforeEach(() => {
  oldHome = process.env.HOME;
  oldXdg = process.env.XDG_CONFIG_HOME;
  fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-user-memory-'));
  fakeXdg = path.join(fakeHome, 'xdg');
  process.env.HOME = fakeHome;
  process.env.XDG_CONFIG_HOME = fakeXdg;
});

afterEach(() => {
  if (oldHome === undefined) delete process.env.HOME;
  else process.env.HOME = oldHome;
  if (oldXdg === undefined) delete process.env.XDG_CONFIG_HOME;
  else process.env.XDG_CONFIG_HOME = oldXdg;
  fs.rmSync(fakeHome, { recursive: true, force: true });
});

function seedVault() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-mem-'));
  const projectDir = tmp;
  const vaultDir = initVault(projectDir);
  // one confirmed atom + one draft atom
  const confirmed = seedLegacyNode(vaultDir, {
    type: 'atom',
    status: 'confirmed',
    intent: 'chose express',
    summary: 'express for the http server',
    tags: ['http'],
  });
  const draft = seedLegacyNode(vaultDir, {
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
      const junk = seedLegacyNode(vaultDir, {
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

describe('memory lib — read-only scope projections and preference library', () => {
  it('returns the complete filtered preference set and isolates summary/graph projections by scope', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-memory-projection-'));
    const vaultDir = initVault(tmp);
    const globalVault = initUserVault();
    try {
      const globalOld = seedLegacyNode(globalVault, {
        id: 'global-old', ts: 10, type: 'preference', status: 'confirmed', scope: 'global',
        intent: 'Use Spanish', summary: 'Respond in Spanish.', tags: ['language'],
      });
      const globalCurrent = seedLegacyNode(globalVault, {
        id: 'global-current', ts: 20, type: 'preference', status: 'confirmed', scope: 'global',
        category: 'communication', priority: 'essential', intent: 'Use English', summary: 'Respond in English.', tags: ['language'],
      });
      const workflow = seedLegacyNode(globalVault, {
        id: 'global-workflow', ts: 30, type: 'preference', status: 'confirmed', scope: 'global',
        category: 'workflow', intent: 'Workflow preference', summary: 'Keep the verification order.',
      });
      const agent = seedLegacyNode(globalVault, {
        id: 'global-agent', ts: 40, type: 'preference', status: 'confirmed', scope: 'global',
        category: 'agent_behavior', intent: 'Concise agent', summary: 'Keep answers direct.',
      });
      const general = seedLegacyNode(globalVault, {
        id: 'global-general', ts: 50, type: 'preference', status: 'confirmed', scope: 'global',
        category: 'obsolete-category', priority: 'urgent', intent: 'Lookupneedle preference',
        summary: 'Use a plain format.', tags: ['lookupneedle', 'sk-abcdefghijklmnop', 'ordinary-tag'],
      });
      const globalDraft = seedLegacyNode(globalVault, {
        id: 'global-draft', type: 'preference', status: 'draft', scope: 'global',
        intent: 'draft must not appear', summary: 'draft text',
      });
      const legacyGlobalDecision = seedLegacyNode(globalVault, {
        id: 'global-decision', type: 'decision', status: 'confirmed', scope: 'global',
        intent: 'global non-preference sentinel', summary: 'global non-preference text',
      });
      const projectPreference = seedLegacyNode(vaultDir, {
        id: 'project-preference', type: 'preference', status: 'confirmed', scope: 'project',
        intent: 'project preference sentinel', summary: 'project preference text',
      });
      createEdge(globalVault, { from: globalCurrent.id, to: globalOld.id, rel: 'supersedes', ts: 11 });
      createEdge(globalVault, { from: globalCurrent.id, to: workflow.id, rel: 'relates-to', ts: 12 });
      createEdge(globalVault, { from: globalCurrent.id, to: legacyGlobalDecision.id, rel: 'depends-on', ts: 13 });
      const projectPeer = seedLegacyNode(vaultDir, {
        id: 'project-peer', type: 'decision', status: 'confirmed', scope: 'project', intent: 'project peer', summary: 'project relationship target',
      });
      createEdge(vaultDir, { from: projectPreference.id, to: projectPeer.id, rel: 'relates-to', ts: 14 });

      const files = [
        path.join(vaultDir, 'nodes.jsonl'), path.join(vaultDir, 'edges.jsonl'),
        path.join(vaultDir, 'config.json'),
        path.join(globalVault, 'nodes.jsonl'), path.join(globalVault, 'edges.jsonl'),
        path.join(globalVault, 'config.json'),
      ];
      const bytesBefore = files.map((file) => fs.readFileSync(file));

      const library = await preferences();
      assert.equal(library.count, 5);
      assert.deepEqual(new Set(library.preferences.map((node) => node.id)), new Set([
        globalOld.id, globalCurrent.id, workflow.id, agent.id, general.id,
      ]));
      assert.equal(library.preferences.find((node) => node.id === globalOld.id).status, 'superseded');
      assert.equal(library.preferences.find((node) => node.id === globalCurrent.id).status, 'active');
      assert.equal(library.preferences.find((node) => node.id === general.id).category, 'general');
      assert.equal(library.preferences.find((node) => node.id === globalOld.id).category, 'general');
      assert.equal(library.preferences.find((node) => node.id === globalCurrent.id).priority, 'essential');
      assert.equal('priority' in library.preferences.find((node) => node.id === general.id), false);
      assert.deepEqual(library.preferences.find((node) => node.id === general.id).tags, ['lookupneedle', 'ordinary-tag']);
      assert.deepEqual((await preferences({ category: 'general', status: 'active' })).preferences.map((node) => node.id), [general.id]);
      assert.deepEqual((await preferences({ category: 'communication' })).preferences.map((node) => node.id), [globalCurrent.id]);
      assert.deepEqual((await preferences({ status: 'superseded' })).preferences.map((node) => node.id), [globalOld.id]);
      assert.deepEqual((await preferences({ q: 'LOOKUPNEEDLE' })).preferences.map((node) => node.id), [general.id]);

      const projectSummary = await summary(vaultDir, { scope: 'project' });
      assert.equal(projectSummary.nodes.byScope.project, 2);
      assert.equal('global' in projectSummary.nodes.byScope, false);
      assert.equal(projectSummary.nodes.total, 2);
      const projectGraph = await graph(vaultDir, { scope: 'project' });
      assert.equal(projectGraph.nodes.some((node) => node.scope === 'global' || node.id === legacyGlobalDecision.id), false);
      assert.equal(projectGraph.nodes.some((node) => node.id === projectPreference.id), true);
      assert.ok(projectGraph.edges.every((edge) => edge.scope === 'project'));

      const globalSummary = await summary(vaultDir, { scope: 'global' });
      assert.deepEqual(globalSummary.nodes.byScope, { global: 5 });
      assert.equal(globalSummary.nodes.total, 5);
      assert.equal(globalSummary.edges, 2);
      const globalGraph = await graph(vaultDir, { scope: 'global' });
      assert.equal(globalGraph.nodes.length, 5);
      assert.ok(globalGraph.nodes.every((node) => node.type === 'preference' && node.scope === 'global'));
      assert.ok(globalGraph.edges.every((edge) => edge.scope === 'global'
        && globalGraph.nodes.some((node) => node.id === edge.from)
        && globalGraph.nodes.some((node) => node.id === edge.to)));
      assert.equal(globalGraph.nodes.some((node) => node.id === legacyGlobalDecision.id), false);
      assert.equal(JSON.stringify({ globalSummary, globalGraph }).includes('project preference sentinel'), false);

      // Omitted scope remains the backward-compatible combined projection.
      const combinedGraph = await graph(vaultDir);
      assert.equal(combinedGraph.nodes.some((node) => node.id === legacyGlobalDecision.id), true);
      assert.deepEqual(files.map((file) => fs.readFileSync(file)), bytesBefore);
      assert.equal(globalDraft.status, 'draft');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('projects mixed injection history by scope and retains unscoped legacy project references', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-memory-injection-scope-'));
    const vaultDir = initVault(tmp);
    const globalVault = initUserVault();
    try {
      const projectOne = seedLegacyNode(vaultDir, {
        id: 'project-one', type: 'decision', status: 'confirmed', scope: 'project',
        intent: 'project one text', summary: 'project one summary',
      });
      const projectTwo = seedLegacyNode(vaultDir, {
        id: 'project-two', type: 'solution', status: 'confirmed', scope: 'project',
        intent: 'project two text', summary: 'project two summary',
      });
      const globalOne = seedLegacyNode(globalVault, {
        id: 'global-one', type: 'preference', status: 'confirmed', scope: 'global', category: 'workflow',
        intent: 'global preference one', summary: 'global one summary',
      });
      const globalTwo = seedLegacyNode(globalVault, {
        id: 'global-two', type: 'preference', status: 'confirmed', scope: 'global', category: 'communication',
        intent: 'global preference two', summary: 'global two summary',
      });
      const globalDecision = seedLegacyNode(globalVault, {
        id: 'global-old-decision', type: 'decision', status: 'confirmed', scope: 'global',
        intent: 'non-preference global sentinel', summary: 'non-preference global text',
      });
      createEdge(vaultDir, { from: projectOne.id, to: projectTwo.id, rel: 'relates-to', ts: 15 });
      createEdge(globalVault, { from: globalOne.id, to: globalTwo.id, rel: 'supersedes', ts: 16 });
      createEdge(globalVault, { from: globalOne.id, to: globalDecision.id, rel: 'depends-on', ts: 17 });

      const telemetryFile = path.join(tmp, 'events.jsonl');
      fs.writeFileSync(telemetryFile, [
        {
          ts: 100, type: 'memory-injected', sessionID: 'mixed-session', prompt: 'PROMPT_SENTINEL',
          memories: [
            { id: projectOne.id, type: 'decision', scope: 'project' },
            { id: projectTwo.id, type: 'solution', scope: 'project' },
            { id: globalOne.id, type: 'preference', scope: 'global' },
            { id: globalTwo.id, type: 'preference', scope: 'global' },
            { id: globalDecision.id, type: 'decision', scope: 'global' },
          ],
        },
        {
          ts: 200, type: 'memory-injected', sessionID: 'legacy-session',
          memories: [{ id: projectTwo.id, type: 'solution' }],
        },
      ].map((event) => JSON.stringify(event)).join('\n') + '\n');

      const files = [
        path.join(vaultDir, 'nodes.jsonl'), path.join(vaultDir, 'edges.jsonl'),
        path.join(vaultDir, 'config.json'),
        path.join(globalVault, 'nodes.jsonl'), path.join(globalVault, 'edges.jsonl'),
        path.join(globalVault, 'config.json'),
      ];
      const bytesBefore = files.map((file) => fs.readFileSync(file));
      const projectResult = await injections(vaultDir, telemetryFile, { scope: 'project' });
      assert.equal(projectResult.injections.length, 2);
      const mixedProjectEvent = projectResult.injections.find((event) => event.sessionID === 'mixed-session');
      assert.deepEqual(mixedProjectEvent.memories.map((node) => node.id), [projectOne.id, projectTwo.id]);
      assert.equal(mixedProjectEvent.edges.length, 1);
      assert.equal(mixedProjectEvent.edges[0].scope, 'project');
      const legacyProjectRef = projectResult.injections.find((event) => event.sessionID === 'legacy-session').memories[0];
      assert.equal(legacyProjectRef.scope, 'project');
      assert.equal(legacyProjectRef.available, true);
      assert.equal(JSON.stringify(projectResult).includes('global one summary'), false);

      const globalResult = await injections(vaultDir, telemetryFile, { scope: 'global' });
      assert.equal(globalResult.injections.length, 1);
      assert.deepEqual(globalResult.injections[0].memories.map((node) => node.id), [globalOne.id, globalTwo.id]);
      assert.equal(globalResult.injections[0].edges.length, 1);
      assert.equal(globalResult.injections[0].edges[0].scope, 'global');
      assert.equal(JSON.stringify(globalResult).includes('non-preference global'), false);
      assert.equal(JSON.stringify(globalResult).includes('project one summary'), false);
      assert.equal(JSON.stringify(globalResult).includes('PROMPT_SENTINEL'), false);
      assert.deepEqual(files.map((file) => fs.readFileSync(file)), bytesBefore);
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
        type: 'preference', status: 'confirmed', scope: 'global', category: 'communication',
        intent: 'response language', summary: 'Use Portuguese.',
      });
      const globalDecision = createNode(globalVault, {
        type: 'preference', status: 'confirmed', scope: 'global', category: 'agent_behavior',
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
      const junk = seedLegacyNode(vaultDir, {
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

describe('memory lib — project relationships', () => {
  it('validates project endpoints, creates typed edges, and deletes only the selected edge', async () => {
    const { tmp, vaultDir, confirmed, draft, confirmed2 } = seedVault();
    try {
      assert.match((await createRelationship(vaultDir, {
        from: confirmed.id, to: confirmed2.id, rel: 'invalid',
      })).error, /edge\.rel/);
      assert.equal((await createRelationship(vaultDir, {
        from: confirmed.id, to: 'missing-node', rel: 'fixes',
      })).statusCode, 404);
      assert.equal((await createRelationship(vaultDir, {
        from: confirmed.id, to: draft.id, rel: 'fixes',
      })).statusCode, 400);
      assert.equal((await createRelationship(vaultDir, {
        from: confirmed.id, to: confirmed.id, rel: 'fixes',
      })).statusCode, 400);
      assert.equal((await createRelationship(vaultDir, {
        from: confirmed.id, to: confirmed2.id, rel: 'fixes', scope: 'global',
      })).statusCode, 400);

      const created = await createRelationship(vaultDir, {
        from: confirmed.id, to: confirmed2.id, rel: 'fixes', scope: 'project',
      });
      assert.deepEqual(
        { from: created.edge.from, to: created.edge.to, rel: created.edge.rel },
        { from: confirmed.id, to: confirmed2.id, rel: 'fixes' }
      );
      assert.equal((await createRelationship(vaultDir, {
        from: confirmed.id, to: confirmed2.id, rel: 'fixes',
      })).statusCode, 409);

      const retained = createEdge(vaultDir, {
        from: confirmed.id, to: confirmed2.id, rel: 'relates-to', ts: created.edge.ts + 1,
      });
      assert.equal((await deleteRelationship(vaultDir, { ...created.edge, scope: 'global' })).statusCode, 400);
      assert.ok(listEdges(vaultDir).some((edge) => edge.ts === created.edge.ts));
      const deleted = await deleteRelationship(vaultDir, created.edge);
      assert.deepEqual(deleted.edge, created.edge);
      assert.deepEqual(listEdges(vaultDir).map(({ rel }) => rel).sort(), ['depends-on', 'relates-to']);
      assert.equal((await deleteRelationship(vaultDir, created.edge)).statusCode, 404);
      assert.deepEqual(listEdges(vaultDir).find((edge) => edge.ts === retained.ts), retained);
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

describe('memory lib — sensitive tag projections', () => {
  it('filters secret-shaped legacy tags from every read surface without changing vault records', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-mem-tags-'));
    try {
      const vaultDir = initVault(tmp);
      const globalVaultDir = initUserVault();
      const tags = ['sk-abcdefghijklmnop', 'api_key=genericsecretvalue123', 'ordinary-tag'];
      const projectNode = seedLegacyNode(vaultDir, {
        type: 'atom', status: 'confirmed', intent: 'dashboard projection target',
        summary: 'project response projection fixture', tags,
      });
      const draftNode = seedLegacyNode(vaultDir, {
        type: 'atom', status: 'draft', intent: 'draft projection fixture',
        summary: 'draft response projection fixture', tags,
      });
      const globalNode = seedLegacyNode(globalVaultDir, {
        type: 'preference', status: 'confirmed', scope: 'global',
        intent: 'global projection fixture', summary: 'global response projection fixture', tags,
      });
      const telemetryFile = path.join(tmp, 'events.jsonl');
      fs.writeFileSync(telemetryFile, `${JSON.stringify({
        type: 'memory-injected', ts: Date.now(), sessionID: 'temporary-session',
        memories: [
          { id: projectNode.id, scope: 'project' },
          { id: globalNode.id, scope: 'global' },
        ],
      })}\n`);

      const projectNodesFile = path.join(vaultDir, 'nodes.jsonl');
      const globalNodesFile = path.join(globalVaultDir, 'nodes.jsonl');
      const projectBytesBefore = fs.readFileSync(projectNodesFile);
      const globalBytesBefore = fs.readFileSync(globalNodesFile);

      const searchResult = await search(vaultDir, { q: 'dashboard projection target' });
      assert.equal(searchResult.count, searchResult.results.length);
      const searchNode = searchResult.results.find((node) => node.id === projectNode.id);
      assert.ok(searchNode);
      assert.equal(searchNode.intent, projectNode.intent);
      assert.equal(searchNode.status, 'confirmed');
      assert.equal(typeof searchNode.score, 'number');
      assert.deepEqual(searchNode.tags, ['ordinary-tag']);

      const graphResult = await graph(vaultDir);
      for (const [id, scope] of [[projectNode.id, 'project'], [globalNode.id, 'global']]) {
        const node = graphResult.nodes.find((entry) => entry.id === id);
        assert.ok(node);
        assert.equal(node.scope, scope);
        assert.equal(node.status, 'confirmed');
        assert.deepEqual(node.tags, ['ordinary-tag']);
      }

      const injectionResult = await injections(vaultDir, telemetryFile);
      assert.equal(injectionResult.injections.length, 1);
      assert.equal(injectionResult.injections[0].sessionID, 'temporary-session');
      for (const [id, scope] of [[projectNode.id, 'project'], [globalNode.id, 'global']]) {
        const node = injectionResult.injections[0].memories.find((entry) => entry.id === id);
        assert.ok(node);
        assert.equal(node.scope, scope);
        assert.equal(node.available, true);
        assert.deepEqual(node.tags, ['ordinary-tag']);
      }

      const draftsResult = await drafts(vaultDir);
      assert.equal(draftsResult.drafts.length, 1);
      assert.equal(draftsResult.drafts[0].id, draftNode.id);
      assert.equal(draftsResult.drafts[0].intent, draftNode.intent);
      assert.equal(typeof draftsResult.drafts[0].ts, 'number');
      assert.deepEqual(draftsResult.drafts[0].tags, ['ordinary-tag']);

      assert.deepEqual(fs.readFileSync(projectNodesFile), projectBytesBefore);
      assert.deepEqual(fs.readFileSync(globalNodesFile), globalBytesBefore);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe('memory lib — review', () => {
  it('requires an explicit project type conversion and leaves edges intact', async () => {
    const { tmp, vaultDir, draft } = seedVault();
    try {
      const nodesFile = path.join(vaultDir, 'nodes.jsonl');
      const edgesFile = path.join(vaultDir, 'edges.jsonl');
      const beforeNodes = fs.readFileSync(nodesFile);
      const beforeEdges = fs.readFileSync(edgesFile);
      const implicit = await review(vaultDir, { id: draft.id, action: 'confirm' });
      assert.match(implicit.error, /explicit project type conversion/);
      assert.deepEqual(fs.readFileSync(nodesFile), beforeNodes);
      assert.deepEqual(fs.readFileSync(edgesFile), beforeEdges);

      const confirmed = await review(vaultDir, { id: draft.id, action: 'confirm', edits: { type: 'solution', intent: 'confirmed intent' } });
      assert.equal(confirmed.node.status, 'confirmed');
      assert.equal(confirmed.node.type, 'solution');
      assert.equal(confirmed.node.scope, 'project');
      assert.equal(confirmed.node.intent, 'confirmed intent');
      assert.equal((await drafts(vaultDir)).drafts.length, 0);
      assert.deepEqual(fs.readFileSync(edgesFile), beforeEdges);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('keeps explicit discard available for legacy drafts', async () => {
    const { tmp, vaultDir, draft } = seedVault();
    try {
      const discarded = await review(vaultDir, { id: draft.id, action: 'discard' });
      assert.deepEqual(discarded, { id: draft.id, action: 'discard', removed: true });
      assert.equal((await drafts(vaultDir)).drafts.length, 0);
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
