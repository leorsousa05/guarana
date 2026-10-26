import { useEffect, useMemo, useRef, useState } from 'react';
import { usePoll } from '../hooks/usePoll.js';
import { parseGoal } from './NowPanel.jsx';
import { handleMemoryBubbleKeyDown, layoutMemoryBubbles, qualifyMemoryGraph } from '../lib/memoryBubbleLayout.js';

const ACTIVE_STATUSES = new Set(['busy', 'running']);
const WORKFLOW_PHASES = new Set(['idle', 'planning', 'building', 'coding', 'verifying', 'debugging', 'completed']);
const SAFE_WORKER_KEY = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_AGENT = /^[A-Za-z0-9_-]{1,48}$/;
const SECRET_LIKE = /sk-[A-Za-z0-9]|gh[pousr]_[A-Za-z0-9]+|api[_-]?key|token|password|secret|bearer/i;
const MEMORY_TYPES = new Set(['decision', 'bug', 'solution', 'refactor', 'preference', 'supernode', 'atom']);
const EMPTY_MEMORIES = [];
export const OVERVIEW_GRAPH_ENDPOINTS = {
  project: '/api/memory/graph?scope=project',
  global: '/api/memory/graph?scope=global',
};
const MEMORY_SCOPES = ['project', 'global'];
const INJECTION_REASON_LABELS = {
  'session-start': 'session start',
  compacted: 'after context compacted',
  'new-memories': 'new memories became relevant',
};

function latestActivity(run) {
  return run?.end ?? run?.start ?? 0;
}

export function activeRootFromTelemetry(summary) {
  return (summary?.runs || [])
    .filter((run) => !run.parentSessionID && ACTIVE_STATUSES.has(run.status))
    .reduce((latest, run) => !latest || latestActivity(latest) < latestActivity(run) ? run : latest, null);
}

function mostRecentRootFromTelemetry(summary) {
  return (summary?.runs || [])
    .filter((run) => !run.parentSessionID)
    .reduce((latest, run) => !latest || latestActivity(latest) < latestActivity(run) ? run : latest, null);
}

export function latestInjectionForRoot(injections, root) {
  if (!root?.sessionID) return null;
  return (Array.isArray(injections) ? injections : [])
    .filter((entry) => entry?.sessionID === root.sessionID)
    .reduce((latest, entry) => !latest || (entry.ts ?? 0) > (latest.ts ?? 0) ? entry : latest, null);
}

export function latestAdvisorForRoot(history, root) {
  return root && Array.isArray(history)
    ? history.find((entry) => entry?.parentSessionID === root.sessionID) || null
    : null;
}

export function projectOverviewWorkers(state) {
  const data = state?.data;
  if (state?.error || data?.available !== true || !Array.isArray(data.workers)) return [];
  return data.workers.flatMap((worker) => {
    if (typeof worker?.key !== 'string' || !SAFE_WORKER_KEY.test(worker.key) || !ACTIVE_STATUSES.has(worker.status)
      || typeof worker.agent !== 'string' || !SAFE_AGENT.test(worker.agent) || SECRET_LIKE.test(worker.agent)) return [];
    return [{ key: worker.key, agent: worker.agent, status: worker.status }];
  });
}

export function overviewGraphModel(graphData, scope, injectedMemories = []) {
  const safeNodes = (Array.isArray(graphData?.nodes) ? graphData.nodes : [])
    .filter((node) => node?.status === 'confirmed'
      && node.scope === scope
      && (scope !== 'global' || node.type === 'preference')
      && typeof node.id === 'string'
      && MEMORY_TYPES.has(node.type));
  const safeEdges = (Array.isArray(graphData?.edges) ? graphData.edges : [])
    .filter((edge) => edge?.scope === scope
      && typeof edge.from === 'string' && typeof edge.to === 'string'
      && typeof edge.rel === 'string');
  const qualified = qualifyMemoryGraph(safeNodes, safeEdges);
  const injected = new Set((Array.isArray(injectedMemories) ? injectedMemories : [])
    .filter((node) => node?.scope === scope && typeof node.id === 'string')
    .map((node) => `${node.scope}:${node.id}`));
  const nodeIds = new Set(qualified.nodes.map((node) => node.id));
  return {
    nodes: qualified.nodes,
    edges: qualified.edges.filter((edge) => qualified.nodes.some((node) => node.id === edge.from)
      && qualified.nodes.some((node) => node.id === edge.to)),
    injected: new Set([...injected].filter((id) => nodeIds.has(id))),
  };
}

