import { useMemo, useState } from 'react';
import { fmtTs, fmtDur } from '../lib/format.js';
import { Stamp } from './common.jsx';
import { RunModal } from './RunModal.jsx';
import { lastSessionStatus } from './NowPanel.jsx';

export const RUNS_PAGE_SIZE = 25;
export const UNTAGGED_PROJECT = 'untagged (legacy)';

export const projectForRun = (run) => run.project || UNTAGGED_PROJECT;

export function filterRunsByProject(runs, project) {
  return project === 'all' ? runs : runs.filter((run) => projectForRun(run) === project);
}

export function visibleRunPage(runs, expanded) {
  return expanded ? runs : runs.slice(0, RUNS_PAGE_SIZE);
}

export function Runs({ summary, mergedEvents }) {
  const [selected, setSelected] = useState(null);
  const [trigger, setTrigger] = useState(null);
  const [project, setProject] = useState('all');
  const [expanded, setExpanded] = useState(false);

  const projects = useMemo(
    () => [...new Set(summary.runs.map(projectForRun))].sort((a, b) => (a === UNTAGGED_PROJECT ? 1 : b === UNTAGGED_PROJECT ? -1 : a.localeCompare(b))),
    [summary.runs]
  );

  const filtered = useMemo(
    () => filterRunsByProject(summary.runs, project),
    [summary.runs, project]
  );

  const visible = visibleRunPage(filtered, expanded);
  const hiddenCount = filtered.length - visible.length;

  const statusOf = (sessionId) => lastSessionStatus(mergedEvents, sessionId) || 'unknown';
  const closeModal = () => {
    setSelected(null);
    if (trigger) trigger.focus();
  };

  return (
    <section id="runs" className="runs-page" aria-label="Runs">
      <header className="runs-head">
        <div>
          <p className="runs-kicker">Session register</p>
          <h2 className="section-title">Runs <span className="runs-count" aria-label={`${summary.runs.length} runs`}>{summary.runs.length}</span></h2>
        </div>
        <p className="runs-intro" id="runs-row-instructions">Select a session to inspect its event stream.</p>
      </header>
      <div className="runs-toolbar">
        {summary.runs.length > 0 && (
          <div className="runs-filter">
            <label htmlFor="runs-project-filter">project</label>
            <select
              id="runs-project-filter"
              value={project}
              onChange={(e) => {
                setProject(e.target.value);
                setExpanded(false);
              }}
            >
              <option value="all">all projects ({summary.runs.length})</option>
              {projects.map((p) => (
                <option key={p} value={p}>
                  {p} ({summary.runs.filter((r) => projectForRun(r) === p).length})
                </option>
              ))}
            </select>
          </div>
        )}
        <p className="runs-range">showing {visible.length} of {filtered.length}</p>
      </div>
      <p className="runs-scroll-hint" id="runs-scroll-hint">Scroll horizontally to see every field.</p>
      <div className="runs-table-scroll" role="region" aria-label="Run register; scroll horizontally to see all fields" aria-describedby="runs-scroll-hint" tabIndex={0}>
        <table className="ledger runs-table">
          <caption className="runs-caption">Run sessions with project, status, start, duration, tool-call, token, and error totals.</caption>
          <thead>
            <tr>
              <th>session</th>
              <th>project</th>
              <th>status</th>
              <th>started</th>
              <th>duration</th>
              <th>tool calls</th>
              <th>tokens</th>
              <th>errors</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr
                key={r.sessionID}
                className={selected === r.sessionID ? 'selected' : ''}
                tabIndex={0}
                aria-selected={selected === r.sessionID}
                aria-describedby="runs-row-instructions"
                onClick={(e) => {
                  setTrigger(e.currentTarget);
                  setSelected(r.sessionID);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setTrigger(e.currentTarget);
                    setSelected(r.sessionID);
                  }
                }}
              >
                <td className="runs-session-cell"><code className="runs-session-id">{r.sessionID}</code></td>
                <td className="runs-project-cell">{projectForRun(r)}</td>
                <td className="runs-status-cell">
                  <span className={`runs-status runs-status--${statusOf(r.sessionID).toLowerCase().replace(/[^a-z0-9-]/g, '-')}`}>
                    <Stamp word={statusOf(r.sessionID)} />
                  </span>
                </td>
                <td className="runs-started">{fmtTs(r.start)}</td>
                <td>{fmtDur(r.durationMs)}</td>
                <td className="runs-number">{r.toolCalls.toLocaleString()}</td>
                <td className="runs-number">{r.tokens.toLocaleString()}</td>
                <td className={`runs-number${r.errors > 0 ? ' num--err' : ''}`}>{r.errors.toLocaleString()}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td className="runs-empty" colSpan={8}>no runs recorded</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {(hiddenCount > 0 || (expanded && filtered.length > RUNS_PAGE_SIZE)) && (
        <div className="runs-actions">
          {hiddenCount > 0 && (
            <button type="button" className="runs-more" onClick={() => setExpanded(true)}>
              show all {filtered.length} runs ({hiddenCount} more)
            </button>
          )}
          {expanded && filtered.length > RUNS_PAGE_SIZE && (
            <button type="button" className="runs-more" onClick={() => setExpanded(false)}>
              collapse to latest {RUNS_PAGE_SIZE}
            </button>
          )}
        </div>
      )}
      {selected && <RunModal sessionID={selected} onClose={closeModal} trigger={trigger} />}
    </section>
  );
}
