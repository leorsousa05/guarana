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
  const preferences = await vite.ssrLoadModule('/src/components/MemoryPreferences.jsx');
  const common = await vite.ssrLoadModule('/src/components/common.jsx');
  return { ...memory, ...graph, ...injections, ...preferences, ...common };
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

test('Memory SSR exposes separate workspaces, Project knowledge default, and independent project tabs', async (t) => {
  const { Memory } = await loadMemory(t);
  const html = render(React.createElement(Memory));
  const tabs = [...html.matchAll(/<button(?=[^>]*role="tab")([^>]*)>(.*?)<\/button>/gs)];
  assert.equal(tabs.length, 7);
  assert.deepEqual(tabs.slice(0, 2).map(([, , content]) => content.match(/class="mem-workspace-tab-label">([^<]+)/)?.[1]), [
    'Project knowledge', 'User preferences',
  ]);
  assert.deepEqual(tabs.slice(2).map(([, , content]) => content.replace(/<[^>]*>/g, '')), [
    'Overview', 'Search', 'Graph', 'Drafts', 'Legacy injections',
  ]);
  assert.equal([...html.matchAll(/role="tablist"/g)].length, 2);
  assert.equal(tabs.filter(([, attrs]) => /aria-selected="true"/.test(attrs)).length, 2);
  assert.match(tabs[0][1], /aria-selected="true"/);
  assert.match(tabs[0][1], /tabindex="0"/);
  assert.match(tabs[2][1], /aria-selected="true"/);
  assert.equal([...html.matchAll(/role="tabpanel"/g)].length, 7);
  for (const id of ['project', 'preferences']) {
    assert.match(html, new RegExp(`id="memory-workspace-tab-${id}"[^>]*aria-controls="memory-workspace-panel-${id}"`));
    assert.match(html, new RegExp(`id="memory-workspace-panel-${id}"[^>]*aria-labelledby="memory-workspace-tab-${id}"`));
  }
  for (const id of ['overview', 'search', 'graph', 'drafts', 'legacy-injections']) {
    assert.match(html, new RegExp(`id="memory-project-tab-${id}"[^>]*aria-controls="memory-project-panel-${id}"`));
    assert.match(html, new RegExp(`id="memory-project-panel-${id}"[^>]*aria-labelledby="memory-project-tab-${id}"`));
  }
  assert.match(html, /loading project summary/);
  assert.match(html, /id="memory-workspace-panel-preferences"[^>]*hidden=""/);
  assert.match(html, /Project memory overview/);
  assert.doesNotMatch(html, /Global preference library|Private global memories/);
});

