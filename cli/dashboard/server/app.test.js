import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './app.js';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { initVault, initUserVault } from '../../memory/vault.js';
import { createNode } from '../../memory/graph.js';
import { createSkill } from '../../skill-engine/index.js';
import { resolveSharedAdvisorModule } from './routes/shared-advisor-modules.js';

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

  it('resolves shared advisor modules from canonical and CLI route trees', async () => {
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
      },
      {
        route: 'cli/dashboard/server/routes/models.js',
        resolver: 'cli/dashboard/server/routes/shared-advisor-modules.js',
      },
    ];

    for (const layout of layouts) {
      const routeUrl = pathToFileURL(path.join(repoRoot, layout.route));
      const { resolveSharedAdvisorModule } = await import(pathToFileURL(path.join(repoRoot, layout.resolver)));
      for (const name of ['advisor-settings.js', 'advisor-profiles.js', 'opencode-model-catalog.js']) {
        const resolved = resolveSharedAdvisorModule(name, routeUrl.href);
        assert.equal(resolved, path.join(repoRoot, 'cli', 'lib', name));
        const sharedModule = require(resolved);
        const expectedExport = name === 'advisor-settings.js'
          ? 'readSettings'
          : name === 'advisor-profiles.js' ? 'installAdvisorArtifacts' : 'discoverModels';
        assert.equal(typeof sharedModule[expectedExport], 'function');
      }
    }
  });

  it('catalog API exposes connected model metadata only and uses the explicit project cwd', async () => {
    const require = createRequire(import.meta.url);
    const catalog = require(resolveSharedAdvisorModule('opencode-model-catalog.js'));
    const originalDiscover = catalog.discoverModels;
    const calls = [];
    catalog.discoverModels = async (options) => {
      calls.push(options);
      const outputs = {
        'auth list': '● OpenAI api\n│ ● Anthropic │ oauth │\n',
        models: 'openai/gpt-5\nanthropic/claude-sonnet-4\nnot-connected/private-token\n',
      };
      return originalDiscover({
        ...options,
        execFile: (executable, args, execOptions, callback) => {
          assert.equal(executable, process.env.OPENCODE_BIN || 'opencode');
          assert.equal(execOptions.cwd, root);
          callback(null, args.join(' ') === 'auth list' ? outputs['auth list'] : outputs.models, '');
        },
      });
    };
    try {
      const response = await fetch(`${base}/api/models/catalog?provider=openai`);
      const body = await response.json();
      assert.equal(response.status, 200);
      assert.deepEqual(body, {
        models: [{ provider: { id: 'openai', name: 'openai' }, model: { id: 'gpt-5', name: 'gpt-5' } }],
        error: null,
      });
      assert.equal(calls[0].cwd, root);
      assert.equal(calls[0].provider, 'openai');
      assert.doesNotMatch(JSON.stringify(body), /private-token|\bapi\b|\boauth\b/i);
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
});
