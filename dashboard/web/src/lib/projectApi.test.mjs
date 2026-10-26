import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import test from 'node:test';
import {
  addCurrentProject,
  PROJECT_STORAGE_KEY,
  projectApiUrl,
  projectFetch,
  readSavedProjectId,
  removeRegisteredProject,
  resolveProjectSelection,
  saveProjectId,
} from './projectApi.js';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const projectA = 'prj_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const projectB = 'prj_BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
const projects = {
  projects: [{ id: projectA, name: 'Current checkout', registered: false }, { id: projectB, name: 'Other checkout', registered: true }],
  currentProjectId: projectA,
};

test('project selection defaults to current, restores valid storage, and visibly identifies stale storage', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
  };
  assert.equal(readSavedProjectId(storage), null);
  assert.deepEqual(resolveProjectSelection(projects, null), { projectId: projectA, stale: false });
  saveProjectId(projectB, storage);
  assert.equal(values.get(PROJECT_STORAGE_KEY), projectB);
  assert.deepEqual(resolveProjectSelection(projects, readSavedProjectId(storage)), { projectId: projectB, stale: false });
  assert.deepEqual(resolveProjectSelection(projects, 'removed-id'), { projectId: projectA, stale: true });
});

test('project-scoped requests and streaming URLs bind the opaque selected ID; registry API stays unscoped', async () => {
  assert.equal(projectApiUrl('/api/memory/search?q=coffee', projectB), `/api/memory/search?q=coffee&projectId=${projectB}`);
  assert.equal(projectApiUrl('/api/memory/search?q=coffee', projectA), `/api/memory/search?q=coffee&projectId=${projectA}`);
  assert.equal(projectApiUrl('/api/telemetry/stream', projectB), `/api/telemetry/stream?projectId=${projectB}`);
  assert.equal(projectApiUrl('/api/projects', projectB), '/api/projects');
  assert.equal(projectApiUrl(`/api/projects/${projectB}`, projectB), `/api/projects/${projectB}`);

  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (...args) => { calls.push(args); return { ok: true }; };
  try {
    await projectFetch('/api/specs/file?path=docs%2Fplan.md', projectA, { method: 'GET' });
  } finally { globalThis.fetch = originalFetch; }
  assert.deepEqual(calls[0], [`/api/specs/file?path=docs%2Fplan.md&projectId=${projectA}`, { method: 'GET' }]);
});

test('Add this project sends no browser path or body; remove addresses only the selected opaque ID', async () => {
  const calls = [];
  const response = (body) => ({ ok: true, json: async () => body });
  const added = await addCurrentProject(async (...args) => { calls.push(args); return response({ project: { id: projectA, name: 'Current checkout' } }); });
  assert.equal(added.id, projectA);
  assert.deepEqual(calls[0], ['/api/projects', { method: 'POST' }]);
  await removeRegisteredProject(projectB, async (...args) => { calls.push(args); return response({ ok: true }); });
  assert.deepEqual(calls[1], [`/api/projects/${projectB}`, { method: 'DELETE' }]);
});

test('project selector exposes accessible names, safe project names, and remove confirmation copy', async (t) => {
  const vite = await createServer({ root: webRoot, server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  t.after(() => vite.close());
  const { ProjectSelector } = await vite.ssrLoadModule('/src/components/ProjectSelector.jsx');
  const html = renderToStaticMarkup(React.createElement(ProjectSelector, {
    projects: projects.projects,
    selectedProjectId: projectB,
    notice: { type: 'status', text: 'The saved project is no longer available. Showing the current project instead.' },
    onSelect() {}, onAdd() {}, onRemove() {},
  }));
  assert.match(html, /aria-label="Project"/);
  assert.match(html, /Add this project/);
  assert.match(html, /Remove selected project/);
  assert.match(html, /Current checkout/);
  assert.match(html, /Other checkout/);
  assert.match(html, /role="status"/);
  assert.match(fs.readFileSync(path.join(webRoot, 'src/App.jsx'), 'utf8'), /Remove only this project[’']s registry entry\? Project files and settings will remain untouched\./);
  assert.match(fs.readFileSync(path.join(webRoot, 'src/style.css'), 'utf8'), /@media \(max-width: 560px\)[\s\S]*project-picker-field select/);
  assert.doesNotMatch(html, /\/home\//);
  assert.doesNotMatch(html, /<option[^>]*>[^<]*prj_/);

  const implicitHtml = renderToStaticMarkup(React.createElement(ProjectSelector, {
    projects: projects.projects,
    selectedProjectId: projectA,
    onSelect() {}, onAdd() {}, onRemove() {},
  }));
  assert.match(implicitHtml, /<button[^>]*>Add this project<\/button>/);
  assert.doesNotMatch(implicitHtml, /<button[^>]*disabled=""[^>]*>Add this project<\/button>/);
  assert.match(implicitHtml, /<button[^>]*disabled=""[^>]*>Remove selected project<\/button>/);
  assert.doesNotMatch(html, /<button[^>]*disabled=""[^>]*>Remove selected project<\/button>/);
});

test('dashboard binds every polling/live stream and remounts project state on selection changes', () => {
  const read = (file) => fs.readFileSync(path.join(webRoot, file), 'utf8');
  const polling = read('src/hooks/usePoll.js');
  const streaming = read('src/hooks/useLiveTick.js');
  const app = read('src/App.jsx');
  assert.match(polling, /projectApiUrl\(url, projectId\)/);
  assert.match(streaming, /new EventSource\(projectApiUrl\(url, projectId\)\)/);
  assert.match(app, /<ProjectDashboard\s+key=\{selectedProjectId\}/);
  assert.match(app, /The saved project is no longer available\. Showing the current project instead\./);
  const sourceFiles = fs.readdirSync(path.join(webRoot, 'src/components')).filter((name) => /\.(jsx|js)$/.test(name));
  for (const name of sourceFiles) {
    const source = read(`src/components/${name}`);
    assert.doesNotMatch(source, /fetch\(\s*['"`]\/api\/(?!projects(?:\/|['"`]))/, `${name} must use the project-aware request path`);
  }
});
