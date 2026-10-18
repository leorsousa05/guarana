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
  const { memorySummaryRows, MemorySummary } = await loadMemory(t);
  const data = {
    nodes: { total: 7, byScope: { project: 4, global: 3 }, confirmed: 6 },
    supernodes: 2,
    edges: 9,
  };
  const rows = memorySummaryRows(data);
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

  const html = render(React.createElement(MemorySummary, { data }));
  assert.match(html, /aria-label="Memory counts by scope"/);
  assert.match(html, /Project memories<\/dt><dd>4/);
  assert.match(html, /Private global memories<\/dt><dd>3/);
  for (const count of ['total nodes', 'confirmed', 'supernodes', 'edges']) assert.ok(html.includes(count));
  assert.match(html, /aria-label="Other memory counts"/);
});

test('Memory search remains project-only and renders readable confirmed-result entries', async (t) => {
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
  assert.match(html, /<ol class="mem-result-list">/);
  assert.match(html, /<dt>type<\/dt><dd class="mem-result-type">decision<\/dd>/);
  assert.match(html, /<span class="mem-result-label">intent<\/span>retry safely/);
  assert.match(html, /<span class="mem-result-label">summary<\/span>Back off before retrying\./);
  assert.match(html, /<dt>score<\/dt><dd>0\.875<\/dd>/);
  assert.match(html, /<dt>timestamp<\/dt><dd><time dateTime=/);
  assert.doesNotMatch(html, /<table|<th>/);
});

