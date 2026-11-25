import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import test from 'node:test';
import { projectFetch } from '../lib/projectApi.js';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const render = (element) => renderToStaticMarkup(element);
const SOURCE_IDS = ['tracker', 'decisions', 'documents', 'memory', 'skills', 'preferences'];

async function loadKnowledgeHome(t) {
  const vite = await createServer({
    root: webRoot,
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  t.after(() => vite.close());
  return vite.ssrLoadModule('/src/components/KnowledgeHome.jsx');
}

function sourceStates(overrides = {}) {
  return Object.fromEntries(SOURCE_IDS.map((id) => [
    id,
    overrides[id] || { status: 'loading' },
  ]));
}

function ready(data) {
  return { status: 'ready', data };
}

function jsonResponse(data, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Unavailable',
    json: async () => data,
  };
}

function sourceMarkup(html, id) {
  const match = html.match(new RegExp(`<section class="[^"]*" data-knowledge-source="${id}"[\\s\\S]*?<\\/section>`));
  assert.ok(match, `expected ${id} source section`);
  return match[0];
}

test('Knowledge Home keeps submitted cross-source search without a redundant source directory', async (t) => {
  const { KnowledgeAtAGlance, KnowledgeHome } = await loadKnowledgeHome(t);
  const html = render(React.createElement(KnowledgeHome));

  assert.match(html, /id="knowledge-title">Knowledge/);
  assert.match(html, /id="knowledge-search-title">Search knowledge/);
  assert.match(html, /type="search"[^>]*required/);
  assert.match(html, /Knowledge at a glance/);
  const searchPosition = html.indexOf('class="knowledge-search"');
  const ledgerPosition = html.indexOf('class="knowledge-ledger"');
  assert.ok(searchPosition >= 0 && ledgerPosition >= 0 && searchPosition < ledgerPosition, 'knowledge search precedes source snapshots');
  assert.doesNotMatch(html, /knowledge-source-list|aria-label="Knowledge sources"/);

  const snapshot = render(React.createElement(KnowledgeAtAGlance));
  assert.doesNotMatch(snapshot, /knowledge-source-list|aria-label="Knowledge sources"/);
  assert.match(snapshot, /Loading implementation tracker/);
});

test('Knowledge at a glance renders actual project ledger, memory, skills, and separate global preference snapshots', async (t) => {
  const { KnowledgeAtAGlance } = await loadKnowledgeHome(t);
  const sources = sourceStates({
    tracker: ready({ rows: [
      { skill: 'Dashboard ledger', status: 'TASKED', proof: '.specs/proof.md', change: 'Focused snapshot' },
      { skill: 'Memory import', status: 'IMPLEMENTED' },
      { skill: 'Unclassified row', status: null },
    ] }),
    decisions: ready({ decisions: [
      { statement: 'Keep the selected-project ledger read-only.', file: '.specs/decisions/ledger.md' },
      { statement: 'Retain separate global scope.', file: '.specs/decisions/scope.md' },
    ] }),
    documents: ready({ files: ['features/dashboard.md', 'state/project-state.md'] }),
    memory: ready({ nodes: { total: 16, byScope: { project: 7, global: 9 }, confirmed: 5, draft: 2 } }),
    skills: ready({
      global: [{ name: 'global-research' }, { name: 'global-workflow' }],
      project: [{ name: 'project-ledger' }, { name: 'project-tests' }, { name: 'project-review' }],
    }),
    preferences: ready([
      { id: 'pref-a', intent: 'Keep implementation concise.' },
      { id: 'pref-b', intent: 'Prefer focused tests.' },
      { id: 'pref-c', intent: 'Preserve selected-project boundaries.' },
      { id: 'pref-d', intent: 'Use accessible controls.' },
    ]),
  });
  const html = render(React.createElement(KnowledgeAtAGlance, { sources }));
  const tracker = sourceMarkup(html, 'tracker');
  const decisions = sourceMarkup(html, 'decisions');
  const documents = sourceMarkup(html, 'documents');
  const memory = sourceMarkup(html, 'memory');
  const skills = sourceMarkup(html, 'skills');
  const preferences = sourceMarkup(html, 'preferences');

  assert.match(tracker, /<strong>3<\/strong> tracked entries/);
  assert.match(tracker, /TASKED/);
  assert.match(tracker, /IMPLEMENTED/);
  assert.match(tracker, /Unspecified/);
  assert.match(tracker, /Dashboard ledger/);
  assert.match(tracker, /Focused snapshot/);

  assert.match(decisions, /<strong>2<\/strong> pending decisions/);
  assert.match(decisions, /Keep the selected-project ledger read-only\./);
  assert.match(decisions, /\.specs\/decisions\/ledger\.md/);
  assert.match(decisions, /\.specs\/decisions\/scope\.md/);

  assert.match(documents, /<strong>2<\/strong> document paths/);
  assert.match(documents, /features\/dashboard\.md/);
  assert.match(documents, /state\/project-state\.md/);

  assert.match(memory, /Selected project · Memory/);
  assert.match(memory, /Project records/);
  assert.match(memory, />7</);
  assert.match(memory, /Confirmed/);
  assert.match(memory, />5</);
  assert.match(memory, /Drafts/);
  assert.match(memory, />2</);
  assert.doesNotMatch(memory, />9</, 'global Memory graph count is not mixed into Project Memory');

  assert.match(skills, /Global skills/);
  assert.match(skills, /Project skills/);
  assert.match(skills, />2</);
  assert.match(skills, />3</);
  assert.match(skills, /global-research/);
  assert.match(skills, /project-ledger/);

  assert.match(preferences, /Global · read-only/);
  assert.match(preferences, /<strong>4<\/strong> active global preferences/);
  assert.match(preferences, /Keep implementation concise\./);
  assert.doesNotMatch(memory, /Keep implementation concise\./, 'global preference text stays out of Project Memory');
});

test('Knowledge sources keep loading, error, empty, and sibling success states independent and safe', async (t) => {
  const { KnowledgeAtAGlance } = await loadKnowledgeHome(t);
  const html = render(React.createElement(KnowledgeAtAGlance, {
    sources: sourceStates({
      tracker: { status: 'loading' },
      decisions: { status: 'error', error: 'private endpoint detail' },
      documents: ready({ files: [] }),
      memory: ready({ nodes: { total: 0, byScope: { project: 0 }, confirmed: 0, draft: 0 } }),
      skills: ready({ global: [], project: [] }),
      preferences: ready([]),
    }),
  }));

  assert.match(sourceMarkup(html, 'tracker'), /role="status">Loading implementation tracker/);
  assert.match(sourceMarkup(html, 'decisions'), /role="alert">Unable to load pending decisions/);
  assert.doesNotMatch(html, /private endpoint detail/);
  assert.match(sourceMarkup(html, 'documents'), /No project document paths are available/);
  assert.match(sourceMarkup(html, 'memory'), /No project memories are recorded/);
  assert.match(sourceMarkup(html, 'skills'), /No global skills are recorded/);
  assert.match(sourceMarkup(html, 'skills'), /No project skills are recorded/);
  assert.match(sourceMarkup(html, 'preferences'), /No active global preferences/);
  assert.match(html, /Project records/);
  assert.match(html, /Open Project Memory/);
});

test('project snapshot requests stay selected-project scoped while active global preferences remain unscoped', async (t) => {
  const { loadGlobalPreferenceSource, loadProjectKnowledgeSources } = await loadKnowledgeHome(t);
  const originalFetch = globalThis.fetch;
  const calls = [];
  const fixtures = {
    '/api/specs/tracker': { rows: [] },
    '/api/decisions/pending': { decisions: [] },
    '/api/specs/tree': { files: [] },
    '/api/memory/summary': { nodes: { total: 0, byScope: { project: 0 }, confirmed: 0, draft: 0 } },
    '/api/skills': { global: [], project: [] },
    '/api/memory/preferences': { preferences: [{ id: 'global-1', status: 'active' }] },
  };
  globalThis.fetch = async (input, options) => {
    calls.push({ input, options });
    const url = new URL(input, 'http://dashboard.local');
    const data = fixtures[url.pathname];
    if (!data) return jsonResponse({ error: 'Unexpected request' }, 404);
    return jsonResponse(data);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const projectId = 'opaque-selected-project-91';
  const updates = {};
  await Promise.all([
    loadProjectKnowledgeSources((url, options) => projectFetch(url, projectId, options), (id, state) => { updates[id] = state; }),
    loadGlobalPreferenceSource((id, state) => { updates[id] = state; }),
  ]);

  assert.equal(calls.length, 6);
  const urls = calls.map(({ input }) => new URL(input, 'http://dashboard.local'));
  const preferenceUrl = urls.find(({ pathname }) => pathname === '/api/memory/preferences');
  assert.ok(preferenceUrl);
  assert.equal(preferenceUrl.searchParams.get('status'), 'active');
  assert.equal(preferenceUrl.searchParams.has('projectId'), false);
  for (const url of urls.filter(({ pathname }) => pathname !== '/api/memory/preferences')) {
    assert.equal(url.searchParams.get('projectId'), projectId, `${url.pathname} uses the selected opaque project id`);
  }
  assert.ok(calls.every(({ options }) => options === undefined), 'snapshot reads are plain GETs');
  assert.deepEqual(Object.fromEntries(Object.entries(updates).map(([id, state]) => [id, state.status])), {
    tracker: 'ready',
    decisions: 'ready',
    documents: 'ready',
    memory: 'ready',
    skills: 'ready',
    preferences: 'ready',
  });
  assert.equal(updates.preferences.data.length, 1);
});

test('one failed project source does not erase successful snapshots or expose response bodies', async (t) => {
  const { loadProjectKnowledgeSources } = await loadKnowledgeHome(t);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = new URL(input, 'http://dashboard.local');
    if (url.pathname === '/api/specs/tracker') return jsonResponse({ error: 'private backend diagnostic' }, 503);
    if (url.pathname === '/api/decisions/pending') return jsonResponse({ decisions: [{ statement: 'Available decision.' }] });
    if (url.pathname === '/api/specs/tree') return jsonResponse({ files: ['state/known-issues.md'] });
    if (url.pathname === '/api/memory/summary') return jsonResponse({ nodes: { total: 3, byScope: { project: 3 }, confirmed: 2, draft: 1 } });
    if (url.pathname === '/api/skills') return jsonResponse({ global: [], project: [{ name: 'available-skill' }] });
    return jsonResponse({ error: 'Unexpected request' }, 404);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const updates = {};
  await loadProjectKnowledgeSources((url, options) => projectFetch(url, 'selected-project', options), (id, state) => { updates[id] = state; });

  assert.deepEqual(updates.tracker, { status: 'error' });
  assert.deepEqual(updates.decisions.data.decisions, [{ statement: 'Available decision.' }]);
  assert.deepEqual(updates.documents.data.files, ['state/known-issues.md']);
  assert.equal(updates.memory.status, 'ready');
  assert.deepEqual(updates.skills.data.project, [{ name: 'available-skill' }]);
  assert.equal(JSON.stringify(updates).includes('private backend diagnostic'), false);
});
