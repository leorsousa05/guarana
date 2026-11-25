import { useEffect, useState } from 'react';
import { useProjectFetch } from '../lib/projectApi.js';
import { loadMemoryPreferences } from './MemoryPreferences.jsx';
import { KnowledgeSearch } from './KnowledgeSearch.jsx';

const PROJECT_SOURCE_LOADERS = {
  tracker: (projectFetch) => projectJson(projectFetch, '/api/specs/tracker', (data) => Array.isArray(data?.rows)),
  decisions: (projectFetch) => projectJson(projectFetch, '/api/decisions/pending', (data) => Array.isArray(data?.decisions)),
  documents: (projectFetch) => projectJson(projectFetch, '/api/specs/tree', (data) => Array.isArray(data?.files) && data.files.every((file) => typeof file === 'string')),
  memory: (projectFetch) => projectJson(projectFetch, '/api/memory/summary?scope=project', (data) => Boolean(data?.nodes && typeof data.nodes === 'object')),
  skills: (projectFetch) => projectJson(projectFetch, '/api/skills', (data) => Array.isArray(data?.global) && Array.isArray(data?.project)),
};

const PROJECT_SOURCE_IDS = Object.keys(PROJECT_SOURCE_LOADERS);
const INITIAL_SOURCES = Object.fromEntries(
  [...PROJECT_SOURCE_IDS, 'preferences'].map((id) => [id, { status: 'loading' }]),
);

async function projectJson(projectFetch, url, isValid) {
  const response = await projectFetch(url);
  const data = await response.json();
  if (!response.ok || data?.error || !isValid(data)) throw new Error('Invalid or unavailable response.');
  return data;
}

async function loadSource(id, load, onUpdate) {
  let state;
  try {
    state = { status: 'ready', data: await load() };
  } catch {
    state = { status: 'error' };
  }
  onUpdate(id, state);
  return state;
}

export async function loadProjectKnowledgeSources(projectFetch, onUpdate = () => {}) {
  return Object.fromEntries(await Promise.all(PROJECT_SOURCE_IDS.map(async (id) => [
    id,
    await loadSource(id, () => PROJECT_SOURCE_LOADERS[id](projectFetch), onUpdate),
  ])));
}

export async function loadGlobalPreferenceSource(onUpdate = () => {}, preferencesLoader = loadMemoryPreferences) {
  return loadSource(
    'preferences',
    async () => {
      const preferences = await preferencesLoader({ status: 'active' });
      if (!Array.isArray(preferences)) throw new Error('Invalid preference response.');
      return preferences;
    },
    onUpdate,
  );
}

function routeLink(route, label, onSelect) {
  return (
    <a
      className="knowledge-route-link"
      href={`#/${route}`}
      onClick={onSelect ? (event) => {
        event.preventDefault();
        onSelect(route);
      } : undefined}
    >
      {label}
    </a>
  );
}

function KnowledgeSource({ id, title, scope, state, className = '', children }) {
  return (
    <section
      className={['knowledge-record', className].filter(Boolean).join(' ')}
      data-knowledge-source={id}
      aria-labelledby={`knowledge-${id}-title`}
    >
      <header className="knowledge-record-head">
        <div>
          <p className="knowledge-record-scope">{scope}</p>
          <h2 id={`knowledge-${id}-title`}>{title}</h2>
        </div>
      </header>
      {state.status === 'loading' && <p className="knowledge-record-state" role="status">Loading {title.toLowerCase()}…</p>}
      {state.status === 'error' && (
        <p className="knowledge-record-state knowledge-record-state--error" role="alert">
          Unable to load {title.toLowerCase()}. Other knowledge sources remain available.
        </p>
      )}
      {state.status === 'ready' && children(state.data)}
    </section>
  );
}

function trackerStatus(row) {
  return typeof row?.status === 'string' && row.status.trim() ? row.status.trim() : 'Unspecified';
}