export function overviewSelectionEpoch(root, injection, scope) {
  const references = (Array.isArray(injection?.memories) ? injection.memories : [])
    .map((memory) => memory?.scope === scope && typeof memory.id === 'string'
      ? `${memory.scope}:${memory.id}`
      : null);
  const scopedReferences = references.filter(Boolean);
  // Keep the root identity internal to selection state; it is never rendered into the DOM.
  return JSON.stringify([root?.sessionID || null, scopedReferences]);
}

export function defaultOverviewSelection(model) {
  const available = new Set(model.nodes.map((node) => node.id));
  return [...model.injected].find((id) => available.has(id)) || model.nodes[0]?.id || null;
}

export function resolveOverviewSelection(model, selection, epoch) {
  return selection?.epoch === epoch && model.nodes.some((node) => node.id === selection.id)
    ? selection.id
    : defaultOverviewSelection(model);
}

export function selectOverviewMemory(epoch, id) {
  return { epoch, id };
}

function ContextStrip({ workflow, workflowLoading, workflowError, state }) {
  const phase = WORKFLOW_PHASES.has(workflow?.state) ? workflow.state : null;
  const task = workflow?.activeTask || null;
  const goal = workflow?.goal || parseGoal(state?.projectState);
  const unavailable = Boolean(workflowError);
  return (
    <header className="ov-context" aria-label="Current workflow context">
      <span className="ov-context-label">Current workflow</span>
      {unavailable ? (
        <span className="ov-context-status" role="status">Workflow context unavailable.</span>
      ) : workflowLoading || !workflow ? (
        <span className="ov-context-status" role="status">Loading workflow context…</span>
      ) : (
        <dl className="ov-context-fields">
          <div><dt>phase</dt><dd>{phase || 'not recorded'}</dd></div>
          <div><dt>task</dt><dd title={task || undefined}>{task || 'No active task recorded.'}</dd></div>
          <div><dt>goal</dt><dd title={goal || undefined}>{goal || 'No goal recorded.'}</dd></div>
        </dl>
      )}
    </header>
  );
}

function WorkersPanel({ state }) {
  const workers = projectOverviewWorkers(state);
  const count = state?.data?.runningCount;
  const available = !state?.error && state?.data?.available === true
    && Number.isSafeInteger(count) && count >= 0 && Array.isArray(state?.data?.workers);
  return (
    <section className="ov-panel ov-workers" aria-labelledby="ov-workers-title">
      <header className="ov-panel-head">
        <h2 id="ov-workers-title">Active workers</h2>
        {available && Number.isSafeInteger(count) && <span>{count} observed</span>}
      </header>
      {state?.error || (state?.data && !available) ? (
        <p className="ov-state" role="status">Active worker status unavailable.</p>
      ) : !state?.data ? (
        <p className="ov-state" role="status">Loading active workers…</p>
      ) : workers.length ? (
        <ul className="ov-worker-list" aria-label="Observed active workers">
          {workers.map((worker) => <li key={worker.key}>
            <span className="ov-worker-agent">{worker.agent}</span>
            <span className={`ov-worker-status ov-worker-status--${worker.status}`}>{worker.status}</span>
            <code className="ov-worker-ref" aria-label="Opaque worker reference">ref {worker.key.slice(0, 8)}…{worker.key.slice(-4)}</code>
          </li>)}
        </ul>
      ) : Number.isSafeInteger(count) && count > 0 ? (
        <p className="ov-state" role="status">{count} active {count === 1 ? 'worker' : 'workers'} reported; worker details unavailable.</p>
      ) : (
        <p className="ov-state" role="status">No active workers observed.</p>
      )}
    </section>
  );
}

function AdvisorPanel({ summary, summaryError, summaryLoading, history }) {
  const root = activeRootFromTelemetry(summary) || mostRecentRootFromTelemetry(summary);
  const latest = latestAdvisorForRoot(history?.data?.history, root);
  const unavailable = Boolean(summaryError || history?.error || history?.data?.error);
  let status = 'Loading Advisor runtime…';
  if (unavailable) status = 'Advisor runtime unavailable.';
  else if (!history?.data) status = 'Loading Advisor runtime…';
  else if (summaryLoading && !summary) status = 'Loading telemetry root for Advisor runtime…';
  else if (!root) status = 'No root session observed for Advisor runtime.';
  else if (!latest) status = 'Advisor not observed in the latest root session.';
  else if (latest.status === 'running' && ACTIVE_STATUSES.has(root.status)) status = 'Running · observed in the active root.';
  else if (latest.status === 'running') status = 'Last observed running; no active root is observed.';
  else if (latest.status === 'dispatched') status = 'Dispatched · completion not observed.';
  else {
    const observedStatus = ['completed', 'error', 'failed', 'idle', 'cancelled', 'busy'].includes(latest.status)
      ? latest.status
      : 'status not reported';
    status = `Most recently observed · ${observedStatus}.`;
  }
  return (
    <section className="ov-panel ov-advisor" aria-labelledby="ov-advisor-title">
      <header className="ov-panel-head"><h2 id="ov-advisor-title">Advisor runtime</h2></header>
      <p className="ov-state" role="status">{status}</p>
    </section>
  );
}

