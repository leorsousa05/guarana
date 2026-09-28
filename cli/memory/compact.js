// guarana memory — threshold check + supernode summarization. Zero deps.
// Compacts the oldest `atom` nodes into a `supernode`, preserving decision
// text verbatim. decision/bug/solution/refactor/supernode nodes are never
// compacted. Provenance is recorded in the supernode's `collapsedIds`.
import { listNodes, listEdges, addNode, newId } from "./graph.js";
import { paths, writeJsonl, loadConfig } from "./vault.js";

const PLACEHOLDER_SUMMARY =
  /^supernode summarizing \d+ atom node\(s\)\s+ts range: \d+\.\.\d+$/;

const hasUsefulContent = (node) =>
  [node.intent, node.summary, node.decision].some(
    (value) => typeof value === "string" && value.trim() && !PLACEHOLDER_SUMMARY.test(value.trim())
  );

// Returns { compacted, supernodeId?, remaining }. Never throws.
export function compactVault(vaultDir, { threshold } = {}) {
  const p = paths(vaultDir);
  const initialNodes = listNodes(vaultDir);
  const junkIds = new Set(
    initialNodes
      .filter((n) => n.type === "supernode" && typeof n.summary === "string" && PLACEHOLDER_SUMMARY.test(n.summary.trim()))
      .map((n) => n.id)
  );
  if (junkIds.size) {
    writeJsonl(p.nodes, initialNodes.filter((n) => !junkIds.has(n.id)));
    writeJsonl(p.edges, listEdges(vaultDir).filter((e) => !junkIds.has(e.from) && !junkIds.has(e.to)));
  }

  const cfg = loadConfig(vaultDir);
  const t = Number.isInteger(threshold) ? threshold : cfg.compactionThreshold;
  const keep = Math.max(0, t);

  const atoms = listNodes(vaultDir)
    .filter((n) =>
      n.type === "atom" &&
      n.status === "confirmed" &&
      hasUsefulContent(n)
    )
    .sort((a, b) => a.ts - b.ts); // oldest first

  if (atoms.length <= keep) return { compacted: 0, remaining: atoms.length, removedSupernodes: junkIds.size };

  const collapse = atoms.slice(0, atoms.length - keep);
  const collapsedIds = collapse.map((n) => n.id);

  const lines = [];
  for (const atom of collapse) {
    const content = [atom.intent, atom.summary, atom.decision]
      .filter((value) => typeof value === "string" && value.trim())
      .map((value) => value.trim());
    lines.push(`- ${content.join(" — ")}`);
  }

  const supernode = {
    id: newId(),
    type: "supernode",
    status: "confirmed",
    ts: Date.now(),
    tags: [...new Set(collapse.flatMap((n) => Array.isArray(n.tags) ? n.tags : []))],
    summary: lines.join("\n"),
    collapsedIds,
  };
  addNode(vaultDir, supernode);

  const removed = new Set(collapsedIds);
  writeJsonl(p.nodes, listNodes(vaultDir).filter((n) => !removed.has(n.id)));
  writeJsonl(
    p.edges,
    listEdges(vaultDir).filter((e) => !removed.has(e.from) && !removed.has(e.to))
  );

  return { compacted: collapse.length, supernodeId: supernode.id, remaining: keep, removedSupernodes: junkIds.size };
}
