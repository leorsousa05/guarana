// guarana memory — node/edge CRUD over JSONL with schema validation. Zero deps.
import fs from "node:fs";
import crypto from "node:crypto";
import { paths, readJsonl, writeJsonl } from "./vault.js";
import {
  EDGE_RELS,
  MemoryValidationError,
  PROJECT_NODE_TYPES,
  validateEdge,
  validateNewNode,
  validateNewTags,
  validateNode,
} from "./schema.js";

export {
  EDGE_RELS,
  MemoryValidationError,
  NODE_STATUSES,
  NODE_TYPES,
  PREFERENCE_CATEGORIES,
  PROJECT_NODE_TYPES,
  validateEdge,
  validateNewNode,
  validateNode,
} from "./schema.js";

export const newId = () => `mem-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

export function listNodes(vaultDir) {
  return readJsonl(paths(vaultDir).nodes);
}

export function listEdges(vaultDir) {
  return readJsonl(paths(vaultDir).edges);
}

export function getNode(vaultDir, id) {
  return listNodes(vaultDir).find((n) => n.id === id) || null;
}

// Strict insert: node must be fully formed (use createNode for defaults).
export function addNode(vaultDir, node) {
  validateNewNode(node);
  fs.appendFileSync(paths(vaultDir).nodes, JSON.stringify(node) + "\n", "utf8");
  return node;
}

// Convenience builder: fills id/ts defaults, tags default [].
export function createNode(vaultDir, fields) {
  const node = { id: newId(), ts: Date.now(), tags: [], ...fields };
  return addNode(vaultDir, node);
}

export function updateNode(vaultDir, id, patch) {
  const p = paths(vaultDir).nodes;
  const nodes = readJsonl(p);
  const idx = nodes.findIndex((n) => n.id === id);
  if (idx === -1) throw new MemoryValidationError(`node not found: ${id}`);
  const updated = { ...nodes[idx], ...patch, id: nodes[idx].id };
  for (const field of ["type", "scope", "category"]) {
    if (updated[field] !== nodes[idx][field])
      throw new MemoryValidationError(`node.${field} is immutable after creation`);
  }
  if (updated.status !== nodes[idx].status)
    throw new MemoryValidationError("node.status changes require explicit draft review conversion");
  validateNode(updated);
  if (patch && Object.hasOwn(patch, "tags")) validateNewTags(updated.tags);
  nodes[idx] = updated;
  writeJsonl(p, nodes);
  return updated;
}

// The only draft-confirmation path requires an explicit conversion target.
// It preserves node identity (and therefore existing edges) while producing a
// valid project record under the current write matrix.
export function confirmDraft(vaultDir, id, targetType, patch = {}) {
  if (!PROJECT_NODE_TYPES.includes(targetType))
    throw new MemoryValidationError(`project type must be one of ${PROJECT_NODE_TYPES.join("|")}`);
  const p = paths(vaultDir).nodes;
  const nodes = readJsonl(p);
  const idx = nodes.findIndex((node) => node.id === id);
  if (idx === -1) throw new MemoryValidationError(`node not found: ${id}`);
  const original = nodes[idx];
  if (original.status !== "draft")
    throw new MemoryValidationError(`node is not a draft: ${id}`);
  if (original.scope !== undefined && original.scope !== "project")
    throw new MemoryValidationError(`draft scope is not project: ${id}`);

  const converted = {
    ...original,
    ...patch,
    id: original.id,
    type: targetType,
    status: "confirmed",
    scope: "project",
  };
  delete converted.category;
  delete converted.priority;
  validateNewNode(converted);
  nodes[idx] = converted;
  writeJsonl(p, nodes);
  return converted;
}

export function addEdge(vaultDir, edge) {
  const nodeIds = new Set(listNodes(vaultDir).map((n) => n.id));
  validateEdge(edge, nodeIds);
  fs.appendFileSync(paths(vaultDir).edges, JSON.stringify(edge) + "\n", "utf8");
  return edge;
}

export function createEdge(vaultDir, fields) {
  return addEdge(vaultDir, { ts: Date.now(), ...fields });
}

// Remove one edge selected by its complete identity, not every edge incident
// to either endpoint. Returns the removed edge, or null when it is absent.
export function removeEdge(vaultDir, edge) {
  validateEdge(edge);
  const p = paths(vaultDir).edges;
  const edges = readJsonl(p);
  const idx = edges.findIndex(
    (candidate) =>
      candidate.from === edge.from &&
      candidate.to === edge.to &&
      candidate.rel === edge.rel &&
      candidate.ts === edge.ts
  );
  if (idx === -1) return null;
  const [removed] = edges.splice(idx, 1);
  writeJsonl(p, edges);
  return removed;
}

// Remove a node and all edges touching it. Returns true if the node existed.
export function removeNode(vaultDir, id) {
  const p = paths(vaultDir);
  const nodes = readJsonl(p.nodes);
  const kept = nodes.filter((n) => n.id !== id);
  if (kept.length === nodes.length) return false;
  writeJsonl(p.nodes, kept);
  writeJsonl(
    p.edges,
    readJsonl(p.edges).filter((e) => e.from !== id && e.to !== id)
  );
  return true;
}
