import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { after, before, test } from 'node:test';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
let vite;
let OperationPulse;
let projectOperationPulse;

before(async () => {
  vite = await createServer({
    root: webRoot,
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  ({ OperationPulse, projectOperationPulse } = await vite.ssrLoadModule('/src/components/OperationPulse.jsx'));
});

after(async () => vite?.close());

const render = (props) => renderToStaticMarkup(React.createElement(OperationPulse, props));

test('pulse aggregates observed and active sessions with recorded error counts', () => {
  const summary = { runs: [
    { sessionID: 'private-root', status: 'running', errors: 2 },
    { sessionID: 'private-child', parentSessionID: 'private-root', status: 'busy', errors: 1 },
    { sessionID: 'private-old', status: 'completed', errors: 0 },
    { sessionID: 'private-unknown', status: 'failed', errors: '99' },
  ] };
  assert.deepEqual(projectOperationPulse(summary, []), {
    observedSessions: 4,
    activeSessions: 2,
    errorSignals: 3,
    signals: [],
  });

  const html = render({ summary, events: [], summaryError: null, summaryLoading: false });
  assert.match(html, /<dt>Observed<\/dt><dd>4<\/dd>/);
  assert.match(html, /<dt>Active<\/dt><dd>2<\/dd>/);
  assert.match(html, /<dt>Error signals<\/dt><dd>3<\/dd>/);
});

test('recent signal projection uses fixed labels and excludes private telemetry fields', () => {
  const events = [
    {
      ts: 1000, type: 'tool', tool: 'private-unallowlisted-tool', ok: false, status: 'error',
      sessionID: 'PRIVATE_SESSION_ID', parentSessionID: 'PRIVATE_PARENT_ID',
      payload: 'PRIVATE_PAYLOAD', error: 'PRIVATE_ERROR', prompt: 'PRIVATE_PROMPT',
      output: 'PRIVATE_OUTPUT', tokens: 'PRIVATE_TOKENS',
    },
    { ts: 2000, type: 'workflow', task: 'PRIVATE_TASK', raw: 'PRIVATE_RAW' },
    { ts: 3000, type: 'memory-error', error: 'PRIVATE_MEMORY_ERROR' },
    { ts: 4000, type: 'unknown-private-event', error: 'PRIVATE_UNKNOWN_ERROR' },
    { ts: 4500, type: 'toString', error: 'PRIVATE_PROTOTYPE_EVENT' },
    { ts: '5000', type: 'session', status: 'running' },
  ];
  const projection = projectOperationPulse({ runs: [] }, events);
  assert.deepEqual(projection.signals, [
    { label: 'Memory error', timestamp: 3000, error: true },
    { label: 'Workflow', timestamp: 2000, error: false },
    { label: 'Tool call', timestamp: 1000, error: true },
  ]);

  const html = render({ summary: { runs: [] }, events, summaryLoading: false });
  for (const label of ['Memory error', 'Workflow', 'Tool call', 'error signal']) assert.match(html, new RegExp(label));
  assert.match(html, /dateTime="1970-01-01T00:00:03\.000Z"/);
  for (const sentinel of [
    'PRIVATE_SESSION_ID', 'PRIVATE_PARENT_ID', 'private-unallowlisted-tool', 'PRIVATE_PAYLOAD',
    'PRIVATE_ERROR', 'PRIVATE_PROMPT', 'PRIVATE_OUTPUT', 'PRIVATE_TOKENS', 'PRIVATE_TASK',
    'PRIVATE_RAW', 'PRIVATE_MEMORY_ERROR', 'PRIVATE_UNKNOWN_ERROR', 'unknown-private-event',
    'PRIVATE_PROTOTYPE_EVENT', 'toString',
  ]) {
    assert.doesNotMatch(html, new RegExp(sentinel));
  }
});

test('pulse distinguishes loading, unavailable, and empty telemetry states', () => {
  const loading = render({ summary: null, events: [], summaryLoading: true, eventsLoading: false });
  assert.match(loading, /role="status">Loading session summary…/);
  assert.match(loading, /Waiting for session telemetry…/);

  const failed = render({
    summary: null,
    summaryError: 'PRIVATE_SUMMARY_ERROR',
    events: [],
    eventsError: 'PRIVATE_EVENT_ERROR',
  });
  assert.match(failed, /role="alert">Session summary unavailable\./);
  assert.match(failed, /Recent signals unavailable\./);
  assert.doesNotMatch(failed, /PRIVATE_(SUMMARY|EVENT)_ERROR/);

  const eventFailure = render({
    summary: { runs: [] }, events: [], summaryLoading: false, eventsError: 'PRIVATE_EVENT_ERROR',
  });
  assert.match(eventFailure, /role="alert">Recent signals unavailable\./);
  assert.doesNotMatch(eventFailure, /PRIVATE_EVENT_ERROR/);

  const eventLoading = render({
    summary: { runs: [] }, events: [], summaryLoading: false, eventsLoading: true,
  });
  assert.match(eventLoading, /role="status">Loading recent signals…/);

  const empty = render({ summary: { runs: [] }, events: [], summaryLoading: false });
  assert.match(empty, /<dt>Observed<\/dt><dd>0<\/dd>/);
  assert.match(empty, /No observed sessions; 0 active of 0 observed sessions/);
  assert.match(empty, /No recent signals observed\./);
  assert.doesNotMatch(empty, /Loading/);
});

test('active-vs-total visual exposes an accessible meter without a fabricated percentage', () => {
  const html = render({
    summary: { runs: [
      { status: 'running', errors: 0 },
      { status: 'completed', errors: 0 },
    ] },
    events: [],
    summaryLoading: false,
  });
  assert.match(html, /role="meter" aria-label="Active sessions among observed sessions" aria-valuemin="0" aria-valuemax="2" aria-valuenow="1" aria-valuetext="1 active of 2 observed sessions"/);
  assert.match(html, /role="group" aria-label="Session aggregates"/);
  assert.match(html, /role="group" aria-label="Latest telemetry signals"/);
  assert.match(html, /class="operation-pulse-meter-fill" style="width:50%"/);
  assert.doesNotMatch(html, />\s*50%\s*</);

  const css = fs.readFileSync(path.join(webRoot, 'src/style.css'), 'utf8');
  assert.match(css, /\.operation-pulse-content\s*\{[^}]*min-width:\s*0/s);
  assert.match(css, /\.operation-pulse-list li\s*\{[^}]*min-width:\s*0/s);
  assert.match(css, /overflow-wrap:\s*anywhere/);
});
