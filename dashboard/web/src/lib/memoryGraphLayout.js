export const GRAPH_WIDTH = 760;
export const GRAPH_HEIGHT = 480;
export const GRAPH_POSITION_STORAGE_KEY = 'guarana-memory-graph-positions';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const compare = (a, b) => String(a).localeCompare(String(b));

export function readGraphPositions(storage, nodes) {
  try {
    const saved = JSON.parse(storage?.getItem(GRAPH_POSITION_STORAGE_KEY) || '{}');
    return new Map(nodes.flatMap((node) => {
      const point = saved[node.id];
      return point && Number.isFinite(point.x) && Number.isFinite(point.y) ? [[node.id, point]] : [];
    }));
  } catch {
    return new Map();
  }
}

export function saveGraphPositions(storage, positions) {
  try {
    storage?.setItem(GRAPH_POSITION_STORAGE_KEY, JSON.stringify(Object.fromEntries(positions)));
  } catch {
    // Storage is optional; the in-memory layout remains usable.
  }
}

export function graphSignature(nodes, edges) {
  const nodeIds = nodes.map((node) => node.id).sort(compare);
  const links = edges
    .map((edge) => [edge.from, edge.to, edge.rel])
    .sort((a, b) => compare(JSON.stringify(a), JSON.stringify(b)));
  return JSON.stringify([nodeIds, links]);
}

export function layoutGraph(nodes, edges, previous = new Map()) {
  if (previous.size > 0) {
    const positions = new Map();
    for (const node of nodes) {
      const existing = previous.get(node.id);
      if (existing && Number.isFinite(existing.x) && Number.isFinite(existing.y)) {
        positions.set(node.id, existing);
      }
    }

    const missing = nodes.filter((node) => !positions.has(node.id));
    const scopes = [...new Set(nodes.map((node) => node.scope || 'project'))].sort(compare);
    for (const [index, node] of missing.entries()) {
      const linked = edges
        .filter((edge) => edge.from === node.id || edge.to === node.id)
        .map((edge) => positions.get(edge.from === node.id ? edge.to : edge.from))
        .filter(Boolean);
      const scope = node.scope || 'project';
      const scopeX = scopes.length > 1
        ? (scope === 'global' ? GRAPH_WIDTH * 0.75 : GRAPH_WIDTH * 0.25)
        : GRAPH_WIDTH / 2;
      const anchor = linked.length
        ? linked.reduce((sum, point) => ({ x: sum.x + point.x / linked.length, y: sum.y + point.y / linked.length }), { x: 0, y: 0 })
        : { x: scopeX, y: GRAPH_HEIGHT / 2 };
      const angle = index * 2.399963229728653;
      const radius = 48 + Math.floor(index / 6) * 34;
      positions.set(node.id, {
        x: clamp(anchor.x + Math.cos(angle) * radius, 30, GRAPH_WIDTH - 30),
        y: clamp(anchor.y + Math.sin(angle) * radius, 30, GRAPH_HEIGHT - 30),
      });
    }
    return positions;
  }

  const groups = new Map();
  for (const node of nodes) {
    const scope = node.scope || 'project';
    const group = groups.get(scope) || [];
    group.push(node);
    groups.set(scope, group);
  }

  const scopes = [...groups.keys()].sort(compare);
  const positions = new Map();
  for (const scope of scopes) {
    const group = groups.get(scope).slice().sort((a, b) => compare(a.intent || a.id, b.intent || b.id) || compare(a.id, b.id));
    const groupWidth = scopes.length > 1 ? GRAPH_WIDTH * 0.34 : GRAPH_WIDTH * 0.76;
    const centerX = scopes.length > 1
      ? (scope === 'global' ? GRAPH_WIDTH * 0.75 : GRAPH_WIDTH * 0.25)
      : GRAPH_WIDTH / 2;
    const columns = Math.max(1, Math.ceil(Math.sqrt(group.length * groupWidth / (GRAPH_HEIGHT - 80))));
    const rows = Math.ceil(group.length / columns);

    group.forEach((node, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      positions.set(node.id, {
        x: centerX - groupWidth / 2 + ((column + 1) * groupWidth) / (columns + 1),
        y: 40 + ((row + 1) * (GRAPH_HEIGHT - 80)) / (rows + 1),
      });
    });
  }
  return positions;
}
