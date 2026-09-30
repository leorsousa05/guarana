import { useEffect, useState } from 'react';
import { Stamp, EmptyState } from './common.jsx';
import { fmtTs } from '../lib/format.js';

const STATE_ORDER = ['idle', 'planning', 'building', 'coding', 'verifying', 'debugging', 'completed'];

// State machine for the workflow visualizer (mirrors orchestrator/state.js).
const TRANSITIONS = {
  planning: 'plan_complete',
  building: 'run_start',
  coding: 'code_complete',
  verifying: 'verify_pass',
  debugging: 'debug_complete',
};

const STATE_LABEL = {
  idle: 'Idle',
  planning: 'Planning',
  building: 'Building',
  coding: 'Coding',
  verifying: 'Verifying',
  debugging: 'Debugging',
  completed: 'Completed',
};

function activeIndex(state) {
  const i = STATE_ORDER.indexOf(state);
  return i === -1 ? 0 : i;
}

function EdgeArrow({ state }) {
  const ev = TRANSITIONS[state];
  if (!ev) return null;
  return <span className="wf-edge">{ev}</span>;
}

export function Workflow({ data }) {
  const state = data?.state || 'idle';
  const idx = activeIndex(state);
  const hasHistory = Array.isArray(data?.history) && data.history.length > 0;
  const [selectedPhase, setSelectedPhase] = useState(state);
  useEffect(() => setSelectedPhase(state), [state]);
  const selectedIndex = activeIndex(selectedPhase);
  const phaseStatus = selectedPhase === state ? 'current' : selectedIndex < idx ? 'passed' : 'upcoming';
  const phaseHistory = (data?.history || [])
    .filter((entry) => entry.from === selectedPhase || entry.to === selectedPhase)
    .slice()
    .reverse();

  return (
    <section className="workflow" aria-label="Workflow state machine">
      <h2 className="section-title">Workflow</h2>
      {data?.engine === 'not-found' ? (
        <EmptyState copy="Orchestrator core not deployed. Run: guarana plugin install --project" />
      ) : (
        <>
          <div className="wf-current">
            <div>
              <p className="wf-current-label">Active task</p>
              <p className="wf-current-task">{data?.activeTask || 'No active task'}</p>
            </div>
            <Stamp word={state} />
          </div>

          <ol className="wf-strip" aria-label="Workflow phases">
            {STATE_ORDER.map((s, i) => (
              <li
                key={s}
                className={`wf-node${i < idx ? ' wf-node--passed' : ''}${s === state ? ' wf-node--current' : ''}${s === selectedPhase ? ' wf-node--selected' : ''}`}
              >
                <button
                  type="button"
                  className="wf-node-button"
                  aria-current={s === state ? 'step' : undefined}
                  aria-pressed={s === selectedPhase}
                  onClick={() => setSelectedPhase(s)}
                >
                  <span className="wf-step-index">{i + 1}</span>
                  <span className="wf-node-label">{STATE_LABEL[s]}</span>
                  <EdgeArrow state={s} />
                </button>
              </li>
            ))}
          </ol>

          <section className={`wf-phase-detail wf-phase-detail--${phaseStatus}`} aria-live="polite" aria-label={`${STATE_LABEL[selectedPhase]} phase details`}>
            <div>
              <p className="wf-current-label">{phaseStatus === 'current' ? 'Current phase' : phaseStatus === 'passed' ? 'Completed phase' : 'Upcoming phase'}</p>
              <h3>{STATE_LABEL[selectedPhase]}</h3>
              <p className="wf-phase-next">
                {TRANSITIONS[selectedPhase]
                  ? `Advances on ${TRANSITIONS[selectedPhase]}.`
                  : selectedPhase === 'completed' ? 'This run is complete.' : 'Waiting for a task to begin.'}
              </p>
            </div>
            <p className="wf-phase-records">
              {phaseHistory.length ? `${phaseHistory.length} related transition${phaseHistory.length === 1 ? '' : 's'}.` : 'No transition recorded for this phase yet.'}
            </p>
          </section>

          <dl className="wf-grid">
            <div>
              <dt>skill</dt>
              <dd>{data?.skill ? `guarana:${data.skill}` : '—'}</dd>
            </div>
            <div>
              <dt>goal</dt>
              <dd>{data?.goal || '—'}</dd>
            </div>
            <div>
              <dt>condition</dt>
              <dd>{data?.condition || '—'}</dd>
            </div>
            <div>
              <dt>updated</dt>
              <dd>{data?.updatedAt ? fmtTs(data.updatedAt) : '—'}</dd>
            </div>
          </dl>

          {hasHistory && (
            <div className="wf-history">
              <h3>Transitions · {STATE_LABEL[selectedPhase]}</h3>
              <ul>
                {phaseHistory.map((h, i) => (
                  <li key={`${h.ts || i}-${h.event}`} className="wf-history-entry">
                    <span className="wf-history-path">
                      <span className="wf-h-from">{h.from}</span>
                      <span aria-hidden="true">→</span>
                      <span className="wf-h-to">{h.to}</span>
                    </span>
                    <code className="wf-history-event">{h.event}</code>
                    {h.note ? <span className="wf-h-note">{h.note}</span> : <span className="wf-h-note" />}
                    {h.ts ? <time className="wf-h-ts" dateTime={new Date(h.ts).toISOString()}>{fmtTs(h.ts)}</time> : <span />}
                  </li>
                ))}
              </ul>
              {phaseHistory.length === 0 && <p className="wf-history-empty">No recorded transitions for this phase.</p>}
            </div>
          )}
        </>
      )}
    </section>
  );
}
