import { useState } from 'react';
import { usePoll } from '../hooks/usePoll.js';
import { fmtDur, fmtTs } from '../lib/format.js';
import { EmptyState, Stamp } from './common.jsx';
import { MemoryInjections } from './MemoryInjections.jsx';
import { AdvisorHistoryModal } from './AdvisorHistoryModal.jsx';

export function rootSessionFrom(summary) {
  const roots = (summary?.runs || []).filter((run) => !run.parentSessionID);
  const runningRoots = roots.filter((run) => run.status === 'busy' || run.status === 'running');
  const candidates = runningRoots.length ? runningRoots : roots;
  const lastActivity = (run) => run.end ?? run.start ?? 0;

  return candidates.reduce((latest, run) => (
    latest && lastActivity(latest) >= lastActivity(run) ? latest : run
  ), null);
}

export function activitySessionIDs(summary, limit = 5) {
  const runs = summary?.runs || [];
  const root = rootSessionFrom(summary);
  return [...new Set([root?.sessionID, ...runs.slice(0, limit).map((run) => run.sessionID)].filter(Boolean))];
}

function sessionLabel(status) {
  if (status === 'busy' || status === 'running') return 'running';
  if (['created', 'idle', 'retry', 'error', 'failed', 'cancelled', 'completed', 'compacted'].includes(status)) return status;
  return 'latest';
}

const EVENT_LABELS = {
  tool: 'Tool call', session: 'Session', workflow: 'Workflow', todo: 'Todo',
  'advisor-dispatch': 'Advisor dispatch', 'advisor-execution': 'Advisor execution',
  'memory-injected': 'Memory injected', 'memory-session': 'Memory session',
  tokens: 'Token usage', 'telemetry-error': 'Telemetry error',
  'memory-error': 'Memory error', 'orchestrator-error': 'Orchestrator error',
  error: 'Error',
};

const ERROR_EVENT_TYPES = new Set(['telemetry-error', 'memory-error', 'orchestrator-error', 'error']);
const RUNNING_STATUSES = new Set(['busy', 'running']);
const TERMINAL_STATUSES = new Set(['completed', 'idle', 'error', 'failed', 'cancelled']);
const WORKFLOW_PHASES = new Set(['idle', 'planning', 'building', 'coding', 'verifying', 'debugging', 'completed']);

const secretLike = /sk-[A-Za-z0-9]|gh[pousr]_[A-Za-z0-9]+|api[_-]?key|token|password|secret|bearer/i;

export function safeToolName(value) {
  return typeof value === 'string'
    && value.length <= 40
    && /^[A-Za-z0-9_][A-Za-z0-9_.:-]*$/.test(value)
    && !secretLike.test(value)
    ? value
    : null;
}

function safeAgentLabel(value) {
  return typeof value === 'string'
    && value.length <= 48
    && /^[A-Za-z0-9_-]+$/.test(value)
    && !secretLike.test(value)
    ? value
    : null;
}

export function eventsForSession(events, sessionID) {
  return (events || []).filter((event) => event.sessionID === sessionID && EVENT_LABELS[event.type]);
}

export function latestEventForSession(events, sessionID) {
  return eventsForSession(events, sessionID)
    .reduce((latest, event) => !latest || (event.ts ?? 0) >= (latest.ts ?? 0) ? event : latest, null);
}

export function terminalTimeLabel(run) {
  const statusTs = Number.isFinite(run.statusTs) ? run.statusTs : null;
  if (statusTs !== null && TERMINAL_STATUSES.has(run.status)) {
    return `${run.status === 'completed' ? 'Completed' : 'Terminal status observed'} · ${fmtTs(statusTs)}`;
  }
  return `Last observed · ${fmtTs(Number.isFinite(run.end) ? run.end : null)}`;
}

