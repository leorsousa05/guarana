import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import test from 'node:test';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sectionLabels = (html) => [...html.matchAll(/<section\b[^>]*aria-label="([^"]+)"/g)].map((match) => match[1]);

test('Overview keeps current work focal and renders all supporting ledger data accessibly', async (t) => {
  const vite = await createServer({ root: webRoot, server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  t.after(() => vite.close());
  const { OverviewContent } = await vite.ssrLoadModule('/src/components/Overview.jsx');
  const html = renderToStaticMarkup(React.createElement(OverviewContent, {
    summary: { runs: [
      { sessionID: 'run-one', durationMs: 1000, toolCalls: 4, errors: 1, tokens: 100 },
      { sessionID: 'run-two', durationMs: 2000, toolCalls: 3, errors: 0, tokens: 50 },
      { sessionID: 'run-three', durationMs: 3000, toolCalls: 2, errors: 0, tokens: 25 },
      { sessionID: 'run-four', durationMs: 4000, toolCalls: 1, errors: 2, tokens: 25 },
    ] },
    state: { projectState: '' },
    workflow: { state: 'coding', skill: 'code', activeTask: 'Implement dashboard overview', goal: '# Make current work clear\n\nPrioritize **active evidence**.' },
    memory: { data: { nodes: { total: 14, confirmed: 11 }, supernodes: 2, edges: 24 } },
    decisions: { data: { decisions: [{ statement: 'Keep the Overview in the dashboard bundle.' }] } },
    tracker: {
      BLOCKED: ['**Waiting** for integration review.'],
      NEXT: ['Check the run summary.'],
      DONE: ['Record the `overview` handoff.'],
    },
  }));

  assert.match(html, /aria-label="Overview"/);
  assert.deepEqual(sectionLabels(html), ['Workflow', 'Runs', 'Memory', 'Decisions', 'Roadmap']);
  assert.match(html, /Current workflow/);
  assert.match(html, /CODING/);
  assert.match(html, /Open goal:/);
  assert.match(html, /<h1>Make current work clear<\/h1>/);
  assert.match(html, /active evidence/);
  assert.match(html, /guarana:code/);
  assert.match(html, /Implement dashboard overview/);
  assert.match(html, /10 tool calls/);
  assert.match(html, /200 tokens/);
  assert.match(html, /30\.0% errors/);
  assert.match(html, /run-one/);
  assert.match(html, /run-three/);
  assert.doesNotMatch(html, /run-four/);
  assert.match(html, /14/);
  assert.match(html, /11/);
  assert.match(html, /supernodes/);
  assert.match(html, /24/);
  assert.match(html, /Keep the Overview in the dashboard bundle\./);
  assert.match(html, /BLOCKED/);
  assert.match(html, /NEXT/);
  assert.match(html, /DONE/);
  assert.match(html, /Waiting/);
  assert.match(html, /Check the run summary\./);
  assert.match(html, /Record the <code>overview<\/code> handoff\./);
});

test('Overview preserves empty and loading states while keeping all sections available', async (t) => {
  const vite = await createServer({ root: webRoot, server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  t.after(() => vite.close());
  const { OverviewContent } = await vite.ssrLoadModule('/src/components/Overview.jsx');
  const loadingHtml = renderToStaticMarkup(React.createElement(OverviewContent, {
    summary: { runs: [] }, state: { projectState: '' }, tracker: null, workflow: null,
    memory: null, decisions: { data: { decisions: [] } },
  }));

  assert.deepEqual(sectionLabels(loadingHtml), ['Workflow', 'Runs', 'Memory', 'Decisions', 'Roadmap']);
  assert.match(loadingHtml, /System of record — no active goal recorded\./);
  assert.match(loadingHtml, /No telemetry yet\. Install the plugin:/);
  assert.match(loadingHtml, /<code>guarana plugin install --project<\/code>/);
  assert.match(loadingHtml, /All decisions resolved\./);
  assert.equal((loadingHtml.match(/role="status"/g) || []).length, 2);
  assert.equal((loadingHtml.match(/loading…/g) || []).length, 2);

  const emptyRoadmapHtml = renderToStaticMarkup(React.createElement(OverviewContent, {
    summary: { runs: [] }, state: null, tracker: { BLOCKED: [], NEXT: [], DONE: [] }, workflow: null,
    memory: { data: { nodes: {}, edges: 0 } }, decisions: { data: { decisions: [] } },
  }));
  assert.deepEqual(sectionLabels(emptyRoadmapHtml), ['Workflow', 'Runs', 'Memory', 'Decisions', 'Roadmap']);
  assert.match(emptyRoadmapHtml, /No roadmap flags recorded\./);
  assert.doesNotMatch(emptyRoadmapHtml, /loading…/);

  const stateGoalHtml = renderToStaticMarkup(React.createElement(OverviewContent, {
    summary: { runs: [] }, state: { projectState: '- Goal: Recover the project-state goal.\n- Pending writes: none' },
    tracker: { BLOCKED: [], NEXT: [], DONE: [] }, workflow: null,
    memory: { data: {} }, decisions: { data: { decisions: [] } },
  }));
  assert.match(stateGoalHtml, /Recover the project-state goal\./);
});
