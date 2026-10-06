import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import test from 'node:test';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('Skills view exposes accessible Global and Project tabs', async (t) => {
  const vite = await createServer({
    root: webRoot,
    server: { middlewareMode: true },
    appType: 'custom',
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  t.after(() => vite.close());

  const { Skills, SkillScopeTabs } = await vite.ssrLoadModule('/src/components/Skills.jsx');
  const html = renderToStaticMarkup(React.createElement(Skills));
  assert.match(html, /aria-label="Skills"/);
  assert.match(html, /role="tablist" aria-label="Skill scope"/);
  assert.match(html, /role="tab"[^>]*aria-selected="true"[^>]*>Global</);
  assert.match(html, /role="tab"[^>]*aria-selected="false"[^>]*>Project</);
  assert.match(html, /role="status">loading skills/);

  const renderTabs = (response) => renderToStaticMarkup(React.createElement(SkillScopeTabs, {
    response,
    scope: 'global',
    onScopeChange() {},
  }));
  const successHtml = renderTabs({
    data: { global: [{}, {}], project: [] },
    error: null,
  });
  assert.match(successHtml, /role="tab"[^>]*aria-selected="true"[^>]*>Global \(2\)<\/button>/);
  assert.match(successHtml, /role="tab"[^>]*aria-selected="false"[^>]*>Project \(0\)<\/button>/);

  for (const failedResponse of [
    { data: null, error: null },
    { data: { global: [], project: [] }, error: 'network failure' },
    { data: { error: 'skill loading failed', global: [], project: [] }, error: null },
  ]) {
    const failedHtml = renderTabs(failedResponse);
    assert.doesNotMatch(failedHtml, /Global \(\d+\)|Project \(\d+\)/);
  }
});
