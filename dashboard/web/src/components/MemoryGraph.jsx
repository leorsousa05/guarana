import { useEffect, useMemo, useRef, useState } from 'react';
import { useProjectFetch } from '../lib/projectApi.js';
import { fmtTs } from '../lib/format.js';
import { buildLineage } from '../lib/lineage.js';
import {
  clampMemoryCamera,
  fitMemoryCamera,
  focusMemoryCamera,
  handleMemoryBubbleKeyDown,
  layoutMemoryBubbles,
  panMemoryCamera,
  qualifyMemoryGraph,
  zoomMemoryCamera,
} from '../lib/memoryBubbleLayout.js';

const TYPE_CLASS = (t) => `mem-type mem-type--${t}`;
const NODE_TYPES = ['decision', 'bug', 'solution', 'refactor', 'preference', 'supernode', 'atom'];
const noop = () => {};
export const MEMORY_RELATIONS = ['caused-by', 'depends-on', 'supersedes', 'summarizes', 'fixes', 'relates-to'];

export const RELATION_LABEL = {
  'caused-by': 'was caused by',
  'depends-on': 'depends on',
  supersedes: 'supersedes',
  summarizes: 'summarizes',
  fixes: 'fixes',
  'relates-to': 'is related to',
};

export function filterMemoryGraph(nodes, edges, filters = {}) {
  const query = String(filters.query || '').trim().toLocaleLowerCase();
  const visibleNodes = nodes.filter((node) => {
    const scope = node.scope || 'project';
    if (filters.scope && filters.scope !== scope) return false;
    if (filters.type && filters.type !== node.type) return false;
    if (query && ![node.intent, node.summary, ...(node.tags || [])].join(' ').toLocaleLowerCase().includes(query)) return false;
    return true;
  });
  const ids = new Set(visibleNodes.map((node) => node.id));
  const visibleEdges = edges.filter((edge) =>
    (!filters.rel || edge.rel === filters.rel) && ids.has(edge.from) && ids.has(edge.to)
  );
  return { nodes: visibleNodes, edges: visibleEdges };
}

export function filterGlobalPreferenceGraph(nodes, edges) {
  const preferences = (Array.isArray(nodes) ? nodes : [])
    .filter((node) => node && node.scope === 'global' && node.type === 'preference');
  const ids = new Set(preferences.map((node) => node.id));
  const relationships = (Array.isArray(edges) ? edges : [])
    .filter((edge) => edge && edge.scope === 'global' && ids.has(edge.from) && ids.has(edge.to));
  return { nodes: preferences, edges: relationships };
}

export function resolveMemorySelection(visibleNodes, selected) {
  if (visibleNodes.some((node) => node.id === selected)) return selected;
  return visibleNodes[0]?.id ?? null;
}

export function relationshipSuggestions(selectedId, results, edges, nodesById) {
  const linked = new Set();
  for (const edge of edges) {
    if (edge.from === selectedId) linked.add(edge.to);
    if (edge.to === selectedId) linked.add(edge.from);
  }
  const seen = new Set();
  return (Array.isArray(results) ? results : []).flatMap((result) => {
    const id = `project:${result.id}`;
    const node = nodesById.get(id);
    if (!node || id === selectedId || linked.has(id) || seen.has(id)) return [];
    seen.add(id);
    return [{
      ...node,
      score: typeof result.score === 'number' ? result.score : null,
      intent: result.intent || node.intent || '',
      summary: result.summary || node.summary || '',
    }];
  });
}

export function createRelationshipPayload(source, target, rel) {
  if (source?.scope !== 'project' || target?.scope !== 'project' || source.id === target.id || !MEMORY_RELATIONS.includes(rel)) return null;
  return { from: source.memoryId || source.id, to: target.memoryId || target.id, rel, scope: 'project' };
}

export function deleteRelationshipPayload(edge) {
  if (edge?.scope !== 'project' || !Number.isFinite(edge.ts) || !MEMORY_RELATIONS.includes(edge.rel)) return null;
  return {
    from: edge.memoryFrom,
    to: edge.memoryTo,
    rel: edge.rel,
    ts: edge.ts,
    scope: 'project',
  };
}

