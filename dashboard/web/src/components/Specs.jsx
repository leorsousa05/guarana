import { useEffect, useMemo, useRef, useState } from 'react';
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
    <section className="spec-state-page" aria-labelledby={`spec-${title}`}>
      <div className="spec-state-copy">
        <h4 id={`spec-${title}`}>{title}</h4>
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
    </section>
  );
}

const isDocPath = (rel) => isSpecPath(rel);

export async function postDecisionResolution(file, statement, outcome, request = fetch) {
  const response = await request('/api/decisions/resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file, statement, outcome }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `${response.status} ${response.statusText}`);
  return result;
}

export function PendingDecisionQueue({
  decisions,
  error,
  loading,
  resolving,
  resolution,
  onRead,
  onResolve,
}) {
  return (
    <section className="spec-decision-queue" aria-labelledby="spec-decisions-title">
      <header className="spec-decision-head">
        <div>
          <p className="spec-kicker">Action queue</p>
          <h3 id="spec-decisions-title">Decisions needing you</h3>
        </div>
        {decisions?.length > 0 && <span className="spec-decision-count">{decisions.length} open</span>}
      </header>
      {error && <ErrorBanner text={`Unable to load pending decisions: ${error}`} />}
      {loading && !error && <p className="loading" role="status">loading pending decisions…</p>}
      {decisions?.length > 0 && (
        <>
          <ul className="decisions-list">
            {decisions.map((decision) => {
              const id = JSON.stringify([decision.file, decision.statement]);
              const saving = resolving === id;
              return (
                <li key={id}>
                  <div className="spec-decision-detail">
                    <p className="decisions-statement" title={decision.statement}>{excerpt(decision.statement, 170)}</p>
                    <span className="spec-decision-file">{decision.file}</span>
                  </div>
                  <span className="decisions-actions">
                    <button type="button" className="spec-read-button" onClick={() => onRead(decision.statement)}>Read</button>
                    <button
                      type="button"
                      className="decision-btn"
                      aria-label={`Accept decision: ${excerpt(decision.statement, 110)}`}
                      disabled={resolving !== null}
                      onClick={() => onResolve(decision.file, decision.statement, 'accepted')}
                    >
                      {saving ? 'Saving…' : 'Accept'}
                    </button>
                    <button
                      type="button"
                      className="decision-btn"
                      aria-label={`Reject decision: ${excerpt(decision.statement, 110)}`}
                      disabled={resolving !== null}
                      onClick={() => onResolve(decision.file, decision.statement, 'rejected')}
                    >
                      {saving ? 'Saving…' : 'Reject'}
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="spec-file-wide-note">
            Resolution is file-wide: resolving one item in a file can hide every pending decision in that file.
          </p>
        </>
      )}
      {decisions && decisions.length === 0 && !error && <p className="spec-queue-empty">No open decisions.</p>}
      {resolution && (
        <p className={`decision-feedback decision-feedback--${resolution.type}`} role={resolution.type === 'error' ? 'alert' : 'status'}>
          {resolution.text}
        </p>
      )}
    </section>
  );
}

function Roadmap({ tracker, onOpen }) {
  const statuses = ['BLOCKED', 'NEXT', 'DONE'];
  const hasItems = statuses.some((status) => tracker[status]?.length);
  return (
    <section className="spec-roadmap" aria-labelledby="spec-roadmap-title">
      <header className="spec-section-head">
        <div>
          <p className="spec-kicker">Priority and progress</p>
          <h3 id="spec-roadmap-title">Roadmap</h3>
        </div>
      </header>
      {hasItems ? statuses.map((status) => {
        const items = tracker[status] || [];
        if (!items.length) return null;
        return (
          <section key={status} className={`spec-roadmap-group spec-roadmap-group--${status.toLowerCase()}`} aria-label={`${status} roadmap items`}>
            <h4><Stamp word={status} /><span>{status === 'BLOCKED' ? 'Blocked' : status === 'NEXT' ? 'Next' : 'Done'}</span><span className="spec-roadmap-count">{items.length}</span></h4>
            <ul>
              {items.map((item, index) => (
                <li key={`${status}-${index}`}>
                  <p className="spec-text-preview" title={excerpt(item, 500)}>{excerpt(item)}</p>
                  <button type="button" className="spec-read-button" onClick={() => onOpen(`Roadmap — ${status.toLowerCase()}`, item)}>Read</button>
                </li>
              ))}
            </ul>
          </section>
        );
      }) : <p className="spec-roadmap-empty">No roadmap items recorded.</p>}
    </section>
  );
}

function Overview({ tracker, state, onOpen }) {
  return (
    <div className="spec-overview">
      <section className="spec-block" aria-labelledby="spec-tracker-title">
        <header className="spec-section-head spec-block-head">
          <div>
            <p className="spec-kicker">Implementation status</p>
            <h3 id="spec-tracker-title">Implementation tracker</h3>
          </div>
          {tracker?.rows && <span>{tracker.rows.length} entries</span>}
        </header>
        {tracker ? (
          tracker.schema === 'unknown' ? (
            <div className="ledger-note" role="note">
              {tracker.message || 'This project does not follow the Guarana spec schema; the tracker cannot be rendered here.'}
            </div>
          ) : (
            <div className="table-scroll spec-tracker-scroll" role="region" aria-label="Implementation tracker; scroll horizontally to see every field" tabIndex={0}>
              <table className="ledger spec-tracker-table">
                <thead>
                  <tr><th scope="col">skill</th><th scope="col">status</th><th scope="col">proof</th><th scope="col">change</th></tr>
                </thead>
                <tbody>
                  {tracker.rows.map((row, index) => (
                    <tr key={index}>
                      <td>{row.skill}</td>
                      <td><Stamp word={row.status} /></td>
                      <td><MdLink text={row.proof} onOpenFile={onOpen} canOpen={isDocPath} /></td>
                      <td><MdLink text={row.change} onOpenFile={onOpen} canOpen={isDocPath} /></td>
                    </tr>
                  ))}
                  {tracker.rows.length === 0 && <tr><td colSpan={4}>no tracker rows</td></tr>}
                </tbody>
              </table>
            </div>
          )
        ) : <p className="loading" role="status">loading tracker…</p>}
      </section>
      {tracker && tracker.schema !== 'unknown' && <Roadmap tracker={tracker} onOpen={onOpen} />}
      <section className="spec-state" aria-labelledby="spec-state-title">
        <header className="spec-section-head">
          <div>
            <p className="spec-kicker">Current project record</p>
            <h3 id="spec-state-title">Project state and known issues</h3>
          </div>
        </header>
        <div className="spec-state-pages">
          <LedgerPage title="project-state.md" text={state ? state.projectState : 'loading…'} onOpen={onOpen} />
          <LedgerPage title="known-issues.md" text={state ? state.knownIssues : 'loading…'} onOpen={onOpen} />
        </div>
      </section>
    </div>
  );
}

export function Specs({ tracker, state, tick = 0 }) {
  const [view, setView] = useState('overview');
  const [tree, setTree] = useState(null);
  const [treeError, setTreeError] = useState(null);
  const [active, setActive] = useState(null);
  const [titles, setTitles] = useState({});
  const [resolving, setResolving] = useState(null);
  const [resolution, setResolution] = useState(null);
  const [reader, setReader] = useState(null);
  const focusDocumentsAfterClose = useRef(false);
  const pending = usePoll('/api/decisions/pending', 5000, tick);

  const resolveDecision = async (file, statement, outcome) => {
    const id = JSON.stringify([file, statement]);
    if (resolving) return;
    setResolving(id);
    setResolution(null);
    try {
      await postDecisionResolution(file, statement, outcome);
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
      .then((response) => {
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        return response.json();
      })
      .then((json) => {
        if (!cancelled) {
          setTree(json.files || []);
          setTreeError(null);
        }
      }).catch((error) => {
        if (!cancelled) setTreeError(`Unable to load documents: ${error.message || error}`);
      });
    return () => { cancelled = true; };
  }, []);

  const docPaths = useMemo(() => buildGroups(tree).flatMap((group) => group.items), [tree]);
  useEffect(() => {
    let cancelled = false;
    const need = docPaths.filter((path) => !(path in titles));
    if (need.length === 0) return undefined;
    Promise.all(need.map(async (path) => {
      try {
        const response = await fetch(`/api/specs/file?path=${encodeURIComponent(path)}`);
        const text = response.ok ? await response.text() : '';
        const match = text.match(/^\s*#\s+(.+)$/m);
        return [path, match ? match[1].trim() : fallbackTitle(path)];
      } catch {
        return [path, fallbackTitle(path)];
      }
    })).then((entries) => {
      if (!cancelled) setTitles((current) => ({ ...current, ...Object.fromEntries(entries) }));
    });
    return () => { cancelled = true; };
  }, [docPaths, titles]);

  const openText = (title, text) => setReader({ title, text });
  const openDoc = (rel) => {
    if (view !== 'documents') focusDocumentsAfterClose.current = true;
    setActive(rel);
    setView('documents');
    setReader({ title: titles[rel] || fallbackTitle(rel), path: rel });
  };

  useEffect(() => {
    if (reader || !focusDocumentsAfterClose.current) return;
    focusDocumentsAfterClose.current = false;
    document.getElementById('spec-tab-documents')?.focus();
  }, [reader]);

  return (
    <section id="specs" className="specs-screen" aria-label="System of record">
      <header className="specs-page-head">
        <div>
          <p className="spec-kicker">Project ledger</p>
          <h2 className="section-title">System of record</h2>
        </div>
        <p>Implementation evidence, priority, and working documents.</p>
      </header>

      <PendingDecisionQueue
        decisions={pending.data?.decisions ?? null}
        error={pending.error}
        loading={!pending.data && !pending.error}
        resolving={resolving}
        resolution={resolution}
        onRead={(statement) => openText('Pending decision', statement)}
        onResolve={resolveDecision}
      />

      <div className="spec-tabs" role="tablist" aria-label="Specs views" onKeyDown={(event) => handleTabKeyDown(event, ['overview', 'documents'], setView)}>
        <button
          type="button" role="tab" id="spec-tab-overview" data-tab-id="overview"
          aria-controls="spec-panel-overview" aria-selected={view === 'overview'}
          tabIndex={view === 'overview' ? 0 : -1}
          className={view === 'overview' ? 'spec-tab spec-tab--on' : 'spec-tab'}
          onClick={() => setView('overview')}
        >Overview</button>
        <button
          type="button" role="tab" id="spec-tab-documents" data-tab-id="documents"
          aria-controls="spec-panel-documents" aria-selected={view === 'documents'}
          tabIndex={view === 'documents' ? 0 : -1}
          className={view === 'documents' ? 'spec-tab spec-tab--on' : 'spec-tab'}
          onClick={() => setView('documents')}
        >Documents</button>
      </div>

      <div id="spec-panel-overview" role="tabpanel" aria-labelledby="spec-tab-overview" tabIndex={0} hidden={view !== 'overview'}>
        <Overview tracker={tracker} state={state} onOpen={openDoc} />
      </div>
      <div id="spec-panel-documents" role="tabpanel" aria-labelledby="spec-tab-documents" tabIndex={0} hidden={view !== 'documents'}>
        {tree === null ? (
          treeError ? <ErrorBanner text={treeError} /> : <p className="loading" role="status">loading documents…</p>
        ) : (
          <Documents tree={tree} titles={titles} active={active} onOpen={openDoc} />
        )}
      </div>

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
