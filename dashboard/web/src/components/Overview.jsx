import { usePoll } from '../hooks/usePoll.js';
import { Stamp, EmptyState } from './common.jsx';
import { parseGoal } from './NowPanel.jsx';
import { fmtDur } from '../lib/format.js';

const STATE_ORDER = ['idle', 'planning', 'building', 'coding', 'verifying', 'debugging', 'completed'];
const STATE_LABEL = {
  idle: 'Idle', planning: 'Planning', building: 'Building', coding: 'Coding',
  verifying: 'Verifying', debugging: 'Debugging', completed: 'Completed',
};

function HealthLine({ runs }) {
  const toolCalls = runs.reduce((s, r) => s + r.toolCalls, 0);
  const errors = runs.reduce((s, r) => s + r.errors, 0);
  const tokens = runs.reduce((s, r) => s + (r.tokens || 0), 0);
  const rate = toolCalls ? ((errors / toolCalls) * 100).toFixed(1) : '0.0';
  return (
    <span className={`ov-health ${errors > 0 ? 'ov-health--bad' : ''}`}>
      {runs.length} runs · {toolCalls} tool calls · {tokens.toLocaleString()} tokens · <span className="ov-err">{rate}% errors</span>
    </span>
  );
}

function WorkflowCard({ workflow }) {
  const state = workflow?.state || 'idle';
  const idx = STATE_ORDER.indexOf(state);
  return (
    <section className="ov-card" aria-label="Workflow">
      <header className="ov-card-head">
        <h3>Workflow</h3>
        <Stamp word={state} />
      </header>
      <div className="ov-wf">
        {STATE_ORDER.map((s, i) => (
          <span
            key={s}
            className={`ov-wf-node${i === idx ? ' ov-wf-node--active' : ''}${i < idx ? ' ov-wf-node--passed' : ''}`}
            title={STATE_LABEL[s]}
          >
            {STATE_LABEL[s]}
          </span>
        ))}
      </div>
      <dl className="ov-grid">
        <div><dt>skill</dt><dd>{workflow?.skill ? `guarana:${workflow.skill}` : '—'}</dd></div>
        <div><dt>active task</dt><dd className="ov-truncate">{workflow?.activeTask || '—'}</dd></div>
        <div><dt>goal</dt><dd className="ov-truncate">{parseGoal2(workflow) || '—'}</dd></div>
      </dl>
    </section>
  );
}

function parseGoal2(workflow) {
  if (!workflow) return null;
  return workflow.goal || workflow.activeTask || null;
}

function RunsCard({ summary }) {
  const runs = summary?.runs || [];
  const hasData = runs.length > 0;
  return (
    <section className="ov-card" aria-label="Runs">
      <header className="ov-card-head">
        <h3>Runs</h3>
        {hasData && <span className="ov-count">{runs.length}</span>}
      </header>
      {!hasData ? (
        <EmptyState copy="No telemetry yet. Install the plugin:" hint="guarana plugin install --project" />
      ) : (
        <>
          <HealthLine runs={runs} />
          {runs.slice(0, 3).map((r) => (
            <div key={r.sessionID} className="ov-run">
              <span className="ov-run-id ov-truncate">{r.sessionID}</span>
              <span className="ov-run-meta">
                {fmtDur(r.durationMs)} · {r.toolCalls} tools · {r.errors} errors
              </span>
            </div>
          ))}
        </>
      )}
    </section>
  );
}

function DecisionsCard({ decisions, onOpen }) {
  const list = decisions?.data?.decisions || [];
  return (
    <section className="ov-card" aria-label="Decisions">
      <header className="ov-card-head">
        <h3>Decisions</h3>
        {list.length > 0 && <span className="ov-count">{list.length}</span>}
      </header>
      {list.length === 0 ? (
        <p className="ov-empty">All decisions resolved.</p>
      ) : (
        <ul className="ov-list">
          {list.map((d, i) => (
            <li key={i}>
              <span className="ov-truncate">{d.statement}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function MemoryCard({ memory }) {
  const d = memory?.data;
  if (!d) return <p className="loading">loading…</p>;
  return (
    <section className="ov-card" aria-label="Memory">
      <header className="ov-card-head">
        <h3>Memory</h3>
      </header>
      <dl className="ov-grid">
        <div><dt>nodes</dt><dd>{d.nodes?.total ?? 0}</dd></div>
        <div><dt>confirmed</dt><dd>{d.nodes?.confirmed ?? 0}</dd></div>
        <div><dt>drafts</dt><dd>{d.nodes?.draft ?? 0}</dd></div>
        <div><dt>supernodes</dt><dd>{d.supernodes ?? 0}</dd></div>
        <div><dt>edges</dt><dd>{d.edges ?? 0}</dd></div>
      </dl>
    </section>
  );
}

function RoadmapCard({ tracker }) {
  if (!tracker) return <p className="loading">loading…</p>;
  return (
    <section className="ov-card ov-card--wide" aria-label="Roadmap">
      <header className="ov-card-head">
        <h3>Roadmap</h3>
      </header>
      {['BLOCKED', 'NEXT', 'DONE'].map((k) =>
        tracker[k]?.length ? (
          <p key={k} className="flag-line">
            <Stamp word={k} /> {tracker[k].join(' · ')}
          </p>
        ) : null
      )}
      {!tracker.BLOCKED?.length && !tracker.NEXT?.length && !tracker.DONE?.length && (
        <p className="ov-empty">No roadmap flags recorded.</p>
      )}
    </section>
  );
}

export function Overview({ summary, state, tracker, workflow }) {
  const memory = usePoll('/api/memory/summary', 5000);
  const decisions = usePoll('/api/decisions/pending', 5000);
  const goal = parseGoal(state?.projectState);

  return (
    <div className="ov" aria-label="Overview">
      <p className="ov-lede">
        {goal ? <><strong>Open goal:</strong> {goal}</> : 'System of record — no active goal recorded.'}
      </p>
      <div className="ov-grid-layout">
        <WorkflowCard workflow={workflow} />
        <RunsCard summary={summary} />
        <MemoryCard memory={memory} />
        <DecisionsCard decisions={decisions} />
        <RoadmapCard tracker={tracker} />
      </div>
    </div>
  );
}