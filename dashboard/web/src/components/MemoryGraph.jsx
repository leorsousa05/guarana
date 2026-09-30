import { useEffect, useMemo, useRef, useState } from 'react';
import { fmtTs } from '../lib/format.js';
import { buildLineage } from '../lib/lineage.js';
import { graphSignature, GRAPH_HEIGHT as H, GRAPH_WIDTH as W, layoutGraph, readGraphPositions, saveGraphPositions } from '../lib/memoryGraphLayout.js';

const TYPE_CLASS = (t) => `mem-type mem-type--${t}`;
const NODE_TYPES = ['decision', 'bug', 'solution', 'refactor', 'preference', 'supernode', 'atom'];

const REL_WHY = {
  'caused-by': 'was caused by',
  'depends-on': 'depends on',
  supersedes: 'supersedes',
  summarizes: 'summarizes',
  fixes: 'fixes',
  'relates-to': 'is related to',
};

const REL_DESC = {
  'caused-by': 'this node happened because of the other',
  'depends-on': 'this node requires the other',
  supersedes: 'this node replaced the other',
  summarizes: 'this node condenses the other',
  fixes: 'this node fixes the other',
  'relates-to': 'this node is related to the other',
};

const shortLabel = (value) => {
  const text = String(value || 'memory');
  return text.length > 24 ? `${text.slice(0, 23)}…` : text;
};

