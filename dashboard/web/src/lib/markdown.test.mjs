import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import test from 'node:test';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('Markdown renders safe links but neutralizes executable URL schemes', async (t) => {
  const vite = await createServer({
    root: webRoot,
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  t.after(() => vite.close());
  const { Markdown } = await vite.ssrLoadModule('/src/lib/markdown.jsx');

  const render = (text) => renderToStaticMarkup(React.createElement(Markdown, { text }));
  for (const markdown of [
    '[script](javascript:alert%281%29)',
    '[script](JaVaScRiPt:alert%281%29)',
    '[markup](data:text/html,hello)',
    '[legacy](vbscript:msgbox%281%29)',
  ]) {
    const html = render(markdown);
    assert.doesNotMatch(html, /href="(?:javascript|data|vbscript):/i, markdown);
    assert.match(html, /href="#"/, markdown);
  }

  assert.match(render('[web](https://example.com)'), /href="https:\/\/example\.com"/);
  assert.match(render('[mail](mailto:hello@example.com)'), /href="mailto:hello@example\.com"/);
  assert.match(render('[spec](features/plan.md)'), /data-specfile="features\/plan\.md"/);
});
