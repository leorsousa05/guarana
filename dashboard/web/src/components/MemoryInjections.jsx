import { useState } from 'react';
import { fmtTs } from '../lib/format.js';
import { usePoll } from '../hooks/usePoll.js';
import { EmptyState, ErrorBanner } from './common.jsx';

const nodeKey = (node) => `${node.scope}:${node.id}`;
const reasonLabel = (reason) => ({
  'session-start': 'session start',
  compacted: 'after context compacted',
  'new-memories': 'new memories became relevant',
}[reason] || 'memory context');

const RELATION_PHRASES = {
  'caused-by': 'was caused by',
  'depends-on': 'depends on',
  supersedes: 'supersedes',
  summarizes: 'summarizes',
  fixes: 'fixes',
  'relates-to': 'is related to',
};

export function filterInjectionsForSession(injections, sessionID) {
  return (injections || []).filter((entry) => !sessionID || entry.sessionID === sessionID);
}

export function filterInjectionsForScope(injections, scope) {
  if (!['project', 'global'].includes(scope)) return injections || [];
  return (injections || []).flatMap((entry) => {
    const memories = (entry.memories || []).filter((node) =>
      node.scope === scope && (scope !== 'global' || node.type === 'preference')
    );
    if (!memories.length) return [];
    const ids = new Set(memories.map((node) => node.id));
    const edges = (entry.edges || []).filter((edge) => edge.scope === scope && ids.has(edge.from) && ids.has(edge.to));
    return [{ ...entry, memories, edges }];
  });
}

export function injectedRelationshipText(edge, memories) {
  const byKey = new Map((memories || []).map((node) => [nodeKey(node), node]));
  const scope = edge.scope || 'project';
  const from = byKey.get(`${scope}:${edge.from}`);
  const to = byKey.get(`${scope}:${edge.to}`);
  const fromText = from?.intent || edge.from;
  const toText = to?.intent || edge.to;
  const phrase = RELATION_PHRASES[edge.rel] || String(edge.rel || 'relates to').replaceAll('-', ' ');
  return { fromText, phrase, toText };
}

