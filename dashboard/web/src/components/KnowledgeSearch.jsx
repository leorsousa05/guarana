import { useRef, useState } from 'react';
import { memorySearchUrl } from './Memory.jsx';
import { loadMemoryPreferences } from './MemoryPreferences.jsx';
import { filterSkills } from './Skills.jsx';
import { useProjectFetch } from '../lib/projectApi.js';

const SOURCE_GROUPS = [
  { id: 'tracker', label: 'Specs · Project tracker', scope: 'Project', route: 'specs', action: 'Open Specs' },
  { id: 'decisions', label: 'Specs · Pending decisions', scope: 'Project', route: 'specs', action: 'Open Specs' },
  { id: 'documents', label: 'Specs · Documents', scope: 'Project', route: 'specs', action: 'Open Specs' },
  { id: 'memory', label: 'Project Memory', scope: 'Project', route: 'memory', action: 'Open Project Memory' },
  { id: 'preferences', label: 'User preferences', scope: 'Global', route: 'memory', action: 'Open User preferences' },
  { id: 'skills', label: 'Skills', scope: 'Global and Project', route: 'skills', action: 'Open Skills' },
];

const INITIAL_SOURCES = Object.fromEntries(
  SOURCE_GROUPS.map(({ id }) => [id, { status: 'idle', results: [] }]),
);

function text(value) {
  return typeof value === 'string' ? value : '';
}

function matches(query, ...values) {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return false;
  return values.flat(Infinity).some((value) => text(value).toLocaleLowerCase().includes(needle));
}

function concise(value, limit = 190) {
  const content = text(value).replace(/\s+/g, ' ').trim();
  return content.length > limit ? `${content.slice(0, limit).trimEnd()}…` : content;
}

function documentTitle(path) {
  return path.split('/').pop()?.replace(/\.md$/i, '') || path;
}

async function projectJson(projectFetch, url) {
  const response = await projectFetch(url);
  const data = await response.json();
  if (!response.ok || data?.error) throw new Error(data?.error || `${response.status} ${response.statusText}`);
  return data;
}

function trackerResults(data, query) {
  if (!Array.isArray(data?.rows)) throw new Error('Invalid Specs tracker response.');
  return data.rows
    .filter((row) => matches(query, row?.skill, row?.status, row?.proof, row?.change))
    .map((row, index) => ({
      id: `tracker-${index}`,
      title: text(row?.skill) || 'Untitled tracker row',
      detail: concise([
        row?.status && `Status: ${row.status}`,
        row?.proof && `Proof: ${row.proof}`,
        row?.change && `Change: ${row.change}`,
      ].filter(Boolean).join(' · ')),
    }));
}

function decisionResults(data, query) {
  if (!Array.isArray(data?.decisions)) throw new Error('Invalid pending decisions response.');
  return data.decisions
    .filter((decision) => matches(query, decision?.statement, decision?.file))
    .map((decision, index) => ({
      id: `decision-${index}`,
      title: text(decision.statement) || 'Pending decision',
      detail: text(decision.file),
    }));
}

function documentResults(data, query) {
  if (!Array.isArray(data?.files)) throw new Error('Invalid Specs tree response.');
  return data.files
    .filter((path) => typeof path === 'string')
    .filter((path) => matches(query, documentTitle(path), path))
    .map((path) => ({ id: path, title: documentTitle(path), detail: path }));
}

function memoryResults(data, query) {
  if (!Array.isArray(data?.results)) throw new Error('Invalid project memory search response.');
  return data.results
    .filter((record) => matches(query, record?.intent, record?.summary, record?.type, record?.tags))
    .map((record, index) => ({
      id: text(record?.id) || `memory-${index}`,
      title: text(record?.intent) || text(record?.type) || 'Untitled memory record',
      detail: concise([
        record?.type && `Type: ${record.type}`,
        record?.summary,
      ].filter(Boolean).join(' · ')),
    }));
}

function preferenceResults(records, query) {
  return records
    .filter((record) => matches(query, record?.intent, record?.summary, record?.category, record?.tags))
    .map((record, index) => ({
      id: text(record?.id) || `preference-${index}`,
      title: text(record?.intent) || 'Untitled preference',
      detail: concise([
        record?.summary,
        record?.category && `Category: ${record.category}`,
        record?.status && `Status: ${record.status}`,
      ].filter(Boolean).join(' · ')),
    }));
}

function skillResults(data, query) {
  if (!Array.isArray(data?.global) || !Array.isArray(data?.project)) {
    throw new Error('Invalid skills library response.');
  }
  return ['global', 'project'].flatMap((scope) => filterSkills(data[scope], query)
    .map((skill) => ({
      id: `${scope}:${skill.name}`,
      title: text(skill.name) || 'Untitled skill',
      detail: concise([skill.category, skill.description].filter(Boolean).join(' · ')),
      scope: scope === 'global' ? 'Global' : 'Project',
    })));
}

