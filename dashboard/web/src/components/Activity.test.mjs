import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import test from 'node:test';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const render = (element) => renderToStaticMarkup(element);

test('Activity foregrounds the selected root and stacks supporting evidence without card symmetry', async (t) => {
  const vite = await createServer({ root: webRoot, server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  t.after(() => vite.close());
  const { Activity, activitySessionIDs, latestAdvisorForRoot, rootSessionFrom } = await vite.ssrLoadModule('/src/components/Activity.jsx');
  const { filterInjectionsForSession } = await vite.ssrLoadModule('/src/components/MemoryInjections.jsx');
  const summary = { runs: [
    { sessionID: 'advisor-child', parentSessionID: 'root-1', start: 200, status: 'busy', toolCalls: 1, tokens: 2, errors: 0 },
    { sessionID: 'root-1', start: 100, end: 175, status: 'created', durationMs: 75, toolCalls: 3, tokens: 40, errors: 0 },
    { sessionID: 'root-0', start: 50, end: 90, status: 'idle', toolCalls: 1, tokens: 10, errors: 0 },
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
  assert.equal(latestAdvisorForRoot([{ parentSessionID: 'another-root', status: 'completed' }], rootSessionFrom(summary)), null);
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

  const html = render(React.createElement(Activity, { summary, workflow: { state: 'coding', activeTask: 'Update dashboard' } }));
  assert.match(html, /aria-label="Activity"/);
  assert.match(html, /Current session/);
  assert.match(html, /root-1/);
  assert.match(html, /Last seen/);
  assert.match(html, /workflow phase/);
  assert.match(html, /Update dashboard/);
  assert.match(html, /tool calls/);
  assert.match(html, /tokens/);
  assert.match(html, /errors/);
  assert.match(html, /Advisor/);
  assert.match(html, /Advisor history/);
  assert.match(html, /Workflow state machine/);
  assert.match(html, /Recent activity/);
  assert.match(html, /Memory evidence/);
  assert.match(html, /Loading Advisor telemetry/);
  assert.match(html, /Loading root-session activity/);
  assert.match(html, /loading memory history/);
  assert.doesNotMatch(html, /advisor-child|root-0/);
  assert.doesNotMatch(html, /Observed as running/);
  assert.ok(html.indexOf('Current session') < html.indexOf('Advisor'));
  assert.ok(html.indexOf('Advisor') < html.indexOf('Workflow state machine'));

  const busyHtml = render(React.createElement(Activity, {
    summary: { runs: [{ sessionID: 'running-root', start: 100, end: 125, status: 'busy', toolCalls: 1, tokens: 2, errors: 0 }] },
    workflow: { state: 'building', activeTask: 'Run check' },
  }));
  assert.match(busyHtml, /RUNNING/);
  assert.match(busyHtml, /Observed as running · last seen/);
  assert.match(busyHtml, /running-root/);

  const noRoot = render(React.createElement(Activity, { summary: { runs: [] }, workflow: { engine: 'not-found' } }));
  assert.match(noRoot, /No root session telemetry observed yet/);
  assert.match(noRoot, /No root session is available to match injected memories/);
  assert.match(noRoot, /WAITING/);
  assert.doesNotMatch(noRoot, /memory-injection-layout/);

  const css = fs.readFileSync(path.join(webRoot, 'src/style.css'), 'utf8');
  assert.match(css, /\.activity-primary\s*\{[^}]*grid-template-columns: minmax\(0, 1\.65fr\) minmax\(16rem, 0\.85fr\)/s);
  assert.match(css, /\.activity-evidence\s*\{[^}]*grid-template-columns: minmax\(0, 1\.45fr\) minmax\(0, 0\.9fr\)/s);
  assert.match(css, /@media \(max-width: 700px\)\s*\{\s*\.activity-primary,\s*\.activity-evidence\s*\{\s*grid-template-columns: minmax\(0, 1fr\)/s);
  assert.match(css, /@media \(max-width: 375px\)\s*\{\s*\.activity-event-list li/);
  assert.doesNotMatch(css, /\.activity-workareas/);
  assert.doesNotMatch(css, /\.activity-area\s*\{[^}]*border: 1px solid/s);
});

test('recent root events have explicit loading, error, empty, and safe-data states', async (t) => {
  const vite = await createServer({ root: webRoot, server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  t.after(() => vite.close());
  const { RecentActivity } = await vite.ssrLoadModule('/src/components/Activity.jsx');

  assert.match(render(React.createElement(RecentActivity, { state: { data: null, error: null } })), /role="status">Loading root-session activity/);
  const error = render(React.createElement(RecentActivity, { state: { data: null, error: 'PRIVATE_ERROR_DETAIL' } }));
  assert.match(error, /role="alert">Unable to load root-session events/);
  assert.doesNotMatch(error, /PRIVATE_ERROR_DETAIL/);
  assert.match(render(React.createElement(RecentActivity, { state: { data: { events: [] }, error: null } })), /No recent tool or session events for this root session/);

  const events = render(React.createElement(RecentActivity, { state: { error: null, data: { events: [
    { ts: 1, type: 'tool', tool: 'read', ok: true, error: 'PRIVATE_TOOL_ERROR', credential: 'PRIVATE_CREDENTIAL' },
    { ts: 2, type: 'session', status: 'busy', prompt: 'PRIVATE_PROMPT' },
    { ts: 3, type: 'advisor-execution', status: 'error', error: 'PRIVATE_ADVISOR_ERROR', output: 'PRIVATE_OUTPUT' },
    { ts: 4, type: 'memory-injected', privateText: 'PRIVATE_MEMORY_TEXT' },
    { ts: 5, type: 'tool', tool: 'write', ok: false, error: 'PRIVATE_TOOL_ERROR' },
  ] } } }));
  assert.match(events, /read/);
  assert.match(events, /write/);
  assert.match(events, /activity-status--error/);
  assert.match(events, /activity-status--running/);
  assert.ok(events.indexOf('write') < events.indexOf('read'));
  assert.doesNotMatch(events, /advisor-execution|memory-injected|PRIVATE_/);
});

test('Advisor area keeps parent-scoped reason, configured/observed comparison, and safe status states', async (t) => {
  const vite = await createServer({ root: webRoot, server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  t.after(() => vite.close());
  const { AdvisorPanel } = await vite.ssrLoadModule('/src/components/Activity.jsx');
  const base = { configured: {}, onShowHistory() {} };

  const notCalled = render(React.createElement(AdvisorPanel, {
    ...base,
    configured: { provider: 'openai', model: 'configured-model' },
    latestAdvisor: null,
    advisorStatus: 'not-called',
    history: { data: { history: [] } },
  }));
  assert.match(notCalled, /Reason not recorded/);
  assert.match(notCalled, /openai \/ configured-model/);
  assert.match(notCalled, /Advisor has not been called in this root session/);
  assert.match(notCalled, /Advisor history/);
  assert.doesNotMatch(notCalled, /matches configured|differs from configured/);

  const observed = render(React.createElement(AdvisorPanel, {
    ...base,
    advisorStatus: 'completed',
    latestAdvisor: { status: 'completed', reason: 'Compare failed retry options', providerID: 'openai', modelID: 'gpt-observed', variant: 'high', ts: 123 },
    configured: { provider: 'openai', model: 'gpt-configured', variant: 'low' },
    history: { data: { history: [] } },
  }));
  assert.match(observed, /Compare failed retry options/);
  assert.match(observed, /openai \/ gpt-configured \/ low/);
  assert.match(observed, /openai \/ gpt-observed \/ high/);
  assert.match(observed, /provider: matches configured/);
  assert.match(observed, /model: differs from configured/);
  assert.match(observed, /variant: differs from configured/);

  const reasonless = render(React.createElement(AdvisorPanel, {
    ...base, latestAdvisor: { status: 'dispatched' }, advisorStatus: 'dispatched', history: { data: { history: [] } },
  }));
  assert.match(reasonless, /Reason not recorded/);
  assert.match(reasonless, /Advisor dispatched; completion not observed/);
  const running = render(React.createElement(AdvisorPanel, {
    ...base, latestAdvisor: { status: 'running' }, advisorStatus: 'running', history: { data: { history: [] } },
  }));
  assert.match(running, /Advisor running based on observed session status/);
  assert.match(render(React.createElement(AdvisorPanel, {
    ...base, latestAdvisor: null, advisorStatus: 'loading', history: { data: null, error: null },
  })), /Loading Advisor telemetry/);
  const unavailable = render(React.createElement(AdvisorPanel, {
    ...base, latestAdvisor: null, advisorStatus: 'unavailable', history: { data: null, error: 'PRIVATE_HISTORY_ERROR' },
  }));
  assert.match(unavailable, /role="alert">Advisor telemetry unavailable/);
  assert.doesNotMatch(unavailable, /PRIVATE_HISTORY_ERROR/);
});

test('Advisor history modal exposes safe metadata and retains Escape/focus behavior', async (t) => {
  const vite = await createServer({ root: webRoot, server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  t.after(() => vite.close());
  const { AdvisorHistoryModal } = await vite.ssrLoadModule('/src/components/AdvisorHistoryModal.jsx');
  const html = render(React.createElement(AdvisorHistoryModal, {
    state: { data: { history: [
      { ts: 100, status: 'completed', callID: 'call-1', parentSessionID: 'root', childSessionID: 'child', providerID: 'openai', modelID: 'gpt', variant: 'high', reason: 'Compare failed retry options', prompt: 'PRIVATE_PROMPT', output: 'PRIVATE_OUTPUT', error: 'PRIVATE_TOOL_ERROR', credential: 'PRIVATE_CREDENTIAL' },
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
  assert.doesNotMatch(html, /PRIVATE_|prompt|credential|output/i);

  assert.match(render(React.createElement(AdvisorHistoryModal, { state: { data: { history: [] } }, onClose() {} })), /No Advisor calls observed/);
  assert.match(render(React.createElement(AdvisorHistoryModal, { state: { data: null, error: null }, onClose() {} })), /Loading Advisor history/);
  const failed = render(React.createElement(AdvisorHistoryModal, { state: { data: null, error: 'PRIVATE_MODAL_ERROR' }, onClose() {} }));
  assert.match(failed, /role="alert">Unable to load Advisor history/);
  assert.doesNotMatch(failed, /PRIVATE_MODAL_ERROR/);

  const source = fs.readFileSync(path.join(webRoot, 'src/components/AdvisorHistoryModal.jsx'), 'utf8');
  assert.match(source, /event\.key === 'Escape'/);
  assert.match(source, /event\.shiftKey/);
  assert.match(source, /previous\?\.focus\?\./);
  assert.match(html, /type="button" class="modal-close"/);
});