test('Workspace and local tablists retain ArrowLeft, ArrowRight, Home, and End roving focus', async (t) => {
  const { handleTabKeyDown } = await loadMemory(t);
  const lists = [
    { ids: ['project', 'preferences'], cases: [['ArrowRight', 'project', 'preferences'], ['ArrowLeft', 'project', 'preferences'], ['Home', 'preferences', 'project'], ['End', 'project', 'preferences']] },
    { ids: ['overview', 'search', 'graph', 'drafts', 'legacy-injections'], cases: [['ArrowRight', 'overview', 'search'], ['ArrowRight', 'drafts', 'legacy-injections'], ['ArrowLeft', 'overview', 'legacy-injections'], ['Home', 'search', 'overview'], ['End', 'overview', 'legacy-injections']] },
    { ids: ['library', 'graph', 'injection-history'], cases: [['ArrowRight', 'library', 'graph'], ['ArrowRight', 'graph', 'injection-history'], ['ArrowLeft', 'library', 'injection-history'], ['Home', 'injection-history', 'library'], ['End', 'library', 'injection-history']] },
  ];
  for (const { ids, cases } of lists) for (const [key, current, expected] of cases) {
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

test('Drafts display only approved metadata and accessible review actions', async (t) => {
  const { MemoryDraftList } = await loadMemory(t);
  const html = render(React.createElement(MemoryDraftList, {
    drafts: [{
      id: 'private-draft-id', type: 'decision', intent: 'Draft intent', ts: 1700000000000,
      tags: ['review', 'project'], scope: 'global', summary: 'secret summary', decision: 'secret decision', extra: 'secret field',
    }],
    onReview() {},
    reviewingId: null,
  }));
  for (const value of ['Draft intent', 'decision', fmtTs(1700000000000), 'review, project']) assert.ok(html.includes(value));
  assert.match(html, /<dt>type<\/dt>/);
  assert.match(html, /<dt>timestamp<\/dt><dd><time dateTime="2023-11-14T22:13:20\.000Z"/);
  assert.match(html, /<dt>tags<\/dt>/);
  assert.match(html, /<div class="memory-draft-actions" role="group" aria-label="Review Draft intent draft">/);
  assert.match(html, /<label class="memory-draft-type-label">Convert to project type<select[^>]*aria-label="Convert Draft intent draft to project type"[^>]*aria-required="true"/);
  assert.deepEqual([...html.matchAll(/<option\b[^>]*>([^<]*)<\/option>/g)].map(([, label]) => label), [
    'Select type…', 'decision', 'bug', 'solution', 'refactor',
  ]);
  assert.match(html, /<button[^>]*disabled=""[^>]*aria-label="Confirm draft: Draft intent"[^>]*>Confirm<\/button>/,
    'confirmation stays unavailable until an explicit conversion type is selected');
  assert.match(html, /<button[^>]*aria-label="Discard draft: Draft intent"[^>]*>Discard<\/button>/);
  assert.doesNotMatch(html, /private-draft-id|secret summary|secret decision|secret field|global|<textarea|<input|Edit draft/i);
});

test('Draft review requires an allowed conversion, confirms discard, and posts through the project fetch boundary', async (t) => {
  const { MEMORY_DRAFT_DISCARD_WARNING, reviewMemoryDraft } = await loadMemory(t);
  const calls = [];
  const projectFetch = async (url, options) => {
    calls.push({ url, options });
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  };
  let warning;
  assert.equal(await reviewMemoryDraft('draft-1', 'discard', projectFetch, undefined, (message) => {
    warning = message;
    return false;
  }), false);
  assert.match(warning, /draft and its edges/);
  assert.match(warning, /deleted permanently/);
  assert.match(warning, /cannot be restored/);
  assert.equal(calls.length, 0, 'canceling discard sends no request');

  await assert.rejects(reviewMemoryDraft('draft-2', 'confirm', projectFetch), /explicit project memory type/);
  await assert.rejects(reviewMemoryDraft('draft-2', 'confirm', projectFetch, 'atom'), /explicit project memory type/);
  assert.equal(calls.length, 0, 'missing and disallowed conversion targets send no request');

  assert.equal(await reviewMemoryDraft('draft-1', 'discard', projectFetch, undefined, () => true), true);
  assert.equal(await reviewMemoryDraft('draft-2', 'confirm', projectFetch, 'decision'), true);
  assert.deepEqual(calls.map(({ url, options }) => [url, options.method, JSON.parse(options.body)]), [
    ['/api/memory/review', 'POST', { id: 'draft-1', action: 'discard' }],
    ['/api/memory/review', 'POST', { id: 'draft-2', action: 'confirm', edits: { type: 'decision' } }],
  ]);
  assert.ok(calls.every(({ options }) => options.headers['Content-Type'] === 'application/json'));
  assert.deepEqual(Object.keys(JSON.parse(calls[0].options.body)).sort(), ['action', 'id'], 'discard remains unchanged');
  assert.deepEqual(Object.keys(JSON.parse(calls[1].options.body)).sort(), ['action', 'edits', 'id']);
});

test('Draft loads and review requests stay on the current project fetch boundary', async () => {
  const source = fs.readFileSync(path.join(webRoot, 'src/components/Memory.jsx'), 'utf8');
  const app = fs.readFileSync(path.join(webRoot, 'src/App.jsx'), 'utf8');
  const css = fs.readFileSync(path.join(webRoot, 'src/style.css'), 'utf8');
  const memoryCss = css.slice(css.indexOf('/* ---------- memory view ----------'), css.indexOf('/* ---------- rendered markdown ----------'));
  assert.match(source, /const projectFetch = useProjectFetch\(\)/);
  assert.match(source, /projectFetch\('\/api\/memory\/drafts'\)/);
  assert.match(source, /usePoll\('\/api\/memory\/summary\?scope=project'/);
  assert.match(source, /usePoll\('\/api\/memory\/graph\?scope=project'/);
  assert.match(source, /reviewMemoryDraft\(id, action, projectFetch, targetType\)/);
  assert.match(source, /\}, \[tab, projectFetch, draftReload\]\)/, 'project fetch changes and successful reviews reload the draft list');
  assert.match(source, /draftLoading && <p className="loading" role="status">/);
  assert.match(source, /draftError && <ErrorBanner/);
  assert.match(source, /draftNotice && <p[^>]*role="status" aria-live="polite"/);
  assert.match(app, /key=\{selectedProjectId\}/, 'switching projects remounts the dashboard and drops pending component state');
  assert.doesNotMatch(source, /\/api\/memory\/global|scope:\s*['"]global/i);
  assert.match(memoryCss, /\.mem-tabs\s*\{[^}]*grid-template-columns:\s*repeat\(5, minmax\(0, 1fr\)\)/s);
  assert.match(memoryCss, /\.mem-tab:focus-visible,[\s\S]*?\.memory-draft-actions select:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--guarana\)/s);
  assert.match(memoryCss, /\.memory-draft-actions\s*\{[^}]*flex-wrap:\s*wrap/s);
  const mobileTabs = memoryCss.slice(memoryCss.indexOf('@media (max-width: 520px)'));
  assert.match(mobileTabs, /\.mem-tab-hint\s*\{[^}]*overflow-wrap:\s*anywhere/s);
  assert.match(mobileTabs, /\.memory-draft-type-label\s*\{\s*flex-basis:\s*100%;\s*\}/);
});

test('Project overview renders only project counts', async (t) => {
  const { memorySummaryRows, MemorySummary } = await loadMemory(t);
  const data = {
    nodes: { total: 7, byScope: { project: 4, global: 3 }, confirmed: 6 },
    supernodes: 2,
    edges: 9,
  };
  const rows = memorySummaryRows(data);
  assert.deepEqual(rows, [
    ['project memories', 4],
    ['confirmed', 6],
    ['drafts', 0],
    ['supernodes', 2],
    ['edges', 9],
  ]);
  assert.deepEqual(memorySummaryRows({ nodes: { total: 2 } }).slice(0, 2), [['project memories', 2], ['confirmed', 0]]);

  const html = render(React.createElement(MemorySummary, { data }));
  assert.match(html, /aria-label="Project memory counts"/);
  for (const count of ['project memories', 'confirmed', 'drafts', 'supernodes', 'edges']) assert.ok(html.includes(count));
  assert.doesNotMatch(html, /global|total nodes/i);
});

test('Preference library and graph are read-only, scoped, and keyboard accessible', async (t) => {
  const { MEMORY_PREFERENCE_CATEGORIES, memoryPreferencesUrl, loadMemoryPreferences, loadMemoryPreferenceGraph, groupMemoryPreferences, MemoryPreferenceRecords, MemoryPreferences } = await loadMemory(t);
  assert.deepEqual(MEMORY_PREFERENCE_CATEGORIES, ['agent_behavior', 'workflow', 'communication', 'general']);
  assert.equal(memoryPreferencesUrl({ query: '  concise  ', category: 'communication', status: 'active' }),
    '/api/memory/preferences?q=concise&category=communication&status=active');
  assert.equal(memoryPreferencesUrl({ status: 'superseded' }), '/api/memory/preferences?status=superseded');

  const calls = [];
  const entries = [{ id: 'pref-1', scope: 'global', type: 'preference', category: 'communication', status: 'active', intent: 'Be concise', summary: 'Prefer brief replies.', tags: ['style'], priority: 'essential', ts: 1700000000000 }];
  assert.deepEqual(await loadMemoryPreferences({ query: 'concise', category: 'communication', status: 'active' }, async (...args) => {
    calls.push(args);
    return { ok: true, json: async () => ({ preferences: entries }) };
  }), entries);
  assert.deepEqual(calls, [['/api/memory/preferences?q=concise&category=communication&status=active']],
    'the preference endpoint is invoked with no mutation method or request body');
  const graphCalls = [];
  const graph = await loadMemoryPreferenceGraph(async (...args) => {
    graphCalls.push(args);
    return { ok: true, json: async () => ({ nodes: [{ id: 'global-1', scope: 'global', type: 'preference' }], edges: [] }) };
  });
  assert.deepEqual(graphCalls, [['/api/memory/graph?scope=global', { method: 'GET' }]],
    'the preference graph uses only the global graph GET endpoint with no request body');
  assert.deepEqual(graph.nodes.map(({ id }) => id), ['global-1']);
  assert.deepEqual(groupMemoryPreferences([
    ...entries,
    { id: 'pref-2', category: 'unrecognized', status: 'superseded', intent: 'Legacy category' },
  ]).map(([category, records]) => [category, records.length]), [['communication', 1], ['general', 1]]);

  const records = render(React.createElement(MemoryPreferenceRecords, { preferences: [
    ...entries,
    { id: 'pref-2', scope: 'global', type: 'preference', category: 'general', status: 'superseded', intent: 'Older preference', summary: 'Prior preference.', tags: ['old'], ts: 1699990000000 },
  ] }));
  for (const value of ['communication', 'general', 'Be concise', 'Prefer brief replies.', 'essential', 'active', 'Older preference', 'superseded']) {
    assert.ok(records.includes(value), `renders preference field ${value}`);
  }
  assert.match(records, /memory-preference-status memory-preference-status--active">active/);
  assert.match(records, /memory-preference-status memory-preference-status--superseded">superseded/);
  assert.match(records, /<dt>timestamp<\/dt><dd><time dateTime="2023-11-14T22:13:20\.000Z"/);
  assert.equal([...records.matchAll(/<dt>scope<\/dt><dd>Global<\/dd>/g)].length, 2);
  assert.doesNotMatch(records, /Project rule|project memory|<button/);

  const filters = render(React.createElement(MemoryPreferences, { tab: 'library', setTab() {} }));
  assert.match(filters, /aria-label="Search global preferences"/);
  assert.match(filters, /aria-label="Filter preferences by category"/);
  assert.match(filters, /aria-label="Filter preferences by status"/);
  assert.match(filters, /role="tablist" aria-label="User preferences sections"/);
  for (const id of ['library', 'graph', 'injection-history']) {
    assert.match(filters, new RegExp(`id="memory-preferences-tab-${id}"[^>]*aria-controls="memory-preferences-panel-${id}"`));
    assert.match(filters, new RegExp(`id="memory-preferences-panel-${id}"[^>]*aria-labelledby="memory-preferences-tab-${id}"`));
  }
  for (const category of MEMORY_PREFERENCE_CATEGORIES) assert.match(filters, new RegExp(`<option value="${category}">`));
  assert.match(filters, /<option value="active" selected="">active<\/option>/);
  assert.match(filters, /<option value="superseded">superseded<\/option>/);
  assert.match(filters, /<option value="all">all statuses<\/option>/);
  assert.match(filters, /role="tab" id="memory-preferences-tab-graph"[^>]*>Preference graph<\/button>/);
  assert.doesNotMatch(filters, /Create preference|Edit preference|Delete preference/);
  const graphTab = render(React.createElement(MemoryPreferences, { tab: 'graph', setTab() {} }));
  assert.match(graphTab, /id="memory-preferences-tab-graph"[^>]*aria-selected="true"/);
  assert.match(graphTab, /Global preference graph/);
  assert.match(graphTab, /read-only and independent of the selected project/);
  assert.doesNotMatch(graphTab, /Filter memories by scope|Project relationship editor|Review link|Remove link/);
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
  assert.match(html, /<dt>scope<\/dt><dd>project<\/dd>/);
  assert.match(html, /<span class="mem-result-label">intent<\/span>retry safely/);
  assert.match(html, /<span class="mem-result-label">summary<\/span>Back off before retrying\./);
  assert.match(html, /<dt>score<\/dt><dd>0\.875<\/dd>/);
  assert.match(html, /<dt>timestamp<\/dt><dd><time dateTime=/);
  assert.doesNotMatch(html, /<table|<th>/);

  const legacy = render(React.createElement(MemorySearchResults, { results: [
    { id: 'legacy-pref', type: 'preference', intent: 'Legacy project preference', summary: 'Project-only sentinel.', ts },
    { id: 'legacy-atom', type: 'atom', intent: 'Legacy project atom', summary: 'Existing label remains.', ts },
  ] }));
  assert.match(legacy, /Project · legacy preference/);
  assert.match(legacy, /Legacy project record/);
  assert.match(legacy, /<dt>scope<\/dt><dd>project<\/dd>/);
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
  assert.match(html, /<div class="mem-graph-display-modes" role="group" aria-label="Memory display"><button type="button" aria-pressed="true">Memory map<\/button><button type="button" aria-pressed="false">Memory index<\/button><\/div>/);
  assert.match(html, /class="mem-graph-explorer mem-graph-explorer--map"/);
  assert.match(html, /<section class="mem-graph-index" aria-label="Memory index" hidden="">/,
    'the hidden attribute removes the index and its descendants from the accessibility tree in Map mode');
  assert.match(html, /class="mem-focus-label">Selected memory/);
  assert.match(html, /aria-label="Selected memory inspector"/);
  assert.match(html, /Scope: project/);
  assert.match(html, /Type: decision/);
  assert.match(html, /ID: project:shared/);
  assert.match(html, /<h5 class="mem-detail-sub">Summary<\/h5>/);
  assert.match(html, /class="mem-bubble-disclosure(?: mem-bubble-disclosure--[a-z]+)*" aria-hidden="true"><strong>New project rule/);
  assert.match(html, /class="mem-bubble-disclosure(?: mem-bubble-disclosure--[a-z]+)*" aria-hidden="true"><strong>Old project rule/);
  assert.match(html, /class="mem-bubble-disclosure-summary">Use the new rule\.<\/span>/);
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
  assert.match(html, /class="mem-bubble-section" aria-label="Memory bubble map"/);
  assert.match(html, /aria-pressed="true">Network/);
  assert.match(html, /aria-pressed="false">Neighborhood/);
  assert.match(html, /role="region" aria-label="Network bubble graph" tabindex="0"/);
  for (const control of ['Zoom in', 'Zoom out', 'Fit map', 'Focus selected']) assert.match(html, new RegExp(`>${control}<\/button>`));
  assert.match(html, /Drag empty map to pan · wheel to zoom · use Focus selected to recenter/);
  assert.match(html, /class="mem-bubble-canvas" style="width:520px;height:520px;transform:translate3d\(0px, 0px, 0\) scale\(1\)"/);
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

test('Project-only graph presentation drops global nodes and controls without changing project editing', async (t) => {
  const { MemoryGraph } = await loadMemory(t);
  const html = render(React.createElement(MemoryGraph, {
    projectOnly: true,
    nodes: [
      { id: 'project-rule', scope: 'project', type: 'decision', intent: 'Project-only rule' },
      { id: 'private-pref', scope: 'global', type: 'preference', intent: 'Private response preference' },
    ],
    edges: [
      { scope: 'project', from: 'project-rule', to: 'project-rule', rel: 'relates-to' },
      { scope: 'global', from: 'private-pref', to: 'private-pref', rel: 'relates-to' },
    ],
    selected: null,
    onSelect() {},
  }));
  assert.match(html, /<legend>Filter project memories and relationships<\/legend>/);
  assert.doesNotMatch(html, /Filter memories by scope|all scopes|global preference: Private response preference|Private response preference|memory-scope--global/);
  assert.match(html, /project decision: Project-only rule/);
  assert.match(html, /Project relationship editor/);
});

test('Global preference graph defensively filters scope, type, and edge endpoints without mutation controls', async (t) => {
  const { filterGlobalPreferenceGraph, MemoryGraph } = await loadMemory(t);
  const nodes = [
    { id: 'preference-safe', scope: 'global', type: 'preference', intent: 'Global preference safe sentinel', summary: 'Private global preference text.' },
    { id: 'project-only', scope: 'project', type: 'decision', intent: 'Project-only sentinel', summary: 'Must not leak.' },
    { id: 'global-legacy', scope: 'global', type: 'decision', intent: 'Global legacy non-preference sentinel', summary: 'Must not leak either.' },
    { id: 'preference-next', scope: 'global', type: 'preference', intent: 'Another global preference' },
    null,
  ];
  const edges = [
    { scope: 'global', from: 'preference-safe', to: 'preference-next', rel: 'relates-to' },
    { scope: 'project', from: 'preference-safe', to: 'project-only', rel: 'fixes' },
    { scope: 'global', from: 'preference-safe', to: 'project-only', rel: 'fixes' },
    { scope: 'global', from: 'preference-safe', to: 'global-legacy', rel: 'caused-by' },
    null,
  ];
  assert.deepEqual(filterGlobalPreferenceGraph(nodes, edges), {
    nodes: [nodes[0], nodes[3]], edges: [edges[0]],
  });
  const html = render(React.createElement(MemoryGraph, {
    nodes, edges, selected: 'global:preference-safe', onSelect() {}, globalPreferencesOnly: true,
  }));
  assert.match(html, /Global preference map/);
  assert.match(html, /aria-label="Selected global preference inspector"/);
  assert.match(html, /Global preference safe sentinel/);
  assert.match(html, /Another global preference/);
  assert.doesNotMatch(html, /Project-only sentinel|Must not leak|global legacy non-preference sentinel|Filter memories by scope|Filter memories by type|all scopes|project<\/option>/i);
  assert.match(html, /aria-label="Filter global preferences by type"/);
  assert.deepEqual([...html.matchAll(/<option value="([^"]*)"[^>]*>([^<]*)<\/option>/g)].map(([, value, label]) => [value, label]), [
    ['', 'all preferences'], ['preference', 'preference'],
    ['', 'all relationships'], ['caused-by', 'caused-by — was caused by'], ['depends-on', 'depends-on — depends on'],
    ['supersedes', 'supersedes — supersedes'], ['summarizes', 'summarizes — summarizes'],
    ['fixes', 'fixes — fixes'], ['relates-to', 'relates-to — is related to'],
  ]);
  assert.doesNotMatch(html, /Project relationship editor|Manage project links|Review link|Remove link|Confirm removal|\/api\/memory\/relationships/);
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
  assert.match(memoryCss, /\.mem-bubble-viewport\s*\{[^}]*max-width:\s*100%;[^}]*height:\s*clamp\(27rem, 74vh, 54rem\);[^}]*overflow:\s*clip;[^}]*overscroll-behavior:\s*contain/s);
  assert.match(memoryCss, /\.mem-bubble-viewport\s*\{[^}]*touch-action:\s*none/s);
  assert.match(memoryCss, /\.mem-bubble-button--global\s*\{[^}]*border-style:\s*dashed/s);
  assert.match(memoryCss, /\.mem-bubble-button--selected\s*\{[^}]*box-shadow/s);
  assert.match(memoryCss, /@media \(max-width: 840px\)\s*\{\s*\.mem-graph-explorer\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\)/s);
  assert.match(memoryCss, /\.mem-index-scroll\s*\{[^}]*max-height:\s*40rem;[^}]*overflow-y:\s*auto;[^}]*overscroll-behavior:\s*contain/s);
  assert.match(memoryCss, /\.mem-graph-explorer\s*\{[^}]*grid-template-columns:\s*minmax\(14rem, 0\.85fr\) minmax\(0, 1\.5fr\)/s);
  assert.match(memoryCss, /\.mem-graph-explorer--index\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\);\s*\}/);
  assert.match(memoryCss, /\.mem-graph-explorer--map\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\);\s*\}/);
  assert.match(memoryCss, /\.mem-graph-explorer--map \.mem-graph-side\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/s);
  assert.match(memoryCss, /\.mem-graph-explorer--map \.mem-map-inspector\s*\{[^}]*border-top:\s*1px solid var\(--ink\);[^}]*border-left:\s*0;[^}]*padding:\s*0\.65rem 0/s);
  assert.match(memoryCss, /\.mem-graph-index\[hidden\]\s*\{\s*display:\s*none;\s*\}/);
  assert.match(memoryCss, /\.mem-graph-explorer--index \.mem-graph-side\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/s);
  assert.match(memoryCss, /\.mem-graph-explorer--index \.mem-bubble-section\s*\{\s*display:\s*none;\s*\}/);
  assert.doesNotMatch(memoryCss, /\.mem-graph-explorer--index \.mem-graph-side\s*\{[^}]*display:\s*none/s);
  assert.match(memoryCss, /\.mem-detail\s*\{[^}]*min-width:\s*0/s);
  assert.match(memoryCss, /\.mem-graph-display-modes button\[aria-pressed="true"\]\s*\{[^}]*border-bottom-color:\s*var\(--guarana\)/s);
  assert.match(memoryCss, /@media \(max-width: 840px\)\s*\{\s*\.mem-graph-explorer\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\)/s);
  const narrowLayoutCss = memoryCss.slice(memoryCss.indexOf('@media (max-width: 840px)'), memoryCss.indexOf('@media (max-width: 520px)'));
  assert.match(narrowLayoutCss, /\.mem-graph-explorer\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\)/s);
  assert.match(narrowLayoutCss, /\.mem-index-scroll\s*\{\s*max-height:\s*16rem;\s*\}/s,
    'the filtered index remains contained at responsive widths when Index mode is selected');
  assert.match(memoryCss, /\.mem-graph-toolbar\s*\{[^}]*flex-wrap:\s*wrap/s);
  assert.match(memoryCss, /\.mem-graph-display-modes button\s*\{[^}]*white-space:\s*nowrap/s);
  assert.match(memoryCss, /@media \(prefers-reduced-motion: reduce\)/);
  const mobileCss = memoryCss.slice(memoryCss.indexOf('@media (max-width: 520px)'));
  assert.match(mobileCss, /\.mem-graph-filters label,[\s\S]*?width:\s*100%/);
  assert.match(memoryCss, /\.mem-graph-explorer\s*\{[^}]*min-width:\s*0/s);
  assert.match(memoryCss, /\.mem-graph-index,[\s\S]*?\.mem-index-list li\s*\{\s*min-width:\s*0;\s*\}/);
  assert.doesNotMatch(componentSource, /sessionStorage|resetLayout|reset layout/i);
  assert.doesNotMatch(componentSource, /scrollLeft|scrollTop/);
  assert.doesNotMatch(componentSource, /\bonWheel\s*=/,
    'wheel zoom is not also registered through React delegated events');
  assert.match(componentSource, /viewport\.addEventListener\('wheel', listener, \{ passive: false \}\)/,
    'the map viewport registers a cancelable native wheel listener');
  assert.match(componentSource, /return \(\) => viewport\.removeEventListener\('wheel', listener\)/,
    'the native wheel listener is removed on unmount');
  assert.match(componentSource, /wheelHandlerRef\.current = handleMapWheel/,
    'the single mounted listener delegates to the latest camera handler');
  const wheelHandlerStart = componentSource.indexOf('const handleMapWheel =');
  const wheelHandlerEnd = componentSource.indexOf('wheelHandlerRef.current =', wheelHandlerStart);
  const wheelHandler = componentSource.slice(wheelHandlerStart, wheelHandlerEnd);
  assert.match(wheelHandler, /if \(event\.cancelable\) event\.preventDefault\(\)/);
  assert.equal([...wheelHandler.matchAll(/\bzoomMap\(/g)].length, 1,
    'each native wheel event performs the existing anchored zoom exactly once');
  assert.match(componentSource, /focusMemoryCamera\(\{ scale: 1, x: 0, y: 0 \}, selectedBubble/,
    'initial map entry starts at natural scale centered on the selected node');
  assert.match(componentSource, /if \(!viewportSize\.width \|\| !viewportSize\.height \|\| !bubbleView\.nodes\.length\) return;/,
    'initial camera focus waits for both a measured viewport and loaded bubbles');
  assert.doesNotMatch(componentSource, /selectionChanged\s*\?\s*focusMemoryCamera/,
    'changing selection does not automatically move the map camera');
  assert.match(componentSource, /const focusSelected = \(\) => \{\s*if \(selectedBubble\) applyCamera\(focusMemoryCamera\(/,
    'Focus selected remains an explicit camera action');
  assert.match(componentSource, /onPointerDown=\{handleMapPointerDown\}/);
  const bubbleButtonStart = componentSource.indexOf('className={`mem-bubble-button');
  const bubbleButtonEnd = componentSource.indexOf('</button>', bubbleButtonStart);
  assert.ok(bubbleButtonStart >= 0 && bubbleButtonEnd > bubbleButtonStart);
  assert.doesNotMatch(componentSource.slice(bubbleButtonStart, bubbleButtonEnd), /onPointer/,
    'pointer handling remains on the empty map surface, never on bubbles');
  assert.doesNotMatch(memoryCss, /mem-graph-svg|mem-graph-reset/);
});

test('Memory injection history remains session-filterable and responsive scrolling is contained', async (t) => {
  const { filterInjectionsForSession, filterInjectionsForScope } = await loadMemory(t);
  const history = [
    { id: 'project-turn', sessionID: 'root', memories: [{ id: 'p1', type: 'decision', scope: 'project' }] },
    { id: 'global-turn', sessionID: 'helper', memories: [{ id: 'g1', type: 'preference', scope: 'global' }] },
  ];
  assert.deepEqual(filterInjectionsForSession(history, 'root').map(({ id }) => id), ['project-turn']);
  assert.deepEqual(filterInjectionsForSession(history).map(({ id }) => id), ['project-turn', 'global-turn']);
  assert.deepEqual(filterInjectionsForScope(history, 'project').map(({ id }) => id), ['project-turn']);
  assert.deepEqual(filterInjectionsForScope(history, 'global').map(({ id }) => id), ['global-turn']);

  const css = fs.readFileSync(path.join(webRoot, 'src/style.css'), 'utf8');
  const start = css.indexOf('/* ---------- memory view ----------');
  const end = css.indexOf('/* ---------- rendered markdown ----------', start);
  const memoryCss = css.slice(start, end);
  assert.match(memoryCss, /\.mem-results\s*\{[^}]*max-width:\s*100%;[^}]*min-width:\s*0/s);
  assert.match(memoryCss, /\.mem-result-list\s*\{[^}]*min-width:\s*0/s);
  assert.doesNotMatch(memoryCss, /\.mem-results-table\s*\{[^}]*min-width:\s*42rem/s);
  assert.match(memoryCss, /\.mem-index-scroll\s*\{[^}]*overflow-y:\s*auto;[^}]*overscroll-behavior:\s*contain/s);
  assert.match(memoryCss, /\.mem-bubble-viewport\s*\{[^}]*overflow:\s*clip;[^}]*overscroll-behavior:\s*contain/s);
  assert.doesNotMatch(memoryCss, /mem-graph-svg|mem-graph-viewport/);
  assert.match(memoryCss, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(memoryCss, /\.mem-workspace-switch\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/s);
  assert.match(memoryCss, /\.memory-preference-list\s*> li\s*\{[^}]*border-bottom:\s*1px solid var\(--hairline\)/s);
  assert.match(memoryCss, /\.memory-preference-status--superseded\s*\{\s*color:\s*var\(--amber\)/);
  assert.doesNotMatch(memoryCss, /\.mem-summary\s*\{[^}]*grid-template-columns/s);
});

test('Injection workspaces request and render only their own scope, with legacy project history labelled', async (t) => {
  const { MemoryInjections } = await loadMemoryInjectionsWithData(t, { injections: [{
    id: 'mixed-legacy-event', sessionID: 'root', ts: 1700000000000,
    memories: [
      { id: 'p1', scope: 'project', type: 'decision', intent: 'Historical project rule', summary: 'Old context.' },
      { id: 'g1', scope: 'global', type: 'preference', intent: 'Global writing style', summary: 'Use short replies.' },
      { id: 'g2', scope: 'global', type: 'decision', intent: 'Not a preference', summary: 'Exclude from global history.' },
    ],
    edges: [
      { scope: 'project', from: 'p1', to: 'p1', rel: 'relates-to' },
      { scope: 'global', from: 'g1', to: 'g1', rel: 'relates-to' },
    ],
  }] });
  const globalHtml = render(React.createElement(MemoryInjections, { scope: 'global' }));
  assert.match(globalHtml, /Global preference injection history/);
  assert.match(globalHtml, /aria-label="User preferences in this injection"/);
  assert.match(globalHtml, /aria-label="Recent preference injections"/);
  assert.match(globalHtml, /Global writing style/);
  assert.doesNotMatch(globalHtml, /Historical project rule|Not a preference|Old context/);

  const projectHtml = render(React.createElement(MemoryInjections, { scope: 'project', historical: true }));
  assert.match(projectHtml, /Legacy project injection history/);
  assert.match(projectHtml, /Older project-context history only\. Project memories are not injected now\./);
  assert.match(projectHtml, /Historical project rule/);
  assert.doesNotMatch(projectHtml, /Global writing style|Use short replies|Not a preference/);

  const source = fs.readFileSync(path.join(webRoot, 'src/components/MemoryInjections.jsx'), 'utf8');
  assert.match(source, /params\.set\('scope', scope\)/);
  assert.match(source, /usePoll\(`\/api\/memory\/injections\?\$\{params\.toString\(\)\}`/);
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
  assert.match(html, /aria-label="Memory records in this injection"/);
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