function InjectionPanel({ state, summary, summaryError, injection, graphStates, models, selectedIds, onSelect }) {
  const root = activeRootFromTelemetry(summary);
  const memories = Array.isArray(injection?.memories) ? injection.memories : [];

  let message;
  if (summaryError) message = 'Active root unavailable because telemetry could not be loaded.';
  else if (!summary) message = 'Loading telemetry root…';
  else if (!root) message = 'No active root session observed.';
  else if (state?.error || state?.data?.error) message = 'Memory injection history unavailable.';
  else if (!state?.data) message = 'Loading active-root injection…';
  else if (!injection) message = 'No injection observed for the active root.';
  return (
    <section className="ov-panel ov-injection" aria-labelledby="ov-injection-title">
      <header className="ov-panel-head"><h2 id="ov-injection-title">Active-root injection</h2></header>
      {message ? <p className="ov-state" role="status">{message}</p> : (
        <>
          <p className="ov-state" role="status">
            {memories.length} {memories.length === 1 ? 'memory' : 'memories'} observed
            {injection.reason ? ` · ${INJECTION_REASON_LABELS[injection.reason] || 'memory context'}` : ''}
            {Number.isFinite(injection.ts) ? ` · ${new Date(injection.ts).toLocaleString()}` : ''}
          </p>
          {memories.length ? <ul className="ov-injection-list" aria-label="Memories in the active-root injection">
            {memories.map((memory, index) => {
              const scope = ['project', 'global'].includes(memory?.scope) ? memory.scope : null;
              const type = MEMORY_TYPES.has(memory?.type) || memory?.type === 'unknown' ? memory.type : null;
              const intent = typeof memory?.intent === 'string' && memory.intent.trim() ? memory.intent : null;
              const graphId = scope && typeof memory?.id === 'string' ? `${scope}:${memory.id}` : null;
              const graphState = scope ? graphStates[scope] : null;
              const model = scope ? models[scope] : null;
              const selectedId = scope ? selectedIds[scope] : null;
              const nodesById = new Map((model?.nodes || []).map((node) => [node.id, node]));
              const graphError = Boolean(graphState?.error || graphState?.data?.error);
              const graphNode = !graphError && graphState?.data && graphId ? nodesById.get(graphId) : null;
              const graphUnavailable = !scope || !graphState
                ? 'Not available in graph.'
                : graphError
                ? 'Graph unavailable.'
                  : !graphState?.data ? 'Waiting for graph data.'
                    : !graphNode ? 'Not available in graph.' : null;
              const recordName = intent || 'Intent unavailable';
              const recordScope = scope || 'Scope unavailable';
              const recordType = type || 'Type unavailable';
              const accessibleName = `${recordScope} ${recordType}: ${recordName}`;
              return <li key={`${graphId || 'unqualified'}:${index}`}>
                <button type="button" className="ov-injection-record" disabled={!graphNode}
                  aria-label={`Select injected ${accessibleName}${graphUnavailable ? `; ${graphUnavailable}` : ''}`}
                  aria-pressed={Boolean(graphNode && selectedId === graphNode.id)}
                  onClick={() => graphNode && onSelect(scope, graphNode.id)}>
                  <span className={`ov-injection-record-scope${scope ? ` memory-scope memory-scope--${scope}` : ''}`}>{recordScope}</span>
                  <span className="ov-injection-record-type">{recordType}</span>
                  <strong className="ov-injection-record-intent">{recordName}</strong>
                  {graphUnavailable && <span className="ov-injection-record-unavailable">{graphUnavailable}</span>}
                </button>
              </li>;
          })}
          </ul> : <p className="ov-state" role="status">No memories recorded in this injection.</p>}
        </>
      )}
    </section>
  );
}

