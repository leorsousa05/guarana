import { useEffect, useMemo, useRef, useState } from 'react';
import { Marked } from 'marked';

function usePoll(url, intervalMs = 5000) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    };
    load();
    const id = setInterval(load, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [url, intervalMs, nonce]);
  return { data, error, refetch: () => setNonce((n) => n + 1) };
}

const fmtTs = (ts) => (ts == null ? '—' : new Date(ts).toLocaleString());
const fmtTime = (ts) => (ts == null ? '—' : new Date(ts).toLocaleTimeString());
const fmtDur = (ms) => (ms == null ? '—' : `${(ms / 1000).toFixed(1)}s`);
const fmtAge = (ts) => {
  if (ts == null) return 'no events';
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
};

/* ---------- empty state & error banner ---------- */

function EmptyState({ copy, hint }) {
  return (
    <p className="empty-copy">
      {copy}
      {hint && <> <code>{hint}</code></>}
    </p>
  );
}

function ErrorBanner({ text }) {
  return (
    <p className="error-banner" role="alert">{text}</p>
  );
}

/* ---------- stamps ---------- */

const GOOD = new Set(['pass', 'shipped', 'ok', 'live', 'done']);
const BAD = new Set(['fail', 'error', 'failed', 'blocked']);

function Stamp({ word }) {
  const w = String(word || '')
    .replace(/\*\*/g, '')
    .trim();
  if (!w || w.toLowerCase() === 'unknown') return <span>—</span>;
  const cls = BAD.has(w.toLowerCase()) ? 'stamp stamp--bad' : GOOD.has(w.toLowerCase()) ? 'stamp stamp--good' : 'stamp';
  return <span className={cls}>{w.toUpperCase()}</span>;
}

/* ---------- markdown rendering (sanitized) ---------- */