export function buildSessionTree(runs) {
  const byID = new Map((runs || []).map((run) => [run.sessionID, { run, children: [] }]));
  const roots = [];
  for (const node of byID.values()) {
    const parent = byID.get(node.run.parentSessionID);
    if (!parent || parent === node) {
      roots.push(node);
      continue;
    }
    let ancestor = parent;
    const path = new Set([node.run.sessionID]);
    while (ancestor && !path.has(ancestor.run.sessionID)) {
      path.add(ancestor.run.sessionID);
      ancestor = byID.get(ancestor.run.parentSessionID);
    }
    if (ancestor) roots.push(node);
    else parent.children.push(node);
  }

  const activeInBranch = (node, seen = new Set()) => {
    if (seen.has(node.run.sessionID)) return false;
    const next = new Set(seen).add(node.run.sessionID);
    return RUNNING_STATUSES.has(node.run.status) || node.children.some((child) => activeInBranch(child, next));
  };
  const newestInBranch = (node, seen = new Set()) => {
    if (seen.has(node.run.sessionID)) return 0;
    const next = new Set(seen).add(node.run.sessionID);
    return Math.max(node.run.end ?? node.run.start ?? 0, ...node.children.map((child) => newestInBranch(child, next)));
  };
  const order = (nodes) => nodes.sort((a, b) => Number(activeInBranch(b)) - Number(activeInBranch(a)) || newestInBranch(b) - newestInBranch(a));
  const orderedRoots = order(roots);
  for (const node of byID.values()) order(node.children);

  return orderedRoots;
}

function activeSubagentTree(nodes) {
  return nodes.map((node) => {
    const children = activeSubagentTree(node.children);
    const isActiveSubagent = Boolean(node.run.parentSessionID) && RUNNING_STATUSES.has(node.run.status);
    return isActiveSubagent || children.length ? { ...node, children } : null;
  }).filter(Boolean);
}

function eventActivity(event, run) {
  if (!event || !EVENT_LABELS[event.type]) return run?.toolCalls ? `${run.toolCalls} observed tool calls` : 'No activity observed';
  if (event.type === 'tool') return `Tool · ${safeToolName(event.tool) || 'activity observed'}`;
  return `${EVENT_LABELS[event.type]} observed`;
}

function ActivityEvents({ data }) {
  const events = (data?.events || [])
    .filter((event) => EVENT_LABELS[event.type])
    .sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0))
    .slice(-100).reverse();
  if (!events.length) return <p role="status">No recent telemetry events observed.</p>;
  const renderEvents = (items, offset = 0) => (
    <ol className="activity-event-list">
      {items.map((event, index) => {
        const isTool = event.type === 'tool';
        const toolName = isTool ? safeToolName(event.tool) : null;
        const status = isTool || ERROR_EVENT_TYPES.has(event.type) ? (isTool && event.ok !== false ? 'ok' : 'error')
          : ['busy', 'running', 'idle', 'retry', 'error', 'completed', 'dispatched'].includes(event.status) ? event.status : 'observed';
        return (
          <li key={`${event.ts}-${index + offset}`}>
            <span className="activity-event-name">{EVENT_LABELS[event.type]}{toolName && <> · <code>{toolName}</code></>}</span>
            <span className={`activity-status activity-status--${status}`}>{status}</span>
            <time dateTime={typeof event.ts === 'number' ? new Date(event.ts).toISOString() : undefined}>{fmtTs(event.ts)}</time>
          </li>
        );
      })}
    </ol>
  );
  return <>
    {renderEvents(events.slice(0, 12))}
    {events.length > 12 && <details className="activity-more">
      <summary>Show older events ({events.length - 12})</summary>
      {renderEvents(events.slice(12), 12)}
    </details>}
  </>;
}

export function RecentActivity({ state }) {
  return (
    <section className="activity-ledger activity-recent" aria-label="Recent activity">
      <h2 className="section-title">Recent activity</h2>
      {state.error && <p className="activity-error" role="alert">Unable to load telemetry events.</p>}
      {!state.data && !state.error && <p className="loading" role="status">Loading live telemetry…</p>}
      {state.data && <ActivityEvents data={state.data} />}
    </section>
  );
}

function configuredAdvisor(settings) {
  return settings?.effective?.advisor || {};
}

export function latestAdvisorForRoot(history, root) {
  return root
    ? (history || []).find((entry) => entry.parentSessionID === root.sessionID) || null
    : null;
}

