import { useState } from 'react';
import { EmptyState, Stamp } from './common.jsx';
import { fmtTs, fmtDur } from '../lib/format.js';
import { Markdown } from '../lib/markdown.jsx';

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
  const goalLines = [];
  let readingGoal = false;
  for (const line of projectState.split('\n')) {
    const m = line.match(/^\s*-\s*Goal:\s*(.*)$/i);
    if (m) {
      readingGoal = true;
      goalLines.push(m[1]);
      continue;
    }
    if (readingGoal) {
      if (/^\s*-\s*Pending writes:/i.test(line)) break;
      goalLines.push(line);
    }
  }
  const goal = goalLines.join('\n').trim();
  return goal || null;
}

export function buildResumePrompt(goal) {
  return [
    'Resume the interrupted guarana run.',
    goal ? `Open goal: "${goal}".` : 'Open goal: none recorded.',
    'Restore state from disk in order: .specs/README.md, .specs/state/project-state.md, .specs/decisions/ADR-*.md, then the current feature spec.',
    'Then call memory_get_context_for_task to recover prior decision rationale, rejected alternatives, and known bugs before continuing.',
  ].join('\n');
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setCopyFailed(false);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
      setCopyFailed(true);
    }
  };
  return (
      <button type="button" className={`resume-copy${copyFailed ? ' resume-copy--error' : ''}`} onClick={copy}>
      <span aria-live="polite">{copied ? 'copied ✓' : copyFailed ? 'copy unavailable' : 'copy resume prompt'}</span>
    </button>
  );
}

// Health gauges computed from telemetry runs: error rate, token volume, and
// a budget-style bar vs ADR-005 aggregate reference. Data-backed only.
function HealthGauges({ runs }) {
  const toolCalls = runs.reduce((s, r) => s + r.toolCalls, 0);
  const errors = runs.reduce((s, r) => s + r.errors, 0);
  const tokens = runs.reduce((s, r) => s + (r.tokens || 0), 0);
  const errorRate = toolCalls ? (errors / toolCalls) * 100 : 0;
  // ADR-005: code 8k + verify 4k + debug 6k per run; a soft aggregate health cap.
  const BUDGET = 18000;
  const tokenPct = Math.min(100, (tokens / BUDGET) * 100);
  const pct = (v) => `${Math.min(100, Math.max(0, v)).toFixed(0)}%`;
  return (
    <div className="health">
      <div className="health-gauge">
        <span className="health-label">error rate</span>
        <div className="health-bar">
          <span
            className={`health-fill ${errorRate > 20 ? 'health-fill--bad' : ''}`}
            style={{ width: pct(errorRate) }}
          />
        </div>
        <span className="health-value">{errorRate.toFixed(1)}%</span>
      </div>
      <div className="health-gauge">
        <span className="health-label">tokens (vs {BUDGET.toLocaleString()} ref)</span>
        <div className="health-bar">
          <span className="health-fill" style={{ width: pct(tokenPct) }} />
        </div>
        <span className="health-value">{tokens.toLocaleString()}</span>
      </div>
      <div className="health-gauge">
        <span className="health-label">runs</span>
        <div className="health-bar">
          <span className="health-fill" style={{ width: pct(runs.length) }} />
        </div>
        <span className="health-value">{runs.length}</span>
      </div>
    </div>
  );
}

export function NowPanel({ summary, mergedEvents, state, workflow }) {
  const goal = workflow?.goal || workflow?.activeTask || parseGoal(state?.projectState);
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

      {(goal || hasRuns) && (
        <div className="resume-card">
          <div className="resume-card-head">
            <Stamp word="resume" />
            <CopyButton text={buildResumePrompt(goal)} />
          </div>
          <div className="resume-goal">
            {goal ? (
              <>
                <strong>open goal:</strong>
                <Markdown text={goal} />
              </>
            ) : (
              <strong>no open goal recorded.</strong>
            )}
          </div>
        </div>
      )}

      {hasRuns && <HealthGauges runs={summary.runs} />}
    </section>
  );
}