const escapeHtml = (s) => String(s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

// Internal spec-relative link target (e.g. features/guarana/plan.md).
const isSpecPath = (href) => /\.md$/i.test(String(href)) && !/^(https?:|mailto:|#|\/|data:)/i.test(String(href));

const md = new Marked();
md.use({
  renderer: {
    // Escape raw HTML in the markdown source so it renders literally (no injection).
    html({ text }) {
      return escapeHtml(text);
    },
    image({ text }) {
      return escapeHtml(text);
    },
    link({ href, title, tokens }) {
      const label = this.parser.parseInline(tokens);
      const spec = isSpecPath(href);
      const attrs = spec
        ? ` href="#" data-specfile="${escapeHtml(href)}"`
        : ` href="${escapeHtml(href)}"${title ? ` title="${escapeHtml(title)}"` : ''}`;
      return `<a${attrs}>${label}</a>`;
    },
  },
});

function Markdown({ text, onOpenFile, canOpen }) {
  const html = useMemo(() => md.parse(String(text || '')), [text]);
  const handleClick = onOpenFile && canOpen
    ? (e) => {
        const el = e.target.closest('[data-specfile]');
        if (el && canOpen(el.dataset.specfile)) {
          e.preventDefault();
          onOpenFile(el.dataset.specfile);
        }
      }
    : undefined;
  return (
    <div
      className="md"
      onClick={handleClick}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// Render a markdown link "[label](href)" as a clickable spec link when it
// points at a .specs file that the Documents view can open; otherwise render
// the label as plain text.
function MdLink({ text, onOpenFile, canOpen }) {
  const m = String(text || '').match(/\[([^\]]+)\]\(([^)]+)\)/);
  if (!m) return <>{text}</>;
  const [, label, target] = m;
  if (isSpecPath(target) && onOpenFile && canOpen && canOpen(target)) {
    return (
      <button type="button" className="md-link" onClick={() => onOpenFile(target)}>
        {label}
      </button>
    );
  }
  return <>{label}</>;
}

/* ---------- curated documents ---------- */

// A tracker/proof/change target opens in the Documents reading pane when it
// lives under the curated categories or is a top-level .specs doc; otherwise
// its label renders as plain text.
const isDocPath = (rel) =>
  /^(changes|decisions|features\/guarana|archive)\//.test(rel) || !/\//.test(rel);

const fallbackTitle = (rel) => rel.split('/').pop().replace(/\.md$/i, '');

const adrNum = (rel) => {
  const m = String(rel).match(/ADR-(\d+)/i);
  return m ? parseInt(m[1], 10) : Infinity;
};

function buildGroups(tree) {
  const list = tree || [];
  const decisions = list
    .filter((p) => /^decisions\/ADR-\d+[^/]*\.md$/.test(p))
    .sort((a, b) => adrNum(a) - adrNum(b));
  const changes = list.filter((p) => /^changes\/[^/]+\.md$/.test(p)).sort();
  const features = list.filter((p) => /^features\/guarana\/[^/]+\.md$/.test(p)).sort();
  const archive = list.filter((p) => /^archive\/[^/]+\.md$/.test(p)).sort();
  const foundations = list.filter((p) => /^[^/]+\.md$/.test(p)).sort();
  return [
    { key: 'decisions', label: 'Decisions', items: decisions },
    { key: 'changes', label: 'Changes', items: changes },
    { key: 'features', label: 'Features', items: features },
    { key: 'archive', label: 'Archive', items: archive },
    { key: 'foundations', label: 'Foundations', items: foundations },
  ];
}

function ReadingPane({ path, onOpenFile, canOpen }) {
  const [content, setContent] = useState(null);
  useEffect(() => {
    let cancelled = false;
    setContent(null);
    fetch(`/api/specs/file?path=${encodeURIComponent(path)}`)
      .then(async (res) => {
        if (cancelled) return;
        setContent(res.ok ? await res.text() : `error ${res.status}`);
      })
      .catch((e) => {
        if (!cancelled) setContent(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [path]);
  if (content === null) return <p className="loading">loading document…</p>;
  return (
    <div className="reading-pane">
      <Markdown text={content} onOpenFile={onOpenFile} canOpen={canOpen} />
    </div>
  );
}

function Documents({ tree, titles, active, onOpen, onOpenFile, canOpen }) {
  const groups = useMemo(() => buildGroups(tree), [tree]);
  const hasAny = groups.some((g) => g.items.length > 0);
  const [collapsed, setCollapsed] = useState({});
  return (
    <div className="documents">
      {!hasAny && <EmptyState copy="no documents found" />}
      {groups.map((g) => {
        if (g.items.length === 0) return null;
        const open = !collapsed[g.key];
        return (
          <section key={g.key} className="doc-category">
            <button
              type="button"
              className="doc-toggle"
              aria-expanded={open}
              aria-controls={`cat-${g.key}`}
              onClick={() => setCollapsed((c) => ({ ...c, [g.key]: open }))}
            >
              <span className="doc-toggle-label">{g.label}</span>
              <span className="doc-toggle-count">{g.items.length}</span>
            </button>
            {open && (
              <ul id={`cat-${g.key}`} className="doc-list">
                {g.items.map((p) => (
                  <li key={p}>
                    <button
                      type="button"
                      className={p === active ? 'doc-item doc-item--on' : 'doc-item'}
                      onClick={() => onOpen(p)}
                    >
                      {titles[p] || fallbackTitle(p)}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
      {active ? (
        <ReadingPane path={active} onOpenFile={onOpenFile} canOpen={canOpen} />
      ) : (
        <p className="empty-copy">select a document to read it</p>
      )}
    </div>
  );
}

/* ---------- derive session status from events ---------- */

const SESSION_STATUS = { created: 'running', idle: 'idle', error: 'error', compacted: 'compacted' };

function lastSessionStatus(events, sessionID) {
  let status = null;
  for (const ev of events) {
    if (ev.sessionID === sessionID && ev.type === 'session') {
      status = SESSION_STATUS[ev.status] || ev.status;
    }
  }
  return status;
}

function parseGoal(projectState) {
  if (!projectState) return null;
  for (const line of projectState.split('\n')) {
    const m = line.match(/^\s*-\s*Goal:\s*(.+)$/i);
    if (m) return m[1].trim();
  }
  return null;
}

/* ---------- header ---------- */

function Header({ lastEventTs, tickerTick }) {
  // tickerTick forces re-render so the "age" text stays fresh
  void tickerTick;
  return (
    <header className="header">
      <h1 className="wordmark">
        guarana <span className="wordmark-sub">— system of record</span>
      </h1>
      <div className="header-meta">
        <span className={`pill ${lastEventTs != null && Date.now() - lastEventTs < 15000 ? 'pill--live' : ''}`}>
          last event {fmtAge(lastEventTs)}
        </span>
        <span className="pill">port {location.port || '(default)'}</span>
      </div>
    </header>
  );
}

/* ---------- NOW panel ---------- */

function NowPanel({ summary, mergedEvents, state }) {
  if (!summary || summary.runs.length === 0) {
    return (
      <section id="now" className="now" aria-label="Current session">
        <h2 className="section-title">Now</h2>
        <EmptyState copy="No telemetry yet. Install the plugin:" hint="guarana plugin install --project" />
      </section>
    );
  }
  const latest = summary.runs[0]; // sorted by start desc
  const status = lastSessionStatus(mergedEvents, latest.sessionID) || 'unknown';
  const goal = parseGoal(state?.projectState);
  return (
    <section id="now" className="now" aria-label="Current session">
      <h2 className="section-title">Now</h2>
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
        {goal && <p className="now-goal">goal: {goal}</p>}
      </div>
    </section>
  );
}

/* ---------- ticker ---------- */

const TICKER_KIND = { tool: '›tool', tokens: '›tokens', session: '›session', todo: '›todo' };

function tickerLine(ev) {
  const parts = [];
  if (ev.sessionID) parts.push(ev.sessionID);
  if (ev.tool) parts.push(ev.tool);
  if (ev.status) parts.push(ev.status);
  if (ev.ok === false) parts.push('FAILED');
  if (ev.error) parts.push(`(${ev.error})`);
  if (typeof ev.tokens === 'number') parts.push(`tokens=${ev.tokens}`);
  if (typeof ev.count === 'number') parts.push(`count=${ev.count}`);
  return parts.join(' ');
}

function Ticker({ events }) {
  const items = useMemo(
    () => [...events].sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0)).slice(-40),
    [events]
  );
  if (items.length === 0) return null;
  const tape = items.map((ev, i) => (
    <span key={i} className={`tick tick--${ev.type} ${ev.ok === false || ev.status === 'error' ? 'tick--err' : ''}`}>
      <b>{TICKER_KIND[ev.type] || `›${ev.type}`}</b> {tickerLine(ev)}
    </span>
  ));
  return (
    <div className="ticker" aria-label="Live telemetry ticker">
      <div className="ticker-tape">
        {tape}
        {tape}
      </div>
    </div>
  );
}

/* ---------- section nav ---------- */

const SECTIONS = [['now', 'Now'], ['runs', 'Runs'], ['specs', 'Specs']];

function SectionNav() {
  return (
    <nav className="sect-nav" aria-label="Jump to section">
      {SECTIONS.map(([id, label]) => (
        <button
          key={id}
          type="button"
          className="sect-nav-btn"
          onClick={() => document.getElementById(id)?.scrollIntoView()}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}

/* ---------- run modal ---------- */

const modalFocusables = (root) =>
  root
    ? [...root.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((el) => !el.disabled)
    : [];

function RunModal({ sessionID, onClose }) {
  const boxRef = useRef(null);
  useEffect(() => {
    const box = boxRef.current;
    if (box) {
      const els = modalFocusables(box);
      (els[0] || box).focus();
    }
  }, []);
  const handleKey = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === 'Tab') {
      const box = boxRef.current;
      if (!box) return;
      const els = modalFocusables(box);
      if (els.length === 0) {
        e.preventDefault();
        return;
      }
      const first = els[0];
      const last = els[els.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === box)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        ref={boxRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Event stream for ${sessionID}`}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKey}
      >
        <button type="button" className="modal-close" onClick={onClose}>
          close
        </button>
        <div className="modal-body">
          <EventStream sessionID={sessionID} />
        </div>
      </div>
    </div>
  );
}

/* ---------- runs ledger ---------- */

function EventStream({ sessionID }) {
  const { data } = usePoll(`/api/telemetry/events?session=${encodeURIComponent(sessionID)}`);
  if (!data) return <p className="loading">loading events…</p>;
  return (
    <div className="events">
      <h3 className="sub-title">event stream — {sessionID}</h3>
      <ul>
        {data.events.map((ev, i) => (
          <li key={i}>
            <span className="ev-ts">{fmtTime(ev.ts)}</span>
            <span className={`ev-kind ev-kind--${ev.type}`}>{TICKER_KIND[ev.type] || ev.type}</span>
            <span className="ev-body">
              {ev.tool && <>{ev.tool} </>}
              {ev.status && <Stamp word={ev.status} />}
              {ev.ok === false && <Stamp word="fail" />}
              {ev.error && <span className="err"> ({ev.error}) </span>}
              {typeof ev.tokens === 'number' && <> tokens={ev.tokens}</>}
              {typeof ev.count === 'number' && <> count={ev.count}</>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Runs({ summary, mergedEvents }) {
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
      {selected && <RunModal sessionID={selected} onClose={closeModal} />}
    </section>
  );
}

/* ---------- system of record ---------- */

function LedgerPage({ title, text }) {
  return (
    <div className="ledger-page">
      <h3 className="sub-title">{title}</h3>
      <Markdown text={text || '(empty)'} />
    </div>
  );
}

function Specs({ tracker, state }) {
  const [view, setView] = useState('overview');
  const [tree, setTree] = useState(null);
  const [active, setActive] = useState(null);
  const [titles, setTitles] = useState({});
  const pending = usePoll('/api/decisions/pending');
  const resolveDecision = async (file, statement, outcome) => {
    try {
      await fetch('/api/decisions/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file, statement, outcome }),
      });
    } finally {
      pending.refetch();
    }
  };

  useEffect(() => {
    let cancelled = false;
    fetch('/api/specs/tree')
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled) setTree(json.files || []);
      })
      .catch(() => {
        if (!cancelled) setTree([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Cache a human title per listed document by reading its `# ` first heading.
  const docPaths = useMemo(() => buildGroups(tree).flatMap((g) => g.items), [tree]);
  useEffect(() => {
    let cancelled = false;
    const need = docPaths.filter((p) => !(p in titles));
    if (need.length === 0) return;
    Promise.all(
      need.map(async (p) => {
        try {
          const res = await fetch(`/api/specs/file?path=${encodeURIComponent(p)}`);
          const text = res.ok ? await res.text() : '';
          const m = text.match(/^\s*#\s+(.+)$/m);
          return [p, m ? m[1].trim() : fallbackTitle(p)];
        } catch {
          return [p, fallbackTitle(p)];
        }
      })
    ).then((entries) => {
      if (!cancelled) setTitles((t) => ({ ...t, ...Object.fromEntries(entries) }));
    });
    return () => {
      cancelled = true;
    };
  }, [docPaths, titles]);

  const openDoc = (rel) => {
    setActive(rel);
    setView('documents');
  };

  return (
    <section id="specs" aria-label="System of record">
      <h2 className="section-title">System of record</h2>
      {pending.data && pending.data.decisions.length > 0 && (
        <div className="decisions-panel">
          <h3 className="sub-title">Decisions needing you</h3>
          <ul className="decisions-list">
            {pending.data.decisions.map((d, i) => (
              <li key={i}>
                <span className="decisions-statement">{d.statement}</span>
                <span className="decisions-actions">
                  <button type="button" className="decision-btn" onClick={() => resolveDecision(d.file, d.statement, 'accepted')}>Accept</button>
                  <button type="button" className="decision-btn" onClick={() => resolveDecision(d.file, d.statement, 'rejected')}>Reject</button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="spec-tabs" role="tablist" aria-label="Specs views">
        <button
          type="button"
          role="tab"
          aria-selected={view === 'overview'}
          className={view === 'overview' ? 'spec-tab spec-tab--on' : 'spec-tab'}
          onClick={() => setView('overview')}
        >
          Overview
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'documents'}
          className={view === 'documents' ? 'spec-tab spec-tab--on' : 'spec-tab'}
          onClick={() => setView('documents')}
        >
          Documents
        </button>
      </div>

      {view === 'documents' ? (
        <Documents
          tree={tree || []}
          titles={titles}
          active={active}
          onOpen={openDoc}
          onOpenFile={openDoc}
          canOpen={isDocPath}
        />
      ) : (
        <>
          {tracker ? (
            <>
              <div className="table-scroll">
                <table className="ledger">
                  <thead>
                    <tr>
                      <th>skill</th>
                      <th>status</th>
                      <th>proof</th>
                      <th>change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tracker.rows.map((r, i) => (
                      <tr key={i} tabIndex={0}>
                        <td>{r.skill}</td>
                        <td>
                          <Stamp word={r.status} />
                        </td>
                        <td><MdLink text={r.proof} onOpenFile={openDoc} canOpen={isDocPath} /></td>
                        <td><MdLink text={r.change} onOpenFile={openDoc} canOpen={isDocPath} /></td>
                      </tr>
                    ))}
                    {tracker.rows.length === 0 && (
                      <tr>
                        <td colSpan={4}>no tracker rows</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {['DONE', 'NEXT', 'BLOCKED'].map((k) =>
                tracker[k].length ? (
                  <p key={k} className="flag-line">
                    <Stamp word={k} /> {tracker[k].join(' · ')}
                  </p>
                ) : null
              )}
            </>
          ) : (
            <p className="loading">loading tracker…</p>
          )}
          <div className="ledger-pages">
            <LedgerPage title="project-state.md" text={state ? state.projectState : 'loading…'} />
            <LedgerPage title="known-issues.md" text={state ? state.knownIssues : 'loading…'} />
          </div>
        </>
      )}
    </section>
  );
}

/* ---------- app ---------- */

export default function App() {
  const summary = usePoll('/api/telemetry/summary');
  const state = usePoll('/api/specs/state');
  const tracker = usePoll('/api/specs/tracker');
  const [mergedEvents, setMergedEvents] = useState([]);

  // Fetch events for the ~5 most recent sessions and merge by ts.
  const recentIDs = summary.data ? summary.data.runs.slice(0, 5).map((r) => r.sessionID).join(',') : '';
  useEffect(() => {
    if (!recentIDs) {
      setMergedEvents([]);
      return;
    }
    let cancelled = false;
    const load = async () => {
      const ids = recentIDs.split(',');
      try {
        const results = await Promise.all(
          ids.map((id) => fetch(`/api/telemetry/events?session=${encodeURIComponent(id)}`).then((r) => r.json()))
        );
        if (cancelled) return;
        const merged = results.flatMap((r) => r.events || []).sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0));
        setMergedEvents(merged);
      } catch {
        /* keep last good data */
      }
    };
    load();
    const id = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [recentIDs]);

  const lastEventTs = mergedEvents.length ? mergedEvents[mergedEvents.length - 1].ts : null;
  const hasTelemetry = summary.data && summary.data.runs.length > 0;

  return (
    <main>
      <Header lastEventTs={lastEventTs} tickerTick={mergedEvents.length} />
      <SectionNav />
      {summary.error && <ErrorBanner text={summary.error} />}
      {!summary.data && !summary.error && <p className="loading">loading…</p>}
      {summary.data && (
        <>
          <NowPanel summary={summary.data} mergedEvents={mergedEvents} state={state.data} />
          {hasTelemetry && <Ticker events={mergedEvents} />}
          <Runs summary={summary.data} mergedEvents={mergedEvents} />
        </>
      )}
      <Specs tracker={tracker.data} state={state.data} />
    </main>
  );
}
