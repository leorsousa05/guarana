import { useEffect, useState } from 'react';
import { fmtTs } from '../lib/format.js';
import { EmptyState, ErrorBanner, handleTabKeyDown } from './common.jsx';
import { MemoryGraph } from './MemoryGraph.jsx';
import { MemoryInjections } from './MemoryInjections.jsx';

export const MEMORY_PREFERENCE_CATEGORIES = ['agent_behavior', 'workflow', 'communication', 'general'];
const PREFERENCE_TABS = [
  ['library', 'Preference library'],
  ['graph', 'Preference graph'],
  ['injection-history', 'Injection history'],
];
const noop = () => {};

export function memoryPreferencesUrl({ query = '', category = '', status = 'active' } = {}) {
  const params = new URLSearchParams();
  if (query.trim()) params.set('q', query.trim());
  if (category) params.set('category', category);
  params.set('status', status);
  return `/api/memory/preferences?${params.toString()}`;
}

export async function loadMemoryPreferences(filters, request = (...args) => globalThis.fetch(...args)) {
  const response = await request(memoryPreferencesUrl(filters));
  const result = await response.json();
  if (!response.ok || result?.error) throw new Error(result?.error || `${response.status} ${response.statusText}`);
  return Array.isArray(result?.preferences) ? result.preferences : [];
}

export async function loadMemoryPreferenceGraph(request = (...args) => globalThis.fetch(...args)) {
  const response = await request('/api/memory/graph?scope=global', { method: 'GET' });
  const result = await response.json();
  if (!response.ok || result?.error) throw new Error(result?.error || `${response.status} ${response.statusText}`);
  return {
    nodes: Array.isArray(result?.nodes) ? result.nodes : [],
    edges: Array.isArray(result?.edges) ? result.edges : [],
  };
}

export function groupMemoryPreferences(preferences) {
  const groups = new Map(MEMORY_PREFERENCE_CATEGORIES.map((category) => [category, []]));
  for (const preference of Array.isArray(preferences) ? preferences : []) {
    const category = MEMORY_PREFERENCE_CATEGORIES.includes(preference.category) ? preference.category : 'general';
    groups.get(category).push({ ...preference, category });
  }
  return [...groups].filter(([, entries]) => entries.length > 0);
}

