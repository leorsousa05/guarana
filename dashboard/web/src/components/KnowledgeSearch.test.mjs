import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import test from 'node:test';
import { projectFetch } from '../lib/projectApi.js';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const render = (element) => renderToStaticMarkup(element);

async function loadKnowledge(t) {
  const vite = await createServer({
    root: webRoot,
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  t.after(() => vite.close());
  return vite.ssrLoadModule('/src/components/KnowledgeSearch.jsx');
}

function jsonResponse(data, status = 200) {
  return { ok: status >= 200 && status < 300, status, statusText: status === 200 ? 'OK' : 'Unavailable', json: async () => data };
}

test('Knowledge search lazily queries read-only project and global sources with separate scopes', async (t) => {
  const { KnowledgeResults, KnowledgeSearch, runKnowledgeSearch } = await loadKnowledge(t);
  const originalFetch = globalThis.fetch;
  const calls = [];
  const selectedProjectId = 'opaque-selected-project-7';
  const fixtures = {
    '/api/specs/tracker': {
      schema: 'guarana',
      rows: [{ skill: 'needle tracker item', status: 'TASKED', proof: 'focused proof', change: 'tracker metadata' }],
    },
    '/api/decisions/pending': {
      decisions: [{ file: '.specs/decisions/ADR-needle.md', statement: 'Keep the needle decision pending.' }],
    },
    '/api/specs/tree': { files: ['features/needle-document.md', 'features/other.md'] },
    '/api/memory/search': {
      results: [{ id: 'project-memory-1', type: 'decision', intent: 'needle project memory', summary: 'Project-only result.' }],
      count: 1,
    },
    '/api/memory/preferences': {
      preferences: [{ id: 'global-pref-1', scope: 'global', status: 'superseded', category: 'workflow', intent: 'needle global preference', summary: 'Global-only history.' }],
      count: 1,
    },
    '/api/skills': {
      global: [{ name: 'needle-global-skill', category: 'research', description: 'Global skill metadata.' }],
      project: [{ name: 'needle-project-skill', category: 'development', description: 'Project skill metadata.' }],
    },
  };

  globalThis.fetch = async (input, options) => {
    calls.push({ input, options });
    const url = new URL(input, 'http://dashboard.local');
    const data = fixtures[url.pathname];
    if (!data) return jsonResponse({ error: 'Unexpected request' }, 404);
    return jsonResponse(data);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const updates = {};
  await runKnowledgeSearch(' Needle ', (url, options) => projectFetch(url, selectedProjectId, options), (id, state) => {
    updates[id] = state;
  });

  assert.equal(calls.length, 6);
  assert.ok(calls.every(({ options }) => options === undefined), 'every lookup uses the default GET with no body');
  const requestUrls = calls.map(({ input }) => new URL(input, 'http://dashboard.local'));
  const preferenceRequest = requestUrls.find((url) => url.pathname === '/api/memory/preferences');
  assert.equal(preferenceRequest.searchParams.get('q'), 'Needle');
  assert.equal(preferenceRequest.searchParams.get('status'), 'all', 'global search includes active and superseded history');
  assert.equal(preferenceRequest.searchParams.has('projectId'), false, 'global preferences remain unscoped');
  for (const url of requestUrls.filter(({ pathname }) => pathname !== '/api/memory/preferences')) {
    assert.equal(url.searchParams.get('projectId'), selectedProjectId, `${url.pathname} stays on the opaque selected project`);
  }
  assert.equal(requestUrls.find(({ pathname }) => pathname === '/api/memory/search').searchParams.get('q'), 'Needle');

  assert.deepEqual(Object.fromEntries(Object.entries(updates).map(([id, state]) => [id, state.status])), {
    tracker: 'ready', decisions: 'ready', documents: 'ready', memory: 'ready', preferences: 'ready', skills: 'ready',
  });
  assert.equal(updates.tracker.results[0].title, 'needle tracker item');
  assert.equal(updates.decisions.results[0].detail, '.specs/decisions/ADR-needle.md');
  assert.equal(updates.documents.results[0].detail, 'features/needle-document.md');
  assert.equal(updates.memory.results[0].title, 'needle project memory');
  assert.equal(updates.preferences.results[0].title, 'needle global preference');
  assert.deepEqual(updates.skills.results.map(({ scope }) => scope), ['Global', 'Project']);

  const html = render(React.createElement(KnowledgeResults, { sources: updates, query: 'Needle' }));
  for (const label of [
    'Specs · Project tracker', 'Specs · Pending decisions', 'Specs · Documents',
    'Project Memory', 'User preferences', 'Skills',
    'Project', 'Global', 'needle project memory', 'needle global preference',
    'Global skill metadata.', 'Project skill metadata.', 'superseded',
  ]) assert.ok(html.includes(label), `search result labels/content include ${label}`);
  assert.match(html, /href="#\/specs"/);
  assert.match(html, /href="#\/memory"/);
  assert.match(html, /href="#\/skills"/);

  const initial = render(React.createElement(KnowledgeSearch));
  assert.match(initial, /type="search"[^>]*required/);
  assert.doesNotMatch(initial, /knowledge-results/);
});

test('Knowledge source errors and empty states stay independent from successful groups', async (t) => {
  const { KnowledgeResults, runKnowledgeSearch } = await loadKnowledge(t);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = new URL(input, 'http://dashboard.local');
    if (url.pathname === '/api/memory/preferences') return jsonResponse({ error: 'preference library unavailable' }, 503);
    if (url.pathname === '/api/specs/tracker') throw new Error('tracker offline');
    if (url.pathname === '/api/specs/tree') return jsonResponse({ files: [] });
    if (url.pathname === '/api/decisions/pending') return jsonResponse({ decisions: [] });
    if (url.pathname === '/api/memory/search') return jsonResponse({ results: [{ id: 'good-memory', intent: 'useful project record' }] });
    if (url.pathname === '/api/skills') return jsonResponse({ global: [], project: [] });
    return jsonResponse({ error: 'Unexpected request' }, 404);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const updates = {};
  await runKnowledgeSearch('useful', (url, options) => projectFetch(url, 'opaque-project-2', options), (id, state) => {
    updates[id] = state;
  });
  assert.equal(updates.tracker.status, 'error');
  assert.equal(updates.preferences.status, 'error');
  assert.equal(updates.memory.status, 'ready');
  assert.equal(updates.memory.results[0].title, 'useful project record');
  assert.equal(updates.documents.status, 'ready');
  assert.deepEqual(updates.documents.results, []);

  const html = render(React.createElement(KnowledgeResults, { sources: updates, query: 'useful' }));
  assert.match(html, /role="alert">Unable to search Specs · Project tracker: tracker offline/);
  assert.match(html, /role="alert">Unable to search User preferences:/);
  assert.match(html, /useful project record/);
  assert.match(html, /No Specs · Documents results match “useful”/);

  const source = fs.readFileSync(path.join(webRoot, 'src/components/KnowledgeSearch.jsx'), 'utf8');
  assert.match(source, /const projectFetch = useProjectFetch\(\)/);
  assert.doesNotMatch(source, /usePoll|setInterval/);
  assert.doesNotMatch(source, /method:\s*['"](?:POST|PUT|PATCH|DELETE)['"]/i);
});
