import { EmptyState } from './common.jsx';
import { fmtTs, fmtDur } from '../lib/format.js';
import { Stamp } from './common.jsx';

const SESSION_STATUS = { created: 'running', idle: 'idle', error: 'error', compacted: 'compacted' };

export function lastSessionStatus(events, sessionID) {
  let status = null;
  for (const ev of events) {
    if (ev.sessionID === sessionID && ev.type === 'session') {
      status = SESSION_STATUS[ev.status] || ev.status;
    }
  }
  return status;
}

export function parseGoal(projectState) {
  if (!projectState) return null;
  for (const line of projectState.split('\n')) {
    const m = line.match(/^\s*-\s*Goal:\s*(.+)$/i);
    if (m) return m[1].trim();
  }
  return null;
}

export function NowPanel({ summary, mergedEvents, state }) {
  const goal = parseGoal(state?.projectState);
  const hasRuns = summary && summary.runs.length > 0;
  return (
    <section id="now" className="now" aria-label="Current session">
      <h2 className="section-title">Now</h2>
      {!hasRuns ? (
        <EmptyState copy="No telemetry yet. Install the plugin:" hint="guarana plugin install --project" />
      ) : (
        (() => {
          const latest = summary.runs[0]; // sorted by start desc
          const status = lastSessionStatus(mergedEvents, latest.sessionID) || 'unknown';
          return (
            <div className="now-panel">
              <div className="now-row now-row--head">
                <span className="now-session">{latest.sessionID}</span>
                <Stamp word={status} />
              </div>
              <dl className="now-grid">
                <div>
                  <dt>started</dt>
                  <dd>{fmtTs(latest.start)}</dd>
                </div>
                <div>
                  <dt>duration</dt>
                  <dd>{fmtDur(latest.durationMs)}</dd>
                </div>
                <div>
                  <dt>tool calls</dt>
                  <dd>{latest.toolCalls}</dd>
                </div>
                <div>
                  <dt>tokens</dt>
                  <dd>{latest.tokens}</dd>
                </div>
                <div>
                  <dt>errors</dt>
                  <dd className={latest.errors > 0 ? 'num--err' : ''}>{latest.errors}</dd>
                </div>
              </dl>
            </div>
          );
        })()
      )}
      {goal && <p className="now-goal">goal: {goal}</p>}
    </section>
  );
}
