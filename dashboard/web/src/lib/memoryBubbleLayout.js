const ORDERED_SCOPES = ['project', 'global'];
const TAU = Math.PI * 2;

export function qualifyMemoryGraph(nodes, edges) {
  const qualifiedNodes = nodes.map((node) => ({
    ...node,
    scope: node.scope || 'project',
    memoryId: node.id,
    id: `${node.scope || 'project'}:${node.id}`,
  }));
  const qualifiedEdges = edges.map((edge) => ({
    ...edge,
    scope: edge.scope || 'project',
    memoryFrom: edge.from,
    memoryTo: edge.to,
    from: `${edge.scope || 'project'}:${edge.from}`,
    to: `${edge.scope || 'project'}:${edge.to}`,
  }));
  return { nodes: qualifiedNodes, edges: qualifiedEdges };
}

function scopeOrder(scope) {
  const index = ORDERED_SCOPES.indexOf(scope);
  return index < 0 ? ORDERED_SCOPES.length : index;
}

const stableNodeOrder = (a, b) =>
  scopeOrder(a.scope) - scopeOrder(b.scope) || a.scope.localeCompare(b.scope) || a.id.localeCompare(b.id);

function allocateRingSlots(capacity, remaining) {
  const scopes = [...remaining.keys()].sort((a, b) => scopeOrder(a) - scopeOrder(b) || a.localeCompare(b));
  const total = scopes.reduce((sum, scope) => sum + remaining.get(scope), 0);
  const slots = Math.min(capacity, total);
  const allocated = new Map(scopes.map((scope) => [scope, 0]));
  const quotas = new Map(scopes.map((scope) => [scope, slots * remaining.get(scope) / total]));
  for (const scope of scopes) allocated.set(scope, Math.min(remaining.get(scope), Math.floor(quotas.get(scope))));
  let unallocated = slots - [...allocated.values()].reduce((sum, value) => sum + value, 0);
  while (unallocated > 0) {
    const scope = scopes
      .filter((candidate) => allocated.get(candidate) < remaining.get(candidate))
      .sort((a, b) => (quotas.get(b) - allocated.get(b)) - (quotas.get(a) - allocated.get(a)))[0];
    if (!scope) break;
    allocated.set(scope, allocated.get(scope) + 1);
    unallocated -= 1;
  }
  return allocated;
}

export function buildMemoryBubbleView(nodes, edges, selectedId, mode = 'network') {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const matchingEdges = edges.filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to));
  const selected = nodeIds.has(selectedId) ? selectedId : nodes[0]?.id ?? null;
  if (mode !== 'neighborhood' || selected == null) return { nodes, edges: matchingEdges, selected };

  const neighbors = new Set([selected]);
  const neighborhoodEdges = matchingEdges.filter((edge) => {
    if (edge.from !== selected && edge.to !== selected) return false;
    neighbors.add(edge.from);
    neighbors.add(edge.to);
    return true;
  });
  return {
    nodes: nodes.filter((node) => neighbors.has(node.id)),
    edges: neighborhoodEdges,
    selected,
  };
}

export function layoutMemoryBubbles(nodes, edges, selectedId, mode = 'network') {
  const view = buildMemoryBubbleView(nodes, edges, selectedId, mode);
  if (!view.nodes.length) return { ...view, width: 0, height: 0, nodes: [], edges: [] };

  // Place the full filtered graph from a stable anchor. Neighborhood mode only
  // changes which positioned nodes and edges are returned, never their centers.
  const nodeIds = new Set(nodes.map((node) => node.id));
  const graphEdges = edges.filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to));
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const degree = new Map(nodes.map((node) => [node.id, 0]));
  for (const edge of graphEdges) {
    degree.set(edge.from, (degree.get(edge.from) || 0) + 1);
    degree.set(edge.to, (degree.get(edge.to) || 0) + 1);
  }
  const selectedNeighborIds = new Set();
  for (const edge of view.edges) {
    if (edge.from === view.selected) selectedNeighborIds.add(edge.to);
    if (edge.to === view.selected) selectedNeighborIds.add(edge.from);
  }

  const positioned = new Map();
  const place = (node, x, y) => {
    positioned.set(node.id, { x, y });
  };

  const anchor = [...nodes].sort(stableNodeOrder)[0];
  const coreNeighborIds = new Set();
  for (const edge of graphEdges) {
    if (edge.from === anchor.id) coreNeighborIds.add(edge.to);
    if (edge.to === anchor.id) coreNeighborIds.add(edge.from);
  }
  const coreNeighbors = [...coreNeighborIds].map((id) => nodeById.get(id)).sort(stableNodeOrder);
  const coreNeighborSet = new Set(coreNeighborIds);
  const outerNodes = nodes
    .filter((node) => node.id !== anchor.id && !coreNeighborSet.has(node.id))
    .sort(stableNodeOrder);
  const remaining = new Map();
  for (const node of outerNodes) remaining.set(node.scope, (remaining.get(node.scope) || 0) + 1);
  const byScope = new Map();
  for (const node of outerNodes) {
    if (!byScope.has(node.scope)) byScope.set(node.scope, []);
    byScope.get(node.scope).push(node);
  }

  const coreRadius = coreNeighbors.length > 1
    ? Math.max(82, 62 / (2 * Math.sin(Math.PI / coreNeighbors.length)))
    : 82;
  const ringPlans = [];
  let ring = 0;
  while ([...remaining.values()].some((count) => count > 0)) {
    const radius = Math.max(164, coreRadius + 72) + ring * 70;
    const capacity = Math.max(1, Math.floor(TAU * radius / 68));
    const allocation = allocateRingSlots(capacity, remaining);
    const slotCount = [...allocation.values()].reduce((sum, count) => sum + count, 0);
    ringPlans.push({ radius, allocation, slotCount });
    for (const [scope, count] of allocation) {
      remaining.set(scope, remaining.get(scope) - count);
    }
    ring += 1;
  }
  const outerRadius = ringPlans.at(-1)?.radius || 0;
  const extent = Math.max(outerRadius, coreRadius, 0);
  const width = Math.max(520, Math.ceil(2 * (extent + 52)));
  const height = width;
  const center = width / 2;
  place(anchor, center, center);
  coreNeighbors.forEach((node, index) => {
    const angle = -Math.PI / 2 + TAU * index / coreNeighbors.length;
    place(node, center + Math.cos(angle) * coreRadius, center + Math.sin(angle) * coreRadius);
  });

  for (const { radius, allocation, slotCount } of ringPlans) {
    let slot = 0;
    for (const [scope, count] of allocation) {
      for (let index = 0; index < count; index += 1) {
        const node = byScope.get(scope).shift();
        const angle = -Math.PI / 2 + TAU * (slot + 0.5) / slotCount;
        place(node, center + Math.cos(angle) * radius, center + Math.sin(angle) * radius);
        slot += 1;
      }
    }
  }

  return {
    ...view,
    width,
    height,
    nodes: view.nodes.map((node) => {
      const point = positioned.get(node.id);
      const focus = node.id === view.selected;
      const neighbor = selectedNeighborIds.has(node.id) && !focus;
      const diameter = focus ? 62 : neighbor ? 54 : 44 + Math.min(degree.get(node.id) || 0, 4) * 2;
      return { ...node, ...point, diameter, focus, neighbor };
    }),
  };
}