function TrackerSnapshot({ data, onSelect }) {
  const rows = data.rows;
  const counts = new Map();
  rows.forEach((row) => {
    const status = trackerStatus(row);
    counts.set(status, (counts.get(status) || 0) + 1);
  });
  const visibleRows = rows.slice(0, 6);

  return (
    <>
      <p className="knowledge-ledger-total"><strong>{rows.length}</strong> tracked {rows.length === 1 ? 'entry' : 'entries'}</p>
      {counts.size > 0 && (
        <ul className="knowledge-status-counts" aria-label="Tracker rows by recorded status">
          {[...counts].map(([status, count]) => (
            <li key={status}><span>{status}</span><strong>{count}</strong></li>
          ))}
        </ul>
      )}
      {rows.length === 0 ? (
        <p className="knowledge-record-empty" role="status">No tracker rows are recorded for this project.</p>
      ) : (
        <>
          <ul className="knowledge-ledger-list" aria-label="Selected-project tracker entries">
            {visibleRows.map((row, index) => (
              <li key={`${row?.skill || 'tracker'}-${index}`}>
                <strong>{row?.skill || 'Tracker entry'}</strong>
                <span className="knowledge-ledger-status">{trackerStatus(row)}</span>
                {(row?.proof || row?.change) && (
                  <p>{[row.proof && `Proof: ${row.proof}`, row.change && `Change: ${row.change}`].filter(Boolean).join(' · ')}</p>
                )}
              </li>
            ))}
          </ul>
          {rows.length > visibleRows.length && <p className="knowledge-record-note">Showing {visibleRows.length} of {rows.length} tracker entries.</p>}
        </>
      )}
      {routeLink('specs', 'Open implementation tracker', onSelect)}
    </>
  );
}

function DecisionSnapshot({ data, onSelect }) {
  const decisions = data.decisions;
  return (
    <>
      <p className="knowledge-ledger-total"><strong>{decisions.length}</strong> pending {decisions.length === 1 ? 'decision' : 'decisions'}</p>
      {decisions.length === 0 ? (
        <p className="knowledge-record-empty" role="status">No pending decisions.</p>
      ) : (
        <ul className="knowledge-ledger-list">
          {decisions.slice(0, 5).map((decision, index) => (
            <li key={`${decision.file || 'decision'}-${index}`}>
              {decision.statement && <strong>{decision.statement}</strong>}
              {decision.file && <span className="knowledge-ledger-path">{decision.file}</span>}
            </li>
          ))}
        </ul>
      )}
      {decisions.length > 5 && <p className="knowledge-record-note">Showing 5 of {decisions.length} pending decisions.</p>}
      {routeLink('specs', 'Review pending decisions', onSelect)}
    </>
  );
}

function DocumentSnapshot({ data, onSelect }) {
  const files = data.files;
  return (
    <>
      <p className="knowledge-ledger-total"><strong>{files.length}</strong> {files.length === 1 ? 'document path' : 'document paths'}</p>
      {files.length === 0 ? (
        <p className="knowledge-record-empty" role="status">No project document paths are available.</p>
      ) : (
        <>
          <ul className="knowledge-path-list" aria-label="Available project document paths">
            {files.slice(0, 6).map((file) => <li key={file}><code>{file}</code></li>)}
          </ul>
          {files.length > 6 && <p className="knowledge-record-note">Showing 6 of {files.length} document paths.</p>}
        </>
      )}
      {routeLink('specs', 'Browse project documents', onSelect)}
    </>
  );
}

