import { useState } from 'react';
import { fmtTs } from '../lib/format.js';
import { usePoll } from '../hooks/usePoll.js';
import { EmptyState, ErrorBanner } from './common.jsx';

const SCOPE_POSITIONS = {
  project: [
    { x: 205, y: 84 }, { x: 274, y: 108 }, { x: 145, y: 139 },
    { x: 238, y: 166 }, { x: 176, y: 211 }, { x: 282, y: 237 }, { x: 227, y: 278 },
  ],
  global: [
    { x: 475, y: 84 }, { x: 406, y: 108 }, { x: 535, y: 139 },
    { x: 442, y: 166 }, { x: 504, y: 211 }, { x: 398, y: 237 }, { x: 453, y: 278 },
  ],
};

const nodeKey = (node) => `${node.scope}:${node.id}`;
const typeClass = (type) => `mem-type--${type || 'decision'}`;
const reasonLabel = (reason) => ({
  'session-start': 'session start',
  compacted: 'after context compacted',
  'new-memories': 'new memories became relevant',
}[reason] || 'memory context');

export function filterInjectionsForSession(injections, sessionID) {
  return (injections || []).filter((entry) => !sessionID || entry.sessionID === sessionID);
}

function BrainMap({ injection, selectedNode, onSelectNode }) {
  const nodes = injection?.memories || [];
  const byScope = {
    project: nodes.filter((node) => node.scope === 'project'),
    global: nodes.filter((node) => node.scope === 'global'),
  };
  const positions = new Map();
  for (const scope of ['project', 'global']) {
    byScope[scope].forEach((node, index) => {
      const anchor = SCOPE_POSITIONS[scope][index % SCOPE_POSITIONS[scope].length];
      positions.set(nodeKey(node), anchor);
    });
  }

  return (
    <svg
      className="memory-brain-svg"
      viewBox="0 0 680 330"
      role="group"
      aria-label="Injected memories mapped onto project and global brain hemispheres"
    >
      <g className="memory-brain-hemi memory-brain-hemi--project">
        <path d="M337 43 C303 25 267 25 236 41 C207 30 177 40 158 59 C127 63 105 83 100 109 C77 127 76 156 91 176 C73 199 84 229 108 242 C112 271 143 292 176 287 C198 312 234 305 255 288 C283 299 314 280 337 260 Z" />
        <path className="memory-brain-fold" d="M123 116 C150 97 172 104 186 127 C202 150 222 152 241 135 C263 114 292 118 316 139" />
        <path className="memory-brain-fold" d="M96 177 C123 160 146 166 156 190 C169 216 193 221 216 205 C242 186 269 191 289 213 C302 228 318 229 333 218" />
        <path className="memory-brain-fold" d="M144 257 C156 235 175 228 194 240 C217 255 238 257 257 241 C278 222 302 228 324 246" />
      </g>
      <g className="memory-brain-hemi memory-brain-hemi--global" transform="translate(680 0) scale(-1 1)">
        <path d="M337 43 C303 25 267 25 236 41 C207 30 177 40 158 59 C127 63 105 83 100 109 C77 127 76 156 91 176 C73 199 84 229 108 242 C112 271 143 292 176 287 C198 312 234 305 255 288 C283 299 314 280 337 260 Z" />
        <path className="memory-brain-fold" d="M123 116 C150 97 172 104 186 127 C202 150 222 152 241 135 C263 114 292 118 316 139" />
        <path className="memory-brain-fold" d="M96 177 C123 160 146 166 156 190 C169 216 193 221 216 205 C242 186 269 191 289 213 C302 228 318 229 333 218" />
        <path className="memory-brain-fold" d="M144 257 C156 235 175 228 194 240 C217 255 238 257 257 241 C278 222 302 228 324 246" />
      </g>
      <path className="memory-brain-seam" d="M340 40 C332 91 349 117 338 162 C330 204 348 239 340 287" />

      {(injection?.edges || []).map((edge, index) => {
        const a = positions.get(`${edge.scope}:${edge.from}`);
        const b = positions.get(`${edge.scope}:${edge.to}`);
        if (!a || !b) return null;
        return <line key={`${edge.scope}-${index}`} className="memory-brain-link" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
      })}

      {nodes.map((node) => {
        const key = nodeKey(node);
        const point = positions.get(key);
        const selected = nodeKey(selectedNode || {}) === key;
        return (
          <g
            key={key}
            className={`memory-brain-neuron${selected ? ' memory-brain-neuron--selected' : ''}`}
            role="button"
            tabIndex={0}
            aria-label={`${node.scope} ${node.type}: ${node.intent || node.id}`}
            aria-pressed={selected}
            onClick={() => onSelectNode(node)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onSelectNode(node);
              }
            }}
          >
            <circle className={typeClass(node.type)} cx={point.x} cy={point.y} r={selected ? 10 : 7} />
            <title>{`${node.scope} · ${node.type} · ${node.intent || node.id}`}</title>
          </g>
        );
      })}
    </svg>
  );
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

  return (
    <div className="memory-injections">
      <header className="memory-injection-heading">
        <div>
          <h3>Injected memory</h3>
          <p>
            {injection.memories.length} {injection.memories.length === 1 ? 'memory' : 'memories'} reached the assistant&rsquo;s context
            {injection.reason && <> · {reasonLabel(injection.reason)}.</>}
          </p>
        </div>
        <time dateTime={injection.ts ? new Date(injection.ts).toISOString() : undefined}>{fmtTs(injection.ts)}</time>
      </header>

      <div className="memory-injection-layout">
        <section className="memory-brain-panel" aria-label="Memory injection map">
          <div className="memory-brain-scopes" aria-hidden="true">
            <span className="memory-brain-scope memory-brain-scope--project">Project</span>
            <span className="memory-brain-scope memory-brain-scope--global">Global</span>
          </div>
          <BrainMap
            injection={injection}
            selectedNode={selectedNode}
            onSelectNode={(node) => setSelectedNodeKey(nodeKey(node))}
          />
          <div className="memory-injection-legend" aria-label="Injected memory types">
            {[...new Set(injection.memories.map((node) => node.type))].map((type) => (
              <span key={type} className="memory-injection-legend-item">
                <span className={`memory-injection-dot ${typeClass(type)}`} aria-hidden="true" />
                {type}
              </span>
            ))}
          </div>
          {selectedNode && (
            <article className="memory-injected-detail" aria-live="polite">
              <div className="memory-injected-detail-meta">
                <span className={`mem-type ${typeClass(selectedNode.type)}`}>{selectedNode.type}</span>
                <span className={`memory-scope memory-scope--${selectedNode.scope}`}>{selectedNode.scope}</span>
                {!selectedNode.available && <span className="memory-unavailable">node no longer exists</span>}
              </div>
              <h4>{selectedNode.intent || selectedNode.id}</h4>
              <p>{selectedNode.summary || 'No summary stored.'}</p>
            </article>
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
                  <span>{entry.memories.length} {entry.memories.length === 1 ? 'node' : 'nodes'}</span>
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
