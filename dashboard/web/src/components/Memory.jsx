import { useEffect, useState } from 'react';
import { fmtTs } from '../lib/format.js';
import { usePoll } from '../hooks/usePoll.js';
import { useProjectFetch } from '../lib/projectApi.js';
import { EmptyState, ErrorBanner, handleTabKeyDown } from './common.jsx';
import { MemoryGraph } from './MemoryGraph.jsx';
import { MemoryInjections } from './MemoryInjections.jsx';
import { MemoryPreferences } from './MemoryPreferences.jsx';

const TYPE_LABEL = { decision: 'decision', bug: 'bug', solution: 'solution', refactor: 'refactor', preference: 'preference', supernode: 'supernode', atom: 'atom' };

const WORKSPACES = [
  ['project', 'Project knowledge', 'Selected-project records, graph, drafts, and legacy history'],
  ['preferences', 'User preferences', 'Read-only global preference library and history'],
];

const PROJECT_TABS = [
  ['overview', 'Overview'],
  ['search', 'Search'],
  ['graph', 'Graph'],
  ['drafts', 'Drafts'],
  ['legacy-injections', 'Legacy injections'],
];

export const MEMORY_DRAFT_DISCARD_WARNING = 'Discard this draft and its edges? They will be deleted permanently and cannot be restored.';
export const MEMORY_PROJECT_TYPES = ['decision', 'bug', 'solution', 'refactor'];

export async function reviewMemoryDraft(id, action, projectFetch, targetType, confirmDiscard = (message) => globalThis.confirm(message)) {
  if (!id || !['confirm', 'discard'].includes(action)) throw new Error('Invalid memory draft review action');
  if (action === 'confirm' && !MEMORY_PROJECT_TYPES.includes(targetType))
    throw new Error('An explicit project memory type is required before confirming this draft');
  if (action === 'discard' && !confirmDiscard(MEMORY_DRAFT_DISCARD_WARNING)) return false;

  const response = await projectFetch('/api/memory/review', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, action, ...(action === 'confirm' ? { edits: { type: targetType } } : {}) }),
  });
  const result = await response.json();
  if (!response.ok || result?.error) throw new Error(result?.error || `${response.status} ${response.statusText}`);
  return true;
}

