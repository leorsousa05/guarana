import { useMemo, useState } from 'react';
import { fmtTs, fmtDur } from '../lib/format.js';
import { Stamp } from './common.jsx';
import { RunModal } from './RunModal.jsx';
import { lastSessionStatus } from './NowPanel.jsx';

const PAGE_SIZE = 25;
const UNTAGGED = 'untagged (legacy)';

export function Runs({ summary, mergedEvents }) {
  const [selected, setSelected] = useState(null);
  const [trigger, setTrigger] = useState(null);
  const [project, setProject] = useState('all');
  const [expanded, setExpanded] = useState(false);

  // Legacy events carry no project tag; group them under a pseudo-project so
  // the filter is always visible and they remain selectable.
  const projectOf = (r) => r.project || UNTAGGED;

  const projects = useMemo(
    () => [...new Set(summary.runs.map(projectOf))].sort((a, b) => (a === UNTAGGED ? 1 : b === UNTAGGED ? -1 : a.localeCompare(b))),
    [summary.runs]
  );

  const filtered = useMemo(
    () =>
      project === 'all'
        ? summary.runs
        : summary.runs.filter((r) => projectOf(r) === project),
    [summary.runs, project]
  );

  const visible = expanded ? filtered : filtered.slice(0, PAGE_SIZE);
  const hiddenCount = filtered.length - visible.length;

  const statusOf = (sessionId) => lastSessionStatus(mergedEvents, sessionId) || 'unknown';
  const closeModal = () => {
    setSelected(null);
    if (trigger) trigger.focus();
  };

  return (
    <section id="runs" aria-label="Runs">
      <h2 className="section-title">Runs</h2>
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
                {p} ({summary.runs.filter((r) => projectOf(r) === p).length})
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="table-scroll">
        <table className="ledger">
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
                tabIndex={0}
                aria-selected={selected === r.sessionID}
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
                <td>{r.sessionID}</td>
                <td>{projectOf(r)}</td>
                <td>
                  <Stamp word={statusOf(r.sessionID)} />
                </td>
                <td>{fmtTs(r.start)}</td>
                <td>{fmtDur(r.durationMs)}</td>
                <td>{r.toolCalls}</td>
                <td>{r.tokens}</td>
                <td className={r.errors > 0 ? 'num--err' : ''}>{r.errors}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8}>no runs recorded</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {hiddenCount > 0 && (
        <button type="button" className="runs-more" onClick={() => setExpanded(true)}>
          show all {filtered.length} runs ({hiddenCount} more)
        </button>
      )}
      {expanded && filtered.length > PAGE_SIZE && (
        <button type="button" className="runs-more" onClick={() => setExpanded(false)}>
          collapse to latest {PAGE_SIZE}
        </button>
      )}
      {selected && <RunModal sessionID={selected} onClose={closeModal} trigger={trigger} />}
    </section>
  );
}
