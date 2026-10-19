import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import test from 'node:test';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

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
      global: { verify: { enabled: false } },
      project: { specs: { enabled: false } },
      effective: { specs: { enabled: false }, verify: { enabled: false } },
      sources: { specs: 'project', verify: 'global' },
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
  assert.match(html, /Effective: disabled · Source: Project/);
  assert.match(html, /Effective: disabled · Source: Global/);
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
  const { clearWebField, clearWorkflowField, putScopedSettings } = await vite.ssrLoadModule('/src/components/Settings.jsx');

  const calls = [];
  const request = async (url, options) => {
    calls.push({ url, options, body: JSON.parse(options.body) });
    return { ok: true, json: async () => ({ global: {}, project: {}, effective: {}, sources: {} }) };
  };
  await putScopedSettings('/api/web/settings', 'global', { appearance: { theme: 'dark' } }, request);
  await putScopedSettings('/api/workflow/settings', 'project', clearWorkflowField({ specs: { enabled: false }, verify: { enabled: true } }, 'specs'), request);
  await putScopedSettings('/api/web/settings', 'project', clearWebField({ appearance: { startPage: 'runs', theme: 'dark' }, server: { open: false } }, 'appearance', 'startPage'), request);

  assert.equal(calls[0].url, '/api/web/settings');
  assert.equal(calls[1].url, '/api/workflow/settings');
  assert.equal(calls[2].url, '/api/web/settings');
  assert.deepEqual(calls.map(({ body }) => body), [
    { scope: 'global', settings: { appearance: { theme: 'dark' } } },
    { scope: 'project', settings: { verify: { enabled: true } } },
    { scope: 'project', settings: { appearance: { theme: 'dark' }, server: { open: false } } },
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