function advisorComparisons(observed, configured) {
  if (!observed) return [];
  const comparisons = [];
  for (const [field, actual, expected] of [
    ['provider', observed.providerID, configured.provider],
    ['model', observed.modelID, configured.model],
    ['variant', observed.variant, configured.variant],
  ]) {
    if (actual && expected) comparisons.push(`${field}: ${actual === expected ? 'matches' : 'differs from'} configured`);
    else if (field === 'variant' && actual && !expected) comparisons.push('variant observed; configured setting uses the model default');
  }
  return comparisons;
}

export function AdvisorPanel({ latestAdvisor, advisorStatus, configured, history, onShowHistory }) {
  return (
    <section className="activity-advisor" aria-labelledby="activity-advisor-title">
      <header className="activity-area-head">
        <h3 id="activity-advisor-title">Advisor</h3>
        <Stamp word={advisorStatus || 'loading'} />
      </header>
      <dl className="activity-meta-grid activity-advisor-meta">
        <div className="activity-advisor-reason"><dt>Why Advisor was called</dt><dd>{latestAdvisor?.reason || 'Reason not recorded'}</dd></div>
        <div><dt>configured</dt><dd>{[configured.provider, configured.model, configured.variant || (configured.model ? 'default' : null)].filter(Boolean).join(' / ') || 'not configured'}</dd></div>
        {latestAdvisor && <div><dt>observed</dt><dd>{[latestAdvisor.providerID, latestAdvisor.modelID, latestAdvisor.variant].filter(Boolean).join(' / ') || 'model metadata not reported'}</dd></div>}
      </dl>
      {advisorComparisons(latestAdvisor, configured).map((comparison) => <p className="activity-comparison" key={comparison}>{comparison}</p>)}
      {history.error && <p className="activity-error" role="alert">Advisor telemetry unavailable.</p>}
      {!history.data && !history.error && <p role="status">Loading Advisor telemetry…</p>}
      {history.data && !latestAdvisor && <p role="status">Advisor has not been called in this root session.</p>}
      {latestAdvisor?.status === 'dispatched' && <p>Advisor dispatched; completion not observed.</p>}
      {latestAdvisor?.status === 'running' && <p>Advisor running based on observed session status.</p>}
      {latestAdvisor && <p className="activity-observed-at">Last call · {fmtTs(latestAdvisor.ts)}</p>}
      <button type="button" className="activity-history-button" onClick={onShowHistory}>Advisor history</button>
    </section>
  );
}

