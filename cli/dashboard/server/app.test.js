import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './app.js';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { initVault, initUserVault } from '../../memory/vault.js';
import { createNode } from '../../memory/graph.js';
import { createSkill } from '../../skill-engine/index.js';

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
});

describe('GET/POST /api/memory', () => {
  let tmp;
  let server;
  let base;
  let oldHome;
  let projectMemory;

  beforeEach(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-memapp-'));
    oldHome = process.env.HOME;
    process.env.HOME = path.join(tmp, 'home');
    const vaultDir = initVault(tmp);
    projectMemory = createNode(vaultDir, {
      type: 'decision',
      status: 'confirmed',
      intent: 'dash decision',
      summary: 'confirmed decision for dashboard',
    });
    createNode(vaultDir, {
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

  it('injections hydrates project and private global node references', async () => {
    const globalVault = initUserVault();
    const preference = createNode(globalVault, {
      type: 'preference',
      status: 'confirmed',
      scope: 'global',
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

  it('drafts lists draft nodes and review confirms them', async () => {
    const listRes = await fetch(`${base}/api/memory/drafts`);
    const listBody = await listRes.json();
    assert.equal(listBody.drafts.length, 1);
    const id = listBody.drafts[0].id;

    const reviewRes = await fetch(`${base}/api/memory/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'confirm' }),
    });
    const reviewBody = await reviewRes.json();
    assert.equal(reviewRes.status, 200);
    assert.equal(reviewBody.node.status, 'confirmed');

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
    assert.equal(JSON.stringify(body).includes(tmp), false);
    assert.equal(JSON.stringify(body).includes('manual-skill'), false);
  });

  it('returns empty scope lists when no generated skills exist', async () => {
    const response = await fetch(`${base}/api/skills`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { global: [], project: [] });
  });
});
