import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './app.js';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { initVault, initUserVault } from '../../memory/vault.js';
import { createNode, createEdge, listEdges } from '../../memory/graph.js';
import { createSkill } from '../../skill-engine/index.js';
import { createRunManifest } from '../../orchestrator/parallel.js';
import { resolveSharedAdvisorModule } from './routes/shared-advisor-modules.js';

function seedLegacyNode(vaultDir, node) {
  const seeded = { id: node.id || `legacy-${Date.now()}-${Math.random()}`, ts: Date.now(), tags: [], ...node };
  fs.appendFileSync(path.join(vaultDir, 'nodes.jsonl'), `${JSON.stringify(seeded)}\n`);
  return seeded;
}

describe('GET /api/telemetry/stream (SSE)', () => {
  let tmp;
  let telemetryDir;
  let eventsFile;
  let server;
  let base;

  beforeEach(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-sse-'));
    telemetryDir = path.join(tmp, '.specs', 'state', 'telemetry');
    fs.mkdirSync(telemetryDir, { recursive: true });
    eventsFile = path.join(telemetryDir, 'events.jsonl');
    const app = createApp({ root: tmp, distDir: path.join(tmp, 'dist') });
    await new Promise((resolve) => {
      server = app.listen(0, () => resolve());
    });
    base = `http://localhost:${server.address().port}`;
  });

  afterEach(async () => {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('pushes an event when the telemetry file changes', async () => {
    const controller = new AbortController();
    const res = await fetch(`${base}/api/telemetry/stream`, { signal: controller.signal });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/event-stream/);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let frames = 0;
    let onFrame = null;
    const waitForFrame = () =>
      new Promise((resolve) => {
        onFrame = resolve;
      });
    const pump = (async () => {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) return;
        buffer += decoder.decode(value);
        const parts = buffer.split('\n\n');
        buffer = parts.pop();
        for (const part of parts) {
          if (part.includes('data:')) {
            frames += 1;
            if (onFrame) {
              const resolve = onFrame;
              onFrame = null;
              resolve(frames);
            }
          }
        }
      }
    })();

    // Frame 1 is emitted immediately on connect.
    await waitForFrame();
    assert.equal(frames, 1);

    // A real file change must produce frame 2.
    fs.appendFileSync(eventsFile, '{"ts":1,"type":"tool","sessionID":"s1","ok":true}\n', 'utf8');
    const second = await Promise.race([
      waitForFrame(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('no SSE push within 3s of file change')), 3000)),
    ]);
    assert.equal(second, 2);

    controller.abort();
    await pump.catch(() => {});
  });

  it('keeps single-session events compatible and supports up to five repeated sessions', async () => {
    fs.writeFileSync(eventsFile, ['a', 'b', 'c', 'd', 'e', 'f'].map((sessionID, ts) => JSON.stringify({ sessionID, ts })).join('\n') + '\n');
    const one = await (await fetch(`${base}/api/telemetry/events?session=b`)).json();
    assert.deepEqual(one, { events: [{ sessionID: 'b', ts: 1 }] });
    const many = await (await fetch(`${base}/api/telemetry/events?session=a&session=b&session=c&session=d&session=e&session=f`)).json();
    assert.deepEqual(many.events.map((event) => event.sessionID), ['a', 'b', 'c', 'd', 'e']);
    assert.equal((await (await fetch(`${base}/api/telemetry/events`)).json()).events.length, 6);
    const bounded = await (await fetch(`${base}/api/telemetry/events?limit=2`)).json();
    assert.deepEqual(bounded.events.map((event) => event.sessionID), ['e', 'f']);
  });
});

