import { useEffect, useMemo, useRef, useState } from 'react';
import { fmtTs } from '../lib/format.js';
import { buildLineage } from '../lib/lineage.js';

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

const W = 760;
const H = 480;
const LG = 150; // rest length for edge springs

function layout(nodes, edges) {
  const pos = new Map();
  const n = nodes.length;
  nodes.forEach((nd, i) => {
    const a = (i / Math.max(n, 1)) * Math.PI * 2;
    const r = Math.min(W, H) / 3;
    pos.set(nd.id, { x: W / 2 + Math.cos(a) * r, y: H / 2 + Math.sin(a) * r });
  });
  // cheap force relaxation
  for (let k = 0; k < 60; k++) {
    const fr = new Map(nodes.map((nd) => [nd.id, { x: 0, y: 0 }]));
    // repulsion
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = pos.get(nodes[i].id);
        const b = pos.get(nodes[j].id);
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d2 = Math.max(dx * dx + dy * dy, 1);
        const f = 2400 / d2;
        fr.get(nodes[i].id).x += (dx / Math.sqrt(d2)) * f;
        fr.get(nodes[i].id).y += (dy / Math.sqrt(d2)) * f;
        fr.get(nodes[j].id).x -= (dx / Math.sqrt(d2)) * f;
        fr.get(nodes[j].id).y -= (dy / Math.sqrt(d2)) * f;
      }
    }
    // springs
    for (const e of edges) {
      const a = pos.get(e.from);
      const b = pos.get(e.to);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const f = (d - LG) * 0.06;
      const ux = dx / d;
      const uy = dy / d;
      a.x += ux * f;
      a.y += uy * f;
      b.x -= ux * f;
      b.y -= uy * f;
    }
    // centering
    for (const p of pos.values()) {
      p.x += (W / 2 - p.x) * 0.02;
      p.y += (H / 2 - p.y) * 0.02;
    }
  }
  return pos;
}

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
  const [pos, setPos] = useState(() => layout(graphNodes, graphEdges));
  const [drag, setDrag] = useState(null);
  const nodesById = useMemo(() => new Map(graphNodes.map((n) => [n.id, n])), [graphNodes]);

  useEffect(() => {
    setPos(layout(graphNodes, graphEdges));
  }, [graphNodes, graphEdges]);

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
    const rect = svg.getBoundingClientRect();
    const ctm = svg.getScreenCTM();
    const toSvg = (x, y) => {
      pt.x = x;
      pt.y = y;
      return pt.matrixTransform(ctm);
    };
    const start = pos.get(id);
    const m = toSvg(ev.clientX, ev.clientY);
    setDrag({ id, dx: start.x - m.x, dy: start.y - m.y });
  };

  const onPointerMove = (ev) => {
    if (!drag || !svgRef.current) return;
    const pt = svgRef.current.createSVGPoint();
    pt.x = ev.clientX;
    pt.y = ev.clientY;
    const m = pt.matrixTransform(svgRef.current.getScreenCTM());
    setPos((prev) => {
      const next = new Map(prev);
      next.set(drag.id, { x: m.x + drag.dx, y: m.y + drag.dy });
      return next;
    });
  };

  const endDrag = () => setDrag(null);

  const onPointerUp = (id, ev) => {
    // click (no meaningful drag) = select
    if (drag && drag.id === id) {
      onSelect(selected === id ? null : id);
    }
    endDrag();
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
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="mem-graph-svg"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
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
              <text x={mx} y={my - 4} textAnchor="middle" className="mem-edge-label">
                {e.rel}
              </text>
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
              onPointerDown={(ev) => onPointerDown(n.id, ev)}
              onPointerUp={(ev) => onPointerUp(n.id, ev)}
            >
              <circle cx={p.x} cy={p.y} r={12} className={TYPE_CLASS(n.type)} />
              <text x={p.x} y={p.y - 16} textAnchor="middle" className="mem-node-text">
                {n.type}
              </text>
              <text x={p.x} y={p.y + 24} textAnchor="middle" className={`mem-node-scope-text memory-scope--${n.scope || 'project'}`}>
                {n.scope || 'project'}
              </text>
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