function ProjectMemorySnapshot({ data, onSelect }) {
  const metrics = [
    ['Project records', data.nodes.byScope?.project ?? data.nodes.total],
    ['Confirmed', data.nodes.confirmed],
    ['Drafts', data.nodes.draft],
  ].filter(([, value]) => typeof value === 'number' && Number.isFinite(value));
  const projectCount = data.nodes.byScope?.project ?? data.nodes.total;

  return (
    <>
      {metrics.length > 0 ? (
        <dl className="knowledge-memory-metrics" aria-label="Selected-project memory counts">
          {metrics.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
        </dl>
      ) : (
        <p className="knowledge-record-empty" role="status">No project memory counts are available.</p>
      )}
      {projectCount === 0 && <p className="knowledge-record-empty" role="status">No project memories are recorded.</p>}
      {routeLink('memory', 'Open Project Memory', onSelect)}
    </>
  );
}

function SkillsSnapshot({ data, onSelect }) {
  return (
    <div className="knowledge-skill-scopes">
      {[
        ['global', 'Global skills', 'Available across projects'],
        ['project', 'Project skills', 'Generated for the selected project'],
      ].map(([scope, label, description]) => (
        <div className="knowledge-skill-scope" key={scope}>
          <div><h3>{label}</h3><p>{description}</p></div>
          <strong>{data[scope].length}</strong>
          {data[scope].length > 0 && (
            <ul>
              {data[scope].slice(0, 4).map((skill) => <li key={skill.name}>{skill.name}</li>)}
            </ul>
          )}
          {data[scope].length === 0 && <p className="knowledge-record-empty" role="status">No {label.toLowerCase()} are recorded.</p>}
        </div>
      ))}
      {routeLink('skills', 'Browse generated skills', onSelect)}
    </div>
  );
}

function PreferencesSnapshot({ preferences, onSelect }) {
  return (
    <>
      <p className="knowledge-ledger-total"><strong>{preferences.length}</strong> active global {preferences.length === 1 ? 'preference' : 'preferences'}</p>
      {preferences.length === 0 ? (
        <p className="knowledge-record-empty" role="status">No active global preferences.</p>
      ) : (
        <ul className="knowledge-preference-list">
          {preferences.slice(0, 3).map((preference, index) => (
            <li key={preference.id || `${preference.intent || 'preference'}-${index}`}>
              {preference.intent || 'Untitled preference'}
            </li>
          ))}
        </ul>
      )}
      {preferences.length > 3 && <p className="knowledge-record-note">Showing 3 of {preferences.length} active preferences.</p>}
      {routeLink('memory', 'Open User preferences', onSelect)}
    </>
  );
}

export function KnowledgeAtAGlance({ sources = INITIAL_SOURCES, onSelect }) {
  return (
    <section className="knowledge-ledger" aria-label="Knowledge at a glance">
      <div className="knowledge-project-ledger">
        <KnowledgeSource id="tracker" title="Implementation tracker" scope="Selected project · Specs" state={sources.tracker} className="knowledge-record--tracker">
          {(data) => <TrackerSnapshot data={data} onSelect={onSelect} />}
        </KnowledgeSource>
        <KnowledgeSource id="decisions" title="Pending decisions" scope="Selected project · Specs" state={sources.decisions}>
          {(data) => <DecisionSnapshot data={data} onSelect={onSelect} />}
        </KnowledgeSource>
        <KnowledgeSource id="documents" title="Document tree" scope="Selected project · Specs" state={sources.documents}>
          {(data) => <DocumentSnapshot data={data} onSelect={onSelect} />}
        </KnowledgeSource>
        <KnowledgeSource id="memory" title="Project Memory" scope="Selected project · Memory" state={sources.memory}>
          {(data) => <ProjectMemorySnapshot data={data} onSelect={onSelect} />}
        </KnowledgeSource>
      </div>
      <aside className="knowledge-scope-rail" aria-label="Global and project scope summaries">
        <p className="knowledge-scope-rail-title">Scope ledger</p>
        <KnowledgeSource id="skills" title="Generated skills" scope="Global and selected project" state={sources.skills}>
          {(data) => <SkillsSnapshot data={data} onSelect={onSelect} />}
        </KnowledgeSource>
        <KnowledgeSource id="preferences" title="User preferences" scope="Global · read-only" state={sources.preferences}>
          {(data) => <PreferencesSnapshot preferences={data} onSelect={onSelect} />}
        </KnowledgeSource>
      </aside>
    </section>
  );
}

export function KnowledgeHome({ onSelect }) {
  const projectFetch = useProjectFetch();
  const [sources, setSources] = useState(INITIAL_SOURCES);

  useEffect(() => {
    let current = true;
    setSources((previous) => ({
      ...previous,
      ...Object.fromEntries(PROJECT_SOURCE_IDS.map((id) => [id, { status: 'loading' }])),
    }));
    void loadProjectKnowledgeSources(projectFetch, (id, state) => {
      if (current) setSources((previous) => ({ ...previous, [id]: state }));
    });
    return () => { current = false; };
  }, [projectFetch]);

  useEffect(() => {
    let current = true;
    setSources((previous) => ({ ...previous, preferences: { status: 'loading' } }));
    void loadGlobalPreferenceSource((id, state) => {
      if (current) setSources((previous) => ({ ...previous, [id]: state }));
    });
    return () => { current = false; };
  }, []);

  return (
    <section className="knowledge-home" aria-labelledby="knowledge-title">
      <header className="knowledge-home-head">
        <h1 id="knowledge-title">Knowledge</h1>
        <p>A working ledger for this project, with global preferences and reusable skills kept in their own scopes.</p>
      </header>
      <KnowledgeSearch onSelect={onSelect} />
      <KnowledgeAtAGlance sources={sources} onSelect={onSelect} />
    </section>
  );
}
