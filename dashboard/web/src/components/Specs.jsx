import { useEffect, useMemo, useState } from 'react';
import { usePoll } from '../hooks/usePoll.js';
import { Stamp } from './common.jsx';
import { Markdown, MdLink } from '../lib/markdown.jsx';
import { Documents, buildGroups } from './Documents.jsx';

function LedgerPage({ title, text }) {
  return (
    <div className="ledger-page">
      <h3 className="sub-title">{title}</h3>
      <Markdown text={text || '(empty)'} />
    </div>
  );
}

const isDocPath = (rel) =>
  /^(changes|decisions|features|archive)\//.test(rel) || !/\//.test(rel);

export function Specs({ tracker, state }) {
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

function fallbackTitle(rel) {
  return rel.split('/').pop().replace(/\.md$/i, '');
}