export function Activity({ summary, workflow, tick = 0 }) {
  const root = rootSessionFrom(summary);
  const runs = [...(summary?.runs || [])];
  const runningChildren = runs.filter((run) => run.parentSessionID && RUNNING_STATUSES.has(run.status));
  const runningSubagents = runningChildren.length;
  const completedChildren = runs.filter((run) => run.parentSessionID && TERMINAL_STATUSES.has(run.status));
  const recentCompletedChildren = [...completedChildren]
    .sort((a, b) => (b.statusTs ?? b.end ?? b.start ?? 0) - (a.statusTs ?? a.end ?? a.start ?? 0))
    .slice(0, 20);
  const sessionTree = activeSubagentTree(buildSessionTree(runs));
  const [selectedSessionID, setSelectedSessionID] = useState(() => runningChildren[0]?.sessionID || null);
  const selectedRun = runs.find((run) => run.sessionID === selectedSessionID) || null;
  const events = usePoll(
    '/api/telemetry/events?limit=200',
    5000,
    tick
  );
  const history = usePoll('/api/telemetry/advisor-history?limit=40', 5000, tick);
  const settings = usePoll('/api/models', 15000);
  const [showHistory, setShowHistory] = useState(false);
  const latestAdvisor = latestAdvisorForRoot(history.data?.history, root);
  const advisorStatus = latestAdvisor?.status || (history.error ? 'unavailable' : history.data ? 'not-called' : 'loading');
  const configured = configuredAdvisor(settings.data);
  const workflowPhase = WORKFLOW_PHASES.has(workflow?.state) ? workflow.state : 'idle';
  const totals = runs.reduce((sum, run) => ({ toolCalls: sum.toolCalls + (run.toolCalls || 0), tokens: sum.tokens + (run.tokens || 0), errors: sum.errors + (run.errors || 0) }), { toolCalls: 0, tokens: 0, errors: 0 });
  const observedEvents = events.data?.events || [];

  const renderSession = (node, ancestors = new Set()) => {
    const run = node.run;
    if (ancestors.has(run.sessionID)) return null;
    const nextAncestors = new Set(ancestors).add(run.sessionID);
    const active = RUNNING_STATUSES.has(run.status);
    const latest = latestEventForSession(observedEvents, run.sessionID);
    const label = safeAgentLabel(run.agent);
    return <li key={run.sessionID} className="activity-agent-node">
      <button
        type="button"
        className={`activity-agent-button${selectedSessionID === run.sessionID ? ' activity-agent-button--selected' : ''}`}
        aria-pressed={selectedSessionID === run.sessionID}
        onClick={() => setSelectedSessionID(run.sessionID)}
      >
        <span className="activity-agent-name">{label || (run.parentSessionID ? 'Subagent' : 'Session')} · <code>{run.sessionID}</code></span>
        <span className={`activity-status activity-status--${active ? 'running' : sessionLabel(run.status)}`}>{sessionLabel(run.status)}</span>
        <span className="activity-agent-activity">{eventActivity(latest, run)}</span>
        <span className="activity-agent-time">Started · {fmtTs(run.start)} · elapsed {fmtDur(run.durationMs)}</span>
        <span className="activity-agent-time">{active ? `Last observed · ${fmtTs(run.end)}` : terminalTimeLabel(run)}</span>
      </button>
      {node.children.length > 0 && <ul>{node.children.map((child) => renderSession(child, nextAncestors))}</ul>}
    </li>;
  };

  return (
    <section id="now" className="activity" aria-label="Activity" tabIndex={-1}>
      <header className="activity-page-head">
        <p className="activity-kicker">Live operations</p>
        <h2 className="section-title">Activity</h2>
        <p className="activity-monitor-summary"><strong>{runningSubagents}</strong> running subagents · {runs.length} observed sessions</p>
      </header>
      <section className="activity-aggregates" aria-label="Observed aggregate totals">
        <strong>Aggregates · observed</strong><span>{runs.length} sessions</span><span>{runs.filter((run) => RUNNING_STATUSES.has(run.status)).length} busy/running</span><span>{totals.toolCalls} tool calls</span><span>{totals.errors} errors</span><span>{totals.tokens} tokens</span>
      </section>
      <div className={`activity-inspector${selectedRun ? '' : ' activity-inspector--empty'}`}>
        <div className="activity-session-navigation">
          {runningSubagents > 0 && <section className="activity-sessions" aria-labelledby="activity-all-sessions-title">
            <h3 id="activity-all-sessions-title">Agent sessions</h3>
            <ul className="activity-agent-list">{sessionTree.map((node) => renderSession(node))}</ul>
          </section>}
          {runningSubagents === 0 && <p className="activity-no-active" role="status">No active subagents.</p>}
          {completedChildren.length > 0 && <details className="activity-completed-subagents">
            <summary>Recently completed subagents ({completedChildren.length})</summary>
            {completedChildren.length > recentCompletedChildren.length && <p className="activity-completed-limit">Showing the 20 most recently observed.</p>}
            <ul className="activity-agent-list">
              {recentCompletedChildren.map((run) => {
                const active = RUNNING_STATUSES.has(run.status);
                const latest = latestEventForSession(observedEvents, run.sessionID);
                const label = safeAgentLabel(run.agent);
                return <li key={run.sessionID} className="activity-agent-node">
                  <button
                    type="button"
                    className={`activity-agent-button${selectedSessionID === run.sessionID ? ' activity-agent-button--selected' : ''}`}
                    aria-pressed={selectedSessionID === run.sessionID}
                    onClick={() => setSelectedSessionID(run.sessionID)}
                  >
                    <span className="activity-agent-name">{label || 'Subagent'} · <code>{run.sessionID}</code></span>
                    <span className={`activity-status activity-status--${active ? 'running' : sessionLabel(run.status)}`}>{sessionLabel(run.status)}</span>
                    <span className="activity-agent-activity">{eventActivity(latest, run)}</span>
                    <span className="activity-agent-time">Started · {fmtTs(run.start)} · elapsed {fmtDur(run.durationMs)}</span>
                    <span className="activity-agent-time">{terminalTimeLabel(run)}</span>
                  </button>
                </li>;
              })}
            </ul>
          </details>}
        </div>
        {selectedRun && <SessionDetail key={selectedSessionID} run={selectedRun} tick={tick} />}
      </div>
      <div className="activity-supporting">
        <section className="activity-workflow-summary" aria-label="Workflow status">
          <h3>Workflow</h3>
          <p>Current phase · <strong>{workflowPhase}</strong></p>
        </section>
        <aside className="activity-signals" aria-label="Supporting signals">
          <AdvisorPanel latestAdvisor={latestAdvisor} advisorStatus={advisorStatus} configured={configured} history={history} onShowHistory={() => setShowHistory(true)} />
          <RecentActivity state={events} />
        </aside>
      </div>
      {showHistory && <AdvisorHistoryModal state={history} onClose={() => setShowHistory(false)} />}
    </section>
  );
}

