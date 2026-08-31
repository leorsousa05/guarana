// guarana memory — threshold check + supernode summarization. Zero deps.
// Compacts the oldest `atom` nodes into a `supernode`, preserving decision
// text verbatim. decision/bug/solution/refactor/supernode nodes are never
// compacted. Provenance is recorded in the supernode's `collapsedIds`.
import { listNodes, listEdges, addNode, newId } from "./graph.js";
import { paths, writeJsonl, loadConfig } from "./vault.js";

// Returns { compacted, supernodeId?, remaining }. Never throws.
export function compactVault(vaultDir, { threshold } = {}) {
  const cfg = loadConfig(vaultDir);
  const t = Number.isInteger(threshold) ? threshold : cfg.compactionThreshold;
  const keep = Math.max(0, t);

  const atoms = listNodes(vaultDir)
    .filter((n) => n.type === "atom")
    .sort((a, b) => a.ts - b.ts); // oldest first

  if (atoms.length <= keep) return { compacted: 0, remaining: atoms.length };

  const collapse = atoms.slice(0, atoms.length - keep);
  const collapsedIds = collapse.map((n) => n.id);

  const decisions = collapse.filter(
    (n) => typeof n.decision === "string" && n.decision.length > 0
  );

  const lines = [`supernode summarizing ${collapse.length} atom node(s)`];
  lines.push(`ts range: ${collapse[0].ts}..${collapse[collapse.length - 1].ts}`);
  if (decisions.length) {
    lines.push("decisions:");
    for (const d of decisions) lines.push(`- ${d.decision}`);
  }

  const supernode = {
    id: newId(),
    type: "supernode",
    status: "confirmed",
    ts: Date.now(),
    tags: [],
    summary: lines.join("\n"),
    collapsedIds,
  };
  addNode(vaultDir, supernode);

  const p = paths(vaultDir);
  const removed = new Set(collapsedIds);
  writeJsonl(p.nodes, listNodes(vaultDir).filter((n) => !removed.has(n.id)));
  writeJsonl(
    p.edges,
    listEdges(vaultDir).filter((e) => !removed.has(e.from) && !removed.has(e.to))
  );

  return { compacted: collapse.length, supernodeId: supernode.id, remaining: keep };
}