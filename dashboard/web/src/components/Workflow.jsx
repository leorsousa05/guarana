import { useEffect, useState } from 'react';
import { EmptyState } from './common.jsx';
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
  return <span className="wf-edge"><span aria-hidden="true">→</span> {ev}</span>;
}

function WorkflowText({ text, className }) {
  if (!text) return '—';
  return <details className="wf-text-disclosure">
    <summary className={className}>{text}</summary>
    <p>{text}</p>
  </details>;
}

export function Workflow({ data }) {
  const state = data?.state || 'idle';
  const idx = activeIndex(state);
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
            <div className="wf-current-task-block">
              <p className="wf-current-label">Active task</p>
              <p className="wf-current-task">{data?.activeTask || 'No active task'}</p>
            </div>
            <div className="wf-current-phase">
              <p className="wf-current-label">Current phase</p>
              <h3>{STATE_LABEL[state]}</h3>
            </div>
          </div>

          <ol className="wf-strip" aria-label="Workflow phases">
            {STATE_ORDER.map((s, i) => (
              <li
                key={s}
                className={`wf-node wf-node--${s === state ? 'current' : i < idx ? 'passed' : 'upcoming'}${s === selectedPhase ? ' wf-node--selected' : ''}`}
              >
                <button
                  type="button"
                  className="wf-node-button"
                  aria-current={s === state ? 'step' : undefined}
                  aria-pressed={s === selectedPhase}
                  onClick={() => setSelectedPhase(s)}
                >
                  <span className="wf-step-index">{i + 1}</span>
                  <span className="wf-node-content">
                    <span className="wf-node-label">{STATE_LABEL[s]}</span>
                    <span className={`wf-node-status wf-node-status--${s === state ? 'current' : i < idx ? 'passed' : 'upcoming'}`}>
                      {s === state ? 'Current' : i < idx ? 'Passed' : 'Upcoming'}
                    </span>
                    <EdgeArrow state={s} />
                  </span>
                </button>
              </li>
            ))}
          </ol>

          <section className="wf-evidence" aria-label="Workflow evidence">
            <div className="wf-phase-record">
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

              <section className="wf-history" aria-label={`${STATE_LABEL[selectedPhase]} transitions`}>
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
                      {h.note ? <WorkflowText className="wf-h-note" text={h.note} /> : <span className="wf-h-note" />}
                      {h.ts ? <time className="wf-h-ts" dateTime={new Date(h.ts).toISOString()}>{fmtTs(h.ts)}</time> : <span />}
                    </li>
                  ))}
                </ul>
                {phaseHistory.length === 0 && <p className="wf-history-empty">No recorded transitions for this phase.</p>}
              </section>
            </div>

            <aside className="wf-metadata" aria-label="Task metadata">
              <h3 className="wf-evidence-title">Task details</h3>
              <dl className="wf-grid">
                <div>
                  <dt>skill</dt>
                  <dd>{data?.skill ? `guarana:${data.skill}` : '—'}</dd>
                </div>
                <div>
                  <dt>goal</dt>
                  <dd><WorkflowText className="wf-detail-summary" text={data?.goal} /></dd>
                </div>
                <div>
                  <dt>condition</dt>
                  <dd><WorkflowText className="wf-detail-summary" text={data?.condition} /></dd>
                </div>
                <div>
                  <dt>updated</dt>
                  <dd>{data?.updatedAt ? fmtTs(data.updatedAt) : '—'}</dd>
                </div>
              </dl>
            </aside>
          </section>
        </>
      )}
    </section>
  );
}