export function MemoryInjections({ sessionID, tick = 0, scope, historical = false } = {}) {
  const params = new URLSearchParams({ limit: String(sessionID ? 100 : 40) });
  if (scope) params.set('scope', scope);
  const history = usePoll(`/api/memory/injections?${params.toString()}`, 5000, tick);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [selectedNodeKey, setSelectedNodeKey] = useState(null);
  const injections = filterInjectionsForScope(filterInjectionsForSession(history.data?.injections, sessionID), scope);
  const injection = injections.find((entry) => entry.id === selectedEventId) || injections[0] || null;
  const selectedNode = injection?.memories.find((node) => nodeKey(node) === selectedNodeKey)
    || injection?.memories[0]
    || null;

  const selectInjection = (entry) => {
    setSelectedEventId(entry.id);
    setSelectedNodeKey(entry.memories[0] ? nodeKey(entry.memories[0]) : null);
  };

  if (history.error) return <ErrorBanner text={history.error} />;
  if (!history.data) return <p className="loading" role="status">loading memory history…</p>;
  if (history.data.error) return <ErrorBanner text={history.data.error} />;

  if (!injections.length) {
    const heading = scope === 'global' ? 'Global preference injection history' : scope === 'project' ? 'Project injection history' : 'Injected memory';
    const copy = scope === 'global'
      ? 'No global user preferences have been injected yet.'
      : scope === 'project'
        ? 'No legacy project injection history is recorded.'
        : 'No memory has been injected yet.';
    const hint = scope === 'global'
      ? 'Global preferences that reach assistant context will appear here.'
      : scope === 'project'
        ? 'This historical area covers older project-context events only; project memories are not injected now.'
        : 'Global preferences and task-relevant project memories will appear after an assistant turn.';
    return (
      <div className="memory-injections">
        <header className="memory-injection-heading">
          <h3>{historical ? 'Legacy project injection history' : heading}</h3>
          <p>{scope === 'global' ? 'User preferences that reached the assistant context.' : historical ? 'Older project-context history only. Project memories are not injected now.' : scope === 'project' ? 'Project memories are shown in this scoped history.' : 'Memories added to the assistant&rsquo;s context appear here.'}</p>
        </header>
        <EmptyState copy={copy} hint={hint} />
      </div>
    );
  }

  const memories = injection.memories || [];
  const memoryHeading = scope === 'global' ? 'User preferences' : scope === 'project' ? 'Project memories' : 'Memory records';
  const historyHeading = scope === 'global' ? 'Recent preference injections' : scope === 'project' ? 'Recent project injections' : 'Recent memory injections';

  return (
    <div className="memory-injections">
      <header className="memory-injection-heading">
        <div>
          <h3>{historical ? 'Legacy project injection history' : scope === 'global' ? 'Global preference injection history' : scope === 'project' ? 'Project injection history' : 'Injected memory'}</h3>
          <p>
            {memories.length} {scope === 'global' ? (memories.length === 1 ? 'user preference' : 'user preferences') : scope === 'project' ? (memories.length === 1 ? 'project memory' : 'project memories') : (memories.length === 1 ? 'memory' : 'memories')} reached the assistant&rsquo;s context
            {injection.reason && <> · {reasonLabel(injection.reason)}.</>}
          </p>
          {historical && <p>Older project-context history only. Project memories are not injected now.</p>}
          {scope === 'global' && <p>Global user preferences only.</p>}
        </div>
        <time dateTime={injection.ts ? new Date(injection.ts).toISOString() : undefined}>{fmtTs(injection.ts)}</time>
      </header>

      <div className="memory-injection-layout">
        <section className="memory-injected-records" aria-label={`${memoryHeading} in this injection`}>
          <h4>{memoryHeading}</h4>
          <ol>
            {memories.map((node) => {
              const key = nodeKey(node);
              const selected = key === nodeKey(selectedNode || {});
              return (
                <li key={key}>
                  <button
                    type="button"
                    className={`memory-injected-record${selected ? ' memory-injected-record--active' : ''}`}
                    aria-pressed={selected}
                    aria-label={`Select ${node.scope} ${node.type} memory: ${node.intent || node.id}`}
                    onClick={() => setSelectedNodeKey(key)}
                  >
                    <span className="memory-injected-meta">
                      <span className="memory-folio-type">{node.type}</span>
                      <span className={`memory-scope memory-scope--${node.scope}`}>{node.scope}</span>
                      {node.available === false && <span className="memory-unavailable">node no longer exists</span>}
                    </span>
                    <span className="memory-injected-intent">{node.intent || node.id}</span>
                    <span className="memory-injected-summary">
                      {node.summary || (node.available === false ? 'Memory text is no longer available.' : 'No summary stored.')}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          {injection.edges?.length > 0 && (
            <section className="memory-injected-links" aria-label="Typed relationships between injected memories">
              <h4>Related records</h4>
              <ul>
                {injection.edges.map((edge, index) => {
                    const { fromText, phrase, toText } = injectedRelationshipText(edge, memories);
                    return (
                      <li key={`${edge.scope}:${edge.from}:${edge.to}:${edge.rel}:${index}`} aria-label={`${fromText} ${phrase} ${toText}; relation type ${edge.rel}`}>
                        <span className="memory-injected-link-line">
                          {fromText} <span className="memory-injected-link-phrase">{phrase}</span> {toText}
                        </span>
                      </li>
                    );
                })}
              </ul>
            </section>
          )}
        </section>

        <aside className="memory-injection-history" aria-label={historyHeading}>
          <h4>{historyHeading}</h4>
          <ol>
            {injections.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  className={`memory-injection-entry${entry.id === injection.id ? ' memory-injection-entry--active' : ''}`}
                  aria-pressed={entry.id === injection.id}
                  onClick={() => selectInjection(entry)}
                >
                  <time dateTime={entry.ts ? new Date(entry.ts).toISOString() : undefined}>{fmtTs(entry.ts)}</time>
                  <span className="memory-injection-count">{entry.memories.length} {entry.memories.length === 1 ? 'memory' : 'memories'}</span>
                  <span className="memory-injection-session">{entry.sessionID}</span>
                  {entry.reason && <span className="memory-injection-reason">{reasonLabel(entry.reason)}</span>}
                </button>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </div>
  );
}
