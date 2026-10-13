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

export function LedgerPage({ title, text, onOpen }) {
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
export const flattenDocumentPaths = (groups) => groups.flatMap((group) => [
  ...group.items,
  ...flattenDocumentPaths(group.children),
]);

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

export function Roadmap({ tracker, onOpenText }) {
  const statuses = ['BLOCKED', 'NEXT', 'DONE'];
  const hasItems = statuses.some((status) => tracker[status]?.length);
  return (
    <section className="spec-roadmap" aria-labelledby="spec-roadmap-title">
      <header className="spec-section-head">
        <div>
          <p className="spec-kicker">Priority and next actions</p>
          <h3 id="spec-roadmap-title">Roadmap</h3>
        </div>
      </header>
      {hasItems ? statuses.map((status) => {
        const items = tracker[status] || [];
        if (!items.length) return null;
        const itemList = (
          <ul>
            {items.map((item, index) => (
              <li key={`${status}-${index}`}>
                <p className="spec-text-preview" title={excerpt(item, 500)}>{excerpt(item)}</p>
                <button type="button" className="spec-read-button" onClick={() => onOpenText(`Roadmap — ${status.toLowerCase()}`, item)}>Read</button>
              </li>
            ))}
          </ul>
        );
        const heading = (
          <h4><Stamp word={status} /><span>{status === 'BLOCKED' ? 'Blocked' : status === 'NEXT' ? 'Next' : 'Done'}</span><span className="spec-roadmap-count">{items.length}</span></h4>
        );
        return (
          <section key={status} className={`spec-roadmap-group spec-roadmap-group--${status.toLowerCase()}`} aria-label={`${status} roadmap items`}>
            {status === 'DONE' && items.length > 3 ? (
              <details className="spec-roadmap-collapsible">
                <summary><Stamp word={status} /><span>Done</span><span className="spec-roadmap-count">{items.length}</span><span className="spec-roadmap-hint">Show completed items</span></summary>
                {itemList}
              </details>
            ) : <>{heading}{itemList}</>}
          </section>
        );
      }) : <p className="spec-roadmap-empty">No roadmap items recorded.</p>}
    </section>
  );
}

const LIFECYCLE_STAGES = ['SPECIFIED', 'TASKED', 'IMPLEMENTED', 'VALIDATED', 'SHIPPED'];
const TRACKER_BUCKETS = [...LIFECYCLE_STAGES, 'Unspecified', 'Other'];

function lifecycleBucket(status) {
  if (status == null || (typeof status === 'string' && !status.trim())) return 'Unspecified';
  if (typeof status !== 'string') return 'Other';
  let finalStage = null;
  for (const match of status.matchAll(/\b(SPECIFIED|TASKED|IMPLEMENTED|VALIDATED|SHIPPED)\b/gi)) {
    finalStage = match[1].toUpperCase();
  }
  return finalStage || 'Other';
}

function TrackerStatusStrip({ tracker }) {
  if (!tracker) {
    return <p className="loading spec-tracker-loading" role="status">loading tracker…</p>;
  }
  const rows = Array.isArray(tracker.rows) ? tracker.rows : [];
  const statusCounts = Object.fromEntries(TRACKER_BUCKETS.map((status) => [status, 0]));
  rows.forEach((row) => { statusCounts[lifecycleBucket(row?.status)] += 1; });
  return (
    <section className="spec-status-strip" aria-label="Tracker status summary" data-tracked-count={rows.length}>
      <div className="spec-status-total">
        <span className="spec-kicker">Tracked rows</span>
        <strong>{rows.length}</strong>
        <span>implementation records</span>
      </div>
      <ul className="spec-status-counts" aria-label="Tracker rows grouped by lifecycle status">
        {TRACKER_BUCKETS.map((status) => (
          <li className="spec-status-count" data-status={status} key={status}>
            <span>{status}</span><b>{statusCounts[status]}</b>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Overview({ tracker, state, decisions, pending, resolving, resolution, onResolve, onOpen, onOpenText, onReadDecision }) {
  return (
    <div className="spec-overview">
      <TrackerStatusStrip tracker={tracker} />
      <div className="spec-priority-grid">
        {tracker && tracker.schema !== 'unknown' && <Roadmap tracker={tracker} onOpenText={onOpenText} />}
        <PendingDecisionQueue
          decisions={decisions}
          error={pending.error}
          loading={!pending.data && !pending.error}
          resolving={resolving}
          resolution={resolution}
          onRead={onReadDecision}
          onResolve={onResolve}
        />
      </div>
      <section className="spec-state spec-context" aria-labelledby="spec-state-title">
        <header className="spec-section-head">
          <div>
            <p className="spec-kicker">Working context</p>
            <h3 id="spec-state-title">Project state &amp; known issues</h3>
          </div>
        </header>
        <div className="spec-state-pages">
          <LedgerPage title="project-state.md" text={state ? state.projectState : 'loading…'} onOpen={onOpenText} />
          <LedgerPage title="known-issues.md" text={state ? state.knownIssues : 'loading…'} onOpen={onOpenText} />
        </div>
      </section>
      <section className="spec-register" aria-label="Full implementation tracker">
        {!tracker ? null : tracker.schema === 'unknown' ? (
          <div className="ledger-note" role="note">
            {tracker.message || 'This project does not follow the Guarana spec schema; the tracker cannot be rendered here.'}
          </div>
        ) : (
          <details className="spec-tracker-details">
            <summary className="spec-tracker-summary">
              <span className="spec-tracker-summary-copy">
                <span className="spec-kicker">Implementation register</span>
                <span className="spec-tracker-title" id="spec-tracker-title">Implementation tracker</span>
              </span>
              <span className="spec-tracker-entry-count">{Array.isArray(tracker.rows) ? tracker.rows.length : 0} entries</span>
            </summary>
            <div className="table-scroll spec-tracker-scroll" role="region" aria-label="Implementation tracker; scroll horizontally to see every field" tabIndex={0}>
              <table className="ledger spec-tracker-table">
                <thead>
                  <tr><th scope="col">skill</th><th scope="col">status</th><th scope="col">proof</th><th scope="col">change</th></tr>
                </thead>
                <tbody>
                  {(Array.isArray(tracker.rows) ? tracker.rows : []).map((row, index) => (
                    <tr key={index}>
                      <td>{row.skill}</td>
                      <td><span className="spec-tracker-raw-status">{typeof row.status === 'string' ? row.status : '—'}</span></td>
                      <td><MdLink text={row.proof} onOpenFile={onOpen} canOpen={isDocPath} /></td>
                      <td><MdLink text={row.change} onOpenFile={onOpen} canOpen={isDocPath} /></td>
                    </tr>
                  ))}
                  {(!Array.isArray(tracker.rows) || tracker.rows.length === 0) && <tr><td colSpan={4}>no tracker rows</td></tr>}
                </tbody>
              </table>
            </div>
          </details>
        )}
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

  const docPaths = useMemo(() => flattenDocumentPaths(buildGroups(tree)), [tree]);
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
        <Overview
          tracker={tracker}
          state={state}
          decisions={pending.data?.decisions ?? null}
          pending={pending}
          resolving={resolving}
          resolution={resolution}
          onResolve={resolveDecision}
          onOpen={openDoc}
          onOpenText={openText}
          onReadDecision={(statement) => openText('Pending decision', statement)}
        />
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