describe('GET/POST /api/memory', () => {
  let tmp;
  let server;
  let base;
  let oldHome;
  let oldXdg;
  let projectMemory;

  beforeEach(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-memapp-'));
    oldHome = process.env.HOME;
    oldXdg = process.env.XDG_CONFIG_HOME;
    process.env.HOME = path.join(tmp, 'home');
    process.env.XDG_CONFIG_HOME = path.join(tmp, 'xdg');
    const vaultDir = initVault(tmp);
    projectMemory = createNode(vaultDir, {
      type: 'decision',
      status: 'confirmed',
      intent: 'dash decision',
      summary: 'confirmed decision for dashboard',
    });
    seedLegacyNode(vaultDir, {
      type: 'atom',
      status: 'draft',
      intent: 'draft leak check',
      summary: 'must not appear in search/summary/graph',
    });
    const app = createApp({ root: tmp, distDir: path.join(tmp, 'dist') });
    await new Promise((resolve) => {
      server = app.listen(0, () => resolve());
    });
    base = `http://localhost:${server.address().port}`;
  });

  afterEach(async () => {
    await new Promise((resolve) => server.close(resolve));
    if (oldHome === undefined) delete process.env.HOME;
    else process.env.HOME = oldHome;
    if (oldXdg === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = oldXdg;
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('summary returns correct counts and never exposes drafts', async () => {
    const res = await fetch(`${base}/api/memory/summary`);
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.nodes.total, 2);
    assert.equal(body.nodes.confirmed, 1);
    assert.equal(body.nodes.draft, 1);
    assert.equal(body.nodes.byType.decision, 1);
  });

  it('search returns only confirmed matches', async () => {
    const res = await fetch(`${base}/api/memory/search?q=decision`);
    const body = await res.json();
    assert.equal(body.results.some((n) => n.intent === 'dash decision'), true);
    assert.equal(body.results.some((n) => n.intent === 'draft leak check'), false);
  });

  it('graph returns bounded confirmed nodes only', async () => {
    const res = await fetch(`${base}/api/memory/graph?limit=10`);
    const body = await res.json();
    assert.equal(body.nodes.length, 1);
    assert.equal(body.nodes.some((n) => n.intent === 'draft leak check'), false);
  });

  it('serves read-only global preference and explicit memory scope projections with safe validation', async () => {
    const globalVault = initUserVault();
    const oldPreference = seedLegacyNode(globalVault, {
      id: 'global-pref-old', ts: 10, type: 'preference', status: 'confirmed', scope: 'global',
      intent: 'Use Spanish', summary: 'Respond in Spanish.', tags: ['language'],
    });
    const currentPreference = seedLegacyNode(globalVault, {
      id: 'global-pref-current', ts: 20, type: 'preference', status: 'confirmed', scope: 'global',
      category: 'communication', priority: 'essential', intent: 'Use English', summary: 'Respond in English.',
    });
    seedLegacyNode(globalVault, {
      id: 'global-pref-workflow', ts: 30, type: 'preference', status: 'confirmed', scope: 'global',
      category: 'workflow', intent: 'Workflow preference', summary: 'Keep the verification order.',
    });
    seedLegacyNode(globalVault, {
      id: 'global-pref-agent', ts: 40, type: 'preference', status: 'confirmed', scope: 'global',
      category: 'agent_behavior', intent: 'Concise agent', summary: 'Keep answers direct.',
    });
    const taggedPreference = seedLegacyNode(globalVault, {
      id: 'global-pref-tagged', ts: 50, type: 'preference', status: 'confirmed', scope: 'global',
      category: 'unknown', intent: 'tagged preference', summary: 'Use a plain format.',
      tags: ['filterneedle', 'sk-abcdefghijklmnop'],
    });
    seedLegacyNode(globalVault, {
      id: 'global-pref-draft', type: 'preference', status: 'draft', scope: 'global',
      intent: 'draft-only sentinel', summary: 'draft-only text',
    });
    const globalDecision = seedLegacyNode(globalVault, {
      id: 'global-decision-sentinel', type: 'decision', status: 'confirmed', scope: 'global',
      intent: 'non-preference sentinel', summary: 'non-preference global text',
    });
    createEdge(globalVault, { from: currentPreference.id, to: oldPreference.id, rel: 'supersedes', ts: 21 });
    createEdge(globalVault, { from: currentPreference.id, to: globalDecision.id, rel: 'depends-on', ts: 22 });

    const telemetryDir = path.join(tmp, '.specs', 'state', 'telemetry');
    fs.mkdirSync(telemetryDir, { recursive: true });
    const telemetryFile = path.join(telemetryDir, 'events.jsonl');
    fs.writeFileSync(telemetryFile, `${JSON.stringify({
      ts: 100, type: 'memory-injected', sessionID: 'mixed-api-session', prompt: 'API_PROMPT_SENTINEL',
      memories: [
        { id: projectMemory.id, type: 'decision', scope: 'project' },
        { id: currentPreference.id, type: 'preference', scope: 'global' },
        { id: globalDecision.id, type: 'decision', scope: 'global' },
      ],
    })}\n`);

    const files = [
      path.join(tmp, '.guarana', 'memory', 'nodes.jsonl'),
      path.join(tmp, '.guarana', 'memory', 'edges.jsonl'),
      path.join(tmp, '.guarana', 'memory', 'config.json'),
      path.join(globalVault, 'nodes.jsonl'),
      path.join(globalVault, 'edges.jsonl'),
      path.join(globalVault, 'config.json'),
      telemetryFile,
    ];
    const bytesBefore = files.map((file) => fs.readFileSync(file));

    const completeResponse = await fetch(`${base}/api/memory/preferences`);
    const complete = await completeResponse.json();
    assert.equal(completeResponse.status, 200);
    assert.equal(complete.count, 5);
    assert.equal(complete.preferences.length, 5);
    assert.equal((await (await fetch(`${base}/api/memory/preferences?q=&category=&status=`)).json()).count, 5);
    assert.equal(complete.preferences.find((node) => node.id === oldPreference.id).status, 'superseded');
    assert.equal(complete.preferences.find((node) => node.id === currentPreference.id).status, 'active');
    assert.equal(complete.preferences.find((node) => node.id === taggedPreference.id).category, 'general');
    assert.deepEqual(complete.preferences.find((node) => node.id === taggedPreference.id).tags, ['filterneedle']);
    assert.equal(JSON.stringify(complete).includes(globalDecision.id), false);
    assert.equal(JSON.stringify(complete).includes('draft-only'), false);
    assert.deepEqual((await (await fetch(`${base}/api/memory/preferences?q=FILTERNEEDLE&category=general&status=active`)).json()).preferences.map((node) => node.id), [taggedPreference.id]);
    assert.deepEqual((await (await fetch(`${base}/api/memory/preferences?category=communication`)).json()).preferences.map((node) => node.id), [currentPreference.id]);
    assert.deepEqual((await (await fetch(`${base}/api/memory/preferences?status=superseded`)).json()).preferences.map((node) => node.id), [oldPreference.id]);
    assert.equal((await (await fetch(`${base}/api/memory/preferences?status=all`)).json()).count, 5);

    const projectSummary = await (await fetch(`${base}/api/memory/summary?scope=project`)).json();
    assert.equal(projectSummary.nodes.byScope.project, 2);
    assert.equal('global' in projectSummary.nodes.byScope, false);
    const projectGraph = await (await fetch(`${base}/api/memory/graph?scope=project`)).json();
    assert.ok(projectGraph.nodes.every((node) => node.scope === 'project'));
    const globalSummary = await (await fetch(`${base}/api/memory/summary?scope=global`)).json();
    assert.deepEqual(globalSummary.nodes.byScope, { global: 5 });
    const globalGraph = await (await fetch(`${base}/api/memory/graph?scope=global`)).json();
    assert.ok(globalGraph.nodes.every((node) => node.type === 'preference' && node.scope === 'global'));
    assert.equal(globalGraph.nodes.some((node) => node.id === globalDecision.id), false);

    const projectInjections = await (await fetch(`${base}/api/memory/injections?scope=project`)).json();
    assert.deepEqual(projectInjections.injections[0].memories.map((node) => node.id), [projectMemory.id]);
    const globalInjections = await (await fetch(`${base}/api/memory/injections?scope=global`)).json();
    assert.deepEqual(globalInjections.injections[0].memories.map((node) => node.id), [currentPreference.id]);
    assert.equal(JSON.stringify(globalInjections).includes('non-preference global text'), false);
    assert.equal(JSON.stringify(globalInjections).includes('API_PROMPT_SENTINEL'), false);

    for (const [url, message] of [
      ['/api/memory/preferences?category=invalid', /category must be/],
      ['/api/memory/preferences?status=invalid', /status must be/],
      ['/api/memory/preferences?q=a&q=b', /single string/],
    ]) {
      const response = await fetch(`${base}${url}`);
      assert.equal(response.status, 400);
      assert.match((await response.json()).error, message);
    }
    for (const route of ['/summary', '/graph', '/injections']) {
      const response = await fetch(`${base}/api/memory${route}?scope=unknown`);
      assert.equal(response.status, 400);
      assert.match((await response.json()).error, /scope must be/);
    }
    const noWriteRoute = await fetch(`${base}/api/memory/preferences`, { method: 'POST' });
    assert.equal(noWriteRoute.status, 404);
    assert.deepEqual(files.map((file) => fs.readFileSync(file)), bytesBefore);
  });

  it('creates only typed relationships between confirmed project memories', async () => {
    const vaultDir = path.join(tmp, '.guarana', 'memory');
    const other = createNode(vaultDir, {
      type: 'solution', status: 'confirmed', intent: 'dashboard solution', summary: 'project endpoint',
    });
    const draft = seedLegacyNode(vaultDir, {
      type: 'atom', status: 'draft', intent: 'draft endpoint', summary: 'not linkable',
    });
    const post = (body) => fetch(`${base}/api/memory/relationships`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });

    const invalidRelation = await post({ from: projectMemory.id, to: other.id, rel: 'invented' });
    assert.equal(invalidRelation.status, 400);
    assert.match((await invalidRelation.json()).error, /edge\.rel/);

    const unknown = await post({ from: projectMemory.id, to: 'mem-global-only', rel: 'fixes' });
    assert.equal(unknown.status, 404);
    assert.match((await unknown.json()).error, /existing project memory node/);

    const unconfirmed = await post({ from: projectMemory.id, to: draft.id, rel: 'fixes' });
    assert.equal(unconfirmed.status, 400);
    assert.match((await unconfirmed.json()).error, /confirmed project memory node/);

    const selfLink = await post({ from: projectMemory.id, to: projectMemory.id, rel: 'fixes' });
    assert.equal(selfLink.status, 400);
    assert.match((await selfLink.json()).error, /different/);

    const wrongScope = await post({ from: projectMemory.id, to: other.id, rel: 'fixes', scope: 'global' });
    assert.equal(wrongScope.status, 400);
    assert.match((await wrongScope.json()).error, /scope must be project/);

    const payload = { from: projectMemory.id, to: other.id, rel: 'fixes' };
    const created = await post({ ...payload, scope: 'project' });
    const edge = await created.json();
    assert.equal(created.status, 201);
    assert.deepEqual({ from: edge.from, to: edge.to, rel: edge.rel }, payload);
    assert.equal(typeof edge.ts, 'number');

    const duplicate = await post(payload);
    assert.equal(duplicate.status, 409);
    assert.match((await duplicate.json()).error, /already exists/);
    assert.deepEqual(listEdges(vaultDir), [edge]);
  });

  it('deletes only the exact selected project edge and reports missing selections', async () => {
    const vaultDir = path.join(tmp, '.guarana', 'memory');
    const other = createNode(vaultDir, {
      type: 'solution', status: 'confirmed', intent: 'dashboard solution', summary: 'project endpoint',
    });
    const selected = createEdge(vaultDir, {
      from: projectMemory.id, to: other.id, rel: 'fixes', ts: 101,
    });
    const retained = createEdge(vaultDir, {
      from: projectMemory.id, to: other.id, rel: 'relates-to', ts: 102,
    });
    const remove = (body) => fetch(`${base}/api/memory/relationships`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });

    const wrongScope = await remove({ ...selected, scope: 'global' });
    assert.equal(wrongScope.status, 400);
    assert.deepEqual(listEdges(vaultDir), [selected, retained]);

    const deleted = await remove({ ...selected, scope: 'project' });
    assert.equal(deleted.status, 200);
    assert.deepEqual(await deleted.json(), selected);
    assert.deepEqual(listEdges(vaultDir), [retained]);

    const missing = await remove(selected);
    assert.equal(missing.status, 404);
    assert.match((await missing.json()).error, /not found/);
    const malformed = await remove({ from: selected.from, to: selected.to, rel: selected.rel });
    assert.equal(malformed.status, 400);
  });

  it('never resolves or mutates global relationship endpoints', async () => {
    const globalVault = initUserVault();
    const globalFrom = createNode(globalVault, {
      type: 'preference', status: 'confirmed', scope: 'global', category: 'communication', intent: 'global start',
    });
    const globalTo = createNode(globalVault, {
      type: 'preference', status: 'confirmed', scope: 'global', category: 'workflow', intent: 'global end',
    });
    const globalEdge = createEdge(globalVault, {
      from: globalFrom.id, to: globalTo.id, rel: 'relates-to', ts: 103,
    });
    const before = listEdges(globalVault);
    const response = await fetch(`${base}/api/memory/relationships`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: globalFrom.id, to: projectMemory.id, rel: 'relates-to' }),
    });
    assert.equal(response.status, 404);
    assert.match((await response.json()).error, /existing project memory node/);

    const deletion = await fetch(`${base}/api/memory/relationships`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(globalEdge),
    });
    assert.equal(deletion.status, 404);
    assert.deepEqual(listEdges(globalVault), before);
    assert.deepEqual(listEdges(globalVault), [globalEdge]);
  });

  it('injections hydrates project and private global node references', async () => {
    const globalVault = initUserVault();
    const preference = createNode(globalVault, {
      type: 'preference',
      status: 'confirmed',
      scope: 'global',
      category: 'communication',
      intent: 'response language',
      summary: 'Always answer me in Portuguese.',
    });
    const summary = await (await fetch(`${base}/api/memory/summary`)).json();
    assert.deepEqual(summary.nodes.byScope, { project: 2, global: 1 });
    const graph = await (await fetch(`${base}/api/memory/graph?limit=10`)).json();
    assert.ok(graph.nodes.some((node) => node.id === preference.id && node.scope === 'global'));
    assert.ok(graph.nodes.some((node) => node.id === projectMemory.id && node.scope === 'project'));
    const telemetryDir = path.join(tmp, '.specs', 'state', 'telemetry');
    fs.mkdirSync(telemetryDir, { recursive: true });
    const firstRefs = [
      { id: projectMemory.id, type: 'decision', scope: 'project' },
      { id: preference.id, type: 'preference', scope: 'global' },
      ...Array.from({ length: 3 }, (_, index) => ({ id: `missing-small-${index}`, type: 'atom', scope: 'project' })),
    ];
    const largerRefs = [
      ...firstRefs,
      ...Array.from({ length: 3 }, (_, index) => ({ id: `missing-large-${index}`, type: 'atom', scope: 'project' })),
    ];
    const event = {
      ts: 100,
      type: 'memory-injected',
      sessionID: 'session-1',
      workflowState: 'planning',
      memories: firstRefs,
    };
    const events = [
      event,
      { ...event, ts: 101 }, // duplicate from two installed plugin scopes
      { ...event, ts: 102, memories: largerRefs }, // overlapping 5-node / 8-node payload from a second scope
      { ts: 150, type: 'session', status: 'compacted', sessionID: 'session-1' },
      { ...event, ts: 200, reason: 'compacted' },
    ];
    fs.writeFileSync(path.join(telemetryDir, 'events.jsonl'), `${events.map((row) => JSON.stringify(row)).join('\n')}\n`);

    const res = await fetch(`${base}/api/memory/injections?limit=10`);
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.injections.length, 2);
    assert.equal(body.injections[0].reason, 'compacted');
    assert.deepEqual(body.injections[0].memories.map((n) => [n.id, n.scope, n.summary]), [
      [projectMemory.id, 'project', 'confirmed decision for dashboard'],
      [preference.id, 'global', 'Always answer me in Portuguese.'],
      ['missing-small-0', 'project', ''],
      ['missing-small-1', 'project', ''],
      ['missing-small-2', 'project', ''],
    ]);
    assert.equal(body.injections[1].memories.length, 8);
    assert.equal(new Set(body.injections[1].memories.map((node) => node.id)).size, 8);
    assert.equal(body.injections[1].memories.find((node) => node.id === 'missing-large-0').available, false);
  });

  it('drafts require an explicit project type conversion before review confirmation', async () => {
    const listRes = await fetch(`${base}/api/memory/drafts`);
    const listBody = await listRes.json();
    assert.equal(listBody.drafts.length, 1);
    const id = listBody.drafts[0].id;

    const reviewRes = await fetch(`${base}/api/memory/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'confirm', edits: { type: 'decision' } }),
    });
    const reviewBody = await reviewRes.json();
    assert.equal(reviewRes.status, 200);
    assert.equal(reviewBody.node.status, 'confirmed');
    assert.equal(reviewBody.node.type, 'decision');

    const emptyDrafts = await (await fetch(`${base}/api/memory/drafts`)).json();
    assert.equal(emptyDrafts.drafts.length, 0);
  });

  it('missing vault returns empty/error, never 500', async () => {
    fs.rmSync(tmp, { recursive: true, force: true });
    const res = await fetch(`${base}/api/memory/summary`);
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.nodes.total, 0);

    const searchRes = await fetch(`${base}/api/memory/search?q=x`);
    assert.equal(searchRes.status, 200);
    assert.deepEqual(await searchRes.json(), { results: [], count: 0 });

    const graphRes = await fetch(`${base}/api/memory/graph`);
    assert.equal(graphRes.status, 200);
    assert.deepEqual(await graphRes.json(), { nodes: [], edges: [] });

    const injectionRes = await fetch(`${base}/api/memory/injections`);
    assert.equal(injectionRes.status, 200);
    assert.deepEqual(await injectionRes.json(), { injections: [] });

    const reviewRes = await fetch(`${base}/api/memory/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'x', action: 'confirm' }),
    });
    assert.equal(reviewRes.status, 400);
    assert.ok((await reviewRes.json()).error);
  });
});

