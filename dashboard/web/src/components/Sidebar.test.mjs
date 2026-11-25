import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import test from 'node:test';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('shared shell keeps all hash routes and accessible section navigation', async (t) => {
  const vite = await createServer({
    root: webRoot,
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  t.after(() => vite.close());

  const { viewFromHash } = await vite.ssrLoadModule('/src/App.jsx');
  const { Sidebar } = await vite.ssrLoadModule('/src/components/Sidebar.jsx');
  const { KnowledgeHome } = await vite.ssrLoadModule('/src/components/KnowledgeHome.jsx');
  const legacyRoutes = [
    ['overview', 'Overview'],
    ['now', 'Activity'],
    ['runs', 'Runs'],
    ['specs', 'Specs'],
    ['workflow', 'Workflow'],
    ['memory', 'Memory'],
    ['skills', 'Skills'],
    ['settings', 'Settings'],
  ];
  const destinations = [
    ['operation', 'Overview'],
    ['now', 'Activity'],
    ['runs', 'Runs'],
    ['workflow', 'Workflow'],
    ['knowledge', 'Knowledge home'],
    ['specs', 'Specs'],
    ['memory', 'Memory'],
    ['skills', 'Skills'],
    ['settings', 'Settings'],
  ];

  const originalWindow = globalThis.window;
  t.after(() => {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  });

  for (const [route] of legacyRoutes) {
    globalThis.window = { location: { hash: `#/${route}` } };
    assert.equal(viewFromHash(), route);
  }
  for (const route of ['operation', 'knowledge']) {
    globalThis.window.location.hash = `#/${route}`;
    assert.equal(viewFromHash(), route);
  }
  globalThis.window.location.hash = '#/unknown';
  assert.equal(viewFromHash(), 'overview');
  globalThis.window.location.hash = '';
  assert.equal(viewFromHash('settings'), 'settings', 'the saved start page applies when no hash is present');
  globalThis.window.location.hash = '#/unknown';
  assert.equal(viewFromHash('settings'), 'settings', 'a saved start page is used when no valid hash route exists');
  globalThis.window.location.hash = '#/now';
  assert.equal(viewFromHash('settings'), 'now', 'a deep link takes precedence over the saved start page');
  globalThis.window.location.hash = '#/overview/extra';
  assert.equal(viewFromHash('settings'), 'settings', 'malformed route suffixes fall back to the saved start page');
  globalThis.window.location.hash = '#/models';
  assert.equal(viewFromHash('settings'), 'settings', 'the removed Models route is not navigable');

  const html = renderToStaticMarkup(React.createElement(Sidebar, { active: 'now', onSelect() {} }));
  assert.match(html, /<aside class="sidebar" aria-label="Dashboard sections">/);
  assert.match(html, /class="sidebar-brand"/);
  assert.match(html, /class="sidebar-brand-name">guarana<\/strong>/);
  assert.match(html, /class="sidebar-brand-edition">Fieldstation<\/span>/);
  assert.match(html, /<nav class="sect-nav" aria-label="Dashboard workspaces">/);
  for (const group of ['Operation', 'Knowledge', 'Settings']) {
    assert.match(html, new RegExp(`sect-nav-group-title"[^>]*>${group}<\\/h2>`));
  }
  for (const [route, label] of destinations) {
    assert.match(html, new RegExp(`data-route="${route}"[^>]*>${label}<\\/button>`));
    assert.ok(html.includes(`sect-nav-btn${route === 'now' ? ' sect-nav-btn--active' : ''}`));
  }
  assert.doesNotMatch(html, />Models<\/button>/);
  assert.equal((html.match(/aria-current="page"/g) || []).length, 1);
  assert.match(html, /data-route="now" aria-current="page" class="sect-nav-btn sect-nav-btn--active">Activity/);
  const operationHtml = renderToStaticMarkup(React.createElement(Sidebar, { active: 'operation', onSelect() {} }));
  assert.match(operationHtml, /data-route="operation" aria-current="page"/);
  const overviewHtml = renderToStaticMarkup(React.createElement(Sidebar, { active: 'overview', onSelect() {} }));
  assert.match(overviewHtml, /data-route="operation" aria-current="page"/, 'the legacy Overview route marks its workspace landing active');

  const knowledgeHtml = renderToStaticMarkup(React.createElement(KnowledgeHome));
  assert.match(knowledgeHtml, /class="knowledge-search"/);
  assert.match(knowledgeHtml, /id="knowledge-search-title">Search knowledge/);
  const knowledgeSearchPosition = knowledgeHtml.indexOf('class="knowledge-search"');
  const knowledgeLedgerPosition = knowledgeHtml.indexOf('class="knowledge-ledger"');
  assert.ok(knowledgeSearchPosition >= 0 && knowledgeLedgerPosition >= 0 && knowledgeSearchPosition < knowledgeLedgerPosition, 'knowledge search precedes source snapshots');
  assert.doesNotMatch(knowledgeHtml, /knowledge-source-list|aria-label="Knowledge sources"/);
  for (const [route, label] of [['specs', 'Specs'], ['memory', 'Memory'], ['skills', 'Skills']]) {
    assert.doesNotMatch(knowledgeHtml, new RegExp(`<a[^>]+href="#/${route}"[^>]*>\\s*<strong>${label}<\\/strong>\\s*<\\/a>`));
  }
  assert.match(knowledgeHtml, /Global · read-only/);
  assert.match(knowledgeHtml, /User preferences/);

  const css = fs.readFileSync(path.join(webRoot, 'src/style.css'), 'utf8');
  for (const [token, color] of [
    ['--paper', '#F0F4F1'], ['--ink', '#1E2C26'], ['--critical', '#D75D47'],
    ['--rail', '#183F36'], ['--rail-ink', '#EDF4EF'], ['--canvas', '#E6ECE8'],
  ]) {
    assert.match(css, new RegExp(`${token}:\\s*${color}`, 'i'));
  }
  assert.match(css, /:root\[data-theme='dark'\][\s\S]*?--paper:\s*#18221E/i);
  assert.match(css, /--mono:\s*'IBM Plex Mono'/);
  assert.match(css, /--display:\s*'Space Grotesk'/);
  assert.match(css, /\.sidebar\s*\{[^}]*background:\s*var\(--rail\)/s);
  assert.match(css, /\.app-content\s*\{[^}]*background:\s*var\(--paper\)/s);
  assert.match(css, /\.app-shell\s*\{[^}]*grid-template-columns:\s*minmax\(12rem, 14rem\) minmax\(0, 1fr\)/s);
  assert.match(css, /@media \(max-width: 840px\)\s*\{[\s\S]*?\.app-shell\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.match(css, /\.sect-nav\s*\{[^}]*overflow-x:\s*auto/s);
  assert.match(css, /\.sect-nav-group-title\s*\{/);
  assert.match(css, /\.operation-shortcuts\s*\{/);
  assert.match(css, /\.knowledge-ledger\s*\{/);
  assert.match(css, /:focus-visible\s*\{[^}]*outline:/s);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});