function SelectedMemory({ node, edges, nodesById, onSelect }) {
  if (!node) return <p className="ov-state" role="status">No confirmed memories available in this graph.</p>;
  const relations = edges.flatMap((edge) => {
    if (edge.from === node.id) return [{ edge, other: nodesById.get(edge.to), direction: 'Outgoing' }];
    if (edge.to === node.id) return [{ edge, other: nodesById.get(edge.from), direction: 'Incoming' }];
    return [];
  }).filter(({ other }) => Boolean(other));
  return (
    <section className="ov-memory-detail" aria-label="Selected memory details">
      <div className="ov-memory-title">
        <span className={`memory-scope memory-scope--${node.scope}`}>{node.scope}</span>
        <strong>{node.intent || node.memoryId}</strong>
        {node.injected && <span className="ov-injected-tag">injected</span>}
      </div>
      <p className="ov-memory-summary">{node.summary || 'No summary recorded.'}</p>
      <h3>Direct relationships</h3>
      {relations.length ? <ul className="ov-neighbor-list">
        {relations.map(({ edge, other, direction }, index) => <li key={`${edge.scope}:${edge.from}:${edge.to}:${edge.rel}:${index}`}>
          <span>{direction} · {edge.rel} · {edge.scope}</span>
          <button type="button" onClick={() => onSelect(other.id)} aria-label={`Select ${other.scope} neighbor ${other.intent || other.memoryId}`}>
            {other.intent || other.memoryId}
          </button>
        </li>)}
      </ul> : <p className="ov-state">No direct relationships observed.</p>}
    </section>
  );
}

