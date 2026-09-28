import { useState } from 'react';
import { fmtTs } from '../lib/format.js';
import { usePoll } from '../hooks/usePoll.js';
import { EmptyState, ErrorBanner } from './common.jsx';
import { MemoryGraph } from './MemoryGraph.jsx';
import { MemoryInjections } from './MemoryInjections.jsx';

const TYPE_LABEL = { decision: 'decision', bug: 'bug', solution: 'solution', refactor: 'refactor', preference: 'preference', supernode: 'supernode', atom: 'atom' };
const TYPE_CLASS = (t) => (TYPE_LABEL[t] ? `mem-type mem-type--${t}` : 'mem-type');

const TABS = [
  ['injected', 'Injected'],
  ['summary', 'Summary'],
  ['search', 'Search'],
  ['graph', 'Graph'],
];

function summaryCards(s) {
  const d = s.data;
  if (!d) return [];
  return [
    ['total nodes', d.nodes?.total ?? 0],
    ['project', d.nodes?.byScope?.project ?? d.nodes?.total ?? 0],
    ['global', d.nodes?.byScope?.global ?? 0],
    ['confirmed', d.nodes?.confirmed ?? 0],
    ['supernodes', d.supernodes ?? 0],
    ['edges', d.edges ?? 0],
  ];
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
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      if (type) params.set('type', type);
      const res = await fetch(`/api/memory/search?${params.toString()}`);
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
    <section id="memory" aria-label="Memory">
      <h2 className="section-title">Memory</h2>

      <div className="mem-tabs" role="tablist" aria-label="Memory sections">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`mem-tab${tab === id ? ' mem-tab--active' : ''}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {summary.error && <ErrorBanner text={summary.error} />}
      {tab === 'injected' && (
        <div role="tabpanel" aria-label="Injected memory">
          <MemoryInjections />
        </div>
      )}
      {tab === 'summary' && (
        <div role="tabpanel" aria-label="Summary">
          {!summary.data && <p className="loading">loading…</p>}
          {sdata && (
            <dl className="mem-summary now-grid">
              {summaryCards(summary).map(([label, val]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{val}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}

      {tab === 'search' && (
        <div role="tabpanel" aria-label="Search" aria-live="polite">
          <form className="mem-search" onSubmit={runSearch}>
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="search confirmed memory…"
              aria-label="search memory"
            />
            <select value={type} onChange={(e) => setType(e.target.value)} aria-label="filter by type">
              <option value="">any type</option>
              {Object.entries(TYPE_LABEL).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <button type="submit" disabled={searching} aria-busy={searching}>
              {searching ? 'Searching…' : 'Search'}
            </button>
          </form>
          {results && results.error && <ErrorBanner text={results.error} />}
          {results && !results.error && results.results?.length === 0 && (
            <EmptyState copy="no confirmed matches" hint="try a different query" />
          )}
          {results && results.results?.length > 0 && (
            <div className="table-scroll">
              <table className="ledger">
                <thead>
                  <tr>
                    <th>type</th>
                    <th>intent</th>
                    <th>summary</th>
                    <th>score</th>
                    <th>ts</th>
                  </tr>
                </thead>
                <tbody>
                  {results.results.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <span className={TYPE_CLASS(r.type)}>{r.type}</span>
                      </td>
                      <td>{r.intent}</td>
                      <td className="mem-summ">{r.summary}</td>
                      <td>{typeof r.score === 'number' ? r.score.toFixed(3) : '—'}</td>
                      <td>{fmtTs(r.ts)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {searched && !searching && results === null && !err && <p className="loading">no search yet</p>}
        </div>
      )}

      {tab === 'graph' && (
        <div role="tabpanel" aria-label="Graph">
          {graph.error && <ErrorBanner text={graph.error} />}
          {!graph.data && <p className="loading">loading…</p>}
          {hasGraph ? (
            <MemoryGraph
              nodes={graph.data.nodes}
              edges={graph.data.edges}
              selected={sel}
              onSelect={setSel}
            />
          ) : (
            !graph.data && graph.data?.nodes?.length === 0 && <EmptyState copy="no confirmed nodes" />
          )}
        </div>
      )}

    </section>
  );
}