function SessionDetail({ run, tick }) {
  const [showMemory, setShowMemory] = useState(false);
  const eventState = usePoll(
    `/api/telemetry/events?session=${encodeURIComponent(run.sessionID)}&limit=100`,
    5000,
    tick
  );
  const sessionEvents = eventsForSession(eventState.data?.events, run.sessionID);
  const latest = sessionEvents.length ? latestEventForSession(sessionEvents, run.sessionID) : null;

  return (
    <section className="activity-session-detail" aria-labelledby="activity-detail-title">
      <header className="activity-area-head">
        <h3 id="activity-detail-title">Selected session</h3>
        <Stamp word={run ? sessionLabel(run.status) : 'waiting'} />
      </header>
      <p className="activity-session-id"><code>{run.sessionID}</code></p>
      <p className="activity-observed-at">{terminalTimeLabel(run)}</p>
      <dl className="activity-meta-grid activity-detail-meta">
        <div><dt>agent</dt><dd>{safeAgentLabel(run.agent) || (run.parentSessionID ? 'Subagent' : 'Session')}</dd></div>
        <div><dt>started</dt><dd>{fmtTs(run.start)}</dd></div>
        <div><dt>elapsed</dt><dd>{fmtDur(run.durationMs)}</dd></div>
        <div><dt>tool calls</dt><dd>{run.toolCalls || 0}</dd></div>
      </dl>
      <p className="activity-current-observation"><strong>Latest observed activity</strong><span>{eventActivity(latest, run)}</span></p>
      {eventState.error && <p className="activity-error" role="alert">Unable to load this session&rsquo;s activity.</p>}
      {!eventState.data && !eventState.error && <p className="loading" role="status">Loading session activity…</p>}
      {eventState.data && <SessionTimeline sessionID={run.sessionID} events={eventState.data.events} />}
      <button type="button" className="activity-history-button" aria-expanded={showMemory} aria-controls="selected-memory-history" onClick={() => setShowMemory((shown) => !shown)}>
        {showMemory ? 'Hide injected memory history' : 'Injected memory history'}
      </button>
      <SessionMemoryHistory sessionID={run.sessionID} tick={tick} open={showMemory} />
    </section>
  );
}

export function SessionTimeline({ sessionID, events }) {
  const filtered = eventsForSession(events, sessionID);
  return (
    <section className="activity-session-timeline" aria-label={`Activity timeline for ${sessionID}`}>
      <h4>Observed timeline</h4>
      <ActivityEvents data={{ events: filtered }} />
    </section>
  );
}

export function SessionMemoryHistory({ sessionID, tick = 0, open = false }) {
  return <div id="selected-memory-history" className="activity-memory-detail" data-session-id={sessionID} hidden={!open}>
    {open && <MemoryInjections sessionID={sessionID} tick={tick} />}
  </div>;
}
