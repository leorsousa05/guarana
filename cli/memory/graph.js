// guarana memory — node/edge CRUD over JSONL with schema validation. Zero deps.
import fs from "node:fs";
import crypto from "node:crypto";
import { paths, readJsonl, writeJsonl } from "./vault.js";

export class MemoryValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "MemoryValidationError";
  }
}

export const NODE_TYPES = ["decision", "bug", "solution", "refactor", "atom", "supernode"];
export const NODE_STATUSES = ["draft", "confirmed"];
export const EDGE_RELS = ["caused-by", "depends-on", "supersedes", "summarizes"];

export const newId = () => `mem-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

const isStr = (v) => typeof v === "string" && v.length > 0;

export function validateNode(node) {
  if (!node || typeof node !== "object" || Array.isArray(node))
    throw new MemoryValidationError("node must be an object");
  if (!isStr(node.id)) throw new MemoryValidationError("node.id is required (string)");
  if (!NODE_TYPES.includes(node.type))
    throw new MemoryValidationError(`node.type must be one of ${NODE_TYPES.join("|")}`);
  if (!NODE_STATUSES.includes(node.status))
    throw new MemoryValidationError(`node.status must be one of ${NODE_STATUSES.join("|")}`);
  if (typeof node.ts !== "number" || !Number.isFinite(node.ts))
    throw new MemoryValidationError("node.ts is required (number)");
  if (node.tags !== undefined && (!Array.isArray(node.tags) || node.tags.some((t) => typeof t !== "string")))
    throw new MemoryValidationError("node.tags must be an array of strings");
  if (
    node.rejectedAlternatives !== undefined &&
    (!Array.isArray(node.rejectedAlternatives) || node.rejectedAlternatives.some((t) => typeof t !== "string"))
  )
    throw new MemoryValidationError("node.rejectedAlternatives must be an array of strings");
  if (
    node.collapsedIds !== undefined &&
    (!Array.isArray(node.collapsedIds) || node.collapsedIds.some((t) => typeof t !== "string"))
  )
    throw new MemoryValidationError("node.collapsedIds must be an array of strings");
  return node;
}

export function validateEdge(edge, nodeIds) {
  if (!edge || typeof edge !== "object" || Array.isArray(edge))
    throw new MemoryValidationError("edge must be an object");
  if (!isStr(edge.from) || !isStr(edge.to))
    throw new MemoryValidationError("edge.from and edge.to are required (strings)");
  if (!EDGE_RELS.includes(edge.rel))
    throw new MemoryValidationError(`edge.rel must be one of ${EDGE_RELS.join("|")}`);
  if (typeof edge.ts !== "number" || !Number.isFinite(edge.ts))
    throw new MemoryValidationError("edge.ts is required (number)");
  if (nodeIds) {
    if (!nodeIds.has(edge.from)) throw new MemoryValidationError(`edge.from unknown node: ${edge.from}`);
    if (!nodeIds.has(edge.to)) throw new MemoryValidationError(`edge.to unknown node: ${edge.to}`);
  }
  return edge;
}

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
  validateNode(node);
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
  validateNode(updated);
  nodes[idx] = updated;
  writeJsonl(p, nodes);
  return updated;
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
