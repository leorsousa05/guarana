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

export function MemoryInjections({ sessionID, tick = 0 } = {}) {
  const history = usePoll(`/api/memory/injections?limit=${sessionID ? 100 : 40}`, 5000, tick);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [selectedNodeKey, setSelectedNodeKey] = useState(null);
  const injections = filterInjectionsForSession(history.data?.injections, sessionID);
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
    return (
      <div className="memory-injections">
        <header className="memory-injection-heading">
          <h3>Injected memory</h3>
          <p>Memories added to the assistant&rsquo;s context appear here.</p>
        </header>
        <EmptyState copy="No memory has been injected yet." hint="Global preferences and task-relevant project memories will appear after an assistant turn." />
      </div>
    );
  }

  const memories = injection.memories || [];

  return (
    <div className="memory-injections">
      <header className="memory-injection-heading">
        <div>
          <h3>Injected memory</h3>
          <p>
            {memories.length} {memories.length === 1 ? 'memory' : 'memories'} reached the assistant&rsquo;s context
            {injection.reason && <> · {reasonLabel(injection.reason)}.</>}
          </p>
        </div>
        <time dateTime={injection.ts ? new Date(injection.ts).toISOString() : undefined}>{fmtTs(injection.ts)}</time>
      </header>

      <div className="memory-injection-layout">
        <section className="memory-injected-records" aria-label="Memories in this injection">
          <h4>Memory records</h4>
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

        <aside className="memory-injection-history" aria-label="Recent memory injections">
          <h4>Recent injections</h4>
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
