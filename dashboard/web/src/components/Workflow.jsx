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

  return (
    <section className="workflow" aria-label="Workflow state machine">
      <h2 className="section-title">Workflow</h2>
      {data?.engine === 'not-found' ? (
        <EmptyState copy="Orchestrator core not deployed. Run: guarana plugin install --project" />
      ) : (
        <>
          <div className="wf-strip">
            {STATE_ORDER.map((s, i) => (
              <div
                key={s}
                className={`wf-node${i === idx ? ' wf-node--active' : ''}${i < idx ? ' wf-node--passed' : ''}${s === state ? ' wf-node--current' : ''}`}
                title={s === state ? `current: ${STATE_LABEL[s]}` : STATE_LABEL[s]}
              >
                <span className="wf-node-label">{STATE_LABEL[s]}</span>
                <EdgeArrow state={s} />
              </div>
            ))}
          </div>

          <dl className="wf-grid">
            <div>
              <dt>state</dt>
              <dd><Stamp word={state} /></dd>
            </div>
            <div>
              <dt>skill</dt>
              <dd>{data?.skill ? `guarana:${data.skill}` : '—'}</dd>
            </div>
            <div>
              <dt>active task</dt>
              <dd>{data?.activeTask || '—'}</dd>
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
              <h3>transition history</h3>
              <ul>
                {data.history.slice().reverse().map((h, i) => (
                  <li key={i}>
                    <code>{h.event}</code>
                    <span className="wf-h-from">{h.from}</span>→<span className="wf-h-to">{h.to}</span>
                    {h.note ? <em> — {h.note}</em> : null}
                    {h.ts ? <span className="wf-h-ts">{fmtTs(h.ts)}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}