export async function runKnowledgeSearch(query, projectFetch, onSourceUpdate, preferencesLoader = loadMemoryPreferences) {
  const term = query.trim();
  const sources = [
    ['tracker', async () => trackerResults(await projectJson(projectFetch, '/api/specs/tracker'), term)],
    ['decisions', async () => decisionResults(await projectJson(projectFetch, '/api/decisions/pending'), term)],
    ['documents', async () => documentResults(await projectJson(projectFetch, '/api/specs/tree'), term)],
    ['memory', async () => memoryResults(await projectJson(projectFetch, memorySearchUrl(term)), term)],
    ['preferences', async () => preferenceResults(await preferencesLoader({ query: term, status: 'all' }), term)],
    ['skills', async () => skillResults(await projectJson(projectFetch, '/api/skills'), term)],
  ];

  await Promise.all(sources.map(async ([id, load]) => {
    try {
      onSourceUpdate(id, { status: 'ready', results: await load() });
    } catch (error) {
      onSourceUpdate(id, { status: 'error', results: [], error: error?.message || String(error) });
    }
  }));
}

function SourceResults({ source, state, query, onSelect }) {
  const scopeFor = SOURCE_GROUPS.find(({ id }) => id === source.id)?.scope;
  return (
    <section className="knowledge-results-source" aria-label={`${source.label} results`}>
      <header className="knowledge-results-source-head">
        <h3>{source.label}</h3>
        <span className="knowledge-results-scope">{scopeFor}</span>
      </header>
      {state.status === 'loading' && <p className="knowledge-search-state" role="status">Searching {source.label}…</p>}
      {state.status === 'error' && <p className="knowledge-search-state knowledge-search-state--error" role="alert">Unable to search {source.label}: {state.error}</p>}
      {state.status === 'ready' && state.results.length === 0 && (
        <p className="knowledge-search-state" role="status">No {source.label} results match “{query}”.</p>
      )}
      {state.status === 'ready' && state.results.length > 0 && (
        <ul className="knowledge-result-list">
          {state.results.map((result) => (
            <li key={result.id}>
              <article className="knowledge-result">
                {result.scope && <span className="knowledge-results-scope">{result.scope}</span>}
                <a
                  href={`#/${source.route}`}
                  aria-label={`${source.action}: ${result.title}`}
                  onClick={onSelect ? (event) => {
                    event.preventDefault();
                    onSelect(source.route);
                  } : undefined}
                >
                  <span>{result.title}</span>
                  <span className="knowledge-result-action">{source.action}</span>
                </a>
                {result.detail && <p>{result.detail}</p>}
              </article>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function KnowledgeResults({ sources, query, onSelect }) {
  return (
    <div className="knowledge-results" aria-label={`Search results for ${query}`}>
      {SOURCE_GROUPS.map((source) => (
        <SourceResults key={source.id} source={source} state={sources[source.id]} query={query} onSelect={onSelect} />
      ))}
    </div>
  );
}

export function KnowledgeSearch({ onSelect }) {
  const projectFetch = useProjectFetch();
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [sources, setSources] = useState(INITIAL_SOURCES);
  const [hasSearched, setHasSearched] = useState(false);
  const searchVersion = useRef(0);

  const submit = (event) => {
    event.preventDefault();
    const term = query.trim();
    if (!term) return;
    const version = ++searchVersion.current;
    setSubmittedQuery(term);
    setHasSearched(true);
    setSources(Object.fromEntries(SOURCE_GROUPS.map(({ id }) => [id, { status: 'loading', results: [] }])));
    void runKnowledgeSearch(term, projectFetch, (id, result) => {
      if (version === searchVersion.current) {
        setSources((current) => ({ ...current, [id]: result }));
      }
    });
  };

  return (
    <section className="knowledge-search" aria-labelledby="knowledge-search-title">
      <header className="knowledge-search-head">
        <h2 id="knowledge-search-title">Search knowledge</h2>
        <p>Search project records and documents alongside confirmed global preferences and skills. Reads happen only when submitted.</p>
      </header>
      <form className="knowledge-search-form" onSubmit={submit}>
        <label htmlFor="knowledge-search-input">Search all knowledge sources</label>
        <div>
          <input
            id="knowledge-search-input"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Title, path, statement, or keyword"
            required
          />
          <button type="submit">Search</button>
        </div>
      </form>
      {hasSearched && <KnowledgeResults sources={sources} query={submittedQuery} onSelect={onSelect} />}
    </section>
  );
}
