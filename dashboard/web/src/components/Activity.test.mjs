import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import test from 'node:test';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('Activity selects the active root and keeps the two ledger work areas square and responsive', async (t) => {
  const vite = await createServer({ root: webRoot, server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  t.after(() => vite.close());
  const { Activity, AdvisorSquare, activitySessionIDs, latestAdvisorForRoot, rootSessionFrom } = await vite.ssrLoadModule('/src/components/Activity.jsx');
  const { filterInjectionsForSession } = await vite.ssrLoadModule('/src/components/MemoryInjections.jsx');
  const summary = { runs: [
    { sessionID: 'advisor-child', parentSessionID: 'root-1', start: 200, status: 'busy', toolCalls: 1, tokens: 2, errors: 0 },
    { sessionID: 'root-1', start: 100, status: 'created', durationMs: 25, toolCalls: 3, tokens: 40, errors: 0 },
    { sessionID: 'root-0', start: 50, toolCalls: 1, tokens: 10, errors: 0 },
  ] };
  assert.equal(rootSessionFrom(summary).sessionID, 'root-1');
  assert.equal(rootSessionFrom({ runs: [{ sessionID: 'only-child', parentSessionID: 'root' }] }), null);
  assert.equal(rootSessionFrom({ runs: [
    { sessionID: 'new-helper', start: 900, end: 950, status: 'idle' },
    { sessionID: 'older-active-root', start: 100, end: 150, status: 'busy' },
    { sessionID: 'newer-helper', start: 1000, end: 1050, status: 'idle' },
  ] }).sessionID, 'older-active-root');
  assert.equal(rootSessionFrom({ runs: [
    { sessionID: 'newer-start', start: 900, end: 950, status: 'idle' },
    { sessionID: 'latest-end', start: 100, end: 1000, status: 'idle' },
  ] }).sessionID, 'latest-end');
  assert.equal(latestAdvisorForRoot([
    { parentSessionID: 'another-root', status: 'completed' },
    { parentSessionID: 'root-1', status: 'running' },
  ], rootSessionFrom(summary)).status, 'running');
  assert.equal(latestAdvisorForRoot([
    { parentSessionID: 'another-root', status: 'completed' },
  ], rootSessionFrom(summary)), null);
  assert.deepEqual(activitySessionIDs({ runs: [
    { sessionID: 'child-0', parentSessionID: 'root' },
    { sessionID: 'child-1', parentSessionID: 'root' },
    { sessionID: 'child-2', parentSessionID: 'root' },
    { sessionID: 'child-3', parentSessionID: 'root' },
    { sessionID: 'child-4', parentSessionID: 'root' },
    { sessionID: 'root' },
  ] }), ['root', 'child-0', 'child-1', 'child-2', 'child-3', 'child-4']);
  assert.deepEqual(filterInjectionsForSession([
    { id: 'root-injection', sessionID: 'root-1' },
    { id: 'child-injection', sessionID: 'advisor-child' },
  ], 'root-1').map((entry) => entry.id), ['root-injection']);
  const html = renderToStaticMarkup(React.createElement(Activity, { summary, workflow: { state: 'coding', activeTask: 'Update dashboard' } }));
  assert.match(html, /aria-label="Activity"/);
  assert.match(html, /Current session/);
  assert.match(html, /Advisor/);
  assert.match(html, /Reason not recorded/);
  assert.match(html, /root-1/);
  assert.match(html, /Last seen/);
  assert.doesNotMatch(html, /Observed as running/);
  assert.doesNotMatch(html, /advisor-child|root-0/);
  assert.match(html, /workflow phase/);
  assert.match(html, /Update dashboard/);
  assert.match(html, /Advisor history/);
  assert.match(html, /class="activity-workareas"/);
  const advisorSquare = renderToStaticMarkup(React.createElement(AdvisorSquare, {
    latestAdvisor: { status: 'completed', reason: 'Compare failed retry options' },
    advisorStatus: 'completed', configured: {}, history: { data: { history: [] } }, onShowHistory() {},
  }));
  assert.match(advisorSquare, /Why Advisor was called/);
  assert.match(advisorSquare, /Compare failed retry options/);
  const missingReasonSquare = renderToStaticMarkup(React.createElement(AdvisorSquare, {
    latestAdvisor: { status: 'completed' },
    advisorStatus: 'completed', configured: {}, history: { data: { history: [] } }, onShowHistory() {},
  }));
  assert.match(missingReasonSquare, /Reason not recorded/);
  const css = fs.readFileSync(path.join(webRoot, 'src/style.css'), 'utf8');
  assert.match(css, /\.activity-workareas\s*\{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/s);
  assert.match(css, /@media \(max-width: 700px\)\s*\{\s*\.activity-workareas\s*\{\s*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(css, /\.activity-area\s*\{[^}]*border: 1px solid var\(--ink\)/s);
});

test('Advisor history modal exposes only safe metadata and implements dialog focus behavior', async (t) => {
  const vite = await createServer({ root: webRoot, server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  t.after(() => vite.close());
  const { AdvisorHistoryModal } = await vite.ssrLoadModule('/src/components/AdvisorHistoryModal.jsx');
  const html = renderToStaticMarkup(React.createElement(AdvisorHistoryModal, {
    state: { data: { history: [
      { ts: 100, status: 'completed', callID: 'call-1', parentSessionID: 'root', childSessionID: 'child', providerID: 'openai', modelID: 'gpt', variant: 'high', reason: 'Compare failed retry options', prompt: 'SECRET', output: 'SECRET', error: 'SECRET', credential: 'SECRET' },
      { ts: 90, status: 'error', callID: 'call-2' },
    ] } },
    onClose() {},
  }));
  assert.match(html, /role="dialog"/);
  assert.match(html, /aria-modal="true"/);
  assert.match(html, /Advisor history/);
  assert.match(html, /child/);
  assert.match(html, /openai \/ gpt \/ high/);
  assert.match(html, /Why Advisor was called/);
  assert.match(html, /Compare failed retry options/);
  assert.match(html, /Reason not recorded/);
  assert.doesNotMatch(html, /SECRET|prompt|credential|output/i);
  const source = fs.readFileSync(path.join(webRoot, 'src/components/AdvisorHistoryModal.jsx'), 'utf8');
  assert.match(source, /event\.key === 'Escape'/);
  assert.match(source, /event\.shiftKey/);
  assert.match(source, /previous\?\.focus\?\./);
  assert.match(html, /type="button" class="modal-close"/);
});