export async function sendMemoryRelationship(method, payload, request = (...args) => globalThis.fetch(...args)) {
  const response = await request('/api/memory/relationships', {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const error = new Error('relationship request failed');
    error.status = response.status;
    throw error;
  }
  return response.json?.().catch?.(() => null) ?? null;
}

export function MemoryRelationshipSuggestions({ candidates, onChoose }) {
  if (!candidates?.length) return <p className="mem-graph-muted">No unlinked text matches found.</p>;
  return (
    <ol className="mem-suggestion-list" aria-label="Local text-match candidates">
      {candidates.map((candidate) => (
        <li key={candidate.id} className="mem-suggestion-row">
          <div>
            <span className={`memory-scope memory-scope--${candidate.scope}`}>{candidate.scope}</span>{' '}
            <span className={TYPE_CLASS(candidate.type)}>{candidate.type}</span>
            <strong>{candidate.intent || candidate.memoryId}</strong>
            <span className="mem-suggestion-score">score {typeof candidate.score === 'number' ? candidate.score.toFixed(3) : '—'}</span>
            {candidate.summary && <p>{candidate.summary}</p>}
          </div>
          <button type="button" className="mem-graph-action" onClick={() => onChoose(candidate.id)}>Use this match</button>
        </li>
      ))}
    </ol>
  );
}

export function MemoryCreateConfirmation({ source, target, rel, onConfirm, onCancel, disabled = false }) {
  if (!source || !target || !rel) return null;
  return (
    <div className="mem-confirmation" role="group" aria-label="Confirm relationship save">
      <p>Save this project link? <strong>{source.intent || source.memoryId}</strong> {RELATION_LABEL[rel]} <strong>{target.intent || target.memoryId}</strong>.</p>
      <button type="button" className="mem-graph-action" onClick={onConfirm} disabled={disabled}>Confirm and save link</button>{' '}
      <button type="button" className="mem-graph-action" onClick={onCancel} disabled={disabled}>Keep editing</button>
    </div>
  );
}

export function MemoryDeleteConfirmation({ edge, source, target, onConfirm, onCancel, disabled = false }) {
  if (!edge) return null;
  return (
    <div className="mem-confirmation" role="group" aria-label="Confirm relationship removal">
      <p>
        Remove this project link? <strong>{source?.intent || edge.memoryFrom}</strong> {RELATION_LABEL[edge.rel]}{' '}
        <strong>{target?.intent || edge.memoryTo}</strong> · {fmtTs(edge.ts)}. It will not be possible to restore it from this screen.
      </p>
      <button type="button" className="mem-graph-action" onClick={onConfirm} disabled={disabled}>Confirm removal</button>{' '}
      <button type="button" className="mem-graph-action" onClick={onCancel} disabled={disabled}>Keep link</button>
    </div>
  );
}

export function MemoryGraph({ nodes, edges, selected, onSelect = noop, onChange = noop, projectOnly = false, globalPreferencesOnly = false }) {
  const projectFetch = useProjectFetch();
  const { nodes: graphNodes, edges: graphEdges } = useMemo(() => {
    if (globalPreferencesOnly) {
      const globalPreferences = filterGlobalPreferenceGraph(nodes, edges);
      return qualifyMemoryGraph(globalPreferences.nodes, globalPreferences.edges);
    }
    if (!projectOnly) return qualifyMemoryGraph(nodes, edges);
    const projectNodes = nodes.filter((node) => (node.scope || 'project') === 'project');
    const projectIds = new Set(projectNodes.map((node) => node.id));
    const projectEdges = edges.filter((edge) => (edge.scope || 'project') === 'project'
      && projectIds.has(edge.from) && projectIds.has(edge.to));
    return qualifyMemoryGraph(projectNodes, projectEdges);
  }, [nodes, edges, projectOnly, globalPreferencesOnly]);
  const nodesById = useMemo(() => new Map(graphNodes.map((n) => [n.id, n])), [graphNodes]);
  const projectNodes = useMemo(() => graphNodes.filter((node) => node.scope === 'project'), [graphNodes]);
  const bubbleRefs = useRef(new Map());
  const bubbleViewportRef = useRef(null);
  const wheelHandlerRef = useRef(null);
  const panStartRef = useRef(null);
  const cameraRef = useRef({ scale: 1, x: 0, y: 0 });
  const cameraStateRef = useRef({ initialized: false });
  const [camera, setCamera] = useState(cameraRef.current);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [panning, setPanning] = useState(false);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [scopeFilter, setScopeFilter] = useState('');
  const [relFilter, setRelFilter] = useState('');
  const [displayMode, setDisplayMode] = useState('map');
  const [viewMode, setViewMode] = useState('network');
  const [focusedBubble, setFocusedBubble] = useState(null);
  const [targetId, setTargetId] = useState('');
  const [relation, setRelation] = useState('');
  const [pendingCreate, setPendingCreate] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [suggestions, setSuggestions] = useState(null);
  const [suggesting, setSuggesting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    setTargetId('');
    setRelation('');
    setPendingCreate(false);
    setPendingDelete(null);
    setSuggestions(null);
    setNotice(null);
  }, [selected]);

  const visible = useMemo(() => filterMemoryGraph(graphNodes, graphEdges, {
    query,
    type: typeFilter,
    scope: projectOnly ? 'project' : globalPreferencesOnly ? 'global' : scopeFilter,
    rel: relFilter,
  }), [graphNodes, graphEdges, query, typeFilter, scopeFilter, relFilter, projectOnly, globalPreferencesOnly]);
  const effectiveSelected = resolveMemorySelection(visible.nodes, selected);
  useEffect(() => {
    if (selected !== effectiveSelected) onSelect(effectiveSelected);
  }, [selected, effectiveSelected, onSelect]);
  const selectedNode = nodesById.get(effectiveSelected);
  const bubbleView = useMemo(
    () => layoutMemoryBubbles(visible.nodes, visible.edges, effectiveSelected, viewMode),
    [visible.nodes, visible.edges, effectiveSelected, viewMode],
  );
  const bubblesById = useMemo(() => new Map(bubbleView.nodes.map((node) => [node.id, node])), [bubbleView.nodes]);
  const selectedBubble = bubblesById.get(effectiveSelected);
  const layoutSignature = `${bubbleView.width}x${bubbleView.height}:${bubbleView.nodes.map((node) => node.id).join('\u0000')}`;
  const bubbleFocusId = bubbleView.nodes.some((node) => node.id === focusedBubble) ? focusedBubble : bubbleView.selected;
  const focusedEdges = bubbleView.edges.filter((edge) => edge.from === bubbleView.selected || edge.to === bubbleView.selected);
  useEffect(() => {
    if (!focusedBubble || bubbleView.nodes.some((node) => node.id === focusedBubble)) return;
    const activeId = typeof document === 'undefined' ? null : document.activeElement?.dataset?.memoryId;
    setFocusedBubble(bubbleView.selected);
    if (activeId === focusedBubble && bubbleView.selected) bubbleRefs.current.get(bubbleView.selected)?.focus();
  }, [focusedBubble, bubbleView.nodes, bubbleView.selected]);
  useEffect(() => {
    const viewport = bubbleViewportRef.current;
    if (!viewport) return undefined;
    const measure = () => {
      const rect = viewport.getBoundingClientRect();
      const next = { width: Math.round(rect.width), height: Math.round(rect.height) };
      setViewportSize((current) => current.width === next.width && current.height === next.height ? current : next);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!viewportSize.width || !viewportSize.height || !bubbleView.nodes.length) return;
    const previous = cameraStateRef.current;
    const selectionChanged = previous.initialized && previous.selected !== effectiveSelected;
    const viewportChanged = previous.initialized && (
      previous.width !== viewportSize.width || previous.height !== viewportSize.height
    );
    const layoutChanged = previous.initialized && previous.signature !== layoutSignature;
    const initial = !previous.initialized;
    const shouldFit = previous.viewMode !== viewMode || viewportChanged || (layoutChanged && !selectionChanged);
    const next = initial
      ? focusMemoryCamera({ scale: 1, x: 0, y: 0 }, selectedBubble, bubbleView, viewportSize)
      : shouldFit
        ? fitMemoryCamera(bubbleView, viewportSize)
        : clampMemoryCamera(cameraRef.current, bubbleView, viewportSize);
    cameraRef.current = next;
    setCamera(next);
    cameraStateRef.current = {
      initialized: true,
      selected: effectiveSelected,
      viewMode,
      signature: layoutSignature,
      width: viewportSize.width,
      height: viewportSize.height,
    };
  }, [viewportSize.width, viewportSize.height, layoutSignature, effectiveSelected, viewMode, bubbleView, selectedBubble]);
  const focusMemory = (id) => {
    if (!visible.nodes.some((node) => node.id === id)) {
      setQuery('');
      setTypeFilter('');
      setScopeFilter('');
      setRelFilter('');
    }
    onSelect(id);
  };
  const neighbors = useMemo(() => {
    if (!effectiveSelected) return [];
    return visible.edges.flatMap((edge) => {
      if (edge.from === effectiveSelected) return [{ other: nodesById.get(edge.to), rel: edge.rel, direction: 'out', edge }];
      if (edge.to === effectiveSelected) return [{ other: nodesById.get(edge.from), rel: edge.rel, direction: 'in', edge }];
      return [];
    }).filter(({ other }) => Boolean(other));
  }, [effectiveSelected, visible.edges, nodesById]);
  const source = selectedNode?.scope === 'project' ? selectedNode : null;
  const target = nodesById.get(targetId);
  const createPayload = createRelationshipPayload(source, target, relation);

  const findSuggestions = async () => {
    if (!source) return;
    const queryText = `${source.intent || ''} ${source.summary || ''}`.trim();
    if (!queryText) {
      setSuggestions([]);
      setNotice(null);
      return;
    }
    setSuggesting(true);
    setNotice(null);
    setSuggestions(null);
    const params = new URLSearchParams({ q: queryText, limit: '20' });
    try {
      const response = await projectFetch(`/api/memory/search?${params.toString()}`);
      if (!response.ok) throw Object.assign(new Error('request failed'), { status: response.status });
      const data = await response.json();
      if (data?.error) throw Object.assign(new Error('request failed'), { status: response.status });
      setSuggestions(relationshipSuggestions(effectiveSelected, data?.results, graphEdges, nodesById));
    } catch (error) {
      setNotice({ kind: 'error', text: `Could not load text matches (HTTP ${Number(error.status) || 0}).` });
    } finally {
      setSuggesting(false);
    }
  };

  const confirmCreate = async () => {
    if (!createPayload || !pendingCreate || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      await sendMemoryRelationship('POST', createPayload, projectFetch);
      setNotice({ kind: 'success', text: 'Project link saved.' });
      setPendingCreate(false);
      setTargetId('');
      setRelation('');
      setSuggestions(null);
      onChange();
    } catch (error) {
      setNotice({ kind: 'error', text: `Could not save this link (HTTP ${Number(error.status) || 0}).` });
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    const payload = deleteRelationshipPayload(pendingDelete);
    if (!payload || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      await sendMemoryRelationship('DELETE', payload, projectFetch);
      setNotice({ kind: 'success', text: 'Project link removed.' });
      setPendingDelete(null);
      onChange();
    } catch (error) {
      setNotice({ kind: 'error', text: `Could not remove this link (HTTP ${Number(error.status) || 0}).` });
    } finally {
      setBusy(false);
    }
  };

  const applyCamera = (next) => {
    const clamped = clampMemoryCamera(next, bubbleView, viewportSize);
    cameraRef.current = clamped;
    setCamera(clamped);
  };

  const fitMap = () => applyCamera(fitMemoryCamera(bubbleView, viewportSize));
  const focusSelected = () => {
    if (selectedBubble) applyCamera(focusMemoryCamera(cameraRef.current, selectedBubble, bubbleView, viewportSize));
  };
  const zoomMap = (factor, anchor) => applyCamera(zoomMemoryCamera(cameraRef.current, factor, bubbleView, viewportSize, anchor));
  const handleMapWheel = (event) => {
    if (event.cancelable) event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    zoomMap(Math.exp(-event.deltaY * 0.001), { x: event.clientX - rect.left, y: event.clientY - rect.top });
  };
  wheelHandlerRef.current = handleMapWheel;
  useEffect(() => {
    const viewport = bubbleViewportRef.current;
    if (!viewport) return undefined;
    const listener = (event) => wheelHandlerRef.current?.(event);
    viewport.addEventListener('wheel', listener, { passive: false });
    return () => viewport.removeEventListener('wheel', listener);
  }, []);
  const handleMapPointerDown = (event) => {
    if (event.button !== 0 || event.target.closest?.('.mem-bubble-button')) return;
    event.preventDefault();
    panStartRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setPanning(true);
  };
  const handleMapPointerMove = (event) => {
    const start = panStartRef.current;
    if (!start || start.pointerId !== event.pointerId) return;
    applyCamera(panMemoryCamera(cameraRef.current, event.clientX - start.x, event.clientY - start.y, bubbleView, viewportSize));
    panStartRef.current = { ...start, x: event.clientX, y: event.clientY };
  };
  const stopMapPan = (event) => {
    if (!panStartRef.current || panStartRef.current.pointerId !== event.pointerId) return;
    panStartRef.current = null;
    setPanning(false);
  };
  const handleViewportKeyDown = (event) => {
    if (event.target === event.currentTarget && ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) {
      event.preventDefault();
    }
  };

  return (
    <div className={`mem-graph${projectOnly ? ' mem-graph--project-only' : ''}${globalPreferencesOnly ? ' mem-graph--global-preferences-only' : ''}`}>
      <fieldset className="mem-graph-filters">
        <legend>{globalPreferencesOnly ? 'Filter global preferences and relationships' : projectOnly ? 'Filter project memories and relationships' : 'Filter memories and relationships'}</legend>
        <label>Text<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} aria-label={globalPreferencesOnly ? 'Filter global preferences by text' : 'Filter memories by text'} placeholder="intent or summary" /></label>
        <label>Type<select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} aria-label={globalPreferencesOnly ? 'Filter global preferences by type' : 'Filter memories by type'}>
          <option value="">{globalPreferencesOnly ? 'all preferences' : 'all types'}</option>
          {(globalPreferencesOnly ? ['preference'] : NODE_TYPES).map((type) => <option key={type} value={type}>{type}</option>)}
        </select></label>
        {!projectOnly && !globalPreferencesOnly && <label>Scope<select value={scopeFilter} onChange={(event) => setScopeFilter(event.target.value)} aria-label="Filter memories by scope">
          <option value="">all scopes</option><option value="project">project</option><option value="global">global</option>
        </select></label>}
        <label>Relationship<select value={relFilter} onChange={(event) => setRelFilter(event.target.value)} aria-label="Filter by relationship type">
          <option value="">all relationships</option>
          {MEMORY_RELATIONS.map((rel) => <option key={rel} value={rel}>{rel} — {RELATION_LABEL[rel]}</option>)}
        </select></label>
      </fieldset>
      <div className="mem-graph-toolbar">
        <p className="mem-graph-help">Select a {globalPreferencesOnly ? 'preference' : 'memory'} in the map or index to inspect its connected neighborhood and details.</p>
        <span className="mem-graph-count" role="status">Showing {visible.nodes.length} of {graphNodes.length} {globalPreferencesOnly ? 'preferences' : 'memories'} · {visible.edges.length} matching links</span>
        <div className="mem-graph-display-modes" role="group" aria-label="Memory display">
          <button type="button" aria-pressed={displayMode === 'map'} onClick={() => setDisplayMode('map')}>{globalPreferencesOnly ? 'Preference map' : 'Memory map'}</button>
          <button type="button" aria-pressed={displayMode === 'index'} onClick={() => setDisplayMode('index')}>{globalPreferencesOnly ? 'Preference index' : 'Memory index'}</button>
        </div>
      </div>
      <div className={`mem-graph-explorer mem-graph-explorer--${displayMode}`}>
        <section className="mem-graph-index" aria-label={globalPreferencesOnly ? 'Global preference index' : 'Memory index'} hidden={displayMode === 'map'}>
          <div className="mem-graph-index-heading">
            <h4>{globalPreferencesOnly ? 'Global preference index' : 'Memory index'}</h4>
            <span>{visible.nodes.length} {visible.nodes.length === 1 ? 'record' : 'records'}</span>
          </div>
          {visible.nodes.length ? (
            <div className="mem-index-scroll" role="region" aria-label={globalPreferencesOnly ? 'Filtered global preference index' : 'Filtered memory index'} tabIndex={0}>
              <ol className="mem-index-list">
                {visible.nodes.map((node) => (
                  <li key={node.id}>
                    <button
                      type="button"
                      className={`mem-index-record${effectiveSelected === node.id ? ' mem-index-record--active' : ''}`}
                      aria-pressed={effectiveSelected === node.id}
                      aria-label={`${node.scope} ${node.type}: ${node.intent || node.memoryId}`}
                      onClick={() => focusMemory(node.id)}
                    >
                      <span className="mem-index-meta">
                        <span className={`memory-scope memory-scope--${node.scope}`}>{node.scope}</span>
                        <span className={TYPE_CLASS(node.type)}>{node.type}</span>
                      </span>
                      <strong className="mem-index-intent">{node.intent || node.memoryId}</strong>
                      <span className="mem-index-summary">{node.summary || 'No summary recorded.'}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <p className="mem-graph-empty">{globalPreferencesOnly ? 'No global preferences match these filters. Adjust the text or relationship filters to continue.' : projectOnly ? 'No project memories match these filters. Adjust the text, type, or relationship filters to continue.' : 'No memories match these filters. Adjust the text, type, scope, or relationship filters to continue.'}</p>
          )}
        </section>

        <div className="mem-graph-side">
          <section className="mem-bubble-section" aria-label={globalPreferencesOnly ? 'Global preference bubble map' : 'Memory bubble map'}>
            <header className="mem-bubble-heading">
              <div>
                <h4>{globalPreferencesOnly ? 'Global preference map' : 'Memory map'}</h4>
                <p>{globalPreferencesOnly ? 'Confirmed global preferences only. The graph and relationships are read-only.' : projectOnly ? 'Confirmed records from the selected project only.' : 'Type is color · project has a solid ring · global has a dashed ring'}</p>
              </div>
              <div className="mem-bubble-modes" role="group" aria-label="Memory map view">
                <button type="button" aria-pressed={viewMode === 'network'} onClick={() => setViewMode('network')}>Network</button>
                <button type="button" aria-pressed={viewMode === 'neighborhood'} onClick={() => setViewMode('neighborhood')}>Neighborhood</button>
              </div>
            </header>
            <div className="mem-map-toolbar" role="group" aria-label="Map navigation">
              <button type="button" className="mem-graph-action" disabled={!bubbleView.nodes.length} onClick={() => zoomMap(1.25)}>Zoom in</button>
              <button type="button" className="mem-graph-action" disabled={!bubbleView.nodes.length} onClick={() => zoomMap(0.8)}>Zoom out</button>
              <button type="button" className="mem-graph-action" disabled={!bubbleView.nodes.length} onClick={fitMap}>Fit map</button>
              <button type="button" className="mem-graph-action" disabled={!selectedBubble} onClick={focusSelected}>Focus selected</button>
              <span className="mem-map-gestures">Drag empty map to pan · wheel to zoom · use Focus selected to recenter</span>
            </div>
            <div className="mem-bubble-legend" aria-label={globalPreferencesOnly ? 'Global preference type' : 'Memory types'}>
              {(globalPreferencesOnly ? ['preference'] : NODE_TYPES).map((type) => <span key={type}><i className={`mem-bubble-key-dot mem-type--${type}`} aria-hidden="true" />{type}</span>)}
            </div>
            <div
              ref={bubbleViewportRef}
              className={`mem-bubble-viewport${panning ? ' mem-bubble-viewport--panning' : ''}`}
              role="region"
              aria-label={`${viewMode === 'network' ? 'Network' : 'Neighborhood'} bubble graph`}
              tabIndex={0}
              onPointerDown={handleMapPointerDown}
              onPointerMove={handleMapPointerMove}
              onPointerUp={stopMapPan}
              onPointerCancel={stopMapPan}
              onKeyDown={handleViewportKeyDown}
            >
              {bubbleView.nodes.length ? (
                <div
                  className="mem-bubble-canvas"
                  style={{
                    width: bubbleView.width,
                    height: bubbleView.height,
                    transform: `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.scale})`,
                  }}
                >
                  <svg className="mem-bubble-edges" width={bubbleView.width} height={bubbleView.height} viewBox={`0 0 ${bubbleView.width} ${bubbleView.height}`} aria-hidden="true" focusable="false">
                    <defs>
                      <marker id="memory-arrow-project" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L8,4 L0,8 z" fill="#315c35" /></marker>
                      <marker id="memory-arrow-global" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L8,4 L0,8 z" fill="#006b68" /></marker>
                    </defs>
                    {bubbleView.edges.map((edge, index) => {
                      const from = bubblesById.get(edge.from);
                      const to = bubblesById.get(edge.to);
                      if (!from || !to) return null;
                      const active = edge.from === bubbleView.selected || edge.to === bubbleView.selected;
                      const markerEnd = `url(#memory-arrow-${edge.scope === 'global' ? 'global' : 'project'})`;
                      if (edge.from === edge.to) {
                        return <path key={`${edge.scope}:${edge.from}:${edge.rel}:${edge.ts ?? index}`} className={`mem-bubble-edge mem-bubble-edge--${edge.scope}${active ? ' mem-bubble-edge--active' : ''}`} d={`M ${from.x - 10} ${from.y - 18} C ${from.x - 64} ${from.y - 72}, ${from.x + 64} ${from.y - 72}, ${from.x + 10} ${from.y - 18}`} markerEnd={markerEnd} />;
                      }
                      const dx = to.x - from.x;
                      const dy = to.y - from.y;
                      const distance = Math.hypot(dx, dy) || 1;
                      const startGap = from.diameter / 2 + 3;
                      const endGap = to.diameter / 2 + 7;
                      return <line
                        key={`${edge.scope}:${edge.from}:${edge.to}:${edge.rel}:${edge.ts ?? index}`}
                        className={`mem-bubble-edge mem-bubble-edge--${edge.scope}${active ? ' mem-bubble-edge--active' : ''}`}
                        x1={from.x + dx / distance * startGap}
                        y1={from.y + dy / distance * startGap}
                        x2={to.x - dx / distance * endGap}
                        y2={to.y - dy / distance * endGap}
                        markerEnd={markerEnd}
                      />;
                    })}
                  </svg>
                  {bubbleView.nodes.map((node) => (
                    <button
                      key={node.id}
                      ref={(element) => {
                        if (element) bubbleRefs.current.set(node.id, element);
                        else bubbleRefs.current.delete(node.id);
                      }}
                      type="button"
                      className={`mem-bubble-button mem-bubble-button--${node.scope}${node.focus ? ' mem-bubble-button--selected' : ''}${node.neighbor ? ' mem-bubble-button--neighbor' : ''}`}
                      style={{ left: node.x - node.diameter / 2, top: node.y - node.diameter / 2, width: node.diameter, height: node.diameter }}
                      data-memory-id={node.id}
                      data-scope={node.scope}
                      data-node-type={node.type}
                      tabIndex={node.id === bubbleFocusId ? 0 : -1}
                      aria-pressed={node.id === effectiveSelected}
                      aria-label={`${node.scope} ${node.type}: ${node.intent || node.memoryId}; ${node.diameter === 62 ? 'focused memory' : node.neighbor ? 'direct neighbor' : 'network memory'}`}
                      title={`${node.scope} ${node.type}: ${node.intent || node.memoryId}`}
                      onFocus={() => setFocusedBubble(node.id)}
                      onClick={() => focusMemory(node.id)}
                      onKeyDown={(event) => handleMemoryBubbleKeyDown(
                        event,
                        bubbleView.nodes,
                        node.id,
                        focusMemory,
                        (id) => bubbleRefs.current.get(id)?.focus(),
                      )}
                    >
                      <span className={`mem-bubble-core mem-type--${node.type}`} aria-hidden="true" />
                      <span className={`mem-bubble-disclosure${node.x > bubbleView.width / 2 ? ' mem-bubble-disclosure--right' : ''}${node.y > bubbleView.height / 2 ? ' mem-bubble-disclosure--above' : ''}`} aria-hidden="true">
                        <strong>{node.intent || node.memoryId}</strong>
                        <span>{node.scope} · {node.type}</span>
                        {node.summary && <span className="mem-bubble-disclosure-summary">{node.summary}</span>}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mem-graph-empty">{globalPreferencesOnly ? 'No global preferences match these filters. Adjust the filters to see bubbles.' : projectOnly ? 'No project memories match these filters. Adjust the filters to see bubbles.' : 'No memories match these filters. Adjust the filters to see bubbles.'}</p>
              )}
            </div>
            <div className="mem-bubble-labels-wrap">
              <h5>{viewMode === 'neighborhood' ? 'Neighborhood relationships' : 'Focused relationships'}</h5>
              {focusedEdges.length ? (
                <ol className="mem-bubble-labels" aria-label="Focused relationship direction and type">
                  {focusedEdges.map((edge, index) => {
                    const from = nodesById.get(edge.from);
                    const to = nodesById.get(edge.to);
                    return <li key={`${edge.scope}:${edge.from}:${edge.to}:${edge.rel}:${edge.ts ?? index}`}>
                      <span className={`memory-scope memory-scope--${edge.scope}`}>{edge.scope}</span>{' '}
                      <span className="mem-bubble-edge-direction">{edge.from === bubbleView.selected ? 'Outgoing' : 'Incoming'}</span>
                      <span>{from?.intent || from?.memoryId || edge.memoryFrom} → {to?.intent || to?.memoryId || edge.memoryTo}</span>
                      <strong>{edge.rel}</strong>
                    </li>;
                  })}
                </ol>
              ) : <p className="mem-graph-muted">No matching relationships touch the selected memory.</p>}
            </div>
          </section>

        {selectedNode ? (
        <section className="mem-detail mem-map-inspector" aria-label={globalPreferencesOnly ? 'Selected global preference inspector' : 'Selected memory inspector'}>
          <div className="mem-detail-heading">
            <div>
              <p className="mem-focus-label">{globalPreferencesOnly ? 'Selected global preference' : 'Selected memory'}</p>
              <h4 className="sub-title"><span className={TYPE_CLASS(selectedNode.type)}>{selectedNode.type}</span> {selectedNode.intent || selectedNode.memoryId}</h4>
              <div className="mem-detail-meta">
                <span className={`memory-scope memory-scope--${selectedNode.scope}`}>Scope: {selectedNode.scope}</span>{' · '}
                <span>Type: {selectedNode.type}</span> · <span>ID: {selectedNode.id}</span> · {fmtTs(selectedNode.ts)}
                {selectedNode.tags?.length > 0 && <> · {selectedNode.tags.join(', ')}</>}
              </div>
            </div>
          </div>
          <h5 className="mem-detail-sub">Summary</h5>
          <p className="mem-detail-text">{selectedNode.summary || 'No summary recorded.'}</p>
          {selectedNode.decision && <><h5 className="mem-detail-sub">Decision</h5><p className="mem-detail-text">{selectedNode.decision}</p></>}
          {selectedNode.rejectedAlternatives?.length > 0 && <p className="mem-detail-text"><strong>rejected:</strong> {selectedNode.rejectedAlternatives.join(' · ')}</p>}

          <h5 className="mem-detail-sub">Connected neighborhood</h5>
          {neighbors.length === 0 && <p className="mem-graph-muted">No matching links to this memory.</p>}
          <ul className="mem-detail-links">
            {neighbors.map(({ other, rel, direction, edge }, index) => (
              <li key={`${edge.scope}:${edge.memoryFrom}:${edge.memoryTo}:${rel}:${edge.ts ?? index}`} className="mem-relationship-row">
                <div className="mem-relationship-copy">
                  <span className={`mem-relationship-direction mem-relationship-direction--${direction}`}>{direction === 'out' ? 'Outgoing' : 'Incoming'}</span>
                  <span className="mem-relationship-statement">
                    {direction === 'out'
                      ? <>This memory {RELATION_LABEL[rel]} <button type="button" className="mem-detail-neighbor" onClick={() => focusMemory(other.id)}>{other.intent || other.memoryId}</button></>
                      : <><button type="button" className="mem-detail-neighbor" onClick={() => focusMemory(other.id)}>{other.intent || other.memoryId}</button> {RELATION_LABEL[rel]} this memory</>}
                  </span>
                  <span className="mem-relationship-meta"><span className={`memory-scope memory-scope--${other.scope}`}>{other.scope}</span> · {other.type}</span>
                  <p className="mem-neighbor-summary">{other.summary || 'No summary recorded.'}</p>
                </div>
                <div className="mem-relationship-meta-row">
                  <span className="mem-relationship-kind">{rel}</span>
                  <span className={`memory-scope memory-scope--${edge.scope}`}>{edge.scope} link</span>
                  <span className="mem-link-ts">{fmtTs(edge.ts)}</span>
                  {edge.scope === 'project' && selectedNode.scope === 'project' && (
                    <button type="button" className="mem-graph-action" disabled={!Number.isFinite(edge.ts) || busy} onClick={() => { setPendingDelete(edge); setPendingCreate(false); setNotice(null); }}>
                      Remove link
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {(() => {
            const { older, newer } = buildLineage(effectiveSelected, graphEdges, nodesById);
            if (older.length === 0 && newer.length === 0) return null;
            const row = (node, tag) => (
              <li key={node.id} className="mem-lineage-row">
                <span className="mem-lineage-tag">{tag}</span>
                <button type="button" className="mem-detail-neighbor" onClick={() => focusMemory(node.id)}>
                  <span className={`memory-scope memory-scope--${node.scope}`}>{node.scope}</span> [{node.type}] {node.intent || node.id}
                </button>
              </li>
            );
            return <><h5 className="mem-detail-sub">decision lineage · supersedes</h5><ul className="mem-detail-links">{older.map((node) => row(node, 'replaced'))}{row(selectedNode, 'this')}{newer.map((node) => row(node, 'replaced by'))}</ul></>;
          })()}

          {pendingDelete && <MemoryDeleteConfirmation
            edge={pendingDelete}
            source={nodesById.get(pendingDelete.from)}
            target={nodesById.get(pendingDelete.to)}
            onConfirm={confirmDelete}
            onCancel={() => setPendingDelete(null)}
            disabled={busy}
          />}

          {source ? (
            <section className="mem-link-editor" aria-label="Project relationship editor">
              <h5 className="mem-detail-sub">Manage project links</h5>
              <p className="mem-graph-muted">Only confirmed project memories can be linked here. Global memories and links stay read-only.</p>
              <div className="mem-link-form">
                <label htmlFor="mem-link-target">Link this memory to
                  <select id="mem-link-target" value={targetId} onChange={(event) => { setTargetId(event.target.value); setPendingCreate(false); }}>
                    <option value="">Choose a project memory</option>
                    {projectNodes.filter((node) => node.id !== source.id).map((node) => (
                      <option key={node.id} value={node.id}>{node.type} · {node.intent || node.memoryId} ({node.scope})</option>
                    ))}
                  </select>
                </label>
                <label htmlFor="mem-link-relation">Relationship
                  <select id="mem-link-relation" value={relation} onChange={(event) => { setRelation(event.target.value); setPendingCreate(false); }}>
                    <option value="">Choose a relationship</option>
                    {MEMORY_RELATIONS.map((rel) => <option key={rel} value={rel}>{rel} — {RELATION_LABEL[rel]}</option>)}
                  </select>
                </label>
                <button type="button" className="mem-graph-action" disabled={!createPayload || busy} onClick={() => { setPendingCreate(true); setPendingDelete(null); setNotice(null); }}>Review link</button>
              </div>
              {pendingCreate && <MemoryCreateConfirmation source={source} target={target} rel={relation} onConfirm={confirmCreate} onCancel={() => setPendingCreate(false)} disabled={busy} />}
              <div className="mem-suggestions">
                <h6>Text-match suggestions</h6>
                <p className="mem-graph-muted">Local TF-IDF search of confirmed project memories only. These candidates match text; they do not imply a relationship type or save anything.</p>
                <button type="button" className="mem-graph-action" disabled={suggesting} onClick={findSuggestions}>{suggesting ? 'Finding matches…' : 'Find text matches'}</button>
                {suggestions && <MemoryRelationshipSuggestions candidates={suggestions} onChoose={(id) => { setTargetId(id); setRelation(''); setPendingCreate(false); setNotice(null); }} />}
              </div>
            </section>
          ) : (
            <p className="mem-graph-muted mem-readonly-note">{globalPreferencesOnly ? 'Global preferences and their relationships are read-only here.' : 'Global memories are read-only here. Project relationship editing is available only when a project memory is selected.'}</p>
          )}
          {notice && <p className={notice.kind === 'error' ? 'mem-operation-message mem-operation-message--error' : 'mem-operation-message'} role={notice.kind === 'error' ? 'alert' : 'status'}>{notice.text}</p>}
        </section>
        ) : (
          <section className="mem-detail mem-map-inspector mem-graph-empty" aria-label={globalPreferencesOnly ? 'Selected global preference inspector' : 'Selected memory inspector'} role="status">
            {globalPreferencesOnly ? 'No global preferences match these filters. Adjust the filters to select a preference and explore its neighborhood.' : projectOnly ? 'No project memories match these filters. Adjust the filters to select a project memory and explore its neighborhood.' : 'No memories match these filters. Adjust the filters to select a memory and explore its neighborhood.'}
          </section>
        )}
        </div>
      </div>
    </div>
  );
}