const browserSessionStorage = () => {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

export function MemoryGraph({ nodes, edges, selected, onSelect }) {
  const svgRef = useRef(null);
  const graphNodes = useMemo(() => nodes.map((node) => ({
    ...node,
    memoryId: node.id,
    id: `${node.scope || 'project'}:${node.id}`,
  })), [nodes]);
  const graphEdges = useMemo(() => edges.map((edge) => ({
    ...edge,
    from: `${edge.scope || 'project'}:${edge.from}`,
    to: `${edge.scope || 'project'}:${edge.to}`,
  })), [edges]);
  const graphKey = useMemo(() => graphSignature(graphNodes, graphEdges), [graphNodes, graphEdges]);
  const [pos, setPos] = useState(() => layoutGraph(graphNodes, graphEdges, readGraphPositions(browserSessionStorage(), graphNodes)));
  const positionsRef = useRef(pos);
  const dragRef = useRef(null);
  const nodesById = useMemo(() => new Map(graphNodes.map((n) => [n.id, n])), [graphNodes]);

  useEffect(() => {
    setPos((previous) => {
      const next = layoutGraph(graphNodes, graphEdges, previous);
      positionsRef.current = next;
      return next;
    });
  }, [graphKey]);

  const neighbors = useMemo(() => {
    if (!selected) return { set: new Set(), list: [] };
    const set = new Set();
    const list = [];
    for (const e of graphEdges) {
      if (e.from === selected) {
        set.add(e.to);
        list.push({ other: nodesById.get(e.to), rel: e.rel, dir: 'out', edge: e });
      } else if (e.to === selected) {
        set.add(e.from);
        list.push({ other: nodesById.get(e.from), rel: e.rel, dir: 'in', edge: e });
      }
    }
    return { set, list };
  }, [selected, graphEdges, nodesById]);

  const onPointerDown = (id, ev) => {
    ev.preventDefault();
    const svg = svgRef.current;
    if (!svg) return;
    const pt = svg.createSVGPoint();
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const toSvg = (x, y) => {
      pt.x = x;
      pt.y = y;
      return pt.matrixTransform(ctm);
    };
    const start = pos.get(id);
    if (!start) return;
    const m = toSvg(ev.clientX, ev.clientY);
    dragRef.current = { id, dx: start.x - m.x, dy: start.y - m.y, startX: ev.clientX, startY: ev.clientY, moved: false };
    svg.setPointerCapture(ev.pointerId);
  };

  const onPointerMove = (ev) => {
    const drag = dragRef.current;
    const svg = svgRef.current;
    if (!drag || !svg) return;
    if (Math.hypot(ev.clientX - drag.startX, ev.clientY - drag.startY) > 4) drag.moved = true;
    if (!drag.moved) return;
    const pt = svg.createSVGPoint();
    pt.x = ev.clientX;
    pt.y = ev.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const m = pt.matrixTransform(ctm);
    setPos((prev) => {
      const next = new Map(prev);
      next.set(drag.id, {
        x: Math.max(24, Math.min(W - 24, m.x + drag.dx)),
        y: Math.max(28, Math.min(H - 28, m.y + drag.dy)),
      });
      positionsRef.current = next;
      return next;
    });
  };

  const onPointerUp = () => {
    const drag = dragRef.current;
    if (drag && !drag.moved) onSelect(selected === drag.id ? null : drag.id);
    if (drag?.moved) saveGraphPositions(browserSessionStorage(), positionsRef.current);
    dragRef.current = null;
  };

  const onPointerCancel = () => {
    dragRef.current = null;
  };

  const resetLayout = () => {
    const next = layoutGraph(graphNodes, graphEdges);
    positionsRef.current = next;
    setPos(next);
    saveGraphPositions(browserSessionStorage(), next);
  };

  if (!graphNodes.length) return null;

  return (
    <div className="mem-graph">
      <div className="mem-graph-legend" aria-label="Node type colors">
        {NODE_TYPES.map((type) => (
          <span key={type} className="mem-graph-legend-item">
            <span className={`mem-graph-legend-swatch mem-type--${type}`} aria-hidden="true" />
            {type}
          </span>
        ))}
        <span className="mem-graph-scope-label"><span className="memory-scope memory-scope--project">project</span></span>
        <span className="mem-graph-scope-label"><span className="memory-scope memory-scope--global">global</span></span>
      </div>
      <div className="mem-graph-toolbar">
        <p className="mem-graph-help">Select a node to inspect it; drag to arrange. Positions stay put between refreshes.</p>
        <button type="button" className="mem-graph-reset" onClick={resetLayout}>reset layout</button>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="mem-graph-svg"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        {graphEdges.map((e, i) => {
          const a = pos.get(e.from);
          const b = pos.get(e.to);
          if (!a || !b) return null;
          const active = selected && (e.from === selected || e.to === selected);
          const mx = (a.x + b.x) / 2;
          const my = (a.y + b.y) / 2;
          return (
            <g key={i} className={`mem-edge${active ? ' mem-edge--active' : ''}`}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
              {active && (
                <text x={mx} y={my - 4} textAnchor="middle" className="mem-edge-label">
                  {e.rel}
                </text>
              )}
              <title>
                {nodesById.get(e.from)?.intent || e.from} —{e.rel}→ {nodesById.get(e.to)?.intent || e.to}:{' '}
                {REL_DESC[e.rel]}
              </title>
            </g>
          );
        })}
        {graphNodes.map((n) => {
          const p = pos.get(n.id);
          if (!p) return null;
          const active = selected === n.id || neighbors.set.has(n.id);
          return (
            <g
              key={n.id}
              className={`mem-node${active ? ' mem-node--active' : ''}`}
              role="button"
              tabIndex={0}
              aria-pressed={selected === n.id}
              aria-label={`${n.scope || 'project'} ${n.type}: ${n.intent || n.memoryId || n.id}`}
              onPointerDown={(ev) => onPointerDown(n.id, ev)}
              onKeyDown={(ev) => {
                if (ev.key === 'Enter' || ev.key === ' ') {
                  ev.preventDefault();
                  onSelect(selected === n.id ? null : n.id);
                }
              }}
            >
              <circle cx={p.x} cy={p.y} r={12} className={TYPE_CLASS(n.type)} />
              {active && (
                <>
                  <text x={p.x} y={p.y - 18} textAnchor="middle" className="mem-node-text">
                    {shortLabel(n.intent || n.type)}
                  </text>
                  <text x={p.x} y={p.y + 25} textAnchor="middle" className={`mem-node-scope-text memory-scope--${n.scope || 'project'}`}>
                    {n.scope || 'project'}
                  </text>
                </>
              )}
              <title>
                {n.scope || 'project'} {n.type}: {n.intent || n.memoryId || n.id} — click to inspect
              </title>
            </g>
          );
        })}
      </svg>

      {selected && (
        <div className="mem-detail">
          {(() => {
            const n = nodesById.get(selected);
            if (!n) return null;
            return (
              <>
                <button type="button" className="mem-detail-close" onClick={() => onSelect(null)}>
                  close
                </button>
                <h4 className="sub-title">
                  <span className={TYPE_CLASS(n.type)}>{n.type}</span> {n.intent}
                </h4>
                <div className="mem-detail-meta">
                 <span className={`memory-scope memory-scope--${n.scope || 'project'}`}>{n.scope || 'project'}</span>{' '}
                 {n.memoryId} · {fmtTs(n.ts)}
                  {n.tags?.length > 0 && <> · {n.tags.join(', ')}</>}
                </div>
                {n.summary && <p className="mem-detail-text">{n.summary}</p>}
                {n.decision && <p className="mem-detail-text">{n.decision}</p>}
                {n.rejectedAlternatives?.length > 0 && (
                  <p className="mem-detail-text">
                    <strong>rejected:</strong> {n.rejectedAlternatives.join(' · ')}
                  </p>
                )}
                {(() => {
                  const { older, newer } = buildLineage(selected, edges, nodesById);
                  if (older.length === 0 && newer.length === 0) return null;
                  const row = (node, tag) => (
                    <li key={node.id} className="mem-lineage-row">
                      <span className="mem-lineage-tag">{tag}</span>
                      <button
                        type="button"
                        className="mem-detail-neighbor"
                        onClick={() => onSelect(node.id)}
                      >
                        [{node.type}] {node.intent || node.id}
                      </button>
                    </li>
                  );
                  return (
                    <>
                      <h5 className="mem-detail-sub">decision lineage (supersedes diff)</h5>
                      <ul className="mem-detail-links">
                        {older.map((node) => row(node, 'replaced'))}
                        {row(n, 'this')}
                        {newer.map((node) => row(node, 'replaced by'))}
                      </ul>
                    </>
                  );
                })()}
                <h5 className="mem-detail-sub">why it&rsquo;s connected</h5>
                {neighbors.list.length === 0 && <p className="loading">no connections</p>}
                <ul className="mem-detail-links">
                  {neighbors.list.map(({ other, rel, dir }, i) => (
                    <li key={i}>
                      <span className="mem-edge-rel">
                        {dir === 'out' ? `↳ this ${REL_WHY[rel]} →` : `⬅ ${REL_WHY[rel]} ← this`}
                      </span>{' '}
                      <button
                        type="button"
                        className="mem-detail-neighbor"
                        onClick={() => onSelect(other.id)}
                      >
                        [{other.type}] {other.intent || other.id}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
