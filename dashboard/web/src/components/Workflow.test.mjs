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
const STATES = ['idle', 'planning', 'building', 'coding', 'verifying', 'debugging', 'completed'];
const LABELS = ['Idle', 'Planning', 'Building', 'Coding', 'Verifying', 'Debugging', 'Completed'];
const mediaBlock = (source, query) => {
  const at = source.indexOf(`@media (${query})`);
  assert.notEqual(at, -1, `has ${query} media rule`);
  const open = source.indexOf('{', at);
  let depth = 1;
  for (let i = open + 1; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}' && --depth === 0) return source.slice(open + 1, i);
  }
  assert.fail(`unclosed ${query} media rule`);
};

test('Workflow SSR preserves phase semantics, selected transition evidence, task metadata, and responsive folio layout', async (t) => {
  const vite = await createServer({ root: webRoot, server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  t.after(() => vite.close());
  const { Workflow } = await vite.ssrLoadModule('/src/components/Workflow.jsx');
  const renderWorkflow = (data) => render(React.createElement(Workflow, { data }));

  for (const [index, state] of STATES.entries()) {
    const html = renderWorkflow({ state, engine: 'ok' });
    assert.match(html, /<ol class="wf-strip" aria-label="Workflow phases">/);
    assert.deepEqual([...html.matchAll(/class="wf-node-label">([^<]*)<\/span>/g)].map(([, label]) => label), LABELS);
    const currentButton = html.match(/<button(?=[^>]*aria-current="step")([^>]*)>(.*?)<\/button>/s);
    assert.ok(currentButton, `${state} has an aria-current step`);
    assert.match(currentButton[1], /aria-pressed="true"/);
    assert.match(currentButton[2], new RegExp(`class="wf-node-label">${LABELS[index]}</span>`));
    assert.match(html, new RegExp(`class="wf-current-phase"><p class="wf-current-label">Current phase</p><h3>${LABELS[index]}</h3>`));
  }

  const fixture = {
    state: 'coding', engine: 'ok', activeTask: 'Redesign the Workflow folio', skill: 'code',
    goal: 'Make the current task and phase easy to scan', condition: 'Focused Workflow test and dashboard build pass', updatedAt: 1700000000000,
    history: [
      { ts: 100, event: 'new_task', from: 'idle', to: 'planning', note: 'Unrelated transition' },
      { ts: 200, event: 'run_start', from: 'building', to: 'coding', note: 'Implementation began' },
      { ts: 300, event: 'code_complete', from: 'coding', to: 'verifying', note: 'Build is ready' },
      { ts: 400, event: 'verify_pass', from: 'verifying', to: 'completed', note: 'Unrelated later transition' },
    ],
  };
  const html = renderWorkflow(fixture);
  for (const field of [fixture.activeTask, 'guarana:code', fixture.goal, fixture.condition, fmtTs(fixture.updatedAt)]) {
    assert.ok(html.includes(field), `renders ${field}`);
  }
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /aria-pressed="false"/);
  assert.match(html, /aria-live="polite"/);
  for (const transition of ['plan_complete', 'run_start', 'code_complete', 'verify_pass', 'debug_complete']) {
    assert.ok(html.includes(transition), `phase path includes ${transition}`);
  }
  assert.match(html, /wf-node-status--passed">Passed/);
  assert.match(html, /wf-node-status--current">Current/);
  assert.match(html, /wf-node-status--upcoming">Upcoming/);
  assert.match(html, /Transitions · Coding/);
  assert.match(html, /class="wf-h-from">building<\/span><span aria-hidden="true">→<\/span><span class="wf-h-to">coding<\/span>/);
  assert.match(html, /run_start/);
  assert.match(html, /Implementation began/);
  assert.match(html, /code_complete/);
  assert.match(html, /Build is ready/);
  assert.doesNotMatch(html, /Unrelated transition|Unrelated later transition/);
  const historyMarkup = html.slice(html.indexOf('Transitions · Coding'));
  assert.ok(historyMarkup.indexOf('code_complete') < historyMarkup.indexOf('run_start'), 'related transition history is newest first');

  const noEngine = renderWorkflow({ state: 'idle', engine: 'not-found' });
  assert.match(noEngine, /Orchestrator core not deployed/);
  assert.match(noEngine, /guarana plugin install --project/);
  assert.doesNotMatch(noEngine, /wf-strip|Task details/);

  const css = fs.readFileSync(path.join(webRoot, 'src/style.css'), 'utf8');
  const workflowCss = css.slice(css.indexOf('/* ---------- workflow state machine ----------'), css.indexOf('/* ---------- overview / home ----------'));
  assert.match(workflowCss, /\.wf-strip\s*\{[^}]*grid-template-columns:\s*repeat\(7,\s*minmax\(0,\s*1fr\)\)/s);
  assert.match(workflowCss, /\.wf-evidence\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1\.45fr\)\s+minmax\(0,\s*0\.85fr\)/s);
  assert.match(mediaBlock(workflowCss, 'max-width: 700px'), /\.wf-evidence\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\)/s);
  const mobile = mediaBlock(workflowCss, 'max-width: 480px');
  assert.match(mobile, /\.wf-current\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\)/s);
  assert.match(mobile, /\.wf-strip\s*\{\s*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s);
  assert.match(workflowCss, /\.workflow\s*\{\s*min-width:\s*0/s);
  assert.match(workflowCss, /\.wf-current-task\s*\{[^}]*overflow-wrap:\s*anywhere/s);
  assert.match(workflowCss, /\.wf-h-note\s*\{[^}]*overflow-wrap:\s*anywhere/s);
  assert.match(workflowCss, /\.wf-node-button:focus-visible\s*\{[^}]*outline:\s*2px/s);
  assert.match(mediaBlock(workflowCss, 'prefers-reduced-motion: reduce'), /\.workflow/s);
});