const MIN_CAMERA_SCALE = 0.01;
const MAX_CAMERA_SCALE = 4;

function safeScale(scale) {
  return Math.min(MAX_CAMERA_SCALE, Math.max(MIN_CAMERA_SCALE, Number.isFinite(scale) ? scale : 1));
}

export function clampMemoryCamera(camera, layout, viewport, padding = 28) {
  const scale = safeScale(camera.scale);
  const width = Math.max(0, viewport.width || 0);
  const height = Math.max(0, viewport.height || 0);
  const mapWidth = Math.max(0, layout.width || 0) * scale;
  const mapHeight = Math.max(0, layout.height || 0) * scale;
  const inset = Math.min(padding, Math.max(0, (Math.min(width, height) - 2) / 2));
  const x = mapWidth <= width
    ? (width - mapWidth) / 2
    : Math.min(inset, Math.max(width - mapWidth + inset, Number.isFinite(camera.x) ? camera.x : 0));
  const y = mapHeight <= height
    ? (height - mapHeight) / 2
    : Math.min(inset, Math.max(height - mapHeight + inset, Number.isFinite(camera.y) ? camera.y : 0));
  return { scale, x, y };
}

export function fitMemoryCamera(layout, viewport, padding = 28) {
  const width = Math.max(0, layout.width || 0);
  const height = Math.max(0, layout.height || 0);
  if (!width || !height || !viewport.width || !viewport.height) return { scale: 1, x: 0, y: 0 };
  const availableWidth = Math.max(1, viewport.width - padding * 2);
  const availableHeight = Math.max(1, viewport.height - padding * 2);
  const scale = safeScale(Math.min(availableWidth / width, availableHeight / height));
  return clampMemoryCamera({
    scale,
    x: (viewport.width - width * scale) / 2,
    y: (viewport.height - height * scale) / 2,
  }, layout, viewport, padding);
}

export function focusMemoryCamera(camera, node, layout, viewport, padding = 28) {
  if (!node || !viewport.width || !viewport.height) return clampMemoryCamera(camera, layout, viewport, padding);
  const scale = safeScale(camera.scale);
  return clampMemoryCamera({
    scale,
    x: viewport.width / 2 - node.x * scale,
    y: viewport.height / 2 - node.y * scale,
  }, layout, viewport, padding);
}

export function zoomMemoryCamera(camera, factor, layout, viewport, anchor = { x: viewport.width / 2, y: viewport.height / 2 }, padding = 28) {
  const scale = safeScale(camera.scale * factor);
  const worldX = (anchor.x - camera.x) / camera.scale;
  const worldY = (anchor.y - camera.y) / camera.scale;
  return clampMemoryCamera({
    scale,
    x: anchor.x - worldX * scale,
    y: anchor.y - worldY * scale,
  }, layout, viewport, padding);
}

export function panMemoryCamera(camera, deltaX, deltaY, layout, viewport, padding = 28) {
  return clampMemoryCamera({
    ...camera,
    x: camera.x + deltaX,
    y: camera.y + deltaY,
  }, layout, viewport, padding);
}

export function handleMemoryBubbleKeyDown(event, nodes, currentId, onSelect, focusNode) {
  if (['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(event.key)) {
    if (!nodes.length) return;
    event.preventDefault();
    const current = Math.max(0, nodes.findIndex((node) => node.id === currentId));
    const direction = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1;
    focusNode(nodes[(current + direction + nodes.length) % nodes.length].id);
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    onSelect(currentId);
  }
}
