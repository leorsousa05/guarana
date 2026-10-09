import { useState } from 'react';
import { usePoll } from '../hooks/usePoll.js';
import { fmtDur, fmtTs } from '../lib/format.js';
import { EmptyState, Stamp } from './common.jsx';
import { Workflow } from './Workflow.jsx';
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
  if (['idle', 'retry', 'error', 'compacted'].includes(status)) return status;
  return 'latest';
}

function ActivityEvents({ data }) {
  const events = (data?.events || [])
    .filter((event) => event.type === 'tool' || event.type === 'session')
    .sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0))
    .slice(0, 12);
  if (!events.length) return <p role="status">No recent tool or session events for this root session.</p>;
  return (
    <ol className="activity-event-list">
      {events.map((event, index) => {
        const isTool = event.type === 'tool';
        const status = isTool ? (event.ok === false ? 'error' : 'ok') : sessionLabel(event.status);
        return (
          <li key={`${event.ts}-${index}`}>
            <span className="activity-event-name">{isTool ? event.tool || 'unknown tool' : 'session'}</span>
            <span className={`activity-status activity-status--${status}`}>{status}</span>
            <time dateTime={typeof event.ts === 'number' ? new Date(event.ts).toISOString() : undefined}>{fmtTs(event.ts)}</time>
          </li>
        );
      })}
    </ol>
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

export function AdvisorSquare({ latestAdvisor, advisorStatus, configured, history, onShowHistory }) {
  return (
    <section className="activity-area" aria-labelledby="activity-advisor-title">
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
  const events = usePoll(
    `/api/telemetry/events?session=${encodeURIComponent(root?.sessionID || '')}`,
    5000,
    tick
  );
  const history = usePoll('/api/telemetry/advisor-history?limit=40', 5000, tick);
  const settings = usePoll('/api/models', 15000, tick);
  const [showHistory, setShowHistory] = useState(false);
  const latestAdvisor = latestAdvisorForRoot(history.data?.history, root);
  const advisorStatus = latestAdvisor?.status || (history.error ? 'unavailable' : history.data ? 'not-called' : 'loading');
  const configured = configuredAdvisor(settings.data);
  const sessionDuration = root
    ? (root.status === 'busy' || root.status === 'running' ? Date.now() - (root.start || Date.now()) : root.durationMs)
    : null;

  return (
    <section id="now" className="activity" aria-label="Activity" tabIndex={-1}>
      <h2 className="section-title">Activity</h2>
      <div className="activity-workareas">
        <section className="activity-area" aria-labelledby="activity-session-title">
          <header className="activity-area-head">
            <h3 id="activity-session-title">Current session</h3>
            <Stamp word={root ? sessionLabel(root.status) : 'waiting'} />
          </header>
          {root ? <>
            <p className="activity-session-id">{root.sessionID}</p>
            <p className="activity-observed-at">
              {root.status === 'busy' || root.status === 'running' ? 'Observed as running' : `Last seen${root.status && root.status !== 'created' ? ` · reported ${sessionLabel(root.status)}` : ''}`}
            </p>
            <dl className="activity-meta-grid">
              <div><dt>started</dt><dd>{fmtTs(root.start)}</dd></div>
              <div><dt>elapsed</dt><dd>{fmtDur(sessionDuration)}</dd></div>
              <div><dt>workflow phase</dt><dd>{workflow?.state || 'idle'}</dd></div>
              <div><dt>current task</dt><dd>{workflow?.activeTask || 'No active task'}</dd></div>
              <div><dt>tool calls</dt><dd>{root.toolCalls}</dd></div>
              <div><dt>tokens</dt><dd>{root.tokens}</dd></div>
              <div><dt>errors</dt><dd className={root.errors ? 'num--err' : ''}>{root.errors}</dd></div>
            </dl>
          </> : <EmptyState copy="No root session telemetry observed yet." />}
        </section>

        <AdvisorSquare latestAdvisor={latestAdvisor} advisorStatus={advisorStatus} configured={configured} history={history} onShowHistory={() => setShowHistory(true)} />
      </div>

      <div className="activity-support">
        <Workflow data={workflow} />
        <section className="activity-ledger" aria-label="Recent activity">
          <h2 className="section-title">Recent activity</h2>
          {events.error && <p className="activity-error" role="alert">Unable to load root-session events.</p>}
          {!events.data && !events.error && <p className="loading" role="status">Loading root-session activity…</p>}
          {events.data && <ActivityEvents data={events.data} />}
        </section>
        <section className="activity-ledger" aria-label="Injected memory for current root session">
          <h2 className="section-title">Injected memory</h2>
          {root
            ? <MemoryInjections sessionID={root.sessionID} tick={tick} />
            : <p role="status">No root session is available to match injected memories.</p>}
        </section>
      </div>
      {showHistory && <AdvisorHistoryModal state={history} onClose={() => setShowHistory(false)} />}
    </section>
  );
}