describe('GET /api/skills', () => {
  let tmp;
  let oldHome;
  let server;
  let base;

  beforeEach(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-skills-api-'));
    oldHome = process.env.HOME;
    process.env.HOME = path.join(tmp, 'home');
    const app = createApp({ root: tmp, distDir: path.join(tmp, 'dist') });
    await new Promise((resolve) => {
      server = app.listen(0, () => resolve());
    });
    base = `http://localhost:${server.address().port}`;
  });

  afterEach(async () => {
    await new Promise((resolve) => server.close(resolve));
    if (oldHome === undefined) delete process.env.HOME;
    else process.env.HOME = oldHome;
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('returns generated global/project skills but excludes manual skills and filesystem paths', async () => {
    const shared = {
      projectDir: tmp,
      homeDir: process.env.HOME,
      name: 'review-release-candidate',
      description: 'Review a release candidate before publishing.',
      content: '# Release review\n\nRun checks, inspect the archive, and record the host smoke result.',
    };
    createSkill({ ...shared, scope: 'global' });
    createSkill({ ...shared, name: 'project-build-review', scope: 'project' });
    const manualDir = path.join(tmp, '.opencode', 'skills', 'manual-skill');
    fs.mkdirSync(manualDir, { recursive: true });
    fs.writeFileSync(path.join(manualDir, 'SKILL.md'), 'user-authored content');

    const response = await fetch(`${base}/api/skills`);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(body.global.map((skill) => skill.name), ['review-release-candidate']);
    assert.deepEqual(body.project.map((skill) => skill.name), ['project-build-review']);
    assert.equal(body.project[0].content, shared.content);
    assert.equal('revision' in body.global[0], false);
    assert.equal('revision' in body.project[0], false);
    assert.equal(JSON.stringify(body).includes(tmp), false);
    assert.equal(JSON.stringify(body).includes('manual-skill'), false);
  });

  it('returns empty scope lists when no generated skills exist', async () => {
    const response = await fetch(`${base}/api/skills`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { global: [], project: [] });
  });
});

describe('GET/PUT /api/models', () => {
  let tmp;
  let root;
  let home;
  let xdg;
  let oldHome;
  let oldXdg;
  let server;
  let base;

  beforeEach(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-models-api-'));
    root = path.join(tmp, 'active-project');
    home = path.join(tmp, 'home');
    xdg = path.join(home, 'xdg-config');
    fs.mkdirSync(root, { recursive: true });
    oldHome = process.env.HOME;
    oldXdg = process.env.XDG_CONFIG_HOME;
    process.env.HOME = home;
    process.env.XDG_CONFIG_HOME = xdg;
    const app = createApp({ root, distDir: path.join(tmp, 'dist') });
    await new Promise((resolve) => {
      server = app.listen(0, () => resolve());
    });
    base = `http://localhost:${server.address().port}`;
  });

  afterEach(async () => {
    await new Promise((resolve) => server.close(resolve));
    if (oldHome === undefined) delete process.env.HOME;
    else process.env.HOME = oldHome;
    if (oldXdg === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = oldXdg;
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('resolves shared settings modules from canonical and CLI route trees', async () => {
    let repoRoot = path.dirname(fileURLToPath(import.meta.url));
    while (!fs.existsSync(path.join(repoRoot, 'scripts', 'sync-cli-bundle.mjs'))) {
      const parent = path.dirname(repoRoot);
      if (parent === repoRoot) throw new Error('unable to locate repository root for route resolution test');
      repoRoot = parent;
    }

    const require = createRequire(import.meta.url);
    const layouts = [
      {
        route: 'dashboard/server/routes/models.js',
        resolver: 'dashboard/server/routes/shared-advisor-modules.js',
        workflowRoute: 'dashboard/server/routes/workflow.js',
        workflowCore: 'orchestrator/workflow-settings.js',
      },
      {
        route: 'cli/dashboard/server/routes/models.js',
        resolver: 'cli/dashboard/server/routes/shared-advisor-modules.js',
        workflowRoute: 'cli/dashboard/server/routes/workflow.js',
        workflowCore: 'cli/orchestrator/workflow-settings.js',
      },
    ];

    for (const layout of layouts) {
      const routeUrl = pathToFileURL(path.join(repoRoot, layout.route));
      const { resolveSharedAdvisorModule } = await import(pathToFileURL(path.join(repoRoot, layout.resolver)));
      for (const name of [
        'advisor-settings.js', 'advisor-profiles.js', 'artifact-transaction.js', 'paths.js', 'opencode-model-catalog.js', 'web-settings.js',
      ]) {
        const resolved = resolveSharedAdvisorModule(name, routeUrl.href);
        assert.equal(resolved, path.join(repoRoot, 'cli', 'lib', name));
        const sharedModule = require(resolved);
        const expectedExport = name === 'advisor-settings.js'
          ? 'readSettings'
          : name === 'advisor-profiles.js' ? 'installAdvisorArtifacts'
            : name === 'artifact-transaction.js' ? 'run'
              : name === 'paths.js' ? 'advisorSettingsTarget'
                : name === 'web-settings.js' ? 'readWebSettings' : 'discoverModels';
        assert.equal(typeof sharedModule[expectedExport], 'function');
      }

      const workflowRoute = pathToFileURL(path.join(repoRoot, layout.workflowRoute));
      const workflowSettingsUrl = new URL('../../../orchestrator/workflow-settings.js', workflowRoute);
      assert.equal(fileURLToPath(workflowSettingsUrl), path.join(repoRoot, layout.workflowCore));
      const workflowSettings = await import(workflowSettingsUrl);
      assert.equal(typeof workflowSettings.readWorkflowSettings, 'function');
      assert.equal(typeof workflowSettings.writeWorkflowSettings, 'function');
    }
  });

  it('catalog API exposes exact connected metadata from whitespace-aligned auth rows only', async () => {
    const require = createRequire(import.meta.url);
    const catalog = require(resolveSharedAdvisorModule('opencode-model-catalog.js'));
    const originalDiscover = catalog.discoverModels;
    const calls = [];
    const commands = [];
    catalog.discoverModels = async (options) => {
      calls.push(options);
      const outputs = {
        'auth list': [
          'Provider                Auth           Status',
          'OpenAI                  OAuth          stored',
          'OpenCode Console        API key        stored',
          'OpenRouter              API key        stored',
        ].join('\n'),
        models: 'openai/gpt-4o\nopencode/gpt-5\nopenrouter/auto\nollama/llama3.2\n',
      };
      return originalDiscover({
        ...options,
        execFile: (executable, args, execOptions, callback) => {
          assert.equal(executable, process.env.OPENCODE_BIN || 'opencode');
          assert.equal(execOptions.cwd, root);
          commands.push(args.join(' '));
          callback(null, args.join(' ') === 'auth list' ? outputs['auth list'] : outputs.models, '');
        },
      });
    };
    try {
      const response = await fetch(`${base}/api/models/catalog`);
      const body = await response.json();
      assert.equal(response.status, 200);
      assert.deepEqual(body, {
        models: [
          { provider: { id: 'openai', name: 'openai' }, model: { id: 'gpt-4o', name: 'gpt-4o' } },
          { provider: { id: 'opencode', name: 'opencode' }, model: { id: 'gpt-5', name: 'gpt-5' } },
          { provider: { id: 'openrouter', name: 'openrouter' }, model: { id: 'auto', name: 'auto' } },
        ],
        error: null,
      });
      assert.deepEqual(Object.keys(body).sort(), ['error', 'models']);
      assert.deepEqual([...new Set(body.models.map(({ provider }) => provider.id))], ['openai', 'opencode', 'openrouter']);
      assert.deepEqual(commands, ['auth list', 'models']);
      assert.equal(calls[0].cwd, root);
      assert.equal(calls[0].provider, undefined);
      assert.doesNotMatch(JSON.stringify(body), /OAuth|API key|stored|status|auth|credential|secret|ollama|llama3\.2/i);
    } finally {
      catalog.discoverModels = originalDiscover;
    }
  });

  it('runtime API returns only the latest sanitized Advisor execution or an empty state', async () => {
    assert.deepEqual(await (await fetch(`${base}/api/models/runtime`)).json(), { execution: null });
    fs.mkdirSync(path.join(root, '.specs', 'state', 'telemetry'), { recursive: true });
    fs.writeFileSync(path.join(root, '.specs', 'state', 'telemetry', 'events.jsonl'), [
      { ts: 1, type: 'advisor-execution', status: 'completed', providerID: 'openai', modelID: 'old', prompt: 'SECRET' },
      { ts: 2, type: 'advisor-execution', status: 'error', childSessionID: 'child', parentSessionID: 'parent', providerID: 'openai', modelID: 'new', variant: 'xhigh', output: 'SECRET', credential: 'SECRET' },
    ].map((event) => JSON.stringify(event)).join('\n'));
    const body = await (await fetch(`${base}/api/models/runtime`)).json();
    assert.deepEqual(body.execution, { ts: 2, status: 'error', childSessionID: 'child', parentSessionID: 'parent', providerID: 'openai', modelID: 'new', variant: 'xhigh' });
    assert.doesNotMatch(JSON.stringify(body), /SECRET|credential|output|prompt/i);
  });

  it('Advisor history endpoint bounds and sanitizes dispatch/execution rows', async () => {
    fs.mkdirSync(path.join(root, '.specs', 'state', 'telemetry'), { recursive: true });
    fs.writeFileSync(path.join(root, '.specs', 'state', 'telemetry', 'events.jsonl'), [
      { ts: 1, type: 'advisor-dispatch', status: 'dispatched', callID: 'call-1', parentSessionID: 'root', reason: 'Compare failed retry options' },
      { ts: 3, type: 'advisor-execution', status: 'completed', childSessionID: 'child', providerID: 'openai', modelID: 'old', prompt: 'SECRET' },
      { ts: 4, type: 'advisor-execution', status: 'error', childSessionID: 'child', providerID: 'openai', modelID: 'new', variant: 'high', output: 'SECRET', error: 'SECRET', credential: 'SECRET' },
      { ts: 5, type: 'advisor-dispatch', status: 'completed', callID: 'call-1', parentSessionID: 'root', childSessionID: 'child' },
      { ts: 5, type: 'advisor-dispatch', status: 'dispatched', callID: 'call-2', parentSessionID: 'other', reason: 'sk-privatevalue' },
    ].map((event) => JSON.stringify(event)).join('\n'));
    const response = await fetch(`${base}/api/telemetry/advisor-history?limit=1`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.history, [{ ts: 5, status: 'dispatched', callID: 'call-2', parentSessionID: 'other' }]);
    const all = await (await fetch(`${base}/api/telemetry/advisor-history?limit=1000`)).json();
    assert.equal(all.history.length, 2);
    const child = all.history.find((row) => row.childSessionID === 'child');
    assert.deepEqual(child, { ts: 1, status: 'error', callID: 'call-1', parentSessionID: 'root', childSessionID: 'child', providerID: 'openai', modelID: 'new', variant: 'high', reason: 'Compare failed retry options' });
    assert.doesNotMatch(JSON.stringify(all), /SECRET|credential|output|prompt|error":"|privatevalue/i);
  });

  it('variant API returns only variant names for the requested model', async () => {
    const require = createRequire(import.meta.url);
    const catalog = require(resolveSharedAdvisorModule('opencode-model-catalog.js'));
    const original = catalog.discoverVariants;
    let received;
    catalog.discoverVariants = async (options) => {
      received = options;
      return { variants: ['high'], error: null };
    };
    try {
      const response = await fetch(`${base}/api/models/variants?provider=openrouter&model=~anthropic%2Fclaude-fable-latest`);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { variants: ['high'], error: null });
      assert.deepEqual(received, { cwd: root, provider: 'openrouter', model: '~anthropic/claude-fable-latest' });
    } finally {
      catalog.discoverVariants = original;
    }
  });

  it('loads global fallback, saves validated project overrides, and refreshes only project profiles', async () => {
    const globalFile = path.join(xdg, 'guarana', 'advisor.json');
    fs.mkdirSync(path.dirname(globalFile), { recursive: true });
    fs.writeFileSync(globalFile, JSON.stringify({
      primary: { provider: 'anthropic', model: 'claude-sonnet-4', variant: 'high' },
      advisor: { provider: 'openai', model: 'gpt-5' },
    }));

    const loaded = await (await fetch(`${base}/api/models`)).json();
    assert.equal(loaded.project.primary, undefined);
    assert.equal(loaded.effective.primary.model, 'claude-sonnet-4');
    assert.equal(loaded.sources.primary.model, 'global');
    assert.equal(loaded.sources.advisor.variant, 'unset');

    const response = await fetch(`${base}/api/models`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: {
        primary: { model: 'claude-opus-4', variant: 'max' },
        advisor: { variant: 'low' },
      } }),
    });
    const saved = await response.json();
    assert.equal(response.status, 200);
    assert.equal(saved.effective.primary.provider, 'anthropic');
    assert.equal(saved.effective.primary.model, 'claude-opus-4');
    assert.equal(saved.effective.advisor.model, 'gpt-5');
    assert.equal(saved.sources.primary.provider, 'global');
    assert.equal(saved.sources.primary.model, 'project');
    assert.equal(saved.sources.advisor.variant, 'project');

    const projectSettings = path.join(root, '.guarana', 'advisor.json');
    assert.deepEqual(JSON.parse(fs.readFileSync(projectSettings, 'utf8')), {
      primary: { model: 'claude-opus-4', variant: 'max' },
      advisor: { variant: 'low' },
    });
    const primaryProfile = path.join(root, '.opencode', 'agents', 'guarana.md');
    const command = path.join(root, '.opencode', 'commands', 'guarana-advisor.md');
    assert.match(fs.readFileSync(primaryProfile, 'utf8'), /model: "anthropic\/claude-opus-4"[\s\S]*variant: "max"/);
    assert.ok(fs.existsSync(command));
    assert.equal(fs.readFileSync(globalFile, 'utf8').includes('claude-opus-4'), false);
  });

  it('rejects invalid settings without writing project settings or generated artifacts', async () => {
    const response = await fetch(`${base}/api/models`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: { primary: { provider: 'bad provider', model: 'gpt-5' } } }),
    });
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /Invalid model settings/);
    assert.equal(fs.existsSync(path.join(root, '.guarana', 'advisor.json')), false);
    assert.equal(fs.existsSync(path.join(root, '.opencode')), false);
  });

  it('defaults Advisor consultations off and permits false without an Advisor model', async () => {
    const loaded = await (await fetch(`${base}/api/models`)).json();
    assert.equal(loaded.effective.advisor?.enabled, false);
    assert.equal(loaded.sources.advisor.enabled, 'unset');
    const response = await fetch(`${base}/api/models`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: { advisor: { enabled: false } } }),
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).project.advisor.enabled, false);
  });

  it('rejects enabling Advisor consultations without an effective provider and model', async () => {
    const response = await fetch(`${base}/api/models`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: { advisor: { enabled: true } } }),
    });
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /Advisor consultations require/);
    assert.equal(fs.existsSync(path.join(root, '.guarana', 'advisor.json')), false);
  });

  it('saves an exact OpenRouter tilde model ID and refreshes the generated profile', async () => {
    const id = '~anthropic/claude-fable-latest';
    const response = await fetch(`${base}/api/models`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: {
        primary: { provider: 'openrouter', model: id },
        advisor: { provider: 'openai', model: 'gpt-5' },
      } }),
    });
    const saved = await response.json();
    assert.equal(response.status, 200);
    assert.equal(saved.project.primary.model, id);
    assert.equal(JSON.parse(fs.readFileSync(path.join(root, '.guarana', 'advisor.json'), 'utf8')).primary.model, id);
    const profile = fs.readFileSync(path.join(root, '.opencode', 'agents', 'guarana.md'), 'utf8');
    assert.match(profile, /model: "openrouter\/~anthropic\/claude-fable-latest"/);

    for (const model of ['bad model', 'bad\u0001model']) {
      const invalid = await fetch(`${base}/api/models`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: { primary: { provider: 'openrouter', model } } }),
      });
      assert.equal(invalid.status, 400);
    }
  });

  it('reports foreign-artifact conflicts and leaves settings and foreign files untouched', async () => {
    const globalFile = path.join(xdg, 'guarana', 'advisor.json');
    fs.mkdirSync(path.dirname(globalFile), { recursive: true });
    fs.writeFileSync(globalFile, JSON.stringify({
      primary: { provider: 'anthropic', model: 'claude-sonnet-4' },
      advisor: { provider: 'openai', model: 'gpt-5' },
    }));
    const projectSettings = path.join(root, '.guarana', 'advisor.json');
    fs.mkdirSync(path.dirname(projectSettings), { recursive: true });
    const originalSettings = '{"primary":{"model":"claude-sonnet-4"}}\n';
    fs.writeFileSync(projectSettings, originalSettings);
    const foreign = path.join(root, '.opencode', 'agents', 'guarana.md');
    fs.mkdirSync(path.dirname(foreign), { recursive: true });
    fs.writeFileSync(foreign, 'owned by another tool\n');

    const response = await fetch(`${base}/api/models`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: { primary: { model: 'claude-opus-4' } } }),
    });
    assert.equal(response.status, 409);
    assert.match((await response.json()).error, /conflict.*not managed by Guarana/i);
    assert.equal(fs.readFileSync(projectSettings, 'utf8'), originalSettings);
    assert.equal(fs.readFileSync(foreign, 'utf8'), 'owned by another tool\n');
    assert.equal(fs.existsSync(path.join(root, '.opencode', 'commands', 'guarana-advisor.md')), false);
  });

  it('preflights modified manifest-owned Advisor profiles before saving settings', async () => {
    const created = await fetch(`${base}/api/models`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: {
        primary: { provider: 'anthropic', model: 'claude-sonnet-4' },
        advisor: { provider: 'openai', model: 'gpt-5', enabled: true },
      } }),
    });
    assert.equal(created.status, 200);

    const projectSettings = path.join(root, '.guarana', 'advisor.json');
    const profile = path.join(root, '.opencode', 'agents', 'guarana-advisor.md');
    const manifest = JSON.parse(fs.readFileSync(path.join(root, '.guarana', 'install-manifest.json'), 'utf8'));
    assert.ok(manifest.advisor.some((entry) => entry.path === 'agents/guarana-advisor.md' && /^[a-f0-9]{64}$/.test(entry.sha256)));

    fs.appendFileSync(profile, '\nlocal edit\n');
    const settingsBefore = fs.readFileSync(projectSettings);
    const profileBefore = fs.readFileSync(profile);
    const response = await fetch(`${base}/api/models`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: {
        primary: { provider: 'anthropic', model: 'claude-sonnet-4' },
        advisor: { provider: 'openai', model: 'gpt-5.1', enabled: true },
      } }),
    });

    assert.equal(response.status, 409);
    assert.match((await response.json()).error, /managed advisor profile was modified/i);
    assert.deepEqual(fs.readFileSync(projectSettings), settingsBefore);
    assert.deepEqual(fs.readFileSync(profile), profileBefore);

    const incomplete = await fetch(`${base}/api/models`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: { advisor: { model: 'gpt-5.2' } } }),
    });
    assert.equal(incomplete.status, 409);
    assert.match((await incomplete.json()).error, /managed advisor profile was modified/i);
    assert.deepEqual(fs.readFileSync(projectSettings), settingsBefore);
    assert.deepEqual(fs.readFileSync(profile), profileBefore);
  });

  it('rolls back settings, Advisor profiles, and manifest when the manifest rename fails after committing', async () => {
    const globalSettings = path.join(xdg, 'guarana', 'advisor.json');
    fs.mkdirSync(path.dirname(globalSettings), { recursive: true });
    fs.writeFileSync(globalSettings, '{"advisor":{"provider":"openai","model":"gpt-5"}}\n');
    const foreign = path.join(root, '.opencode', 'plugins', 'local-plugin.js');
    const memory = path.join(root, '.guarana', 'memory', 'nodes.jsonl');
    fs.mkdirSync(path.dirname(foreign), { recursive: true });
    fs.writeFileSync(foreign, 'foreign plugin stays\n');
    fs.mkdirSync(path.dirname(memory), { recursive: true });
    fs.writeFileSync(memory, '{"id":"keep-memory"}\n');

    const first = await fetch(`${base}/api/models`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: {} }),
    });
    assert.equal(first.status, 200);

    const settingsFile = path.join(root, '.guarana', 'advisor.json');
    const manifestFile = path.join(root, '.guarana', 'install-manifest.json');
    const setupCommand = path.join(root, '.opencode', 'commands', 'guarana-advisor.md');
    fs.chmodSync(settingsFile, 0o600);
    fs.chmodSync(manifestFile, 0o640);
    fs.chmodSync(setupCommand, 0o640);
    const managed = [settingsFile, manifestFile, setupCommand, globalSettings, foreign, memory];
    const before = new Map(managed.map((file) => [file, {
      bytes: fs.readFileSync(file), mode: fs.statSync(file).mode & 0o7777,
    }]));

    const originalRename = fs.renameSync;
    let injected = false;
    fs.renameSync = function (from, to, ...rest) {
      const result = originalRename.call(this, from, to, ...rest);
      if (!injected && to === manifestFile) {
        injected = true;
        throw new Error('injected manifest rename failure');
      }
      return result;
    };
    let response;
    try {
      response = await fetch(`${base}/api/models`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: {
          primary: { provider: 'anthropic', model: 'claude-opus-4' },
          advisor: { provider: 'openai', model: 'gpt-5.1', enabled: true },
        } }),
      });
    } finally {
      fs.renameSync = originalRename;
    }

    assert.ok(injected);
    assert.equal(response.status, 500);
    assert.match((await response.json()).error, /Unable to save model settings: injected manifest rename failure/);
    for (const [file, prior] of before) {
      assert.deepEqual(fs.readFileSync(file), prior.bytes, file);
      assert.equal(fs.statSync(file).mode & 0o7777, prior.mode, file);
    }
    assert.equal(fs.existsSync(path.join(root, '.opencode', 'agents')), false);
  });
});

