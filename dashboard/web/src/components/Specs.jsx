import { useEffect, useMemo, useState } from 'react';
import { usePoll } from '../hooks/usePoll.js';
import { ErrorBanner, handleTabKeyDown, Stamp } from './common.jsx';
import { MdLink, isSpecPath } from '../lib/markdown.jsx';
import { Documents, buildGroups } from './Documents.jsx';
import { SpecsMarkdownModal } from './SpecsMarkdownModal.jsx';

function excerpt(text, limit = 190) {
  const source = String(text || '');
  const paragraphs = source.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
  const paragraph = paragraphs.find((part) => !/^#{1,6}\s/.test(part)) || paragraphs[0] || '';
  const plain = paragraph
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[`*_>#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > limit ? `${plain.slice(0, limit).trimEnd()}…` : plain || '(empty)';
}

function LedgerPage({ title, text, onOpen }) {
  return (
    <div className="ledger-page">
      <div className="ledger-page-copy">
        <h3 className="sub-title">{title}</h3>
        <p className="spec-text-preview">{text === 'loading…' ? text : excerpt(text)}</p>
      </div>
      <button
        type="button"
        className="spec-read-button"
        disabled={!text || text === 'loading…'}
        onClick={() => onOpen(title, text || '(empty)')}
      >
        Read full text
      </button>
    </div>
  );
}

const isDocPath = (rel) => isSpecPath(rel);

export function Specs({ tracker, state, tick = 0 }) {
  const [view, setView] = useState('overview');
  const [tree, setTree] = useState(null);
  const [treeError, setTreeError] = useState(null);
  const [active, setActive] = useState(null);
  const [titles, setTitles] = useState({});
  const [resolving, setResolving] = useState(null);
  const [resolution, setResolution] = useState(null);
  const [reader, setReader] = useState(null);
  const pending = usePoll('/api/decisions/pending', 5000, tick);
  const resolveDecision = async (file, statement, outcome) => {
    const id = JSON.stringify([file, statement]);
    if (resolving) return;
    setResolving(id);
    setResolution(null);
    try {
      const response = await fetch('/api/decisions/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file, statement, outcome }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || `${response.status} ${response.statusText}`);
      setResolution({ type: 'success', text: `Decision ${outcome}.` });
    } catch (error) {
      setResolution({ type: 'error', text: `Unable to ${outcome} decision: ${error.message || error}` });
    } finally {
      setResolving(null);
      pending.refetch();
    }
  };

  useEffect(() => {
    let cancelled = false;
    fetch('/api/specs/tree')
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
        return r.json();
      })
      .then((json) => {
        if (!cancelled) {
          setTree(json.files || []);
          setTreeError(null);
        }
      }).catch((error) => {
        if (!cancelled) setTreeError(`Unable to load documents: ${error.message || error}`);
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

  const openText = (title, text) => setReader({ title, text });

  const openDoc = (rel) => {
    setActive(rel);
    setView('documents');
    setReader({ title: titles[rel] || fallbackTitle(rel), path: rel });
  };

  return (
    <section id="specs" aria-label="System of record">
      <h2 className="section-title">System of record</h2>
      {pending.error && <ErrorBanner text={`Unable to load pending decisions: ${pending.error}`} />}
      {pending.data && pending.data.decisions.length > 0 && (
        <div className="decisions-panel">
          <h3 className="sub-title">Decisions needing you</h3>
          <ul className="decisions-list">
            {pending.data.decisions.map((d, i) => (
              <li key={`${d.file}:${d.statement}`}>
                <span className="decisions-statement" title={d.statement}>{excerpt(d.statement, 150)}</span>
                <span className="decisions-actions">
                  <button type="button" className="spec-read-button" onClick={() => openText('Pending decision', d.statement)}>Read</button>
                  <button type="button" className="decision-btn" disabled={resolving !== null} onClick={() => resolveDecision(d.file, d.statement, 'accepted')}>
                    {resolving === JSON.stringify([d.file, d.statement]) ? 'Saving…' : 'Accept'}
                  </button>
                  <button type="button" className="decision-btn" disabled={resolving !== null} onClick={() => resolveDecision(d.file, d.statement, 'rejected')}>
                    {resolving === JSON.stringify([d.file, d.statement]) ? 'Saving…' : 'Reject'}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {resolution && (
        <p className={`decision-feedback decision-feedback--${resolution.type}`} role={resolution.type === 'error' ? 'alert' : 'status'}>
          {resolution.text}
        </p>
      )}
      <div className="spec-tabs" role="tablist" aria-label="Specs views" onKeyDown={(event) => handleTabKeyDown(event, ['overview', 'documents'], setView)}>
        <button
          type="button"
          role="tab"
          id="spec-tab-overview"
          data-tab-id="overview"
          aria-controls="spec-panel-overview"
          aria-selected={view === 'overview'}
          tabIndex={view === 'overview' ? 0 : -1}
          className={view === 'overview' ? 'spec-tab spec-tab--on' : 'spec-tab'}
          onClick={() => setView('overview')}
        >
          Overview
        </button>
        <button
          type="button"
          role="tab"
          id="spec-tab-documents"
          data-tab-id="documents"
          aria-controls="spec-panel-documents"
          aria-selected={view === 'documents'}
          tabIndex={view === 'documents' ? 0 : -1}
          className={view === 'documents' ? 'spec-tab spec-tab--on' : 'spec-tab'}
          onClick={() => setView('documents')}
        >
          Documents
        </button>
      </div>

      {view === 'documents' ? (
        <div id="spec-panel-documents" role="tabpanel" aria-labelledby="spec-tab-documents" tabIndex={0}>
          {tree === null ? (
            treeError ? <ErrorBanner text={treeError} /> : <p className="loading" role="status">loading documents…</p>
          ) : (
            <Documents
              tree={tree}
              titles={titles}
              active={active}
              onOpen={openDoc}
            />
          )}
        </div>
      ) : (
        <div id="spec-panel-overview" role="tabpanel" aria-labelledby="spec-tab-overview" tabIndex={0}>
          <section className="spec-block" aria-labelledby="spec-tracker-title">
            <header className="spec-block-head">
              <h3 id="spec-tracker-title">Implementation tracker</h3>
              {tracker?.rows && <span>{tracker.rows.length} entries</span>}
            </header>
            {tracker ? (
              tracker.schema === 'unknown' ? (
                <div className="ledger-note" role="note">
                  {tracker.message || 'This project does not follow the Guarana spec schema; the tracker cannot be rendered here.'}
                </div>
              ) : (
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
              )
            ) : (
              <p className="loading" role="status">loading tracker…</p>
            )}
          </section>
          {tracker && tracker.schema !== 'unknown' && (
            <section className="spec-roadmap" aria-labelledby="spec-roadmap-title">
              <h3 id="spec-roadmap-title">Roadmap</h3>
              {['BLOCKED', 'NEXT', 'DONE'].flatMap((status) =>
                (tracker[status] || []).map((item, index) => (
                  <div key={`${status}-${index}`} className="flag-line">
                    <Stamp word={status} />
                    <span className="spec-text-preview" title={excerpt(item, 500)}>{excerpt(item)}</span>
                    <button type="button" className="spec-read-button" onClick={() => openText(`Roadmap — ${status.toLowerCase()}`, item)}>Read</button>
                  </div>
                ))
              )}
              {!['BLOCKED', 'NEXT', 'DONE'].some((status) => tracker[status]?.length) && (
                <p className="spec-roadmap-empty">No roadmap items recorded.</p>
              )}
            </section>
          )}
          <div className="ledger-pages">
            <LedgerPage title="project-state.md" text={state ? state.projectState : 'loading…'} onOpen={openText} />
            <LedgerPage title="known-issues.md" text={state ? state.knownIssues : 'loading…'} onOpen={openText} />
          </div>
        </div>
      )}
      {reader && (
        <SpecsMarkdownModal
          title={reader.title}
          text={reader.text}
          path={reader.path}
          onClose={() => setReader(null)}
          onOpenFile={openDoc}
          canOpen={isDocPath}
        />
      )}
    </section>
  );
}

function fallbackTitle(rel) {
  return rel.split('/').pop().replace(/\.md$/i, '');
}