export function MemoryDraftList({ drafts, onReview, reviewingId }) {
  const [targetTypes, setTargetTypes] = useState({});
  if (!drafts?.length) return null;
  return (
    <ol className="memory-draft-list" aria-label="Project memory drafts">
      {drafts.map((draft) => {
        const timestamp = draft.ts == null ? null : new Date(draft.ts);
        const dateTime = timestamp && Number.isFinite(timestamp.getTime()) ? timestamp.toISOString() : undefined;
        const tags = Array.isArray(draft.tags) ? draft.tags : [];
        const draftName = draft.intent || 'untitled';
        const busy = reviewingId === draft.id;
        const targetType = targetTypes[draft.id] || '';
        return (
          <li key={draft.id} className="memory-draft-entry">
            <article>
              <h4 className="memory-draft-intent"><span className="mem-result-label">intent</span>{draft.intent || 'Untitled draft'}</h4>
              <dl className="memory-draft-meta">
                <div><dt>type</dt><dd>{draft.type || '—'}</dd></div>
                <div><dt>timestamp</dt><dd><time dateTime={dateTime}>{fmtTs(draft.ts)}</time></dd></div>
                <div><dt>tags</dt><dd>{tags.length ? tags.join(', ') : '—'}</dd></div>
              </dl>
              <div className="memory-draft-actions" role="group" aria-label={`Review ${draftName} draft`}>
                <label className="memory-draft-type-label">
                  Convert to project type
                  <select
                    value={targetType}
                    onChange={(event) => setTargetTypes((current) => ({ ...current, [draft.id]: event.target.value }))}
                    aria-label={`Convert ${draftName} draft to project type`}
                    aria-required="true"
                    disabled={Boolean(reviewingId)}
                  >
                    <option value="">Select type…</option>
                    {MEMORY_PROJECT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </label>
                <button type="button" disabled={Boolean(reviewingId) || !targetType} aria-busy={busy} aria-label={`Confirm draft: ${draftName}`} onClick={() => onReview(draft.id, 'confirm', targetType)}>
                  {busy ? 'Reviewing…' : 'Confirm'}
                </button>
                <button type="button" disabled={Boolean(reviewingId)} aria-busy={busy} aria-label={`Discard draft: ${draftName}`} onClick={() => onReview(draft.id, 'discard')}>
                  {busy ? 'Reviewing…' : 'Discard'}
                </button>
              </div>
            </article>
          </li>
        );
      })}
    </ol>
  );
}

export function memorySummaryRows(data) {
  const d = data;
  if (!d) return [];
  return [
    ['project memories', d.nodes?.byScope?.project ?? d.nodes?.total ?? 0],
    ['confirmed', d.nodes?.confirmed ?? 0],
    ['drafts', d.nodes?.draft ?? 0],
    ['supernodes', d.supernodes ?? 0],
    ['edges', d.edges ?? 0],
  ];
}

export function memorySearchUrl(query, type) {
  const params = new URLSearchParams();
  if (query.trim()) params.set('q', query.trim());
  if (type) params.set('type', type);
  return `/api/memory/search?${params.toString()}`;
}

export function MemorySearchForm({ query, onQueryChange, type, onTypeChange, onSubmit, searching }) {
  return (
    <form className="mem-search" onSubmit={onSubmit}>
      <input
        type="search"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="search confirmed memory…"
        aria-label="search memory"
      />
      <select value={type} onChange={(event) => onTypeChange(event.target.value)} aria-label="filter by type">
        <option value="">any type</option>
        {Object.entries(TYPE_LABEL).map(([value, label]) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>
      <button type="submit" disabled={searching} aria-busy={searching}>
        {searching ? 'Searching…' : 'Search'}
      </button>
    </form>
  );
}

export function MemorySearchResults({ results }) {
  if (!results?.length) return null;
  return (
    <div className="mem-results" role="region" aria-label="Memory search results" tabIndex={0}>
      <ol className="mem-result-list">
        {results.map((r) => (
          <li key={r.id}>
            <article className="mem-result">
              <dl className="mem-result-meta">
                <div><dt>scope</dt><dd>project</dd></div>
                <div><dt>type</dt><dd className="mem-result-type">{r.type}</dd></div>
                <div><dt>score</dt><dd>{typeof r.score === 'number' ? r.score.toFixed(3) : '—'}</dd></div>
                <div><dt>timestamp</dt><dd><time dateTime={r.ts == null ? undefined : new Date(r.ts).toISOString()}>{fmtTs(r.ts)}</time></dd></div>
              </dl>
              <div className="mem-result-copy">
                {['preference', 'atom', 'supernode'].includes(r.type) && <p className="mem-legacy-record-label">{r.type === 'preference' ? 'Project · legacy preference' : 'Legacy project record'}</p>}
                <h4><span className="mem-result-label">intent</span>{r.intent}</h4>
                <p><span className="mem-result-label">summary</span>{r.summary}</p>
              </div>
            </article>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function MemorySummary({ data }) {
  const rows = memorySummaryRows(data);
  if (!rows.length) return null;
  return (
    <div className="mem-summary">
      <dl className="mem-summary-details" aria-label="Project memory counts">
        {rows.map(([label, val]) => (
          <div key={label} className="mem-summary-row">
            <dt>{label}</dt>
            <dd>{val}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function ProjectKnowledge({ tab, setTab }) {
  const projectFetch = useProjectFetch();
  const summary = usePoll('/api/memory/summary?scope=project', 5000);
  const graph = usePoll('/api/memory/graph?scope=project', 5000);
  const [sel, setSel] = useState(null);
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [results, setResults] = useState(null);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [err, setErr] = useState(null);
  const [drafts, setDrafts] = useState(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftError, setDraftError] = useState(null);
  const [draftNotice, setDraftNotice] = useState('');
  const [reviewingDraftId, setReviewingDraftId] = useState(null);
  const [draftReload, setDraftReload] = useState(0);

  useEffect(() => {
    if (tab !== 'drafts') return undefined;
    let current = true;
    setDraftLoading(true);
    setDraftError(null);
    projectFetch('/api/memory/drafts')
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || result?.error) throw new Error(result?.error || `${response.status} ${response.statusText}`);
        if (current) setDrafts(Array.isArray(result?.drafts) ? result.drafts : []);
      })
      .catch((error) => {
        if (current) setDraftError(String(error));
      })
      .finally(() => {
        if (current) setDraftLoading(false);
      });
    return () => { current = false; };
  }, [tab, projectFetch, draftReload]);

  const reviewDraft = async (id, action, targetType) => {
    setReviewingDraftId(id);
    setDraftError(null);
    setDraftNotice('');
    try {
      const reviewed = await reviewMemoryDraft(id, action, projectFetch, targetType);
      if (reviewed) {
        setDraftNotice(action === 'confirm' ? 'Draft confirmed.' : 'Draft discarded.');
        setDraftReload((value) => value + 1);
      }
    } catch (error) {
      setDraftError(`Memory draft review failed: ${String(error)}`);
    } finally {
      setReviewingDraftId(null);
    }
  };

  const runSearch = async (e) => {
    e?.preventDefault();
    setSearching(true);
    setErr(null);
    try {
      const res = await projectFetch(memorySearchUrl(q, type));
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      setResults(await res.json());
    } catch (ex) {
      setErr(String(ex));
      setResults(null);
    } finally {
      setSearching(false);
      setSearched(true);
    }
  };

  const sdata = summary.data;
  const hasGraph = graph.data && graph.data.nodes?.length > 0;

  return (
    <section className="mem-workspace-content" aria-label="Project knowledge">
      <header className="mem-workspace-heading">
        <h3>Project knowledge</h3>
        <p>Memory records belong to the selected project. Global user preferences live in their separate workspace.</p>
      </header>

      <div className="mem-local-tabs" role="tablist" aria-label="Project knowledge sections" onKeyDown={(event) => handleTabKeyDown(event, PROJECT_TABS.map(([id]) => id), setTab)}>
        {PROJECT_TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`memory-project-tab-${id}`}
            data-tab-id={id}
            aria-controls={`memory-project-panel-${id}`}
            aria-selected={tab === id}
            tabIndex={tab === id ? 0 : -1}
            className={`mem-local-tab${tab === id ? ' mem-local-tab--active' : ''}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {PROJECT_TABS.map(([id]) => <div key={id} id={`memory-project-panel-${id}`} role="tabpanel" aria-labelledby={`memory-project-tab-${id}`} tabIndex={0} hidden={tab !== id}>
        {tab === 'overview' && id === 'overview' && <>
          {summary.error && <ErrorBanner text={summary.error} />}
          <header className="mem-panel-heading">
            <h4>Project memory overview</h4>
            <p>Counts include only confirmed and draft records in the selected project.</p>
          </header>
          {!summary.data && !summary.error && <p className="loading" role="status">loading project summary…</p>}
          {sdata && <MemorySummary data={sdata} />}
          {sdata && memorySummaryRows(sdata)[0]?.[1] === 0 && <EmptyState copy="No project memories are recorded for this project yet." />}
        </>}

        {tab === 'search' && id === 'search' && <div aria-live="polite">
          <header className="mem-panel-heading">
            <h4>Find confirmed project memory</h4>
            <p>Search confirmed records in this project only. Legacy project-scoped preferences, atoms, and supernodes remain searchable and are labelled; global user preferences are not included.</p>
          </header>
          <MemorySearchForm query={q} onQueryChange={setQ} type={type} onTypeChange={setType} onSubmit={runSearch} searching={searching} />
          {err && <ErrorBanner text={`Memory search failed: ${err}`} />}
          {results && results.error && <ErrorBanner text={results.error} />}
          {!searched && !searching && <EmptyState copy="Search confirmed memory in this project by text or type." />}
          {results && !results.error && results.results?.length === 0 && <EmptyState copy="No confirmed project matches." hint="try a different query" />}
          {results && !results.error && <MemorySearchResults results={results.results} />}
        </div>}

        {tab === 'graph' && id === 'graph' && <>
          {graph.error && <ErrorBanner text={graph.error} />}
          <header className="mem-panel-heading">
            <h4>Project memory graph</h4>
            <p>Explore confirmed relationships in this project only. User preferences are shown separately.</p>
          </header>
          {!graph.data && !graph.error && <p className="loading" role="status">loading project memory graph…</p>}
          {hasGraph ? <MemoryGraph nodes={graph.data.nodes} edges={graph.data.edges} selected={sel} onSelect={setSel} onChange={graph.refetch} projectOnly />
            : graph.data && graph.data.nodes?.length === 0 ? <EmptyState copy="No confirmed project memories in the graph yet. Save a project decision to get started." /> : null}
        </>}

        {tab === 'drafts' && id === 'drafts' && <>
          <header className="mem-panel-heading">
            <h4>Project memory drafts</h4>
            <p>Review pending drafts for this project. Draft details cannot be edited here.</p>
          </header>
          {draftLoading && <p className="loading" role="status">loading project drafts…</p>}
          {draftError && <ErrorBanner text={draftError} />}
          {draftNotice && <p className="memory-draft-notice" role="status" aria-live="polite">{draftNotice}</p>}
          {drafts && !draftLoading && drafts.length === 0 && <EmptyState copy="No project drafts to review." />}
          {drafts && <MemoryDraftList drafts={drafts} onReview={reviewDraft} reviewingId={reviewingDraftId} />}
        </>}

        {tab === 'legacy-injections' && id === 'legacy-injections' && <>
          <header className="mem-panel-heading">
            <h4>Legacy project injection history</h4>
            <p>This is only older project-context history. Project memories are not injected now.</p>
          </header>
          <MemoryInjections scope="project" historical />
        </>}
      </div>)}
    </section>
  );
}

export function Memory() {
  const [workspace, setWorkspace] = useState('project');
  const [projectTab, setProjectTab] = useState('overview');
  const [preferencesTab, setPreferencesTab] = useState('library');

  return (
    <section id="memory" className="memory-page" aria-label="Memory">
      <h2 className="section-title">Memory</h2>
      <div className="mem-workspace-switch" role="tablist" aria-label="Memory workspaces" onKeyDown={(event) => handleTabKeyDown(event, WORKSPACES.map(([id]) => id), setWorkspace)}>
        {WORKSPACES.map(([id, label, description]) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`memory-workspace-tab-${id}`}
            data-tab-id={id}
            aria-controls={`memory-workspace-panel-${id}`}
            aria-selected={workspace === id}
            tabIndex={workspace === id ? 0 : -1}
            className={`mem-workspace-tab${workspace === id ? ' mem-workspace-tab--active' : ''}`}
            onClick={() => setWorkspace(id)}
          >
            <span className="mem-workspace-tab-label">{label}</span>
            <span className="mem-workspace-tab-description">{description}</span>
          </button>
        ))}
      </div>

      {WORKSPACES.map(([id]) => <div key={id} id={`memory-workspace-panel-${id}`} role="tabpanel" aria-labelledby={`memory-workspace-tab-${id}`} tabIndex={0} hidden={workspace !== id}>
        {workspace === id && (id === 'project'
          ? <ProjectKnowledge tab={projectTab} setTab={setProjectTab} />
          : <MemoryPreferences tab={preferencesTab} setTab={setPreferencesTab} />)}
      </div>)}
    </section>
  );
}
