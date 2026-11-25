import { fmtTs } from '../lib/format.js';

const ACTIVE_STATUSES = new Set(['busy', 'running']);
const EVENT_LABELS = Object.freeze({
  tool: 'Tool call',
  session: 'Session',
  workflow: 'Workflow',
  todo: 'Todo',
  'advisor-dispatch': 'Advisor dispatch',
  'advisor-execution': 'Advisor execution',
  'memory-injected': 'Memory injected',
  'memory-session': 'Memory session',
  tokens: 'Token usage',
  'telemetry-error': 'Telemetry error',
  'memory-error': 'Memory error',
  'orchestrator-error': 'Orchestrator error',
  error: 'Error',
});
const ERROR_EVENT_TYPES = new Set(['telemetry-error', 'memory-error', 'orchestrator-error', 'error']);

function safeTimestamp(value) {
  return Number.isFinite(value) && Number.isFinite(new Date(value).getTime()) ? value : null;
}

function isErrorSignal(event) {
  return ERROR_EVENT_TYPES.has(event.type)
    || event.status === 'error'
    || (event.type === 'tool' && event.ok === false);
}

export function projectOperationPulse(summary, events) {
  const runs = Array.isArray(summary?.runs)
    ? summary.runs.filter((run) => run && typeof run === 'object' && !Array.isArray(run))
    : [];
  const signals = (Array.isArray(events) ? events : [])
    .filter((event) => event && typeof event === 'object' && !Array.isArray(event)
      && Object.hasOwn(EVENT_LABELS, event.type) && safeTimestamp(event.ts) !== null)
    .map((event, index) => ({
      label: EVENT_LABELS[event.type],
      timestamp: event.ts,
      error: isErrorSignal(event),
      index,
    }))
    .sort((a, b) => b.timestamp - a.timestamp || a.index - b.index)
    .slice(0, 3)
    .map(({ label, timestamp, error }) => ({ label, timestamp, error }));

  return {
    observedSessions: runs.length,
    activeSessions: runs.filter((run) => ACTIVE_STATUSES.has(run.status)).length,
    errorSignals: runs.reduce((total, run) => total
      + (Number.isSafeInteger(run.errors) && run.errors >= 0 ? run.errors : 0), 0),
    signals,
  };
}

export function OperationPulse({
  summary,
  summaryError,
  summaryLoading,
  events,
  eventsError,
  eventsLoading,
}) {
  const summaryReady = !summaryError && !summaryLoading && Array.isArray(summary?.runs);
  const pulse = projectOperationPulse(summary, events);

  return (
    <section className="operation-pulse" aria-labelledby="operation-pulse-title">
      <header className="operation-pulse-head">
        <h2 id="operation-pulse-title">Operational pulse</h2>
        <span>Observed telemetry</span>
      </header>
      <div className="operation-pulse-content">
        <div className="operation-pulse-execution" role="group" aria-label="Session aggregates">
          {summaryError || (!summaryLoading && summary && !Array.isArray(summary.runs)) ? (
            <p className="operation-pulse-state" role="alert">Session summary unavailable.</p>
          ) : !summaryReady ? (
            <p className="operation-pulse-state" role="status">Loading session summary…</p>
          ) : (
            <>
              <dl className="operation-pulse-stats">
                <div><dt>Observed</dt><dd>{pulse.observedSessions}</dd></div>
                <div><dt>Active</dt><dd>{pulse.activeSessions}</dd></div>
                <div><dt>Error signals</dt><dd>{pulse.errorSignals}</dd></div>
              </dl>
              {pulse.observedSessions > 0 ? (
                <div
                  className="operation-pulse-meter"
                  role="meter"
                  aria-label="Active sessions among observed sessions"
                  aria-valuemin={0}
                  aria-valuemax={pulse.observedSessions}
                  aria-valuenow={pulse.activeSessions}
                  aria-valuetext={`${pulse.activeSessions} active of ${pulse.observedSessions} observed sessions`}
                >
                  <span
                    className="operation-pulse-meter-fill"
                    style={{ width: `${(pulse.activeSessions / pulse.observedSessions) * 100}%` }}
                    aria-hidden="true"
                  />
                </div>
              ) : (
                <div className="operation-pulse-meter operation-pulse-meter--empty" role="img"
                  aria-label="No observed sessions; 0 active of 0 observed sessions">
                  <span className="operation-pulse-meter-fill" aria-hidden="true" />
                </div>
              )}
            </>
          )}
        </div>
        <div className="operation-pulse-signals" role="group" aria-label="Latest telemetry signals">
          <h3>Latest signals</h3>
          {summaryError || (!summaryLoading && summary && !Array.isArray(summary.runs)) ? (
            <p className="operation-pulse-state" role="status">Recent signals unavailable.</p>
          ) : !summaryReady ? (
            <p className="operation-pulse-state" role="status">Waiting for session telemetry…</p>
          ) : eventsError ? (
            <p className="operation-pulse-state" role="alert">Recent signals unavailable.</p>
          ) : eventsLoading ? (
            <p className="operation-pulse-state" role="status">Loading recent signals…</p>
          ) : pulse.signals.length ? (
            <ol className="operation-pulse-list">
              {pulse.signals.map((signal, index) => (
                <li key={`${signal.timestamp}-${signal.label}-${index}`}>
                  <span>{signal.label}{signal.error && <span className="operation-pulse-error-mark"> · error signal</span>}</span>
                  <time dateTime={new Date(signal.timestamp).toISOString()}>{fmtTs(signal.timestamp)}</time>
                </li>
              ))}
            </ol>
          ) : (
            <p className="operation-pulse-state" role="status">No recent signals observed.</p>
          )}
        </div>
      </div>
    </section>
  );
}