export function MemoryPreferenceRecords({ preferences }) {
  const groups = groupMemoryPreferences(preferences);
  if (!groups.length) return <EmptyState copy="No global preferences match these filters." hint="Change the text, category, or status to browse the confirmed preference library." />;
  return (
    <div className="memory-preference-groups">
      {groups.map(([category, entries]) => (
        <section key={category} className="memory-preference-group" aria-labelledby={`memory-preference-category-${category}`}>
          <header className="memory-preference-group-heading">
            <h5 id={`memory-preference-category-${category}`}>{category.replaceAll('_', ' ')}</h5>
            <span>{entries.length} {entries.length === 1 ? 'preference' : 'preferences'}</span>
          </header>
          <ol className="memory-preference-list">
            {entries.map((preference) => {
              const timestamp = preference.ts == null ? null : new Date(preference.ts);
              const dateTime = timestamp && Number.isFinite(timestamp.getTime()) ? timestamp.toISOString() : undefined;
              const tags = Array.isArray(preference.tags) ? preference.tags : [];
              const status = preference.status === 'superseded' ? 'superseded' : 'active';
              return (
                <li key={preference.id}>
                  <article className="memory-preference-entry">
                    <header className="memory-preference-entry-heading">
                      <h6>{preference.intent || 'Untitled preference'}</h6>
                      <span className={`memory-preference-status memory-preference-status--${status}`}>{status}</span>
                    </header>
                    <dl className="memory-preference-meta">
                      <div><dt>scope</dt><dd>Global</dd></div>
                      <div><dt>category</dt><dd>{category.replaceAll('_', ' ')}</dd></div>
                      {preference.priority && <div><dt>priority</dt><dd>{preference.priority}</dd></div>}
                      <div><dt>timestamp</dt><dd><time dateTime={dateTime}>{fmtTs(preference.ts)}</time></dd></div>
                    </dl>
                    {preference.summary && <p className="memory-preference-summary">{preference.summary}</p>}
                    {tags.length > 0 && <p className="memory-preference-tags"><span>tags</span> {tags.join(', ')}</p>}
                  </article>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}

export function MemoryPreferences({ tab = 'library', setTab = noop }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('active');
  const [preferences, setPreferences] = useState(null);
  const [graph, setGraph] = useState(null);
  const [graphSelected, setGraphSelected] = useState(null);
  const [graphLoading, setGraphLoading] = useState(false);
  const [graphError, setGraphError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (tab !== 'library') return undefined;
    let current = true;
    setLoading(true);
    setError(null);
    setPreferences(null);
    loadMemoryPreferences({ query, category, status })
      .then((entries) => { if (current) setPreferences(entries); })
      .catch((failure) => { if (current) setError(String(failure)); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [query, category, status, tab]);

  useEffect(() => {
    if (tab !== 'graph') return undefined;
    let current = true;
    setGraphLoading(true);
    setGraphError(null);
    setGraph(null);
    loadMemoryPreferenceGraph()
      .then((result) => { if (current) setGraph(result); })
      .catch((failure) => { if (current) setGraphError(String(failure)); })
      .finally(() => { if (current) setGraphLoading(false); });
    return () => { current = false; };
  }, [tab]);

  return (
    <section className="mem-workspace-content memory-preferences" aria-label="User preferences">
      <header className="mem-workspace-heading mem-workspace-heading--preferences">
        <h3>User preferences</h3>
        <p>Confirmed global preferences, read-only and independent of the selected project.</p>
      </header>

      <div className="mem-local-tabs mem-local-tabs--preferences" role="tablist" aria-label="User preferences sections" onKeyDown={(event) => handleTabKeyDown(event, PREFERENCE_TABS.map(([id]) => id), setTab)}>
        {PREFERENCE_TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`memory-preferences-tab-${id}`}
            data-tab-id={id}
            aria-controls={`memory-preferences-panel-${id}`}
            aria-selected={tab === id}
            tabIndex={tab === id ? 0 : -1}
            className={`mem-local-tab${tab === id ? ' mem-local-tab--active' : ''}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {PREFERENCE_TABS.map(([id]) => <div key={id} id={`memory-preferences-panel-${id}`} role="tabpanel" aria-labelledby={`memory-preferences-tab-${id}`} tabIndex={0} hidden={tab !== id}>
        {id === 'library' && tab === id && <>
          <header className="mem-panel-heading">
            <h4>Global preference library</h4>
            <p>Browse confirmed user preferences grouped by category. The library is read-only; active preferences are shown first, and superseded records remain inspectable.</p>
          </header>
          <div className="memory-preference-filters" role="group" aria-label="Filter global preferences">
            <label>Text
              <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="search preference text or tags" aria-label="Search global preferences" />
            </label>
            <label>Category
              <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filter preferences by category">
                <option value="">all categories</option>
                {MEMORY_PREFERENCE_CATEGORIES.map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}
              </select>
            </label>
            <label>Status
              <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter preferences by status">
                <option value="active">active</option>
                <option value="superseded">superseded</option>
                <option value="all">all statuses</option>
              </select>
            </label>
          </div>
          {loading && <p className="loading" role="status">loading global preferences…</p>}
          {error && <ErrorBanner text={`Global preference library failed: ${error}`} />}
          {preferences && !error && <MemoryPreferenceRecords preferences={preferences} />}
        </>}

        {id === 'graph' && tab === id && <>
          <header className="mem-panel-heading">
            <h4>Global preference graph</h4>
            <p>Explore confirmed global preferences and their relationships. This graph is read-only and independent of the selected project.</p>
          </header>
          {graphLoading && <p className="loading" role="status">loading global preference graph…</p>}
          {graphError && <ErrorBanner text={`Global preference graph failed: ${graphError}`} />}
          {graph && !graphError && <MemoryGraph
            nodes={graph.nodes}
            edges={graph.edges}
            selected={graphSelected}
            onSelect={setGraphSelected}
            globalPreferencesOnly
          />}
        </>}

        {id === 'injection-history' && tab === id && <>
          <header className="mem-panel-heading">
            <h4>Global preference injection history</h4>
            <p>Historical assistant context containing only confirmed global user preferences.</p>
          </header>
          <MemoryInjections scope="global" />
        </>}
      </div>)}
    </section>
  );
}