describe('GET/PUT /api/workflow/settings', () => {
  let tmp;
  let root;
  let home;
  let xdg;
  let oldHome;
  let oldXdg;
  let server;
  let base;

  beforeEach(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-workflow-settings-'));
    root = path.join(tmp, 'project');
    home = path.join(tmp, 'home');
    xdg = path.join(home, 'xdg-config');
    fs.mkdirSync(root, { recursive: true });
    oldHome = process.env.HOME;
    oldXdg = process.env.XDG_CONFIG_HOME;
    process.env.HOME = home;
    process.env.XDG_CONFIG_HOME = xdg;
    const app = createApp({ root, distDir: path.join(tmp, 'dist') });
    await new Promise((resolve) => {
      server = app.listen(0, () => resolve());
    });
    base = `http://localhost:${server.address().port}`;
  });

  afterEach(async () => {
    await new Promise((resolve) => server.close(resolve));
    if (oldHome === undefined) delete process.env.HOME;
    else process.env.HOME = oldHome;
    if (oldXdg === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = oldXdg;
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  const putSettings = (body) => fetch(`${base}/api/workflow/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  it('returns exact defaults and sources, writes project overrides only, and restores inheritance', async () => {
    const globalFile = path.join(xdg, 'guarana', 'workflow.json');
    const globalAdvisor = path.join(xdg, 'guarana', 'advisor.json');
    const projectAdvisor = path.join(root, '.guarana', 'advisor.json');
    fs.mkdirSync(path.dirname(globalFile), { recursive: true });
    fs.mkdirSync(path.dirname(projectAdvisor), { recursive: true });
    fs.writeFileSync(globalFile, '{"specs":{"enabled":false},"memory":{"preferenceInjectionBudgetTokens":8192}}\n');
    fs.writeFileSync(globalAdvisor, '{"primary":{"provider":"openai","model":"gpt-5"}}\n');
    fs.writeFileSync(projectAdvisor, '{"advisor":{"enabled":false}}\n');
    const globalBefore = fs.readFileSync(globalFile);
    const globalAdvisorBefore = fs.readFileSync(globalAdvisor);
    const projectAdvisorBefore = fs.readFileSync(projectAdvisor);

    const initialResponse = await fetch(`${base}/api/workflow/settings`);
    const initial = await initialResponse.json();
    assert.equal(initialResponse.status, 200);
    assert.deepEqual(Object.keys(initial), ['global', 'project', 'effective', 'sources']);
    assert.deepEqual(initial.global, { specs: { enabled: false }, memory: { preferenceInjectionBudgetTokens: 8192 } });
    assert.deepEqual(initial.project, {});
    assert.deepEqual(initial.effective, {
      specs: { enabled: false }, verify: { enabled: true }, memory: { preferenceInjectionBudgetTokens: 8192 },
    });
    assert.deepEqual(initial.sources, {
      specs: 'global', verify: 'default', memory: { preferenceInjectionBudgetTokens: 'global' },
    });

    const savedResponse = await putSettings({ settings: {
      specs: { enabled: true },
      verify: { enabled: false },
      memory: { preferenceInjectionBudgetTokens: 2048 },
    } });
    const saved = await savedResponse.json();
    assert.equal(savedResponse.status, 200);
    assert.deepEqual(saved, {
      ok: true,
      global: { specs: { enabled: false }, memory: { preferenceInjectionBudgetTokens: 8192 } },
      project: { specs: { enabled: true }, verify: { enabled: false }, memory: { preferenceInjectionBudgetTokens: 2048 } },
      effective: { specs: { enabled: true }, verify: { enabled: false }, memory: { preferenceInjectionBudgetTokens: 2048 } },
      sources: { specs: 'project', verify: 'project', memory: { preferenceInjectionBudgetTokens: 'project' } },
    });
    const projectFile = path.join(root, '.guarana', 'workflow.json');
    assert.deepEqual(JSON.parse(fs.readFileSync(projectFile, 'utf8')), {
      specs: { enabled: true }, verify: { enabled: false }, memory: { preferenceInjectionBudgetTokens: 2048 },
    });

    const inheritSpecs = await putSettings({ settings: { verify: { enabled: false } } });
    const inheritedSpecs = await inheritSpecs.json();
    assert.equal(inheritSpecs.status, 200);
    assert.deepEqual(inheritedSpecs.effective, {
      specs: { enabled: false }, verify: { enabled: false }, memory: { preferenceInjectionBudgetTokens: 8192 },
    });
    assert.deepEqual(inheritedSpecs.sources, {
      specs: 'global', verify: 'project', memory: { preferenceInjectionBudgetTokens: 'global' },
    });

    const inheritAll = await putSettings({ settings: {} });
    const inheritedAll = await inheritAll.json();
    assert.equal(inheritAll.status, 200);
    assert.deepEqual(inheritedAll.effective, {
      specs: { enabled: false }, verify: { enabled: true }, memory: { preferenceInjectionBudgetTokens: 8192 },
    });
    assert.deepEqual(inheritedAll.sources, {
      specs: 'global', verify: 'default', memory: { preferenceInjectionBudgetTokens: 'global' },
    });
    assert.deepEqual(fs.readFileSync(globalFile), globalBefore);
    assert.deepEqual(fs.readFileSync(globalAdvisor), globalAdvisorBefore);
    assert.deepEqual(fs.readFileSync(projectAdvisor), projectAdvisorBefore);
  });

  it('rejects malformed request shapes and invalid settings without writing', async () => {
    const projectFile = path.join(root, '.guarana', 'workflow.json');
    const invalidBodies = [
      { settings: {}, scope: 'invalid' },
      { settings: {}, scope: 'global', extra: true },
      { scope: 'global' },
      { settings: { unknown: { enabled: true } } },
      { settings: { specs: { enabled: true, extra: false } } },
      { settings: { verify: { enabled: 'yes' } } },
      { settings: { memory: { preferenceInjectionBudgetTokens: 0 } } },
      { settings: { memory: { preferenceInjectionBudgetTokens: -1 } } },
      { settings: { memory: { preferenceInjectionBudgetTokens: 1.5 } } },
      { settings: { memory: { preferenceInjectionBudgetTokens: '100' } } },
    ];
    for (const body of invalidBodies) {
      const response = await putSettings(body);
      assert.equal(response.status, 400);
      assert.ok((await response.json()).error);
      assert.equal(fs.existsSync(projectFile), false);
    }

    const malformedJson = await fetch(`${base}/api/workflow/settings`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{"settings":',
    });
    assert.equal(malformedJson.status, 400);
    assert.deepEqual(await malformedJson.json(), { error: 'Malformed JSON request body.' });
    assert.equal(fs.existsSync(projectFile), false);

    fs.mkdirSync(path.dirname(projectFile), { recursive: true });
    const invalidExisting = '{not valid json\n';
    fs.writeFileSync(projectFile, invalidExisting);
    const response = await putSettings({ settings: { specs: { enabled: false } } });
    assert.equal(response.status, 500);
    assert.match((await response.json()).error, /Unable to save workflow settings/);
    assert.equal(fs.readFileSync(projectFile, 'utf8'), invalidExisting);

    fs.rmSync(projectFile);
    const globalFile = path.join(xdg, 'guarana', 'workflow.json');
    fs.mkdirSync(path.dirname(globalFile), { recursive: true });
    const invalidGlobal = '{"verify":{"enabled":"invalid"}}\n';
    fs.writeFileSync(globalFile, invalidGlobal);
    const globalError = await putSettings({ settings: { specs: { enabled: false } } });
    assert.equal(globalError.status, 500);
    assert.match((await globalError.json()).error, /Unable to save workflow settings/);
    assert.equal(fs.existsSync(projectFile), false);
    assert.equal(fs.readFileSync(globalFile, 'utf8'), invalidGlobal);
  });

  it('writes only an explicitly selected scope and keeps advisor files unchanged', async () => {
    const globalFile = path.join(xdg, 'guarana', 'workflow.json');
    const projectFile = path.join(root, '.guarana', 'workflow.json');
    const globalAdvisor = path.join(xdg, 'guarana', 'advisor.json');
    const projectAdvisor = path.join(root, '.guarana', 'advisor.json');
    fs.mkdirSync(path.dirname(globalAdvisor), { recursive: true });
    fs.mkdirSync(path.dirname(projectAdvisor), { recursive: true });
    fs.writeFileSync(globalAdvisor, '{"primary":{"provider":"openai"}}\n');
    fs.writeFileSync(projectAdvisor, '{"advisor":{"enabled":false}}\n');
    const globalAdvisorBefore = fs.readFileSync(globalAdvisor);
    const projectAdvisorBefore = fs.readFileSync(projectAdvisor);

    const globalResponse = await putSettings({ scope: 'global', settings: {
      specs: { enabled: false }, memory: { preferenceInjectionBudgetTokens: 8192 },
    } });
    assert.equal(globalResponse.status, 200);
    const globalBody = await globalResponse.json();
    assert.deepEqual(globalBody.global, {
      specs: { enabled: false }, memory: { preferenceInjectionBudgetTokens: 8192 },
    });
    assert.deepEqual(globalBody.project, {});
    assert.deepEqual(JSON.parse(fs.readFileSync(globalFile, 'utf8')), {
      specs: { enabled: false }, memory: { preferenceInjectionBudgetTokens: 8192 },
    });
    assert.equal(fs.existsSync(projectFile), false);

    const projectResponse = await putSettings({ scope: 'project', settings: { verify: { enabled: false } } });
    assert.equal(projectResponse.status, 200);
    const projectBody = await projectResponse.json();
    assert.deepEqual(projectBody.global, {
      specs: { enabled: false }, memory: { preferenceInjectionBudgetTokens: 8192 },
    });
    assert.deepEqual(projectBody.project, { verify: { enabled: false } });
    assert.deepEqual(projectBody.effective, {
      specs: { enabled: false }, verify: { enabled: false }, memory: { preferenceInjectionBudgetTokens: 8192 },
    });
    assert.deepEqual(fs.readFileSync(globalFile), Buffer.from('{\n  "specs": {\n    "enabled": false\n  },\n  "memory": {\n    "preferenceInjectionBudgetTokens": 8192\n  }\n}\n'));
    assert.deepEqual(fs.readFileSync(globalAdvisor), globalAdvisorBefore);
    assert.deepEqual(fs.readFileSync(projectAdvisor), projectAdvisorBefore);
  });
});

describe('GET/PUT /api/web/settings', () => {
  let tmp;
  let root;
  let home;
  let xdg;
  let oldHome;
  let oldXdg;
  let server;
  let base;

  beforeEach(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-web-api-settings-'));
    root = path.join(tmp, 'project');
    home = path.join(tmp, 'home');
    xdg = path.join(tmp, 'xdg-config');
    fs.mkdirSync(root, { recursive: true });
    oldHome = process.env.HOME;
    oldXdg = process.env.XDG_CONFIG_HOME;
    process.env.HOME = home;
    process.env.XDG_CONFIG_HOME = xdg;
    const app = createApp({ root, distDir: path.join(tmp, 'dist') });
    await new Promise((resolve) => {
      server = app.listen(0, () => resolve());
    });
    base = `http://localhost:${server.address().port}`;
  });

  afterEach(async () => {
    await new Promise((resolve) => server.close(resolve));
    if (oldHome === undefined) delete process.env.HOME;
    else process.env.HOME = oldHome;
    if (oldXdg === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = oldXdg;
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  const putWebSettings = (body, raw) => fetch(`${base}/api/web/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: raw ?? JSON.stringify(body),
  });

  it('returns defaults and writes explicit global/project partials without touching other files', async () => {
    const globalAdvisor = path.join(xdg, 'guarana', 'advisor.json');
    const projectAdvisor = path.join(root, '.guarana', 'advisor.json');
    const globalWorkflow = path.join(xdg, 'guarana', 'workflow.json');
    const projectWorkflow = path.join(root, '.guarana', 'workflow.json');
    fs.mkdirSync(path.dirname(globalAdvisor), { recursive: true });
    fs.mkdirSync(path.dirname(projectAdvisor), { recursive: true });
    fs.writeFileSync(globalAdvisor, '{"primary":{"provider":"openai"}}\n');
    fs.writeFileSync(projectAdvisor, '{"advisor":{"enabled":false}}\n');
    fs.writeFileSync(globalWorkflow, '{"specs":{"enabled":false}}\n');
    fs.writeFileSync(projectWorkflow, '{"verify":{"enabled":false}}\n');
    const otherFiles = [globalAdvisor, projectAdvisor, globalWorkflow, projectWorkflow]
      .map((file) => [file, fs.readFileSync(file)]);

    const initialResponse = await fetch(`${base}/api/web/settings`);
    const initial = await initialResponse.json();
    assert.equal(initialResponse.status, 200);
    assert.deepEqual(Object.keys(initial), ['global', 'project', 'effective', 'sources']);
    assert.deepEqual(initial.global, {});
    assert.deepEqual(initial.project, {});
    assert.deepEqual(initial.effective, {
      appearance: { theme: 'light', startPage: 'overview' },
      refresh: { intervalSeconds: 5 },
      server: { port: 4200, open: true },
    });
    assert.deepEqual(initial.sources, {
      appearance: { theme: 'default', startPage: 'default' },
      refresh: { intervalSeconds: 'default' },
      server: { port: 'default', open: 'default' },
    });

    const globalResponse = await putWebSettings({ scope: 'global', settings: {
      appearance: { theme: 'dark' }, server: { port: 4310, open: false },
    } });
    assert.equal(globalResponse.status, 200);
    const global = await globalResponse.json();
    assert.deepEqual(global.global, { appearance: { theme: 'dark' }, server: { port: 4310, open: false } });
    assert.deepEqual(global.project, {});
    assert.equal(fs.existsSync(path.join(root, '.guarana', 'web.json')), false);

    const projectResponse = await putWebSettings({ scope: 'project', settings: {
      appearance: { startPage: 'runs' }, server: { port: 4320 },
    } });
    assert.equal(projectResponse.status, 200);
    const project = await projectResponse.json();
    assert.deepEqual(project.effective, {
      appearance: { theme: 'dark', startPage: 'runs' },
      refresh: { intervalSeconds: 5 },
      server: { port: 4320, open: false },
    });
    assert.deepEqual(project.sources, {
      appearance: { theme: 'global', startPage: 'project' },
      refresh: { intervalSeconds: 'default' },
      server: { port: 'project', open: 'global' },
    });
    for (const [file, before] of otherFiles) assert.deepEqual(fs.readFileSync(file), before, file);
  });

  it('rejects malformed payloads, invalid settings, and corrupt files without writes', async () => {
    const projectFile = path.join(root, '.guarana', 'web.json');
    const globalFile = path.join(xdg, 'guarana', 'web.json');
    const invalidBodies = [
      { settings: {} },
      { scope: 'project', settings: {}, extra: true },
      { scope: 'invalid', settings: {} },
      { scope: 'global', settings: { appearance: { startPage: 'models' } } },
      { scope: 'project', settings: { server: { open: 'no' } } },
      { scope: 'project', settings: { refresh: { intervalSeconds: 10 } } },
    ];
    for (const body of invalidBodies) {
      const response = await putWebSettings(body);
      assert.equal(response.status, 400);
      assert.ok((await response.json()).error);
      assert.equal(fs.existsSync(projectFile), false);
      assert.equal(fs.existsSync(globalFile), false);
    }

    const malformedJson = await putWebSettings(undefined, '{"scope":');
    assert.equal(malformedJson.status, 400);
    assert.deepEqual(await malformedJson.json(), { error: 'Malformed JSON request body.' });
    assert.equal(fs.existsSync(projectFile), false);
    assert.equal(fs.existsSync(globalFile), false);

    fs.mkdirSync(path.dirname(projectFile), { recursive: true });
    const corruptProject = '{bad JSON\n';
    fs.writeFileSync(projectFile, corruptProject);
    const readCorrupt = await fetch(`${base}/api/web/settings`);
    assert.equal(readCorrupt.status, 500);
    assert.match((await readCorrupt.json()).error, /Unable to load web settings/);
    const corruptResponse = await putWebSettings({ scope: 'project', settings: { server: { port: 4311 } } });
    assert.equal(corruptResponse.status, 500);
    assert.match((await corruptResponse.json()).error, /Unable to save web settings/);
    assert.equal(fs.readFileSync(projectFile, 'utf8'), corruptProject);

    fs.rmSync(projectFile);
    fs.mkdirSync(path.dirname(globalFile), { recursive: true });
    const corruptGlobal = '{"server":{"open":"no"}}\n';
    fs.writeFileSync(globalFile, corruptGlobal);
    const invalidExisting = await putWebSettings({ scope: 'project', settings: { server: { port: 4311 } } });
    assert.equal(invalidExisting.status, 500);
    assert.equal(fs.existsSync(projectFile), false);
    assert.equal(fs.readFileSync(globalFile, 'utf8'), corruptGlobal);
  });
});

describe('persistent Dashboard project selection', () => {
  let tmp;
  let home;
  let xdg;
  let previousHome;
  let previousXdg;
  const servers = [];

  async function start(root, execFileImpl) {
    const app = createApp({ root, distDir: path.join(tmp, 'dist'), execFileImpl });
    const server = await new Promise((resolve) => {
      const listener = app.listen(0, () => resolve(listener));
    });
    servers.push(server);
    return `http://127.0.0.1:${server.address().port}`;
  }

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-project-selection-'));
    home = path.join(tmp, 'home');
    xdg = path.join(tmp, 'xdg');
    fs.mkdirSync(home, { recursive: true });
    previousHome = process.env.HOME;
    previousXdg = process.env.XDG_CONFIG_HOME;
    process.env.HOME = home;
    process.env.XDG_CONFIG_HOME = xdg;
    servers.length = 0;
  });

  afterEach(async () => {
    await Promise.all(servers.map((server) => new Promise((resolve) => server.close(resolve))));
    if (previousHome === undefined) delete process.env.HOME;
    else process.env.HOME = previousHome;
    if (previousXdg === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = previousXdg;
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('persists safe opaque IDs, registers only the current root, scopes APIs, and unregisters without deleting files', async () => {
    const rootA = path.join(tmp, 'project-a');
    const rootB = path.join(tmp, 'project-b');
    fs.mkdirSync(rootA, { recursive: true });
    fs.mkdirSync(rootB, { recursive: true });
    const baseA = await start(rootA);
    const baseB = await start(rootB, (_command, _args, options, callback) => {
      assert.equal(options.cwd, rootB);
      callback(null, '{}', '');
    });

    const jsonRequest = (base, route, method, body) => fetch(`${base}${route}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const rejectedPath = await jsonRequest(baseB, '/api/projects', 'POST', { path: rootA });
    assert.equal(rejectedPath.status, 400);
    assert.doesNotMatch(await rejectedPath.text(), new RegExp(rootA.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    const rejectedMalformed = await fetch(`${baseB}/api/projects`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{',
    });
    assert.equal(rejectedMalformed.status, 400);
    const rejectedUnparsed = await fetch(`${baseB}/api/projects`, {
      method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: rootA,
    });
    assert.equal(rejectedUnparsed.status, 400);
    const beforeRegistration = await (await fetch(`${baseA}/api/projects`)).json();
    assert.deepEqual(beforeRegistration.projects.map((project) => project.name), ['project-a']);
    assert.deepEqual(beforeRegistration.projects.map(({ registered }) => registered), [false]);
    assert.match(beforeRegistration.currentProjectId, /^prj_[A-Za-z0-9_-]{43}$/);
    assert.equal(beforeRegistration.projects[0].id, beforeRegistration.currentProjectId);
    assert.doesNotMatch(JSON.stringify(beforeRegistration), /project-selection-|\/home\/|\/tmp\//);

    const registered = await jsonRequest(baseB, '/api/projects', 'POST', {});
    assert.equal(registered.status, 201);
    const projectB = (await registered.json()).project;
    assert.match(projectB.id, /^prj_[A-Za-z0-9_-]{43}$/);
    assert.equal(projectB.name, 'project-b');
    assert.doesNotMatch(JSON.stringify(projectB), /project-selection-|\/home\/|\/tmp\//);
    const registryFile = path.join(xdg, 'guarana', 'dashboard-projects.json');
    const persisted = JSON.parse(fs.readFileSync(registryFile, 'utf8'));
    assert.equal(persisted.projects.length, 1);
    assert.equal(fs.realpathSync(rootB), persisted.projects.find((project) => project.id === projectB.id).root);
    assert.equal((fs.statSync(registryFile).mode & 0o777), 0o600);

    const listed = await (await fetch(`${baseA}/api/projects`)).json();
    assert.deepEqual(listed.projects.map(({ name }) => name).sort(), ['project-a', 'project-b']);
    assert.deepEqual(listed.projects.map(({ name, registered }) => [name, registered]).sort(([a], [b]) => a.localeCompare(b)), [
      ['project-a', false], ['project-b', true],
    ]);
    assert.equal(listed.currentProjectId, beforeRegistration.currentProjectId);
    assert.equal(listed.projects.find(({ id }) => id === listed.currentProjectId)?.name, 'project-a');
    assert.doesNotMatch(JSON.stringify(listed), /project-selection-|\/home\/|\/tmp\//);
    assert.equal((await (await fetch(`${baseA}/api/projects?projectId=${projectB.id}`)).json()).projects.length, 2);

    const alias = path.join(tmp, 'project-b-alias');
    fs.symlinkSync(rootB, alias, 'dir');
    const aliasBase = await start(alias);
    const aliasRegistration = await jsonRequest(aliasBase, '/api/projects', 'POST', {});
    assert.equal((await aliasRegistration.json()).project.id, projectB.id);
    assert.equal(JSON.parse(fs.readFileSync(registryFile, 'utf8')).projects.length, 1);

    const writeFixture = (root, marker) => {
      const specs = path.join(root, '.specs');
      const telemetry = path.join(specs, 'state', 'telemetry');
      fs.mkdirSync(path.join(specs, 'state'), { recursive: true });
      fs.mkdirSync(telemetry, { recursive: true });
      fs.writeFileSync(path.join(specs, 'README.md'), marker);
      fs.writeFileSync(path.join(telemetry, 'events.jsonl'), `${JSON.stringify({ ts: 10, type: 'advisor-execution', status: marker, modelID: marker })}\n`);
    };
    writeFixture(rootA, 'project-a-marker');
    writeFixture(rootB, 'project-b-marker');
    const decisionDirB = path.join(rootB, '.specs', 'decisions');
    fs.mkdirSync(decisionDirB, { recursive: true });
    const decisionFileB = path.join(decisionDirB, 'ADR-SELECTED.md');
    fs.writeFileSync(decisionFileB, '# Selected\n\n- **Decision:** pending: Resolve only in project B.\n');
    const vaultA = initVault(rootA);
    const vaultB = initVault(rootB);
    seedLegacyNode(vaultA, { type: 'atom', status: 'confirmed', intent: 'A only' });
    seedLegacyNode(vaultB, { type: 'atom', status: 'confirmed', intent: 'B only' });
    const draftB = seedLegacyNode(vaultB, { type: 'atom', status: 'draft', intent: 'B draft' });
    createSkill({ projectDir: rootB, homeDir: home, scope: 'project', name: 'selected-project-skill', description: 'Scoped test skill.', content: '# B only' });
    const globalVault = initUserVault();
    const globalPreference = createNode(globalVault, {
      type: 'preference', status: 'confirmed', scope: 'global', category: 'agent_behavior', intent: 'global only',
    });

    const selected = `?projectId=${encodeURIComponent(projectB.id)}`;
    const workflowTs = 1700000000500;
    const workflowRunId = `workflow-${workflowTs}`;
    const workflowState = path.join(rootB, '.specs', 'state');
    const workflowHistory = [
      { ts: workflowTs - 20, event: 'new_task', from: 'idle', to: 'planning', note: '' },
      { ts: workflowTs - 10, event: 'plan_complete', from: 'planning', to: 'building', note: '' },
      { ts: workflowTs, event: 'run_start', from: 'building', to: 'coding', note: '' },
    ];
    fs.mkdirSync(workflowState, { recursive: true });
    fs.writeFileSync(path.join(workflowState, 'workflow.json'), JSON.stringify({
      version: 1, state: 'coding', activeTask: 'Project B current task', updatedAt: workflowTs, history: workflowHistory,
    }));
    const selectedManifest = createRunManifest(workflowRunId, [
      { id: 'project-b-task', mode: 'read-only', ownedPaths: ['PRIVATE_SELECTED_PROJECT_PATH_SENTINEL'] },
    ], { now: workflowTs });
    const manifestFile = path.join(workflowState, 'parallel-runs', `${workflowRunId}.json`);
    fs.mkdirSync(path.dirname(manifestFile), { recursive: true });
    fs.writeFileSync(path.join(workflowState, 'parallel-runs', `${workflowRunId}.bound`), JSON.stringify({ version: 1, runId: workflowRunId }));
    fs.writeFileSync(manifestFile, JSON.stringify(selectedManifest));
    const defaultWorkflow = await (await fetch(`${baseA}/api/workflow/current`)).json();
    assert.equal(defaultWorkflow.parallelRun, null);
    const selectedWorkflow = await (await fetch(`${baseA}/api/workflow/current${selected}`)).json();
    assert.deepEqual(selectedWorkflow.parallelRun, {
      status: 'pending', updatedAt: workflowTs,
      tasks: [{ id: 'project-b-task', mode: 'read-only', status: 'pending', dependsOn: [] }],
    });
    assert.doesNotMatch(JSON.stringify(selectedWorkflow.parallelRun), /PRIVATE_SELECTED_PROJECT_PATH_SENTINEL|PRIVATE_WORKTREE_PATH_SENTINEL|\/tmp\//);

    const userPreferences = await (await fetch(`${baseA}/api/memory/preferences`)).json();
    const selectedUserPreferences = await (await fetch(`${baseA}/api/memory/preferences${selected}`)).json();
    assert.deepEqual(selectedUserPreferences, userPreferences);
    assert.deepEqual(userPreferences.preferences.map(({ id }) => id), [globalPreference.id]);
    const selectedProjectGraph = await (await fetch(`${baseA}/api/memory/graph?scope=project${selected.replace('?', '&')}`)).json();
    assert.deepEqual(selectedProjectGraph.nodes.map(({ intent }) => intent), ['B only']);
    assert.ok(selectedProjectGraph.nodes.every((node) => node.scope === 'project'));
    const specFile = await fetch(`${baseA}/api/specs/file?path=README.md${selected.replace('?', '&')}`);
    assert.equal(await specFile.text(), 'project-b-marker');
    const pending = await (await fetch(`${baseA}/api/decisions/pending${selected}`)).json();
    assert.equal(pending.decisions[0].statement, 'Resolve only in project B.');
    const decisionWrite = await jsonRequest(baseA, `/api/decisions/resolve${selected}`, 'POST', {
      file: 'ADR-SELECTED.md', statement: 'Resolve only in project B.', outcome: 'accepted',
    });
    assert.equal(decisionWrite.status, 200);
    assert.match(fs.readFileSync(decisionFileB, 'utf8'), /Resolved \(\d{4}-\d{2}-\d{2}\):\*\* accepted/);
    assert.equal(fs.existsSync(path.join(rootA, '.specs', 'decisions', 'ADR-SELECTED.md')), false);
    const telemetry = await (await fetch(`${baseA}/api/telemetry/events${selected}`)).json();
    assert.equal(telemetry.events[0].status, 'project-b-marker');
    const runtime = await (await fetch(`${baseA}/api/models/runtime${selected}`)).json();
    assert.equal(runtime.execution.modelID, 'project-b-marker');
    const skills = await (await fetch(`${baseA}/api/skills${selected}`)).json();
    assert.deepEqual(skills.project.map((skill) => skill.name), ['selected-project-skill']);
    const modelCatalog = createRequire(import.meta.url)(resolveSharedAdvisorModule('opencode-model-catalog.js'));
    const originalDiscoverModels = modelCatalog.discoverModels;
    modelCatalog.discoverModels = async (options) => {
      assert.equal(options.cwd, rootB);
      return { models: [], error: null };
    };
    try {
      const catalog = await fetch(`${baseA}/api/models/catalog${selected}`);
      assert.equal(catalog.status, 200);
    } finally {
      modelCatalog.discoverModels = originalDiscoverModels;
    }
    const memory = await (await fetch(`${baseA}/api/memory/summary${selected}`)).json();
    assert.equal(memory.nodes.byScope.project, 2);
    assert.equal(memory.nodes.byScope.global, 1);
    const review = await jsonRequest(baseA, `/api/memory/review${selected}`, 'POST', { id: draftB.id, action: 'confirm', edits: { type: 'decision' } });
    assert.equal(review.status, 200);
    assert.equal(JSON.parse(fs.readFileSync(path.join(vaultB, 'nodes.jsonl'), 'utf8').split('\n').filter(Boolean).find((line) => JSON.parse(line).id === draftB.id)).status, 'confirmed');
    assert.equal(JSON.parse(fs.readFileSync(path.join(vaultB, 'nodes.jsonl'), 'utf8').split('\n').filter(Boolean).find((line) => JSON.parse(line).id === draftB.id)).type, 'decision');
    assert.equal(JSON.parse(fs.readFileSync(path.join(vaultA, 'nodes.jsonl'), 'utf8').split('\n').filter(Boolean).find((line) => JSON.parse(line).intent === 'A only')).status, 'confirmed');

    const workflowWrite = await jsonRequest(baseA, `/api/workflow/settings${selected}`, 'PUT', { settings: { specs: { enabled: false } } });
    assert.equal(workflowWrite.status, 200);
    assert.equal(JSON.parse(fs.readFileSync(path.join(rootB, '.guarana', 'workflow.json'), 'utf8')).specs.enabled, false);
    assert.equal(fs.existsSync(path.join(rootA, '.guarana', 'workflow.json')), false);
    const webGlobal = await jsonRequest(baseA, `/api/web/settings${selected}`, 'PUT', { scope: 'global', settings: { appearance: { theme: 'dark' } } });
    assert.equal(webGlobal.status, 200);
    assert.equal(JSON.parse(fs.readFileSync(path.join(xdg, 'guarana', 'web.json'), 'utf8')).appearance.theme, 'dark');
    assert.equal(fs.existsSync(path.join(rootB, '.guarana', 'web.json')), false);
    assert.equal((await (await fetch(`${baseA}/api/web/settings`)).json()).effective.appearance.theme, 'dark');

    await fetch(`${baseA}/api/opencode/active-subagents${selected}`);
    const unknown = await fetch(`${baseA}/api/memory/summary?projectId=${encodeURIComponent(rootB)}`);
    assert.equal(unknown.status, 404);
    assert.deepEqual(await unknown.json(), { error: 'Unknown project selection.' });
    const stale = await fetch(`${baseA}/api/memory/summary?projectId=prj_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`);
    assert.equal(stale.status, 404);

    const restartedBase = await start(rootA);
    const afterRestart = await (await fetch(`${restartedBase}/api/projects`)).json();
    assert.equal(afterRestart.projects.find((project) => project.name === 'project-b').id, projectB.id);
    assert.equal(afterRestart.projects.find((project) => project.name === 'project-b').registered, true);
    const removed = await fetch(`${baseA}/api/projects/${projectB.id}`, { method: 'DELETE' });
    assert.equal(removed.status, 200);
    assert.equal(fs.existsSync(path.join(rootB, '.specs', 'README.md')), true);
    assert.equal(fs.existsSync(path.join(rootB, '.guarana', 'workflow.json')), true);
    const afterRemoval = await (await fetch(`${baseA}/api/projects`)).json();
    assert.deepEqual(afterRemoval.projects.map(({ name }) => name), ['project-a']);
    assert.equal(afterRemoval.projects[0].registered, false);
  });
});