function ReadOnlyMemoryGraph({ scope, title, graphState, model, selectedId, onSelect }) {
  const [focusedId, setFocusedId] = useState(null);
  const [viewMode, setViewMode] = useState('network');
  const viewportRef = useRef(null);
  const canvasRef = useRef(null);
  const initialCenterApplied = useRef(false);
  const layout = useMemo(() => layoutMemoryBubbles(model.nodes, model.edges, selectedId, viewMode), [model, selectedId, viewMode]);
  const nodesById = useMemo(() => new Map(model.nodes.map((node) => [node.id, node])), [model.nodes]);
  const selectedNode = nodesById.get(selectedId);
  const positioned = new Map(layout.nodes.map((node) => [node.id, { ...node, injected: model.injected.has(node.id) }]));
  const graphError = Boolean(graphState?.error || graphState?.data?.error);
  const focusId = layout.nodes.some((node) => node.id === focusedId) ? focusedId : layout.selected;

  useEffect(() => {
    if (initialCenterApplied.current || graphError || !graphState?.data || !layout.nodes.length) return;
    const viewport = viewportRef.current;
    const canvas = canvasRef.current;
    if (!viewport || !canvas || !viewport.clientWidth || !viewport.clientHeight) return;

    viewport.scrollLeft = Math.max(0, (canvas.clientWidth - viewport.clientWidth) / 2);
    viewport.scrollTop = Math.max(0, (canvas.clientHeight - viewport.clientHeight) / 2);
    initialCenterApplied.current = true;
  }, [graphError, graphState?.data, layout.nodes.length, layout.width, layout.height]);

  useEffect(() => {
    if (!focusedId || layout.nodes.some((node) => node.id === focusedId)) return;
    const activeElement = typeof document === 'undefined' ? null : document.activeElement;
    const focusWasInMap = activeElement?.closest?.('.ov-map-viewport') === viewportRef.current;
    setFocusedId(layout.selected);
    if (focusWasInMap && layout.selected) {
      [...(viewportRef.current?.querySelectorAll('.ov-map-node') || [])]
        .find((candidate) => candidate.dataset.memoryId === layout.selected)?.focus();
    }
  }, [focusedId, layout.nodes, layout.selected]);

  return (
    <section className={`ov-panel ov-graph ov-graph--${scope}`} aria-labelledby={`ov-graph-title-${scope}`}>
      <header className="ov-panel-head">
        <h2 id={`ov-graph-title-${scope}`}>{title} <span className="ov-read-only">read-only</span></h2>
        {model.nodes.length > 0 && <span>{model.nodes.length} nodes · {model.edges.length} links</span>}
      </header>
      {graphError ? <p className="ov-state" role="status">Memory graph unavailable.</p>
        : !graphState?.data ? <p className="ov-state" role="status">Loading {scope} memory graph…</p>
          : !model.nodes.length ? <p className="ov-state" role="status">No confirmed {scope === 'global' ? 'preferences' : 'memories'} available.</p> : (
            <>
              <p className="ov-map-help">Select a node to inspect its summary and direct relationships. Injected nodes are marked in amber.</p>
              <div className="ov-map-modes" role="group" aria-label={`${title} graph view mode`}>
                {['network', 'neighborhood'].map((mode) => <button key={mode} type="button"
                  aria-pressed={viewMode === mode} onClick={() => setViewMode(mode)}>
                  {mode === 'network' ? 'Network' : 'Neighborhood'}
                </button>)}
              </div>
              <div ref={viewportRef} className="ov-map-viewport" role="region" aria-label={`Read-only ${title.toLowerCase()} map; scroll within this region to navigate`} tabIndex={0}>
                <div ref={canvasRef} className="ov-map-canvas" style={{ width: layout.width, height: layout.height }}>
                  <svg className="ov-map-edges" width={layout.width} height={layout.height} aria-hidden="true" focusable="false">
                    <defs>
                      <marker id={`ov-map-arrow-${scope}`} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto" markerUnits="strokeWidth">
                        <path d="M0,0 L7,3.5 L0,7 z" className={`ov-map-arrow--${scope}`} />
                      </marker>
                    </defs>
                    {layout.edges.map((edge, index) => {
                      const from = positioned.get(edge.from);
                      const to = positioned.get(edge.to);
                      if (!from || !to) return null;
                      if (edge.from === edge.to) {
                        return <g key={`${edge.scope}:${edge.from}:${edge.to}:${edge.rel}:${index}`}>
                          <path className={`ov-map-edge ov-map-edge--${edge.scope}`}
                            d={`M ${from.x + 8} ${from.y - from.diameter / 2} C ${from.x + 52} ${from.y - from.diameter / 2 - 48}, ${from.x + 62} ${from.y - from.diameter / 2 + 12}, ${from.x + 16} ${from.y - from.diameter / 2 + 4}`}
                            markerEnd={`url(#ov-map-arrow-${scope})`} />
                          <text className={`ov-map-edge-label ov-map-edge-label--${scope}`}
                            x={from.x + 34} y={from.y - from.diameter / 2 - 34} textAnchor="middle">{edge.rel}</text>
                        </g>;
                      }
                      const dx = to.x - from.x;
                      const dy = to.y - from.y;
                      const distance = Math.hypot(dx, dy) || 1;
                      const start = from.diameter / 2;
                      const end = to.diameter / 2 + 3;
                      const x1 = from.x + dx / distance * start;
                      const y1 = from.y + dy / distance * start;
                      const x2 = to.x - dx / distance * end;
                      const y2 = to.y - dy / distance * end;
                      return <g key={`${edge.scope}:${edge.from}:${edge.to}:${edge.rel}:${index}`}>
                        <line className={`ov-map-edge ov-map-edge--${edge.scope}`}
                          x1={x1} y1={y1} x2={x2} y2={y2} markerEnd={`url(#ov-map-arrow-${scope})`} />
                        <text className={`ov-map-edge-label ov-map-edge-label--${scope}`}
                          x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 3} textAnchor="middle">{edge.rel}</text>
                      </g>;
                    })}
                  </svg>
                  {layout.nodes.map((node) => {
                    const isInjected = model.injected.has(node.id);
                    return <button key={node.id} type="button"
                      className={`ov-map-node ov-map-node--${node.scope}${node.focus ? ' ov-map-node--selected' : ''}${node.neighbor ? ' ov-map-node--neighbor' : ''}${isInjected ? ' ov-map-node--injected' : ''}`}
                      style={{ left: node.x - node.diameter / 2, top: node.y - node.diameter / 2, width: node.diameter, height: node.diameter }}
                       data-memory-id={node.id} data-scope={node.scope}
                       tabIndex={node.id === focusId ? 0 : -1} aria-pressed={node.id === selectedId}
                      aria-label={`${node.scope} ${node.type}: ${node.intent || node.memoryId}${isInjected ? ', injected into active root' : ''}`}
                      title={`${node.scope} ${node.type}: ${node.intent || node.memoryId}`}
                       onFocus={() => setFocusedId(node.id)} onClick={() => onSelect(node.id)}
                       onKeyDown={(event) => handleMemoryBubbleKeyDown(event, layout.nodes, node.id, onSelect, (id) => {
                        setFocusedId(id);
                        [...(event.currentTarget.parentElement?.querySelectorAll('.ov-map-node') || [])]
                          .find((candidate) => candidate.dataset.memoryId === id)?.focus();
                      })}>
                      <span className={`ov-map-node-core mem-type--${node.type}`} aria-hidden="true" />
                      <span className="ov-map-node-label">{node.intent || node.memoryId}</span>
                      {isInjected && <span className="ov-map-injected-mark" aria-hidden="true">●</span>}
                    </button>;
                  })}
                </div>
              </div>
              <SelectedMemory node={selectedNode ? { ...selectedNode, injected: model.injected.has(selectedNode.id) } : null}
                  edges={model.edges} nodesById={nodesById} onSelect={onSelect} />
            </>
          )}
    </section>
  );
}

