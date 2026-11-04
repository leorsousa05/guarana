import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import test from 'node:test';
import { readWorkflowSettings, writeWorkflowSettings } from '../../../../orchestrator/workflow-settings.js';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
let estimatePollTestId = 0;

async function loadSettingsWithEstimate(t, result) {
  const callsKey = `__settingsEstimatePollCalls${estimatePollTestId += 1}`;
  const pollState = { result, calls: [] };
  globalThis[callsKey] = pollState;
  const vite = await createServer({
    root: webRoot,
    plugins: [{
      name: 'settings-estimate-test-poll',
      enforce: 'pre',
      resolveId(source, importer) {
        if (source === '../hooks/usePoll.js' && importer?.endsWith('/Settings.jsx')) return '\0settings-estimate-test-poll';
      },
      load(id) {
        if (id === '\0settings-estimate-test-poll') {
          return `export function usePoll(url, intervalMs) {
            const state = globalThis[${JSON.stringify(callsKey)}];
            state.calls.push([url, intervalMs]);
            return state.result;
          }`;
        }
      },
    }],
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  t.after(() => vite.close());
  t.after(() => { delete globalThis[callsKey]; });
  const { Settings } = await vite.ssrLoadModule('/src/components/Settings.jsx');
  return { Settings, pollState };
}

function mediaBlock(source, query) {
  const at = source.indexOf(`@media (${query})`);
  assert.notEqual(at, -1, `has ${query} media rule`);
  const open = source.indexOf('{', at);
  let depth = 1;
  for (let i = open + 1; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}' && --depth === 0) return source.slice(open + 1, i);
  }
  assert.fail(`unclosed ${query} media rule`);
}

test('Settings SSR combines Models with scoped workflow and web preferences, effective sources, and clear actions', async (t) => {
  const vite = await createServer({ root: webRoot, server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  t.after(() => vite.close());
  const { Settings } = await vite.ssrLoadModule('/src/components/Settings.jsx');
  const html = renderToStaticMarkup(React.createElement(Settings, {
    webSettings: {
      global: { appearance: { theme: 'dark' }, refresh: { intervalSeconds: 15 } },
      project: { appearance: { startPage: 'runs' }, server: { open: false } },
      effective: {
        appearance: { theme: 'dark', startPage: 'runs' },
        refresh: { intervalSeconds: 15 },
        server: { port: 4200, open: false },
      },
      sources: {
        appearance: { theme: 'global', startPage: 'project' },
        refresh: { intervalSeconds: 'global' },
        server: { port: 'default', open: 'project' },
      },
    },
    workflowSettings: {
      global: { verify: { enabled: false }, memory: { autoInject: false, preferenceInjectionBudgetTokens: 32768 } },
      project: { specs: { enabled: false }, memory: { autoInject: true, preferenceInjectionBudgetTokens: 8192 } },
      effective: { specs: { enabled: false }, verify: { enabled: false }, memory: { autoInject: true, preferenceInjectionBudgetTokens: 8192 } },
      sources: { specs: 'project', verify: 'global', memory: { autoInject: 'project', preferenceInjectionBudgetTokens: 'project' } },
    },
  }));

  assert.match(html, /<section class="settings-page" aria-label="Settings">/);
  assert.match(html, /<h2 class="section-title">Settings<\/h2>/);
  assert.match(html, /loading model settings/);
  assert.match(html, /<h3 id="settings-workflow-title">Workflow preferences<\/h3>/);
  assert.match(html, /<h3 id="settings-web-title">Web preferences<\/h3>/);
  assert.match(html, /Workflow preference scope/);
  assert.match(html, /Web preference scope/);
  assert.match(html, /Editing Project changes this checkout only/);
  assert.match(html, /<label[^>]*for="settings-workflow-specs"[^>]*><span>Specs \+ worker-specs<\/span>/);
  assert.match(html, /<label[^>]*for="settings-workflow-verify"[^>]*><span>Independent verification<\/span>/);
  assert.match(html, /<select id="settings-workflow-memory-preferenceInjectionBudgetTokens"/);
  assert.match(html, /<option value="">Automatic \(unset\)<\/option>/);
  assert.match(html, /<option value="8192" selected="">Less \(8192\)<\/option>/);
  assert.match(html, /<option value="32768">Medium \(32768\)<\/option>/);
  assert.match(html, /<option value="65536">More \(65536\)<\/option>/);
  assert.match(html, /Current-project \+ Global preference injection budget \(tokens\)/);
  assert.match(html, /<label[^>]*for="settings-workflow-memory-autoInject"[^>]*><span>Automatically inject saved memory preferences<\/span>/);
  assert.match(html, /id="settings-workflow-memory-autoInject" type="checkbox"[^>]*checked=""/);
  assert.match(html, /Effective for selected project: enabled · Source: Project/);
  assert.match(html, /Spec files are not automatically injected either; consult only relevant records when needed/);
  assert.match(html, /Effective for selected project: 8192 tokens · Source: Project/);
  assert.match(html, /UTF-8 serialized byte length is compared with the token budget as an estimate/);
  assert.match(html, /Effective for selected project: disabled · Source: Project/);
  assert.match(html, /Effective for selected project: disabled · Source: Global/);
  assert.match(html, /id="settings-web-appearance-theme"/);
  assert.match(html, /id="settings-web-appearance-startPage"/);
  assert.match(html, /id="settings-web-refresh-intervalSeconds"/);
  assert.match(html, /id="settings-web-server-port" type="number"/);
  assert.match(html, /id="settings-web-server-open" type="checkbox"/);
  assert.match(html, /Effective: Dark · Source: Global/);
  assert.match(html, /Effective: Runs · Source: Project/);
  assert.match(html, /Effective: 15 seconds · Source: Global/);
  assert.match(html, /Effective: 4200 · Source: Default/);
  assert.match(html, /Server port and auto-open changes apply on the next guarana web invocation/);
  assert.match(html, /Clear project override/);
  assert.match(html, /aria-label="Clear project override for Specs \+ worker-specs"/);
  assert.match(html, /aria-label="Clear project override for preference injection budget"/);
  assert.match(html, /aria-label="Clear project override for automatic memory preference injection"/);
  assert.match(html, /aria-label="Clear project override for Start page"/);
  assert.match(html, /Save Project web preferences/);
  assert.doesNotMatch(html, /Save Global/);

  const css = fs.readFileSync(path.join(webRoot, 'src/style.css'), 'utf8');
  assert.match(css, /:root\[data-theme='dark'\]\s*\{[^}]*--paper:\s*#1c1b18;[^}]*--ink:\s*#eee7d7;[^}]*--rule:\s*#514b40/s);
  assert.match(css, /:root\[data-theme='dark'\] \.mem-type--decision\s*\{[^}]*--mem-fill:\s*#27394c/s);
  assert.match(css, /--global-accent:\s*#70cfc2/);
  assert.match(css, /\.settings-row input:focus-visible[^}]*outline:\s*2px/s);
  assert.match(css, /\.settings-scope-picker select:focus-visible[^}]*outline:\s*2px/s);
  assert.match(css, /\.settings-fields\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s);
  assert.match(css, /\.settings-page\s*\{[^}]*overflow-wrap:\s*anywhere/s);
  const viewportWidth = 375;
  assert.ok(viewportWidth <= 480, '375px layout uses narrow Settings rules');
  const narrow = mediaBlock(css, 'max-width: 480px');
  assert.match(narrow, /\.settings-fields\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\)/s);
  assert.match(narrow, /\.settings-control\s*\{[^}]*minmax\(7rem,\s*0\.9fr\)/s);
});

test('preference budget selector renders Automatic fallback and preserves custom inherited values', async (t) => {
  const vite = await createServer({ root: webRoot, server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  t.after(() => vite.close());
  const { Settings } = await vite.ssrLoadModule('/src/components/Settings.jsx');
  const automaticHtml = renderToStaticMarkup(React.createElement(Settings, {
    workflowSettings: {
      global: {},
      project: { verify: { enabled: false } },
      effective: { verify: { enabled: false } },
      sources: { verify: 'project' },
    },
  }));
  const html = renderToStaticMarkup(React.createElement(Settings, {
    workflowSettings: {
      global: { memory: { preferenceInjectionBudgetTokens: 6144 } },
      project: { verify: { enabled: false } },
      effective: { verify: { enabled: false }, memory: { preferenceInjectionBudgetTokens: 6144 } },
      sources: { verify: 'project', memory: { preferenceInjectionBudgetTokens: 'global' } },
    },
  }));

  assert.match(automaticHtml, /<option value="" selected="">Automatic \(unset\)<\/option>/);
  assert.match(automaticHtml, /id="settings-workflow-memory-autoInject" type="checkbox"[^>]*checked=""/);
  assert.match(automaticHtml, /Effective for selected project: enabled · Source: Default/);
  assert.match(automaticHtml, /Effective for selected project: model context when available · Source: Default/);
  assert.match(automaticHtml, /Complete preference records are injected in trust and priority order when they fit the budget; records that do not fit are omitted without truncation\./);
  assert.doesNotMatch(automaticHtml, /complete preference set is injected or omitted as a whole/i);
  assert.match(html, /<option value="6144" selected="">Custom \(6144\)<\/option>/);
  assert.match(html, /Effective for selected project: 6144 tokens · Source: Global/);
  assert.doesNotMatch(html, /id="settings-workflow-memory-preferenceInjectionBudgetTokens" type="number"/);
});

test('combined injection estimate renders the byte-based value and count without exposing record content', async (t) => {
  const { Settings, pollState } = await loadSettingsWithEstimate(t, {
    data: { candidateCount: 8, serializedBytes: 12345, text: 'private text', id: 'private-id' },
    error: null,
  });
  const html = renderToStaticMarkup(React.createElement(Settings, { workflowSettings: { global: {}, project: {}, effective: {}, sources: {} } }));

  assert.match(html, /Full injectable current-project \+ Global candidate set \(before budget fitting or session dedup\): approximately 12,345 UTF-8 bytes across 8 records \(byte estimate; not exact model tokenization\)\./);
  assert.doesNotMatch(html, /private text|private-id/);
  assert.deepEqual(pollState.calls, [['/api/memory/preference-estimate', 15000]]);
});

test('updated combined injection estimate appears beside the budget selector', async (t) => {
  const { Settings, pollState } = await loadSettingsWithEstimate(t, {
    data: { candidateCount: 3, serializedBytes: 1234 },
    error: null,
  });
  const props = { workflowSettings: { global: {}, project: {}, effective: {}, sources: {} } };
  const estimateA = 'Full injectable current-project + Global candidate set (before budget fitting or session dedup): approximately 1,234 UTF-8 bytes across 3 records (byte estimate; not exact model tokenization).';
  const initialHtml = renderToStaticMarkup(React.createElement(Settings, props));
  assert.ok(initialHtml.includes(estimateA), 'initial successful estimate A is rendered');

  pollState.result = { data: { candidateCount: 5, serializedBytes: 6789 }, error: null };
  const updatedHtml = renderToStaticMarkup(React.createElement(Settings, props));
  const estimateB = 'Full injectable current-project + Global candidate set (before budget fitting or session dedup): approximately 6,789 UTF-8 bytes across 5 records (byte estimate; not exact model tokenization).';
  assert.ok(updatedHtml.includes(estimateB), 'updated successful estimate B is rendered');
  assert.ok(!updatedHtml.includes(estimateA), 'stale successful estimate A is no longer rendered');

  const estimateRow = [...updatedHtml.matchAll(/<div class="settings-row">([\s\S]*?)<\/div>/g)]
    .map(([, row]) => row)
    .find((row) => row.includes('id="settings-workflow-memory-preferenceInjectionBudgetTokens-estimate"'));
  assert.ok(estimateRow, 'estimate is inside a settings row');
  assert.ok(estimateRow.includes('id="settings-workflow-memory-preferenceInjectionBudgetTokens"'), 'budget selector shares the estimate settings row');
  assert.ok(estimateRow.includes('Current-project + Global preference injection budget (tokens)'), 'row identifies the shared preference injection budget selector');
  assert.ok(estimateRow.includes(estimateB), 'updated estimate is inside the selector settings row');
});

test('combined injection estimate shows loading and safe unavailable states', async (t) => {
  const { Settings, pollState } = await loadSettingsWithEstimate(t, { data: null, error: null });
  const props = { workflowSettings: { global: {}, project: {}, effective: {}, sources: {} } };
  const loadingHtml = renderToStaticMarkup(React.createElement(Settings, props));
  assert.match(loadingHtml, /role="status">Loading preference injection estimate…<\/p>/);

  pollState.result = { data: null, error: 'private backend detail' };
  const unavailableHtml = renderToStaticMarkup(React.createElement(Settings, props));
  assert.match(unavailableHtml, /role="alert">Preference injection estimate is unavailable right now\.<\/p>/);
  assert.doesNotMatch(unavailableHtml, /private backend detail/);
  assert.deepEqual(pollState.calls, [
    ['/api/memory/preference-estimate', 15000],
    ['/api/memory/preference-estimate', 15000],
  ]);
});

test('live refresh changes 5-second data polls while fixed configuration polls remain at 15 seconds', async (t) => {
  const vite = await createServer({ root: webRoot, server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  t.after(() => vite.close());
  const { pollIntervalFor } = await vite.ssrLoadModule('/src/hooks/usePoll.js');
  assert.equal(pollIntervalFor(5000, 15000), 15000);
  assert.equal(pollIntervalFor(5000, 30000), 30000);
  assert.equal(pollIntervalFor(15000, 30000), 15000);
});

test('scoped Settings requests send only the selected scope and clear helpers preserve other fields', async (t) => {
  const vite = await createServer({ root: webRoot, server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  t.after(() => vite.close());
  const { clearWebField, clearWorkflowField, clearWorkflowBudgetField, clearWorkflowMemoryAutoInject, putScopedSettings, setWorkflowBudgetField, setWorkflowMemoryAutoInject } = await vite.ssrLoadModule('/src/components/Settings.jsx');

  const calls = [];
  const request = async (url, options) => {
    calls.push({ url, options, body: JSON.parse(options.body) });
    return { ok: true, json: async () => ({ global: {}, project: {}, effective: {}, sources: {} }) };
  };
  await putScopedSettings('/api/web/settings', 'global', { appearance: { theme: 'dark' } }, request);
  await putScopedSettings('/api/workflow/settings', 'project', clearWorkflowField({ specs: { enabled: false }, verify: { enabled: true } }, 'specs'), request);
  await putScopedSettings('/api/workflow/settings', 'project', setWorkflowBudgetField({ specs: { enabled: false } }, 2048), request);
  await putScopedSettings('/api/workflow/settings', 'project', clearWorkflowBudgetField({ memory: { preferenceInjectionBudgetTokens: 1024 }, verify: { enabled: false } }), request);
  await putScopedSettings('/api/web/settings', 'project', clearWebField({ appearance: { startPage: 'runs', theme: 'dark' }, server: { open: false } }, 'appearance', 'startPage'), request);
  await putScopedSettings('/api/workflow/settings', 'global', clearWorkflowBudgetField({ memory: { preferenceInjectionBudgetTokens: 4096 }, verify: { enabled: false } }), request);
  await putScopedSettings('/api/workflow/settings', 'project', setWorkflowMemoryAutoInject({ memory: { preferenceInjectionBudgetTokens: 2048 } }, false), request);
  await putScopedSettings('/api/workflow/settings', 'project', clearWorkflowMemoryAutoInject({ memory: { autoInject: false, preferenceInjectionBudgetTokens: 2048 }, verify: { enabled: false } }), request);

  assert.equal(calls[0].url, '/api/web/settings');
  assert.equal(calls[1].url, '/api/workflow/settings');
  assert.equal(calls[2].url, '/api/workflow/settings');
  assert.equal(calls[3].url, '/api/workflow/settings');
  assert.equal(calls[4].url, '/api/web/settings');
  assert.equal(calls[5].url, '/api/workflow/settings');
  assert.equal(calls[6].url, '/api/workflow/settings');
  assert.equal(calls[7].url, '/api/workflow/settings');
  assert.deepEqual(calls.map(({ body }) => body), [
    { scope: 'global', settings: { appearance: { theme: 'dark' } } },
    { scope: 'project', settings: { verify: { enabled: true } } },
    { scope: 'project', settings: { specs: { enabled: false }, memory: { preferenceInjectionBudgetTokens: 2048 } } },
    { scope: 'project', settings: { verify: { enabled: false } } },
    { scope: 'project', settings: { appearance: { theme: 'dark' }, server: { open: false } } },
    { scope: 'global', settings: { verify: { enabled: false } } },
    { scope: 'project', settings: { memory: { preferenceInjectionBudgetTokens: 2048, autoInject: false } } },
    { scope: 'project', settings: { verify: { enabled: false }, memory: { preferenceInjectionBudgetTokens: 2048 } } },
  ]);
  assert.ok(calls.every(({ options }) => options.method === 'PUT'));
  assert.ok(calls.every(({ options }) => options.headers['Content-Type'] === 'application/json'));
});

test('workflow checkbox updates capture checked before the deferred state updater runs', async (t) => {
  const vite = await createServer({ root: webRoot, server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  t.after(() => vite.close());
  const { workflowFieldUpdate } = await vite.ssrLoadModule('/src/components/Settings.jsx');

  let deferredUpdater;
  const setWorkflowDraft = (update) => { deferredUpdater = update; };
  const event = { currentTarget: { checked: true } };

  setWorkflowDraft(workflowFieldUpdate('verify', event));
  event.currentTarget = null;

  assert.deepEqual(deferredUpdater({ specs: { enabled: false } }), {
    specs: { enabled: false },
    verify: { enabled: true },
  });
});

test('memory auto-injection checkbox captures checked before the deferred state updater runs', async (t) => {
  const vite = await createServer({ root: webRoot, server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  t.after(() => vite.close());
  const { workflowMemoryAutoInjectUpdate } = await vite.ssrLoadModule('/src/components/Settings.jsx');

  let deferredUpdater;
  const setWorkflowDraft = (update) => { deferredUpdater = update; };
  const event = { currentTarget: { checked: false } };

  setWorkflowDraft(workflowMemoryAutoInjectUpdate(event));
  event.currentTarget = null;

  assert.deepEqual(deferredUpdater({ memory: { preferenceInjectionBudgetTokens: 8192, autoInject: true } }), {
    memory: { preferenceInjectionBudgetTokens: 8192, autoInject: false },
  });
});

test('workflow budget updates capture value before the deferred state updater runs', async (t) => {
  const vite = await createServer({ root: webRoot, server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  t.after(() => vite.close());
  const { workflowBudgetUpdate } = await vite.ssrLoadModule('/src/components/Settings.jsx');

  let deferredUpdater;
  const setWorkflowDraft = (update) => { deferredUpdater = update; };
  const event = { currentTarget: { value: '32768' } };

  setWorkflowDraft(workflowBudgetUpdate(event));
  event.currentTarget = null;

  assert.deepEqual(deferredUpdater({ specs: { enabled: false } }), {
    specs: { enabled: false },
    memory: { preferenceInjectionBudgetTokens: 32768 },
  });

  for (const value of [8192, 32768, 65536]) {
    const update = workflowBudgetUpdate({ currentTarget: { value: String(value) } });
    assert.deepEqual(update({}), { memory: { preferenceInjectionBudgetTokens: value } });
  }

  const automatic = workflowBudgetUpdate({ currentTarget: { value: '' } });
  assert.deepEqual(automatic({ memory: { preferenceInjectionBudgetTokens: 6144 } }), {});
});

test('Project Automatic budget save removes the override and restores the Global effective value and source', async (t) => {
  const vite = await createServer({ root: webRoot, server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  t.after(() => vite.close());
  const { putScopedSettings, workflowBudgetUpdate } = await vite.ssrLoadModule('/src/components/Settings.jsx');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-settings-budget-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const settingsOptions = {
    directory: path.join(root, 'project'),
    env: { XDG_CONFIG_HOME: path.join(root, 'xdg') },
    home: path.join(root, 'home'),
  };
  writeWorkflowSettings('global', { memory: { preferenceInjectionBudgetTokens: 6144 } }, settingsOptions);

  const projectDraft = {
    specs: { enabled: false },
    verify: { enabled: true },
    memory: { preferenceInjectionBudgetTokens: 1024 },
  };
  const automaticUpdate = workflowBudgetUpdate({ currentTarget: { value: '' } });
  const automaticDraft = automaticUpdate(projectDraft);
  assert.deepEqual(automaticDraft, {
    specs: { enabled: false },
    verify: { enabled: true },
  });
  assert.equal(Object.hasOwn(automaticDraft, 'memory'), false);

  const calls = [];
  const request = async (url, options) => {
    const body = JSON.parse(options.body);
    calls.push({ url, options, body });
    writeWorkflowSettings(body.scope, body.settings, settingsOptions);
    return { ok: true, json: async () => readWorkflowSettings(settingsOptions) };
  };
  const saved = await putScopedSettings('/api/workflow/settings', 'project', automaticDraft, request);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/api/workflow/settings');
  assert.equal(calls[0].body.scope, 'project');
  assert.deepEqual(calls[0].body.settings, { specs: { enabled: false }, verify: { enabled: true } });
  assert.equal(Object.hasOwn(saved.project, 'memory'), false);
  assert.equal(saved.effective.memory.preferenceInjectionBudgetTokens, 6144);
  assert.equal(saved.sources.memory.preferenceInjectionBudgetTokens, 'global');
});

test('Global Automatic budget save removes the setting and restores Default model-context behavior', async (t) => {
  const vite = await createServer({ root: webRoot, server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  t.after(() => vite.close());
  const { putScopedSettings, workflowBudgetUpdate } = await vite.ssrLoadModule('/src/components/Settings.jsx');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-settings-global-budget-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const settingsOptions = {
    directory: path.join(root, 'project'),
    env: { XDG_CONFIG_HOME: path.join(root, 'xdg') },
    home: path.join(root, 'home'),
  };
  writeWorkflowSettings('global', { verify: { enabled: false }, memory: { preferenceInjectionBudgetTokens: 6144 } }, settingsOptions);

  const automaticDraft = workflowBudgetUpdate({ currentTarget: { value: '' } })({
    verify: { enabled: false },
    memory: { preferenceInjectionBudgetTokens: 6144 },
  });
  assert.deepEqual(automaticDraft, { verify: { enabled: false } });

  const calls = [];
  const request = async (url, options) => {
    const body = JSON.parse(options.body);
    calls.push({ url, options, body });
    writeWorkflowSettings(body.scope, body.settings, settingsOptions);
    return { ok: true, json: async () => readWorkflowSettings(settingsOptions) };
  };
  const saved = await putScopedSettings('/api/workflow/settings', 'global', automaticDraft, request);
  const globalFile = path.join(settingsOptions.env.XDG_CONFIG_HOME, 'guarana', 'workflow.json');
  const persisted = fs.readFileSync(globalFile, 'utf8');

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/api/workflow/settings');
  assert.equal(calls[0].body.scope, 'global');
  assert.deepEqual(calls[0].body.settings, { verify: { enabled: false } });
  assert.equal(Object.hasOwn(saved.global.memory || {}, 'preferenceInjectionBudgetTokens'), false);
  assert.doesNotMatch(persisted, /preferenceInjectionBudgetTokens|6144/);
  assert.equal(saved.effective.memory.preferenceInjectionBudgetTokens, null);
  assert.equal(saved.sources.memory.preferenceInjectionBudgetTokens, 'default');
});
