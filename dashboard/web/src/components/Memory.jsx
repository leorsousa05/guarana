import { useState } from 'react';
import { fmtTs } from '../lib/format.js';
import { usePoll } from '../hooks/usePoll.js';
import { EmptyState, ErrorBanner, handleTabKeyDown } from './common.jsx';
import { MemoryGraph } from './MemoryGraph.jsx';
import { MemoryInjections } from './MemoryInjections.jsx';

const TYPE_LABEL = { decision: 'decision', bug: 'bug', solution: 'solution', refactor: 'refactor', preference: 'preference', supernode: 'supernode', atom: 'atom' };

const TABS = [
  ['injected', 'Injected'],
  ['summary', 'Summary'],
  ['search', 'Search'],
  ['graph', 'Graph'],
];

const TAB_HINTS = {
  injected: 'Recent context',
  summary: 'Scope counts',
  search: 'Find a record',
  graph: 'Explore links',
};

export function memorySummaryRows(data) {
  const d = data;
  if (!d) return [];
  return [
    ['project nodes', d.nodes?.byScope?.project ?? d.nodes?.total ?? 0, 'project'],
    ['global nodes', d.nodes?.byScope?.global ?? 0, 'global'],
    ['total nodes', d.nodes?.total ?? 0],
    ['confirmed', d.nodes?.confirmed ?? 0],
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
                <div><dt>type</dt><dd className="mem-result-type">{r.type}</dd></div>
                <div><dt>score</dt><dd>{typeof r.score === 'number' ? r.score.toFixed(3) : '—'}</dd></div>
                <div><dt>timestamp</dt><dd><time dateTime={r.ts == null ? undefined : new Date(r.ts).toISOString()}>{fmtTs(r.ts)}</time></dd></div>
              </dl>
              <div className="mem-result-copy">
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
  const scopes = rows.filter(([, , scope]) => scope);
  const totals = rows.filter(([, , scope]) => !scope);
  return (
    <div className="mem-summary">
      <dl className="mem-summary-scopes" aria-label="Memory counts by scope">
        {scopes.map(([label, val, scope]) => (
          <div key={label} className={`mem-summary-scope mem-summary-scope--${scope}`}>
            <dt>{scope === 'global' ? 'Private global memories' : 'Project memories'}</dt>
            <dd>{val}</dd>
          </div>
        ))}
      </dl>
      <dl className="mem-summary-details" aria-label="Other memory counts">
        {totals.map(([label, val]) => (
          <div key={label} className="mem-summary-row">
            <dt>{label}</dt>
            <dd>{val}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function Memory() {
  const summary = usePoll('/api/memory/summary', 5000);
  const graph = usePoll('/api/memory/graph', 5000);
  const [tab, setTab] = useState('injected');
  const [sel, setSel] = useState(null);
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [results, setResults] = useState(null);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [err, setErr] = useState(null);

  const runSearch = async (e) => {
    e?.preventDefault();
    setSearching(true);
    setErr(null);
    try {
      const res = await fetch(memorySearchUrl(q, type));
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
    <section id="memory" className="memory-page" aria-label="Memory">
      <h2 className="section-title">Memory</h2>

      <div className="mem-tabs" role="tablist" aria-label="Memory sections" onKeyDown={(event) => handleTabKeyDown(event, TABS.map(([id]) => id), setTab)}>
        {TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`memory-tab-${id}`}
            data-tab-id={id}
            aria-controls={`memory-panel-${id}`}
            aria-selected={tab === id}
            tabIndex={tab === id ? 0 : -1}
            className={`mem-tab${tab === id ? ' mem-tab--active' : ''}`}
            onClick={() => setTab(id)}
            aria-label={label}
          >
            <span className="mem-tab-label">{label}</span>
            <span className="mem-tab-hint" aria-hidden="true">{TAB_HINTS[id]}</span>
          </button>
        ))}
      </div>

      {summary.error && <ErrorBanner text={summary.error} />}
      <div id="memory-panel-injected" role="tabpanel" aria-labelledby="memory-tab-injected" tabIndex={0} hidden={tab !== 'injected'}>
        {tab === 'injected' && <MemoryInjections />}
      </div>

      <div id="memory-panel-summary" role="tabpanel" aria-labelledby="memory-tab-summary" tabIndex={0} hidden={tab !== 'summary'}>
        <header className="mem-panel-heading">
          <h3>Memory at a glance</h3>
          <p>Confirmed and stored context across project and global scopes.</p>
        </header>
        {!summary.data && !summary.error && <p className="loading" role="status">loading summary…</p>}
        {sdata && <MemorySummary data={sdata} />}
      </div>

      <div id="memory-panel-search" role="tabpanel" aria-labelledby="memory-tab-search" tabIndex={0} hidden={tab !== 'search'} aria-live="polite">
        <header className="mem-panel-heading">
          <h3>Find confirmed project memory</h3>
          <p>Search only this project&rsquo;s confirmed records. Private global preferences are not included.</p>
        </header>
        <MemorySearchForm
          query={q}
          onQueryChange={setQ}
          type={type}
          onTypeChange={setType}
          onSubmit={runSearch}
          searching={searching}
        />
        {err && <ErrorBanner text={`Memory search failed: ${err}`} />}
        {results && results.error && <ErrorBanner text={results.error} />}
        {!searched && !searching && <EmptyState copy="Search confirmed memory by text or type." />}
        {results && !results.error && results.results?.length === 0 && (
          <EmptyState copy="no confirmed matches" hint="try a different query" />
        )}
        {results && !results.error && <MemorySearchResults results={results.results} />}
      </div>

      <div id="memory-panel-graph" role="tabpanel" aria-labelledby="memory-tab-graph" tabIndex={0} hidden={tab !== 'graph'}>
        {graph.error && <ErrorBanner text={graph.error} />}
        <header className="mem-panel-heading">
          <h3>Memory graph</h3>
          <p>Explore confirmed relationships across project knowledge and global preferences.</p>
        </header>
        {!graph.data && !graph.error && <p className="loading" role="status">loading memory graph…</p>}
        {hasGraph ? (
          <MemoryGraph
            nodes={graph.data.nodes}
            edges={graph.data.edges}
            selected={sel}
            onSelect={setSel}
            onChange={graph.refetch}
          />
        ) : graph.data && graph.data.nodes?.length === 0 ? (
          <EmptyState copy="No confirmed memories in the graph yet. Save a decision to get started." />
        ) : null}
      </div>

    </section>
  );
}
