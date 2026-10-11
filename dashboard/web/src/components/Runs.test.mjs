import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import test from 'node:test';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const readSource = (name) => fs.readFileSync(path.join(webRoot, 'src/components', name), 'utf8');
const render = (element) => renderToStaticMarkup(element);

test('Runs renders the full session ledger fields, matching status, counts, and legacy project', async (t) => {
  const vite = await createServer({ root: webRoot, server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  t.after(() => vite.close());
  const { Runs, filterRunsByProject, projectForRun } = await vite.ssrLoadModule('/src/components/Runs.jsx');
  const started = 1_700_000_000_000;
  const runs = [
    { sessionID: 'run-alpha', project: 'alpha', start: started, durationMs: 1234, toolCalls: 7, tokens: 12345, errors: 2 },
    { sessionID: 'run-legacy', start: started - 10000, durationMs: 250, toolCalls: 1, tokens: 9, errors: 0 },
    { sessionID: 'run-beta', project: 'beta', start: started - 20000, durationMs: null, toolCalls: 0, tokens: 0, errors: 0 },
  ];
  const mergedEvents = [
    { sessionID: 'run-alpha', type: 'session', status: 'created' },
    { sessionID: 'run-legacy', type: 'session', status: 'error' },
  ];
  const html = render(React.createElement(Runs, { summary: { runs }, mergedEvents }));

  assert.match(html, /Session register/);
  assert.match(html, /aria-label="3 runs"/);
  for (const heading of ['session', 'project', 'status', 'started', 'duration', 'tool calls', 'tokens', 'errors']) {
    assert.match(html, new RegExp(`<th>${heading}<\\/th>`));
  }
  assert.match(html, /run-alpha/);
  assert.match(html, /run-legacy/);
  assert.match(html, /untagged \(legacy\)/);
  assert.match(html, /RUNNING/); // session.created is presented as running
  assert.match(html, /runs-status--running/);
  assert.match(html, /ERROR/);
  assert.match(html, /stamp--bad/);
  assert.ok(html.includes(new Date(started).toLocaleString()));
  assert.match(html, /1\.2s/);
  assert.match(html, /class="runs-number">7<\/td>/);
  assert.match(html, /12,345/);
  assert.match(html, /class="runs-number num--err">2<\/td>/);
  assert.match(html, /aria-describedby="runs-row-instructions"/);
  assert.match(html, /all projects \(3\)/);
  assert.match(html, /alpha \(1\)/);
  assert.match(html, /beta \(1\)/);
  assert.match(html, /untagged \(legacy\) \(1\)/);
  assert.match(html, /showing 3 of 3/);

  assert.deepEqual(filterRunsByProject(runs, 'alpha'), [runs[0]]);
  assert.deepEqual(filterRunsByProject(runs, 'untagged (legacy)'), [runs[1]]);
  assert.equal(projectForRun(runs[1]), 'untagged (legacy)');
  assert.equal(filterRunsByProject(runs, 'all'), runs);

  const emptyHtml = render(React.createElement(Runs, { summary: { runs: [] }, mergedEvents: [] }));
  assert.match(emptyHtml, /no runs recorded/);
  assert.match(emptyHtml, /aria-label="0 runs"/);
});

test('Runs starts at 25 rows, expands/collapses against the filtered set, and resets expansion on filter changes', async (t) => {
  const vite = await createServer({ root: webRoot, server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  t.after(() => vite.close());
  const { Runs, RUNS_PAGE_SIZE, visibleRunPage, filterRunsByProject } = await vite.ssrLoadModule('/src/components/Runs.jsx');
  const runs = Array.from({ length: 27 }, (_, index) => ({
    sessionID: `session-${index}`,
    project: index === 0 ? 'single' : 'main',
    start: 1_700_000_000_000 - index,
    durationMs: 0,
    toolCalls: index,
    tokens: index * 10,
    errors: 0,
  }));
  const html = render(React.createElement(Runs, { summary: { runs }, mergedEvents: [] }));
  const rowCount = [...html.matchAll(/<tr\b[^>]*tabindex="0"/g)].length;

  assert.equal(RUNS_PAGE_SIZE, 25);
  assert.equal(rowCount, 25);
  assert.match(html, /show all 27 runs \(2 more\)/);
  assert.equal(visibleRunPage(runs, false).length, 25);
  assert.equal(visibleRunPage(runs, true).length, 27);
  assert.equal(filterRunsByProject(runs, 'single').length, 1);
  assert.match(readSource('Runs.jsx'), /setProject\(e\.target\.value\);\s*setExpanded\(false\)/);
  assert.match(readSource('Runs.jsx'), /expanded && filtered\.length > RUNS_PAGE_SIZE/);
});

test('Run event dialog retains close, Escape, focus containment, restoration, and contained scroll semantics', async (t) => {
  const vite = await createServer({ root: webRoot, server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  t.after(() => vite.close());
  const { RunModal } = await vite.ssrLoadModule('/src/components/RunModal.jsx');
  const html = render(React.createElement(RunModal, { sessionID: 'run-alpha', onClose() {}, trigger: null }));
  const modalSource = readSource('RunModal.jsx');
  const runsSource = readSource('Runs.jsx');
  const css = fs.readFileSync(path.join(webRoot, 'src/style.css'), 'utf8');

  assert.match(html, /class="modal-backdrop"/);
  assert.match(html, /role="dialog"/);
  assert.match(html, /aria-modal="true"/);
  assert.match(html, /aria-label="Event stream for run-alpha"/);
  assert.match(html, /Session event record/);
  assert.match(html, /role="status">loading events…/);
  assert.match(html, /type="button" class="modal-close"/);
  assert.match(modalSource, /onClick=\{onClose\}/); // backdrop
  assert.match(modalSource, /onClick=\{\(e\) => e\.stopPropagation\(\)\}/); // dialog surface
  assert.match(modalSource, /e\.key === 'Escape'/);
  assert.match(modalSource, /\(els\[0\] \|\| box\)\.focus\(\)/);
  assert.match(modalSource, /e\.shiftKey && \(active === first \|\| active === box\)/);
  assert.match(modalSource, /last\.focus\(\)/);
  assert.match(modalSource, /first\.focus\(\)/);
  assert.match(runsSource, /if \(trigger\) trigger\.focus\(\)/);
  assert.match(runsSource, /setSelected\(r\.sessionID\)/);
  assert.equal((runsSource.match(/setTrigger\(e\.currentTarget\);/g) || []).length, 2);
  assert.match(runsSource, /e\.key === 'Enter' \|\| e\.key === ' '/);
  assert.match(css, /\.modal--run \.modal-body\s*\{[^}]*max-height:\s*72vh[^}]*overflow-y:\s*auto/s);
});

test('Runs has a labelled, contained horizontal ledger with visible focus and a narrow-screen cue', () => {
  const css = fs.readFileSync(path.join(webRoot, 'src/style.css'), 'utf8');
  assert.match(css, /\.runs-table-scroll\s*\{[^}]*overflow-x:\s*auto[^}]*overscroll-behavior-inline:\s*contain/s);
  assert.match(css, /\.runs-table-scroll:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--guarana\)/s);
  assert.match(css, /@media \(max-width: 700px\)[\s\S]*?\.runs-scroll-hint\s*\{[^}]*display:\s*block/s);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});
