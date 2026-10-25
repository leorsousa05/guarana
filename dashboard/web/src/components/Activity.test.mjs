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

test('Activity presents a live execution workbench with compact supporting signals', async (t) => {
  const vite = await createServer({ root: webRoot, server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  t.after(() => vite.close());
  const { Activity, activitySessionIDs, buildSessionTree, latestAdvisorForRoot, rootSessionFrom } = await vite.ssrLoadModule('/src/components/Activity.jsx');
  const { filterInjectionsForSession } = await vite.ssrLoadModule('/src/components/MemoryInjections.jsx');
  const summary = { runs: [
    { sessionID: 'advisor-child', parentSessionID: 'root-1', start: 200, status: 'busy', toolCalls: 1, tokens: 2, errors: 0 },
    { sessionID: 'old-child', parentSessionID: 'root-1', start: 150, end: 175, status: 'completed', statusTs: 175, toolCalls: 1, tokens: 2, errors: 0 },
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
  const tree = buildSessionTree([
    { sessionID: 'old-root', start: 1, status: 'idle' },
    { sessionID: 'busy-root', start: 2, status: 'idle' },
    { sessionID: 'busy-child', parentSessionID: 'busy-root', start: 3, status: 'running' },
  ]);
  assert.equal(tree[0].run.sessionID, 'busy-root');
  assert.equal(tree[0].children[0].run.sessionID, 'busy-child');
  assert.deepEqual(filterInjectionsForSession([
    { id: 'root-injection', sessionID: 'root-1' },
    { id: 'child-injection', sessionID: 'advisor-child' },
  ], 'root-1').map((entry) => entry.id), ['root-injection']);

  const html = render(React.createElement(Activity, { summary, workflow: { state: 'coding', activeTask: 'Update dashboard' } }));
  assert.match(html, /aria-label="Activity"/);
  assert.match(html, /running subagents/);
  assert.match(html, /Agent sessions/);
  assert.match(html, /Selected session/);
  assert.match(html, /Aggregates · observed/);
  assert.match(html, /activity-agent-list/);
  assert.match(html, /advisor-child/);
  assert.match(html, /Completed history · 1/);
  assert.match(html, /aria-haspopup="dialog"[^>]*aria-expanded="false"/);
  assert.doesNotMatch(html, /old-child|activity-completed-subagents/);
  assert.match(html, /activity-status--running/);
  assert.match(html, /root-1/);
  assert.match(html, /Last observed/);
  assert.match(html, /Current phase/);
  assert.doesNotMatch(html, /Update dashboard|current task/);
  assert.match(html, /tool calls/);
  assert.match(html, /tokens/);
  assert.match(html, /errors/);
  assert.match(html, /Advisor/);
  assert.match(html, /Advisor history/);
  assert.match(html, /Workflow status/);
  assert.match(html, /Recent activity/);
  assert.match(html, /Injected memory history/);
  assert.match(html, /aria-expanded="false"/);
  assert.doesNotMatch(html, /loading memory history/);
  assert.match(html, /Loading Advisor telemetry/);
  assert.match(html, /Loading live telemetry/);
  assert.doesNotMatch(html, /root-0/);
  assert.ok(html.indexOf('root-1') < html.indexOf('advisor-child'));
  assert.ok(html.slice(html.indexOf('<code>root-1</code>'), html.indexOf('<code>advisor-child</code>')).includes('</button><ul><li'));
  assert.ok(html.indexOf('Agent sessions') < html.indexOf('Selected session'));
  assert.ok(html.indexOf('Selected session') < html.indexOf('Workflow status'));
  assert.match(html, /activity-live-workbench/);
  assert.match(html, /activity-description/);

  const busyHtml = render(React.createElement(Activity, {
    summary: { runs: [{ sessionID: 'running-root', start: 100, end: 125, status: 'busy', toolCalls: 1, tokens: 2, errors: 0 }] },
    workflow: { state: 'building', activeTask: 'Run check' },
  }));
  assert.match(busyHtml, /No active subagents/);
  assert.match(busyHtml, /Agent sessions/);
  assert.doesNotMatch(busyHtml, /Selected session|running-root/);

  const noRoot = render(React.createElement(Activity, { summary: { runs: [] }, workflow: { engine: 'not-found' } }));
  assert.match(noRoot, /No active subagents/);
  assert.match(noRoot, /Agent sessions/);
  assert.doesNotMatch(noRoot, /Selected session/);
  assert.doesNotMatch(noRoot, /Completed history/);
  assert.doesNotMatch(noRoot, /memory-injection-layout/);

  const css = fs.readFileSync(path.join(webRoot, 'src/style.css'), 'utf8');
  assert.match(css, /\.activity-live-workbench\s*\{[^}]*grid-template-columns: minmax\(0, \.85fr\) minmax\(0, 1\.15fr\)/s);
  assert.match(css, /@media \(max-width: 700px\)\s*\{\s*\.activity-live-workbench,\s*\.activity-supporting\s*\{\s*grid-template-columns: minmax\(0, 1fr\)/s);
  assert.match(css, /@media \(max-width: 375px\)\s*\{[\s\S]{0,500}\.activity-event-list li/);
  assert.doesNotMatch(css, /\.activity-area\s*\{[^}]*border: 1px solid/s);
});

test('Activity keeps completed children out of the default page and exposes a count-labelled history trigger', async (t) => {
  const vite = await createServer({ root: webRoot, server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  t.after(() => vite.close());
  const { Activity } = await vite.ssrLoadModule('/src/components/Activity.jsx');
  const runs = [
    { sessionID: 'running-root', status: 'running', start: 1 },
    ...Array.from({ length: 22 }, (_, index) => ({
      sessionID: `completed-${index}`,
      parentSessionID: 'running-root',
      status: index === 21 ? 'idle' : 'completed',
      start: index + 10,
      end: index + 20,
      statusTs: index === 21 ? null : index + 20,
    })),
  ];
  const html = render(React.createElement(Activity, { summary: { runs }, workflow: {} }));
  assert.match(html, /No active subagents/);
  assert.match(html, /Agent sessions/);
  assert.doesNotMatch(html, /Selected session|running-root/);
  assert.match(html, /<button[^>]*aria-haspopup="dialog"[^>]*aria-expanded="false"[^>]*>Completed history · 22<\/button>/);
  assert.doesNotMatch(html, /completed-21|completed-2|completed-0|Completed ·|Last observed ·|activity-completed-subagents/);
  assert.doesNotMatch(html, /role="dialog"|completed-subagents-list/);
});

test('completed-subagent history is an accessible, bounded modal with selection and focus handling', async (t) => {
  const vite = await createServer({ root: webRoot, server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  t.after(() => vite.close());
  const { CompletedSubagentsModal } = await vite.ssrLoadModule('/src/components/CompletedSubagentsModal.jsx');
  const modalSource = fs.readFileSync(path.join(webRoot, 'src/components/CompletedSubagentsModal.jsx'), 'utf8');
  const activitySource = fs.readFileSync(path.join(webRoot, 'src/components/Activity.jsx'), 'utf8');
  const rows = Array.from({ length: 22 }, (_, index) => ({
    sessionID: `completed-sub-${index}`,
    agent: 'verify_worker',
    status: 'completed',
    activity: 'Tool · read_file',
    started: 'observed start',
    elapsed: 'observed duration',
    terminalTime: 'Completed · observed terminal time',
    selected: false,
  }));
  const html = render(React.createElement(CompletedSubagentsModal, {
    rows,
    totalCount: 22,
    triggerRef: { current: null },
    onSelectSession() {},
    onClose() {},
  }));

  assert.match(html, /id="completed-subagents-dialog"[^>]*role="dialog"[^>]*aria-modal="true"/);
  assert.match(html, /aria-labelledby="completed-subagents-title"/);
  assert.match(html, /aria-describedby="completed-subagents-description"/);
  assert.match(html, /Completed subagent history/);
  assert.match(html, /aria-label="Completed subagents"/);
  assert.match(html, /Showing the 20 most recently observed\./);
  assert.equal((html.match(/class="activity-agent-node"/g) || []).length, 20);
  assert.match(html, /completed-sub-19/);
  assert.doesNotMatch(html, /completed-sub-20|completed-sub-21/);
  assert.match(html, /aria-pressed="false"/);
  assert.match(html, /modal-close/);

  assert.match(activitySource, /aria-haspopup="dialog"[\s\S]*?aria-expanded=\{showCompletedHistory\}/);
  assert.match(activitySource, /onSelectSession=\{setSelectedSessionID\}/);
  assert.match(modalSource, /onSelectSession\(row\.sessionID\);\s*close\(\);/);
  assert.match(modalSource, /\.slice\(0, 20\)/);
  assert.match(modalSource, /useFocusLayoutEffect\(\(\) => \{\s*\(boxRef\.current\?\.querySelector\('\.modal-close'\) \|\| boxRef\.current\)\?\.focus\(\);/);
  assert.match(modalSource, /event\.key === 'Escape'/);
  assert.match(modalSource, /event\.key !== 'Tab'/);
  assert.match(modalSource, /event\.shiftKey/);
  assert.match(modalSource, /requestAnimationFrame\(\(\) => \{[\s\S]*trigger\.isConnected[\s\S]*trigger\.focus\(\)/);
  assert.match(modalSource, /event\.target === event\.currentTarget/);
});

test('OpenCode count is authoritative while Activity preserves telemetry details and completed history', async (t) => {
  const vite = await createServer({ root: webRoot, server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  t.after(() => vite.close());
  const { ActivityContent } = await vite.ssrLoadModule('/src/components/Activity.jsx');
  const activitySource = fs.readFileSync(path.join(webRoot, 'src/components/Activity.jsx'), 'utf8');
  assert.match(activitySource, /usePoll\('\/api\/opencode\/active-subagents', 5000, tick\)/);
  const summary = { runs: [
    { sessionID: 'root-session', status: 'running', start: 1 },
    { sessionID: 'active-child', parentSessionID: 'root-session', agent: 'worker', status: 'busy', start: 2 },
    { sessionID: 'completed-child', parentSessionID: 'root-session', agent: 'verify', status: 'completed', start: 3, end: 4, statusTs: 4 },
  ] };

  const positiveWithoutDetails = render(React.createElement(ActivityContent, {
    summary: { runs: [{ sessionID: 'root-session', status: 'running', start: 1 }] },
    workflow: {},
    openCodeState: { data: { available: true, runningCount: 2 }, error: null },
  }));
  assert.match(positiveWithoutDetails, /<strong>2<\/strong> running subagents/);
  assert.match(positiveWithoutDetails, /role="status">\s*OpenCode reports 2 active subagents; telemetry details are not available\./);
  assert.doesNotMatch(positiveWithoutDetails, /No active subagents|Selected session/);
  assert.doesNotMatch(positiveWithoutDetails, /root-session/);

  const authoritativeZero = render(React.createElement(ActivityContent, {
    summary,
    workflow: {},
    openCodeState: { data: { available: true, runningCount: 0 }, error: null },
  }));
  assert.match(authoritativeZero, /<strong>0<\/strong> running subagents/);
  assert.match(authoritativeZero, /No active subagents/);
  assert.match(authoritativeZero, /Agent sessions/);
  assert.doesNotMatch(authoritativeZero, /Selected session|active-child/);
  assert.match(authoritativeZero, /Completed history · 1/);
  assert.doesNotMatch(authoritativeZero, /completed-child|Completed ·/);

  for (const openCodeState of [
    { data: { available: false, runningCount: 0 }, error: null },
    { data: { available: true, runningCount: '1' }, error: null },
    { data: { available: true, runningCount: 5 }, error: 'PRIVATE_NETWORK_ERROR' },
  ]) {
    const fallback = render(React.createElement(ActivityContent, { summary, workflow: {}, openCodeState }));
    assert.match(fallback, /<strong>1<\/strong> running subagents/);
    assert.match(fallback, /Agent sessions/);
    assert.match(fallback, /active-child/);
    assert.match(fallback, /Selected session/);
    assert.match(fallback, /Completed history · 1/);
    assert.doesNotMatch(fallback, /completed-child|Completed ·/);
  }

  const detail = render(React.createElement(ActivityContent, {
    summary,
    workflow: {},
    openCodeState: { data: { available: true, runningCount: 1 }, error: null },
  }));
  assert.match(detail, /Agent sessions/);
  assert.match(detail, /Selected session/);
  assert.match(detail, /active-child/);
  assert.match(detail, /Loading session activity/);
  assert.match(detail, /Completed history · 1/);
  assert.doesNotMatch(detail, /completed-child|Completed ·/);
});

test('selected terminal session detail remains renderable while stale active detail stays suppressed', async (t) => {
  const vite = await createServer({ root: webRoot, server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  t.after(() => vite.close());
  const { selectedRunDetailIsRenderable } = await vite.ssrLoadModule('/src/components/Activity.jsx');

  const terminalOnlyRuns = [
    { sessionID: 'root', status: 'running' },
    { sessionID: 'completed-without-active-child', parentSessionID: 'root', status: 'completed' },
  ];
  const runningChildren = terminalOnlyRuns.filter((run) => run.parentSessionID && ['busy', 'running'].includes(run.status));
  const selectedTerminal = terminalOnlyRuns.find((run) => run.sessionID === 'completed-without-active-child');
  assert.equal(runningChildren.length, 0);
  assert.equal(selectedRunDetailIsRenderable(selectedTerminal, false), true);

  const zeroCountRuns = [
    { sessionID: 'stale-active', parentSessionID: 'root', status: 'busy' },
    { sessionID: 'completed-at-zero', parentSessionID: 'root', status: 'completed' },
  ];
  const selectedStaleActive = zeroCountRuns.find((run) => run.sessionID === 'stale-active');
  const selectedTerminalAtZero = zeroCountRuns.find((run) => run.sessionID === 'completed-at-zero');
  // A valid OpenCode runningCount: 0 makes showActiveDetails false even if telemetry is stale.
  assert.equal(selectedRunDetailIsRenderable(selectedStaleActive, false), false);
  assert.equal(selectedRunDetailIsRenderable(selectedTerminalAtZero, false), true);
});

test('OpenCode active workers are selectable, privacy-safe, and distinct from telemetry sessions', async (t) => {
  const vite = await createServer({ root: webRoot, server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  t.after(() => vite.close());
  const { ActivityContent } = await vite.ssrLoadModule('/src/components/Activity.jsx');
  const activitySource = fs.readFileSync(path.join(webRoot, 'src/components/Activity.jsx'), 'utf8');
  const css = fs.readFileSync(path.join(webRoot, 'src/style.css'), 'utf8');
  const workers = [
    {
      key: 'fa10d3df-df3e-42a5-a457-31aca3cb9621', agent: 'worker_alpha', status: 'busy',
      createdAt: 1000, updatedAt: 2000, sessionID: 'PRIVATE_RAW_SESSION_ID', parentID: 'PRIVATE_PARENT_ID',
      activity: [
        { ts: 1100, type: 'workflow', status: 'observed', note: 'PRIVATE_NOTE', task: 'PRIVATE_TASK' },
        { ts: 1200, type: 'tool', status: 'ok', tool: 'read_file', ok: true, output: 'PRIVATE_OUTPUT', args: 'PRIVATE_ARGS' },
        { ts: 1300, type: 'session', status: 'running', prompt: 'PRIVATE_PROMPT', credential: 'PRIVATE_CREDENTIAL' },
      ],
    },
    {
      key: '3e0db751-84f6-44ba-bc14-7d167ea8a480', agent: 'verify_worker', status: 'running',
      createdAt: null, updatedAt: 3000, activity: [],
    },
  ];
  const summary = { runs: [
    { sessionID: 'root-session', status: 'running', start: 1 },
    { sessionID: 'telemetry-active-child', parentSessionID: 'root-session', agent: 'telemetry-agent', status: 'busy', start: 2 },
    { sessionID: 'telemetry-completed-child', parentSessionID: 'root-session', agent: 'verify', status: 'completed', start: 3, end: 4, statusTs: 4 },
  ] };
  const html = render(React.createElement(ActivityContent, {
    summary,
    workflow: {},
    openCodeState: { data: { available: true, runningCount: 2, workers }, error: null },
  }));

  assert.match(html, /OpenCode active workers/);
  assert.match(html, /worker_alpha/);
  assert.match(html, /verify_worker/);
  assert.match(html, /activity-status--busy/);
  assert.match(html, /activity-status--running/);
  assert.match(html, /Created ·/);
  assert.match(html, /Updated ·/);
  assert.match(html, /Selected OpenCode worker/);
  assert.match(html, /Observed timeline/);
  assert.ok(html.indexOf('Tool call') < html.indexOf('Workflow'));
  assert.match(html, /<button[^>]*type="button"[^>]*aria-label="Select OpenCode worker worker_alpha, busy"[^>]*aria-pressed="true"/);
  assert.match(html, /aria-controls="activity-opencode-worker-detail"/);
  assert.match(html, /<button[^>]*aria-label="Select OpenCode worker verify_worker, running"[^>]*aria-pressed="false"/);
  assert.match(activitySource, /onClick=\{\(\) => setSelectedOpenCodeKey\(worker\.key\)\}/);
  assert.match(activitySource, /const \[selectedOpenCodeKey, setSelectedOpenCodeKey\] = useState\(null\)/);
  assert.match(activitySource, /openCodeWorkers\.find\(\(worker\) => worker\.key === selectedOpenCodeKey\)/);
  assert.match(css, /\.activity-opencode-worker-button:focus-visible\s*\{\s*outline: 2px solid var\(--guarana\)/);
  assert.match(css, /@media \(max-width: 700px\)\s*\{\s*\.activity-live-workbench,/s);
  assert.doesNotMatch(html, /PRIVATE_RAW_SESSION_ID|PRIVATE_PARENT_ID|PRIVATE_NOTE|PRIVATE_TASK|PRIVATE_OUTPUT|PRIVATE_ARGS|PRIVATE_PROMPT|PRIVATE_CREDENTIAL/);
  assert.match(html, /Agent sessions/);
  assert.match(html, /telemetry-active-child/);
  assert.match(html, /Selected session/);
  assert.match(html, /Completed history · 1/);
  assert.doesNotMatch(html, /telemetry-completed-child|activity-completed-subagents/);

  const emptyTimeline = render(React.createElement(ActivityContent, {
    summary: { runs: [] },
    workflow: {},
    openCodeState: { data: { available: true, runningCount: 1, workers: [workers[1]] }, error: null },
  }));
  assert.match(emptyTimeline, /No matching telemetry activity observed for this worker\./);
  assert.doesNotMatch(emptyTimeline, /PRIVATE_RAW_SESSION_ID|PRIVATE_PARENT_ID/);
  assert.doesNotMatch(emptyTimeline, /<ol class="activity-event-list"/);
});

test('terminal timestamps use statusTs only for terminal states; nonterminal states stay last-observed', async (t) => {
  const vite = await createServer({ root: webRoot, server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  t.after(() => vite.close());
  const { terminalTimeLabel } = await vite.ssrLoadModule('/src/components/Activity.jsx');
  const { fmtTs } = await vite.ssrLoadModule('/src/lib/format.js');
  assert.equal(terminalTimeLabel({ status: 'completed', statusTs: 200, end: 175 }), `Completed · ${fmtTs(200)}`);
  assert.equal(terminalTimeLabel({ status: 'running', statusTs: 200, end: 175 }), `Last observed · ${fmtTs(175)}`);
  assert.equal(terminalTimeLabel({ status: 'completed', statusTs: null, end: 175 }), `Last observed · ${fmtTs(175)}`);
});

test('selected-session timeline and memory history stay scoped and history is opt-in', async (t) => {
  const vite = await createServer({ root: webRoot, server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  t.after(() => vite.close());
  const { SessionMemoryHistory, SessionTimeline, safeToolName } = await vite.ssrLoadModule('/src/components/Activity.jsx');
  const events = [
    { ts: 100, type: 'tool', tool: 'read_file', sessionID: 'selected' },
    { ts: 101, type: 'tool', tool: 'write_file', sessionID: 'other', args: 'PRIVATE_ARGS' },
    { ts: 102, type: 'tool', tool: 'api_key=PRIVATE_CREDENTIAL', sessionID: 'selected', error: 'PRIVATE_ERROR' },
    { ts: 103, type: 'session', status: 'busy', sessionID: 'selected', prompt: 'PRIVATE_PROMPT' },
  ];
  const timeline = render(React.createElement(SessionTimeline, { sessionID: 'selected', events }));
  assert.match(timeline, /read_file/);
  assert.match(timeline, /Session/);
  assert.doesNotMatch(timeline, /write_file|PRIVATE_/);
  assert.equal(safeToolName('browser.navigate'), 'browser.navigate');
  assert.equal(safeToolName('sk-secretvalue'), null);
  assert.equal(safeToolName('api_key=PRIVATE_CREDENTIAL'), null);
  assert.equal(safeToolName('x'.repeat(41)), null);

  const closed = render(React.createElement(SessionMemoryHistory, { sessionID: 'selected', tick: 3, open: false }));
  assert.match(closed, /hidden=""/);
  assert.doesNotMatch(closed, /loading memory history/);
  const opened = render(React.createElement(SessionMemoryHistory, { sessionID: 'selected', tick: 3, open: true }));
  assert.match(opened, /data-session-id="selected"/);
  assert.match(opened, /loading memory history/);
  assert.doesNotMatch(opened, /other/);
});

test('global events expose safe categories, newest-first order, and older-event disclosure', async (t) => {
  const vite = await createServer({ root: webRoot, server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  t.after(() => vite.close());
  const { RecentActivity } = await vite.ssrLoadModule('/src/components/Activity.jsx');

  assert.match(render(React.createElement(RecentActivity, { state: { data: null, error: null } })), /role="status">Loading live telemetry/);
  const error = render(React.createElement(RecentActivity, { state: { data: null, error: 'PRIVATE_ERROR_DETAIL' } }));
  assert.match(error, /role="alert">Unable to load telemetry events/);
  assert.doesNotMatch(error, /PRIVATE_ERROR_DETAIL/);
  assert.match(render(React.createElement(RecentActivity, { state: { data: { events: [] }, error: null } })), /No recent telemetry events observed/);

  const events = render(React.createElement(RecentActivity, { state: { error: null, data: { events: [
    { ts: 1, type: 'tool', tool: 'read', ok: true, error: 'PRIVATE_TOOL_ERROR', credential: 'PRIVATE_CREDENTIAL' },
    { ts: 2, type: 'session', status: 'busy', prompt: 'PRIVATE_PROMPT' },
    { ts: 3, type: 'advisor-execution', status: 'error', error: 'PRIVATE_ADVISOR_ERROR', output: 'PRIVATE_OUTPUT' },
    { ts: 4, type: 'memory-injected', privateText: 'PRIVATE_MEMORY_TEXT' },
    { ts: 5, type: 'tool', tool: 'write', ok: false, error: 'PRIVATE_TOOL_ERROR' },
    ...Array.from({ length: 14 }, (_, i) => ({ ts: 10 + i, type: 'workflow', task: 'PRIVATE_TASK', note: 'PRIVATE_NOTE', sessionID: `session-${i}` })),
  ] } } }));
  assert.equal((events.match(/Tool call/g) || []).length, 2);
  assert.match(events, /activity-status--error/);
  assert.match(events, /activity-status--busy/);
  assert.match(events, /Workflow/);
  assert.match(events, /Show older events/);
  assert.ok(events.indexOf('Show older events') > events.indexOf('Workflow'));
  assert.doesNotMatch(events, /PRIVATE_/);
});

test('all emitted event categories render safe labels without private payload values', async (t) => {
  const vite = await createServer({ root: webRoot, server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  t.after(() => vite.close());
  const { RecentActivity } = await vite.ssrLoadModule('/src/components/Activity.jsx');
  const fixture = [
    'tool', 'tokens', 'session', 'todo', 'advisor-dispatch', 'advisor-execution',
    'telemetry-error', 'memory-error', 'memory-session', 'workflow', 'memory-injected', 'orchestrator-error',
  ].map((type, ts) => ({
    type, ts, ok: false, status: 'error', tool: 'api_key=PRIVATE_TOOL', error: 'PRIVATE_ERROR',
    prompt: 'PRIVATE_PROMPT', output: 'PRIVATE_OUTPUT', task: 'PRIVATE_TASK', note: 'PRIVATE_NOTE',
    todo: 'PRIVATE_TODO', memory: 'PRIVATE_MEMORY', content: 'PRIVATE_CONTENT', credential: 'PRIVATE_CREDENTIAL',
  }));
  const html = render(React.createElement(RecentActivity, { state: { error: null, data: { events: fixture } } }));
  for (const label of ['Tool call', 'Token usage', 'Session', 'Todo', 'Advisor dispatch', 'Advisor execution', 'Telemetry error', 'Memory error', 'Memory session', 'Workflow', 'Memory injected', 'Orchestrator error']) {
    assert.match(html, new RegExp(label));
  }
  for (const category of ['telemetry-error', 'memory-error', 'orchestrator-error']) {
    assert.match(html, /activity-status--error/);
  }
  assert.doesNotMatch(html, /PRIVATE_/);
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

test('Activity omits workflow task payload while retaining Advisor reason metadata', async (t) => {
  const vite = await createServer({ root: webRoot, server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  t.after(() => vite.close());
  const { Activity, AdvisorPanel } = await vite.ssrLoadModule('/src/components/Activity.jsx');
  const task = 'task detail '.repeat(500);
  const reason = 'advisor rationale '.repeat(500);
  const activityHtml = render(React.createElement(Activity, {
    summary: { runs: [{ sessionID: 'long-root', status: 'idle', start: 1 }] },
    workflow: { activeTask: task },
  }));
  const advisorHtml = render(React.createElement(AdvisorPanel, {
    latestAdvisor: { status: 'completed', reason }, advisorStatus: 'completed', configured: {},
    history: { data: { history: [] } }, onShowHistory() {},
  }));
  assert.doesNotMatch(activityHtml, /task detail/);
  assert.ok(advisorHtml.includes(`<dd>${reason}</dd>`));
  assert.doesNotMatch(activityHtml, /activity-text-disclosure|activity-task-summary|activity-reason-summary/);
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