test('Memory graph SSR selects the first scoped record and shows readable directed neighbors and lineage', async (t) => {
  const { MemoryGraph } = await loadMemory(t);
  const html = render(React.createElement(MemoryGraph, {
    nodes: [
      { id: 'shared', scope: 'project', type: 'decision', intent: 'New project rule', summary: 'Use the new rule.' },
      { id: 'old', scope: 'project', type: 'decision', intent: 'Old project rule' },
      { id: 'incoming', scope: 'project', type: 'solution', intent: 'Incoming repair', summary: 'Corrects the selected rule.' },
      { id: 'shared', scope: 'global', type: 'preference', intent: 'Global response style' },
      { id: 'pref', scope: 'global', type: 'preference', intent: 'Global language preference' },
    ],
    edges: [
      { scope: 'project', from: 'shared', to: 'old', rel: 'supersedes' },
      { scope: 'project', from: 'incoming', to: 'shared', rel: 'fixes' },
      { scope: 'global', from: 'shared', to: 'pref', rel: 'relates-to' },
    ],
    selected: null,
    onSelect() {},
  }));

  assert.match(html, /aria-label="Memory index"/);
  assert.match(html, /role="region" aria-label="Filtered memory index" tabindex="0"/);
  assert.match(html, /aria-pressed="true" aria-label="project decision: New project rule"/);
  assert.match(html, /aria-pressed="false" aria-label="global preference: Global response style"/);
  assert.match(html, /class="mem-index-intent">New project rule/);
  assert.match(html, /class="mem-index-summary">Use the new rule\.<\/span>/);
  assert.match(html, /class="memory-scope memory-scope--global">global/);
  assert.match(html, /class="mem-focus-label">Focused memory/);
  assert.match(html, /Outgoing/);
  assert.match(html, /This memory supersedes <button[^>]*>Old project rule<\/button>/);
  assert.match(html, /class="mem-relationship-kind">supersedes/);
  assert.match(html, /Incoming/);
  assert.match(html, /<button[^>]*>Incoming repair<\/button> fixes this memory/);
  assert.match(html, /Corrects the selected rule\./);
  assert.match(html, /class="mem-relationship-kind">fixes/);
  assert.match(html, /decision lineage · supersedes/);
  assert.match(html, /replaced/);
  assert.match(html, /Old project rule/);
  assert.match(html, /Global language preference/, 'all scoped records remain readable in the index');
  assert.match(html, /aria-label="Memory bubble map"/);
  assert.match(html, /aria-pressed="true">Network/);
  assert.match(html, /aria-pressed="false">Neighborhood/);
  assert.match(html, /role="region" aria-label="Network bubble graph; scroll within this map to explore" tabindex="0"/);
  assert.match(html, /data-memory-id="project:shared"[^>]*aria-pressed="true"/);
  assert.match(html, /data-memory-id="global:shared"[^>]*aria-pressed="false"/);
  assert.match(html, /class="mem-bubble-button mem-bubble-button--global/);
  assert.match(html, /class="mem-bubble-core mem-type--preference"/);
  assert.match(html, /class="mem-bubble-edge mem-bubble-edge--project mem-bubble-edge--active"/);
  assert.match(html, /aria-label="Focused relationship direction and type"/);
  assert.match(html, /class="mem-bubble-edge-direction">Outgoing/);
  assert.match(html, /class="mem-bubble-edge-direction">Incoming/);
  assert.match(html, /<strong>supersedes<\/strong>/);
  assert.match(html, /<strong>fixes<\/strong>/);
  assert.match(html, /New project rule → Old project rule/);
  assert.match(html, /Incoming repair → New project rule/);
  assert.doesNotMatch(html, /class="mem-relationship-kind">relates-to/, 'same raw ID in another scope does not become a project neighbor');
  assert.doesNotMatch(html, /mem-graph-svg|mem-graph-viewport/);
});

test('Graph selection starts at the first visible record, follows filter fallback, and clears for no matches', async (t) => {
  const { resolveMemorySelection, MemoryGraph } = await loadMemory(t);
  const visible = [
    { id: 'project:first', scope: 'project', type: 'decision', intent: 'First visible' },
    { id: 'global:second', scope: 'global', type: 'preference', intent: 'Second visible' },
  ];
  assert.equal(resolveMemorySelection(visible, null), 'project:first');
  assert.equal(resolveMemorySelection(visible, 'global:second'), 'global:second');
  assert.equal(resolveMemorySelection(visible, 'project:hidden'), 'project:first');
  assert.equal(resolveMemorySelection([], 'project:hidden'), null);

  const fallbackHtml = render(React.createElement(MemoryGraph, { nodes: visible, edges: [], selected: 'project:hidden', onSelect() {} }));
  assert.match(fallbackHtml, /aria-pressed="true" aria-label="project decision: First visible"/);
  assert.doesNotMatch(fallbackHtml, /Focused memory[\s\S]*project:hidden/);
  const emptyHtml = render(React.createElement(MemoryGraph, { nodes: [], edges: [], selected: 'project:hidden', onSelect() {} }));
  assert.match(emptyHtml, /No memories match these filters\. Adjust the text, type, scope, or relationship filters to continue\./);
  assert.match(emptyHtml, /No memories match these filters\. Adjust the filters to select a memory and explore its neighborhood\./);
});

test('Graph filters scope, type, relation, and searchable memory text without losing scope identity', async (t) => {
  const { filterMemoryGraph, MemoryGraph } = await loadMemory(t);
  const nodes = [
    { id: 'same', scope: 'project', type: 'decision', intent: 'Retry policy', summary: 'Back off first.' },
    { id: 'other', scope: 'project', type: 'bug', intent: 'Retry crash', summary: 'Old failure.' },
    { id: 'same', scope: 'global', type: 'preference', intent: 'Writing style', summary: 'Be concise.' },
  ].map((node) => ({ ...node, memoryId: node.id, id: `${node.scope}:${node.id}` }));
  const edges = [
    { scope: 'project', from: 'project:same', to: 'project:other', rel: 'fixes' },
    { scope: 'global', from: 'global:same', to: 'global:same', rel: 'relates-to' },
  ];
  assert.deepEqual(filterMemoryGraph(nodes, edges, { query: 'retry', type: 'decision', scope: 'project' }), {
    nodes: [nodes[0]], edges: [],
  });
  assert.deepEqual(filterMemoryGraph(nodes, edges, { scope: 'project', rel: 'fixes' }), {
    nodes: nodes.slice(0, 2), edges: [edges[0]],
  });

  const html = render(React.createElement(MemoryGraph, {
    nodes: nodes.map(({ memoryId, ...node }) => ({ ...node, id: memoryId })),
    edges: [], selected: null, onSelect() {},
  }));
  for (const label of ['Filter memories by text', 'Filter memories by type', 'Filter memories by scope', 'Filter by relationship type']) {
    assert.match(html, new RegExp(`aria-label="${label}"`));
  }
  assert.match(html, /aria-label="Memory index"/);
  assert.match(html, /class="memory-scope memory-scope--global">global/);
});

test('Graph global selection and global links remain read-only', async (t) => {
  const { MemoryGraph } = await loadMemory(t);
  const html = render(React.createElement(MemoryGraph, {
    nodes: [
      { id: 'g1', scope: 'global', type: 'preference', intent: 'Global style', summary: 'Keep answers short.' },
      { id: 'g2', scope: 'global', type: 'preference', intent: 'Global language', summary: 'Use plain language.' },
    ],
    edges: [{ scope: 'global', from: 'g1', to: 'g2', rel: 'relates-to', ts: 1700000000000 }],
    selected: 'global:g1', onSelect() {},
  }));
  assert.match(html, /Global memories are read-only here/);
  assert.match(html, /memory-scope--global/);
  assert.doesNotMatch(html, /Project relationship editor|Remove link|Review link|Confirm removal/);
});

test('Graph relationship writes use project-only typed payloads and exact edge timestamps', async (t) => {
  const { createRelationshipPayload, deleteRelationshipPayload, sendMemoryRelationship, MEMORY_RELATIONS } = await loadMemory(t);
  const source = { id: 'project:a', memoryId: 'a', scope: 'project', intent: 'Source' };
  const target = { id: 'project:b', memoryId: 'b', scope: 'project', intent: 'Target' };
  assert.equal(createRelationshipPayload(source, target, ''), null, 'a type is required; no relation is inferred');
  assert.equal(createRelationshipPayload(source, { ...target, scope: 'global' }, 'fixes'), null);
  assert.equal(createRelationshipPayload(source, target, 'invented'), null);
  assert.deepEqual(createRelationshipPayload(source, target, 'fixes'), {
    from: 'a', to: 'b', rel: 'fixes', scope: 'project',
  });
  assert.deepEqual(MEMORY_RELATIONS, ['caused-by', 'depends-on', 'supersedes', 'summarizes', 'fixes', 'relates-to']);

  const edge = { scope: 'project', memoryFrom: 'a', memoryTo: 'b', rel: 'fixes', ts: 1700000000123 };
  const removal = deleteRelationshipPayload(edge);
  assert.deepEqual(removal, { from: 'a', to: 'b', rel: 'fixes', ts: 1700000000123, scope: 'project' });
  assert.equal(deleteRelationshipPayload({ ...edge, scope: 'global' }), null);
  assert.equal(deleteRelationshipPayload({ ...edge, ts: undefined }), null);

  const requests = [];
  const fakeFetch = async (url, options) => {
    requests.push({ url, options });
    return { ok: true, json: async () => ({ ok: true }) };
  };
  await sendMemoryRelationship('POST', createRelationshipPayload(source, target, 'fixes'), fakeFetch);
  await sendMemoryRelationship('DELETE', removal, fakeFetch);
  assert.deepEqual(requests.map(({ url, options }) => [url, options.method, JSON.parse(options.body)]), [
    ['/api/memory/relationships', 'POST', { from: 'a', to: 'b', rel: 'fixes', scope: 'project' }],
    ['/api/memory/relationships', 'DELETE', removal],
  ]);
  await assert.rejects(sendMemoryRelationship('POST', removal, async () => ({ ok: false, status: 409, json: async () => ({ private: 'never display' }) })), (error) => {
    assert.equal(error.status, 409);
    assert.doesNotMatch(error.message, /private|never display/);
    return true;
  });
});

test('Graph exposes separate save and removal confirmation steps with accessible controls', async (t) => {
  const { MemoryGraph, MemoryCreateConfirmation, MemoryDeleteConfirmation } = await loadMemory(t);
  const nodes = [
    { id: 'a', scope: 'project', type: 'decision', intent: 'Retry safely' },
    { id: 'b', scope: 'project', type: 'bug', intent: 'Repeated failure' },
  ];
  const graphHtml = render(React.createElement(MemoryGraph, { nodes, edges: [], selected: 'project:a', onSelect() {} }));
  assert.match(graphHtml, /aria-label="Project relationship editor"/);
  assert.match(graphHtml, /id="mem-link-target"/);
  assert.match(graphHtml, /id="mem-link-relation"/);
  assert.match(graphHtml, /disabled=""[^>]*>Review link/);
  assert.doesNotMatch(graphHtml, /Confirm and save link/);

  const createHtml = render(React.createElement(MemoryCreateConfirmation, {
    source: nodes[0], target: nodes[1], rel: 'fixes', onConfirm() {}, onCancel() {},
  }));
  assert.match(createHtml, /role="group" aria-label="Confirm relationship save"/);
  assert.match(createHtml, /<strong>Retry safely<\/strong> fixes <strong>Repeated failure<\/strong>/);
  assert.match(createHtml, />Confirm and save link<\/button>/);
  assert.match(createHtml, />Keep editing<\/button>/);

  const deleteHtml = render(React.createElement(MemoryDeleteConfirmation, {
    edge: { scope: 'project', memoryFrom: 'a', memoryTo: 'b', rel: 'fixes', ts: 1700000000000 },
    source: nodes[0], target: nodes[1], onConfirm() {}, onCancel() {},
  }));
  assert.match(deleteHtml, /role="group" aria-label="Confirm relationship removal"/);
  assert.match(deleteHtml, /<strong>Retry safely<\/strong> fixes <strong>Repeated failure<\/strong>/);
  assert.match(deleteHtml, />Confirm removal<\/button>/);
  assert.match(deleteHtml, />Keep link<\/button>/);
});

test('Text suggestions exclude self and linked nodes, expose rationale, and never choose a relation', async (t) => {
  const { relationshipSuggestions, MemoryRelationshipSuggestions } = await loadMemory(t);
  const nodes = [
    { id: 'project:a', memoryId: 'a', scope: 'project', type: 'decision', intent: 'Selected' },
    { id: 'project:linked', memoryId: 'linked', scope: 'project', type: 'bug', intent: 'Already linked' },
    { id: 'project:candidate', memoryId: 'candidate', scope: 'project', type: 'solution', intent: 'Candidate' },
    { id: 'global:private', memoryId: 'private', scope: 'global', type: 'preference', intent: 'Private global' },
  ];
  const candidates = relationshipSuggestions('project:a', [
    { id: 'a', intent: 'Selected', score: 1 },
    { id: 'linked', intent: 'Already linked', score: 0.9 },
    { id: 'candidate', intent: 'Candidate intent', summary: 'Candidate summary', score: 0.75 },
    { id: 'private', intent: 'Private global', score: 0.7 },
  ], [{ from: 'project:a', to: 'project:linked' }], new Map(nodes.map((node) => [node.id, node])));
  assert.deepEqual(candidates.map(({ id }) => id), ['project:candidate']);
  assert.equal(candidates[0].score, 0.75);
  assert.equal(candidates[0].intent, 'Candidate intent');
  assert.equal(candidates[0].summary, 'Candidate summary');
  assert.equal(candidates[0].rel, undefined, 'candidate text does not infer a relation type');

  const html = render(React.createElement(MemoryRelationshipSuggestions, { candidates, onChoose() {} }));
  assert.match(html, /Local text-match candidates/);
  assert.match(html, /score 0\.750/);
  assert.match(html, /Candidate summary/);
  assert.match(html, /Use this match/);
  assert.doesNotMatch(html, /Already linked|Private global|Selected/);
});

test('Graph uses native focused controls and contains the index without drag, reset, or storage behavior', async () => {
  const componentSource = fs.readFileSync(path.join(webRoot, 'src/components/MemoryGraph.jsx'), 'utf8');
  const css = fs.readFileSync(path.join(webRoot, 'src/style.css'), 'utf8');
  const start = css.indexOf('/* ---------- memory view ----------');
  const end = css.indexOf('/* ---------- rendered markdown ----------', start);
  const memoryCss = css.slice(start, end);
  assert.match(memoryCss, /\.mem-graph button:focus-visible,[\s\S]*?outline:\s*2px solid var\(--guarana\)/);
  assert.match(memoryCss, /\.mem-bubble-viewport\s*\{[^}]*max-width:\s*100%;[^}]*overflow:\s*auto;[^}]*overscroll-behavior:\s*contain/s);
  assert.match(memoryCss, /\.mem-bubble-button--global\s*\{[^}]*border-style:\s*dashed/s);
  assert.match(memoryCss, /\.mem-bubble-button--selected\s*\{[^}]*box-shadow/s);
  assert.match(memoryCss, /@media \(max-width: 840px\)\s*\{\s*\.mem-graph-explorer\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\)/s);
  assert.match(memoryCss, /\.mem-index-scroll\s*\{[^}]*max-height:\s*40rem;[^}]*overflow-y:\s*auto;[^}]*overscroll-behavior:\s*contain/s);
  assert.match(memoryCss, /\.mem-graph-explorer\s*\{[^}]*grid-template-columns:\s*minmax\(14rem, 0\.85fr\) minmax\(0, 1\.5fr\)/s);
  assert.match(memoryCss, /@media \(max-width: 840px\)\s*\{\s*\.mem-graph-explorer\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\)/s);
  assert.match(memoryCss, /@media \(prefers-reduced-motion: reduce\)/);
  const mobileCss = memoryCss.slice(memoryCss.indexOf('@media (max-width: 520px)'));
  assert.match(mobileCss, /\.mem-graph-filters label,[\s\S]*?width:\s*100%/);
  assert.doesNotMatch(componentSource, /sessionStorage|setPointerCapture|onPointer|resetLayout|reset layout/i);
  assert.doesNotMatch(memoryCss, /mem-graph-svg|mem-graph-reset|touch-action:\s*none/);
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
  assert.match(memoryCss, /\.mem-results\s*\{[^}]*max-width:\s*100%;[^}]*min-width:\s*0/s);
  assert.match(memoryCss, /\.mem-result-list\s*\{[^}]*min-width:\s*0/s);
  assert.doesNotMatch(memoryCss, /\.mem-results-table\s*\{[^}]*min-width:\s*42rem/s);
  assert.match(memoryCss, /\.mem-index-scroll\s*\{[^}]*overflow-y:\s*auto;[^}]*overscroll-behavior:\s*contain/s);
  assert.match(memoryCss, /\.mem-bubble-viewport\s*\{[^}]*overflow:\s*auto;[^}]*overscroll-behavior:\s*contain/s);
  assert.doesNotMatch(memoryCss, /mem-graph-svg|mem-graph-viewport/);
  assert.match(memoryCss, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(memoryCss, /\.mem-summary\s*\{[^}]*grid-template-columns/s);
});

