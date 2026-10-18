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

  const nodeById = new Map(view.nodes.map((node) => [node.id, node]));
  const degree = new Map(view.nodes.map((node) => [node.id, 0]));
  for (const edge of view.edges) {
    degree.set(edge.from, (degree.get(edge.from) || 0) + 1);
    degree.set(edge.to, (degree.get(edge.to) || 0) + 1);
  }
  const neighborIds = new Set();
  for (const edge of view.edges) {
    if (edge.from === view.selected) neighborIds.add(edge.to);
    if (edge.to === view.selected) neighborIds.add(edge.from);
  }

  const positioned = new Map();
  let width;
  let height;
  const place = (node, x, y, focus = false, neighbor = false) => {
    const diameter = focus ? 62 : neighbor ? 54 : 44 + Math.min(degree.get(node.id) || 0, 4) * 2;
    positioned.set(node.id, { ...node, x, y, diameter, focus, neighbor });
  };

  if (mode === 'neighborhood') {
    width = 720;
    height = 440;
    const centerX = width / 2;
    const centerY = height / 2;
    const selectedNode = nodeById.get(view.selected);
    place(selectedNode, centerX, centerY, true);
    const neighborNodes = view.nodes.filter((node) => node.id !== view.selected).sort(stableNodeOrder);
    neighborNodes.forEach((node, index) => {
      const angle = -Math.PI / 2 + TAU * index / neighborNodes.length;
      place(node, centerX + Math.cos(angle) * 150, centerY + Math.sin(angle) * 150, false, true);
    });
  } else {
    const coreNeighbors = [...neighborIds].map((id) => nodeById.get(id)).filter(Boolean).sort(stableNodeOrder);
    const outerNodes = view.nodes
      .filter((node) => node.id !== view.selected && !neighborIds.has(node.id))
      .sort(stableNodeOrder);
    const remaining = new Map();
    for (const node of outerNodes) remaining.set(node.scope, (remaining.get(node.scope) || 0) + 1);
    const byScope = new Map();
    for (const node of outerNodes) {
      if (!byScope.has(node.scope)) byScope.set(node.scope, []);
      byScope.get(node.scope).push(node);
    }

    const ringPlans = [];
    let ring = 0;
    while ([...remaining.values()].some((count) => count > 0)) {
      const radius = 164 + ring * 70;
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
    width = Math.max(520, Math.ceil(2 * (outerRadius + 52)));
    height = width;
    const center = width / 2;
    place(nodeById.get(view.selected), center, center, true);
    coreNeighbors.forEach((node, index) => {
      const angle = -Math.PI / 2 + TAU * index / coreNeighbors.length;
      place(node, center + Math.cos(angle) * 82, center + Math.sin(angle) * 82, false, true);
    });

    for (const { radius, allocation, slotCount } of ringPlans) {
      let slot = 0;
      for (const [scope, count] of allocation) {
        for (let index = 0; index < count; index += 1) {
          const node = byScope.get(scope).shift();
          const angle = -Math.PI / 2 + TAU * (slot + 0.5) / slotCount;
          place(node, center + Math.cos(angle) * radius, center + Math.sin(angle) * radius, false, false);
          slot += 1;
        }
      }
    }
  }

  return {
    ...view,
    width,
    height,
    nodes: view.nodes.map((node) => positioned.get(node.id)),
  };
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