export function OverviewContent({ summary, summaryError, summaryLoading, workflow, workflowLoading, workflowError, state, workers, advisorHistory, injections, projectGraph, globalGraph }) {
  const root = activeRootFromTelemetry(summary);
  const injection = !injections?.error && !injections?.data?.error
    ? latestInjectionForRoot(injections?.data?.injections, root)
    : null;
  const injectedMemories = injection?.memories || EMPTY_MEMORIES;
  const graphStates = { project: projectGraph, global: globalGraph };
  const models = {
    project: useMemo(() => overviewGraphModel(projectGraph?.data || {}, 'project', injectedMemories), [projectGraph?.data, injectedMemories]),
    global: useMemo(() => overviewGraphModel(globalGraph?.data || {}, 'global', injectedMemories), [globalGraph?.data, injectedMemories]),
  };
  const epochs = {
    project: overviewSelectionEpoch(root, injection, 'project'),
    global: overviewSelectionEpoch(root, injection, 'global'),
  };
  const [selections, setSelections] = useState({ project: null, global: null });
  const selectedIds = Object.fromEntries(MEMORY_SCOPES.map((scope) => [scope,
    resolveOverviewSelection(models[scope], selections[scope], epochs[scope])]));
  const onSelect = (scope, id) => {
    if (!MEMORY_SCOPES.includes(scope) || !models[scope].nodes.some((node) => node.id === id)) return;
    setSelections((current) => ({ ...current, [scope]: selectOverviewMemory(epochs[scope], id) }));
  };

  useEffect(() => {
    setSelections((current) => {
      let changed = false;
      const next = { ...current };
      for (const scope of MEMORY_SCOPES) {
        if (current[scope]?.epoch !== epochs[scope] || current[scope]?.id !== selectedIds[scope]) {
          next[scope] = selectOverviewMemory(epochs[scope], selectedIds[scope]);
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [epochs.project, epochs.global, selectedIds.project, selectedIds.global]);

  return (
    <div className="ov" aria-label="Overview">
      <ContextStrip workflow={workflow} workflowLoading={workflowLoading} workflowError={workflowError} state={state} />
      <div className="ov-workbench">
        <div className="ov-operations">
          <WorkersPanel state={workers} />
          <AdvisorPanel summary={summary} summaryError={summaryError} summaryLoading={summaryLoading} history={advisorHistory} />
          <InjectionPanel state={injections} summary={summary} summaryError={summaryError} injection={injection}
            graphStates={graphStates} models={models} selectedIds={selectedIds} onSelect={onSelect} />
        </div>
        <div className="ov-graphs" role="group" aria-label="Scoped memory knowledge maps">
          <ReadOnlyMemoryGraph scope="project" title="Project knowledge" graphState={projectGraph} model={models.project}
            selectedId={selectedIds.project} onSelect={(id) => onSelect('project', id)} />
          <ReadOnlyMemoryGraph scope="global" title="User preferences" graphState={globalGraph} model={models.global}
            selectedId={selectedIds.global} onSelect={(id) => onSelect('global', id)} />
        </div>
      </div>
    </div>
  );
}

export function Overview({ summary, summaryError, summaryLoading, state, workflow, workflowError, workflowLoading, tick = 0 }) {
  const workers = usePoll('/api/opencode/active-subagents', 5000, tick);
  const advisorHistory = usePoll('/api/telemetry/advisor-history?limit=40', 5000, tick);
  const injections = usePoll('/api/memory/injections?limit=40', 5000, tick);
  const projectGraph = usePoll(OVERVIEW_GRAPH_ENDPOINTS.project, 15000, tick);
  const globalGraph = usePoll(OVERVIEW_GRAPH_ENDPOINTS.global, 15000, tick);
  return <OverviewContent {...{ summary, summaryError, summaryLoading, state, workflow, workflowError, workflowLoading, workers, advisorHistory, injections, projectGraph, globalGraph }} />;
}