test('Injected renders readable scoped records, typed links, unavailable state, and event history', async (t) => {
  const { MemoryInjections } = await loadMemoryInjectionsWithData(t, { injections: [
    {
      id: 'current', sessionID: 'root', ts: 1700000000000, reason: 'new-memories',
      memories: [
        { id: 'p1', scope: 'project', type: 'decision', intent: 'Project rule', summary: 'Keep project context.' },
        { id: 'p2', scope: 'project', type: 'solution', intent: 'Project fix', summary: 'Fix the issue.' },
        { id: 'g1', scope: 'global', type: 'preference', intent: 'Global style' },
        { id: 'gone', scope: 'project', type: 'bug', intent: 'Missing rule', summary: '', available: false },
      ],
      edges: [{ scope: 'project', from: 'p1', to: 'p2', rel: 'supersedes' }],
    },
    {
      id: 'previous', sessionID: 'helper', ts: 1699990000000,
      memories: [{ id: 'g2', scope: 'global', type: 'preference', intent: 'Earlier style' }],
      edges: [],
    },
  ] });
  const html = render(React.createElement(MemoryInjections));
  assert.match(html, /aria-label="Memories in this injection"/);
  assert.match(html, /class="memory-folio-type">decision/);
  assert.match(html, /class="memory-scope memory-scope--project">project/);
  assert.match(html, /class="memory-scope memory-scope--global">global/);
  assert.match(html, /Project rule<\/span><span class="memory-injected-summary">Keep project context\./);
  assert.match(html, /Project fix<\/span><span class="memory-injected-summary">Fix the issue\./);
  assert.match(html, /class="memory-unavailable">node no longer exists/);
  assert.match(html, /Memory text is no longer available\./);
  assert.match(html, /aria-label="Typed relationships between injected memories"/);
  assert.match(html, /Project rule supersedes Project fix/);
  assert.match(html, /class="memory-injection-history" aria-label="Recent memory injections"/);
  assert.equal([...html.matchAll(/class="memory-injection-entry(?: memory-injection-entry--active)?"/g)].length, 2);
  assert.equal([...html.matchAll(/memory-injection-entry--active/g)].length, 1);
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /class="memory-injection-session">helper/);
  assert.match(html, /class="memory-injection-count">1 memory/);
  assert.match(html, /new memories became relevant/);
  assert.match(html, /dateTime="2023-11-14T22:13:20\.000Z"/);
  assert.doesNotMatch(html, /memory-brain-svg|memory-brain-neuron/);

  const css = fs.readFileSync(path.join(webRoot, 'src/style.css'), 'utf8');
  const start = css.indexOf('/* ---------- memory view ----------');
  const end = css.indexOf('/* ---------- rendered markdown ----------', start);
  const memoryCss = css.slice(start, end);
  assert.match(memoryCss, /\.memory-injection-history\s*\{[^}]*border-left:\s*1px solid var\(--hairline\)/s);
  assert.match(memoryCss, /\.memory-injected-record:focus-visible,\s*\.memory-injection-entry:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--guarana\)/s);
  assert.match(memoryCss, /\.memory-injection-entry--active\s*\{[^}]*background:\s*var\(--hover\)/s);
  assert.match(memoryCss, /\.memory-injection-history ol\s*\{[^}]*max-height:\s*29rem;[^}]*overflow-y:\s*auto/s);
  assert.match(memoryCss, /\.memory-injected-record:focus-visible,[\s\S]*?outline:\s*2px solid var\(--guarana\)/);
  assert.match(memoryCss, /\.memory-injected-records > ol\s*\{[^}]*max-height:\s*36rem;[^}]*overflow-y:\s*auto/s);
  assert.match(memoryCss, /@media \(max-width: 840px\)\s*\{[^}]*\.memory-injection-layout\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\)/s);
  assert.match(memoryCss, /@media \(max-width: 840px\)[\s\S]*?\.memory-injection-history ol,[\s\S]*?max-height:\s*14rem;/);
  assert.match(memoryCss, /\.mem-result-copy\s*\{[^}]*font-family:\s*system-ui, sans-serif/s);
  assert.match(memoryCss, /\.mem-results\s*\{[^}]*min-width:\s*0/s);
});
