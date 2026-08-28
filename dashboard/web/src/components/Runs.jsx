import { useState } from 'react';
import { fmtTs, fmtDur } from '../lib/format.js';
import { Stamp } from './common.jsx';
import { RunModal } from './RunModal.jsx';
import { lastSessionStatus } from './NowPanel.jsx';

export function Runs({ summary, mergedEvents }) {
  const [selected, setSelected] = useState(null);
  const [trigger, setTrigger] = useState(null);
  const statusOf = (sessionId) => lastSessionStatus(mergedEvents, sessionId) || 'unknown';
  const closeModal = () => {
    setSelected(null);
    if (trigger) trigger.focus();
  };
  return (
    <section id="runs" aria-label="Runs">
      <h2 className="section-title">Runs</h2>
      <div className="table-scroll">
        <table className="ledger">
          <thead>
            <tr>
              <th>session</th>
              <th>status</th>
              <th>started</th>
              <th>duration</th>
              <th>tool calls</th>
              <th>tokens</th>
              <th>errors</th>
            </tr>
          </thead>
          <tbody>
            {summary.runs.map((r) => (
              <tr
                key={r.sessionID}
                tabIndex={0}
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
            {summary.runs.length === 0 && (
              <tr>
                <td colSpan={7}>no runs recorded</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {selected && <RunModal sessionID={selected} onClose={closeModal} trigger={trigger} />}
    </section>
  );
}
