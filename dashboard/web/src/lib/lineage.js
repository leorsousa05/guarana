// Pure helper: build the `supersedes` lineage for a node in the memory graph.
// Free of React/JSX so it is unit-testable from the node test runner.
//
//   older = every node this one replaced, oldest -> newest (closest to selected)
//   newer = every node that replaced this one, oldest -> newest (selected is oldest)
//
// Walked transitively along `supersedes` edges: an edge A->B with rel
// "supersedes" means A replaced B, so A is newer than B.

export function buildLineage(selected, edges, nodesById) {
  if (!selected) return { older: [], newer: [] };
  const older = [];
  const seenOlder = new Set([selected]);
  let cur = selected;
  while (cur) {
    const next = edges
      .filter((e) => e.rel === 'supersedes' && e.from === cur)
      .map((e) => e.to)
      .filter((id) => !seenOlder.has(id));
    if (next.length === 0) break;
    const id = next[0];
    seenOlder.add(id);
    older.push(nodesById.get(id));
    cur = id;
  }
  // The walk starts at `selected` and descends toward the oldest ancestor, so
  // it collects newest-first; reverse so the oldest ancestor comes first.
  older.reverse();
  const newer = [];
  const seenNewer = new Set([selected]);
  cur = selected;
  while (cur) {
    const prev = edges
      .filter((e) => e.rel === 'supersedes' && e.to === cur)
      .map((e) => e.from)
      .filter((id) => !seenNewer.has(id));
    if (prev.length === 0) break;
    const id = prev[0];
    seenNewer.add(id);
    newer.push(nodesById.get(id));
    cur = id;
  }
  return { older, newer };
}