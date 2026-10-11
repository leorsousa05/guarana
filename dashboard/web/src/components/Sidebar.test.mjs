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
  const routes = [
    ['overview', 'Overview'],
    ['now', 'Activity'],
    ['runs', 'Runs'],
    ['specs', 'Specs'],
    ['workflow', 'Workflow'],
    ['memory', 'Memory'],
    ['skills', 'Skills'],
    ['models', 'Models'],
  ];

  const originalWindow = globalThis.window;
  t.after(() => {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  });

  for (const [route] of routes) {
    globalThis.window = { location: { hash: `#/${route}` } };
    assert.equal(viewFromHash(), route);
  }
  globalThis.window.location.hash = '#/unknown';
  assert.equal(viewFromHash(), 'overview');

  const html = renderToStaticMarkup(React.createElement(Sidebar, { active: 'now', onSelect() {} }));
  assert.match(html, /<aside class="sidebar" aria-label="Dashboard sections">/);
  assert.match(html, /<nav class="sect-nav">/);
  for (const [route, label] of routes) {
    assert.match(html, new RegExp(`type="button"[^>]*>${label}<\\/button>`));
    assert.ok(html.includes(`sect-nav-btn${route === 'now' ? ' sect-nav-btn--active' : ''}`));
  }
  assert.equal((html.match(/aria-current="page"/g) || []).length, 1);
  assert.match(html, /aria-current="page" class="sect-nav-btn sect-nav-btn--active">Activity/);

  const css = fs.readFileSync(path.join(webRoot, 'src/style.css'), 'utf8');
  for (const [token, color] of [
    ['--paper', '#F5F0E4'], ['--ink', '#1e1710'], ['--rule', '#D8D0BE'],
    ['--critical', '#9E1B1E'], ['--healthy', '#3E5C3A'], ['--warning', '#B87A14'],
  ]) {
    assert.match(css, new RegExp(`${token}:\\s*${color}`, 'i'));
  }
  assert.match(css, /--mono:\s*'IBM Plex Mono'/);
  assert.match(css, /--display:\s*'Space Grotesk'/);
  assert.match(css, /\.app-shell\s*\{[^}]*grid-template-columns:\s*minmax\(10rem, 12\.5rem\) minmax\(0, 1fr\)/s);
  assert.match(css, /@media \(max-width: 840px\)\s*\{[\s\S]*?\.app-shell\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.match(css, /\.sect-nav\s*\{[^}]*overflow-x:\s*auto/s);
  assert.match(css, /:focus-visible\s*\{[^}]*outline:/s);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});
