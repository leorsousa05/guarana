import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import test from 'node:test';
import { fmtTs } from '../lib/format.js';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const render = (element) => renderToStaticMarkup(element);

async function loadMemory(t) {
  const vite = await createServer({ root: webRoot, server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  t.after(() => vite.close());
  const memory = await vite.ssrLoadModule('/src/components/Memory.jsx');
  const graph = await vite.ssrLoadModule('/src/components/MemoryGraph.jsx');
  const injections = await vite.ssrLoadModule('/src/components/MemoryInjections.jsx');
  const common = await vite.ssrLoadModule('/src/components/common.jsx');
  return { ...memory, ...graph, ...injections, ...common };
}

async function loadMemoryInjectionsWithData(t, data) {
  const vite = await createServer({
    root: webRoot,
    plugins: [{
      name: 'memory-injection-test-data',
      enforce: 'pre',
      resolveId(source, importer) {
        if (source === '../hooks/usePoll.js' && importer?.endsWith('/MemoryInjections.jsx')) return '\0memory-test-use-poll';
      },
      load(id) {
        if (id === '\0memory-test-use-poll') {
          return `export function usePoll() { return { data: ${JSON.stringify(data)}, error: null }; }`;
        }
      },
    }],
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  t.after(() => vite.close());
  return vite.ssrLoadModule('/src/components/MemoryInjections.jsx');
}

test('Memory SSR keeps its four linked tabs, Injected default, and loading feedback', async (t) => {
  const { Memory } = await loadMemory(t);
  const html = render(React.createElement(Memory));
  const tabs = [...html.matchAll(/<button(?=[^>]*role="tab")([^>]*)>(.*?)<\/button>/gs)];
  assert.equal(tabs.length, 4);
  assert.deepEqual(tabs.map(([, , content]) => content.match(/class="mem-tab-label">([^<]+)/)?.[1]), [
    'Injected', 'Summary', 'Search', 'Graph',
  ]);
  assert.equal(tabs.filter(([, attrs]) => /aria-selected="true"/.test(attrs)).length, 1);
  assert.match(tabs[0][1], /aria-selected="true"/);
  assert.match(tabs[0][1], /tabindex="0"/);
  assert.equal([...html.matchAll(/role="tabpanel"/g)].length, 4);
  for (const id of ['injected', 'summary', 'search', 'graph']) {
    assert.match(html, new RegExp(`id="memory-tab-${id}"[^>]*aria-controls="memory-panel-${id}"`));
    assert.match(html, new RegExp(`id="memory-panel-${id}"[^>]*aria-labelledby="memory-tab-${id}"`));
  }
  assert.match(html, /loading memory history/);
  assert.doesNotMatch(html, /review drafts|confirm draft|discard draft/i);
});

test('Memory tabs retain ArrowLeft, ArrowRight, Home, and End roving focus', async (t) => {
  const { handleTabKeyDown } = await loadMemory(t);
  const ids = ['injected', 'summary', 'search', 'graph'];
  for (const [key, current, expected] of [
    ['ArrowRight', 'injected', 'summary'],
    ['ArrowLeft', 'injected', 'graph'],
    ['Home', 'search', 'injected'],
    ['End', 'summary', 'graph'],
  ]) {
    let selected;
    let focused = false;
    let prevented = false;
    handleTabKeyDown({
      key,
      target: { closest: () => ({ dataset: { tabId: current } }) },
      currentTarget: {
        querySelector(selector) {
          assert.equal(selector, `[data-tab-id="${expected}"]`);
          return { focus: () => { focused = true; } };
        },
      },
      preventDefault: () => { prevented = true; },
    }, ids, (next) => { selected = next; });
    assert.equal(selected, expected);
    assert.equal(focused, true);
    assert.equal(prevented, true);
  }
});

test('Memory summary preserves scope counts and every existing count field', async (t) => {
  const { memorySummaryRows } = await loadMemory(t);
  const rows = memorySummaryRows({
    nodes: { total: 7, byScope: { project: 4, global: 3 }, confirmed: 6 },
    supernodes: 2,
    edges: 9,
  });
  assert.deepEqual(rows, [
    ['project nodes', 4, 'project'],
    ['global nodes', 3, 'global'],
    ['total nodes', 7],
    ['confirmed', 6],
    ['supernodes', 2],
    ['edges', 9],
  ]);
  assert.deepEqual(memorySummaryRows({ nodes: { total: 2 } }).slice(0, 2), [
    ['project nodes', 2, 'project'],
    ['global nodes', 0, 'global'],
  ]);
});

test('Memory search remains project-only and renders the existing confirmed-result fields', async (t) => {
  const { memorySearchUrl, MemorySearchForm, MemorySearchResults } = await loadMemory(t);
  assert.equal(memorySearchUrl('  retry behavior  ', 'decision'), '/api/memory/search?q=retry+behavior&type=decision');
  assert.equal(memorySearchUrl('', 'bug'), '/api/memory/search?type=bug');

  const form = render(React.createElement(MemorySearchForm, {
    query: 'retry', onQueryChange() {}, type: 'decision', onTypeChange() {}, onSubmit() {}, searching: false,
  }));
  assert.match(form, /type="search"[^>]*aria-label="search memory"/);
  assert.match(form, /aria-label="filter by type"/);
  assert.deepEqual([...form.matchAll(/<option\b[^>]*>([^<]*)<\/option>/g)].map(([, label]) => label), [
    'any type', 'decision', 'bug', 'solution', 'refactor', 'preference', 'supernode', 'atom',
  ]);

  const ts = 1700000000000;
  const html = render(React.createElement(MemorySearchResults, { results: [{
    id: 'confirmed-1', type: 'decision', intent: 'retry safely', summary: 'Back off before retrying.', score: 0.875, ts,
  }] }));
  for (const value of ['decision', 'retry safely', 'Back off before retrying.', '0.875', fmtTs(ts)]) {
    assert.ok(html.includes(value), `renders search field ${value}`);
  }
  assert.match(html, /role="region" aria-label="Memory search results"/);
  assert.match(html, /<th>type<\/th>.*<th>intent<\/th>.*<th>summary<\/th>.*<th>score<\/th>.*<th>ts<\/th>/s);
});

test('Memory graph SSR keeps scope-qualified identities, selection, neighbors, and lineage', async (t) => {
  const { MemoryGraph } = await loadMemory(t);
  const html = render(React.createElement(MemoryGraph, {
    nodes: [
      { id: 'shared', scope: 'project', type: 'decision', intent: 'New project rule', summary: 'Use the new rule.' },
      { id: 'old', scope: 'project', type: 'decision', intent: 'Old project rule' },
      { id: 'shared', scope: 'global', type: 'preference', intent: 'Global response style' },
      { id: 'pref', scope: 'global', type: 'preference', intent: 'Global language preference' },
    ],
    edges: [
      { scope: 'project', from: 'shared', to: 'old', rel: 'supersedes' },
      { scope: 'global', from: 'shared', to: 'pref', rel: 'relates-to' },
    ],
    selected: 'project:shared',
    onSelect() {},
  }));

  assert.match(html, /role="region" aria-label="Memory graph canvas; scroll to explore the full map"/);
  assert.match(html, /role="button" tabindex="0" aria-pressed="true" aria-label="project decision: New project rule"/);
  assert.match(html, /role="button" tabindex="0" aria-pressed="false" aria-label="global preference: Global response style"/);
  assert.match(html, /decision lineage \(supersedes diff\)/);
  assert.match(html, /replaced/);
  assert.match(html, /Old project rule/);
  assert.match(html, /why it’s connected/);
  assert.match(html, /relates-to/);
  assert.match(html, /memory-scope--global/);
  assert.equal([...html.matchAll(/class="mem-edge-label"/g)].length, 1, 'only the selected node edge is labeled');
});

test('Memory injection history remains session-filterable and responsive scrolling is contained', async (t) => {
  const { filterInjectionsForSession } = await loadMemory(t);
  const history = [
    { id: 'project-turn', sessionID: 'root', memories: [{ id: 'p1', type: 'decision', scope: 'project' }] },
    { id: 'global-turn', sessionID: 'helper', memories: [{ id: 'g1', type: 'preference', scope: 'global' }] },
  ];
  assert.deepEqual(filterInjectionsForSession(history, 'root').map(({ id }) => id), ['project-turn']);
  assert.deepEqual(filterInjectionsForSession(history).map(({ id }) => id), ['project-turn', 'global-turn']);

  const css = fs.readFileSync(path.join(webRoot, 'src/style.css'), 'utf8');
  const start = css.indexOf('/* ---------- memory view ----------');
  const end = css.indexOf('/* ---------- rendered markdown ----------', start);
  const memoryCss = css.slice(start, end);
  assert.match(memoryCss, /\.mem-results\s*\{[^}]*overflow-x:\s*auto;[^}]*overscroll-behavior-inline:\s*contain/s);
  assert.match(memoryCss, /\.mem-graph-viewport\s*\{[^}]*overflow-x:\s*auto;[^}]*overscroll-behavior-inline:\s*contain/s);
  assert.match(memoryCss, /\.mem-graph-svg\s*\{[^}]*min-width:\s*760px/s);
  assert.match(memoryCss, /\.mem-graph-viewport:focus-visible\s*\{[^}]*outline:\s*2px/s);
  assert.match(memoryCss, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(memoryCss, /\.mem-summary\s*\{[^}]*grid-template-columns/s);
});

test('Memory injection panels stay unboxed without losing the map and history presentation', async (t) => {
  const { MemoryInjections } = await loadMemoryInjectionsWithData(t, { injections: [
    {
      id: 'current', sessionID: 'root', ts: 1700000000000, reason: 'new-memories',
      memories: [
        { id: 'p1', scope: 'project', type: 'decision', intent: 'Project rule', summary: 'Keep project context.' },
        { id: 'p2', scope: 'project', type: 'solution', intent: 'Project fix' },
        { id: 'g1', scope: 'global', type: 'preference', intent: 'Global style' },
      ],
      edges: [{ scope: 'project', from: 'p1', to: 'p2', rel: 'relates-to' }],
    },
    {
      id: 'previous', sessionID: 'helper', ts: 1699990000000,
      memories: [{ id: 'g2', scope: 'global', type: 'preference', intent: 'Earlier style' }],
      edges: [],
    },
  ] });
  const html = render(React.createElement(MemoryInjections));
  assert.match(html, /class="memory-brain-panel" aria-label="Memory injection map"/);
  assert.match(html, /class="memory-brain-svg" viewBox="0 0 680 330"/);
  assert.match(html, /memory-brain-hemi--project/);
  assert.match(html, /memory-brain-hemi--global/);
  assert.match(html, /class="memory-brain-link"/);
  assert.match(html, /project decision: Project rule/);
  assert.match(html, /global preference: Global style/);
  assert.match(html, /class="memory-injection-history" aria-label="Recent memory injections"/);
  assert.equal([...html.matchAll(/<li>/g)].length, 2);
  assert.equal([...html.matchAll(/memory-injection-entry--active/g)].length, 1);
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /class="memory-injection-session">helper/);

  const css = fs.readFileSync(path.join(webRoot, 'src/style.css'), 'utf8');
  const start = css.indexOf('/* ---------- memory view ----------');
  const end = css.indexOf('/* ---------- rendered markdown ----------', start);
  const memoryCss = css.slice(start, end);
  const panels = memoryCss.match(/\.memory-brain-panel,\s*\.memory-injection-history\s*\{([^}]*)\}/s)?.[1];
  assert.ok(panels, 'shared panel layout rule exists');
  assert.doesNotMatch(panels, /(?:^|;)\s*border\s*:/);
  assert.doesNotMatch(panels, /(?:^|;)\s*background\s*:/);
  assert.match(memoryCss, /\.memory-injection-history\s*\{[^}]*border-left:\s*1px solid var\(--hairline\)/s);
  assert.match(memoryCss, /\.memory-brain-scope--project\s*\{[^}]*color:\s*var\(--leaf\)/s);
  assert.match(memoryCss, /\.memory-brain-scope--global\s*\{[^}]*color:\s*#006b68/s);
  assert.match(memoryCss, /\.memory-injection-entry:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--guarana\)/s);
  assert.match(memoryCss, /\.memory-injection-entry--active\s*\{[^}]*background:\s*var\(--hover\)/s);
  assert.match(memoryCss, /\.memory-injection-history ol\s*\{[^}]*max-height:\s*29rem;[^}]*overflow-y:\s*auto/s);
  assert.match(memoryCss, /\.memory-brain-svg\s*\{[^}]*width:\s*100%;[^}]*height:\s*auto;[^}]*max-height:\s*23rem/s);
  assert.match(memoryCss, /@media \(max-width: 840px\)\s*\{[^}]*\.memory-injection-layout\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\)/s);
  assert.match(memoryCss, /\.memory-injection-history ol\s*\{\s*max-height:\s*14rem;/s);
});
