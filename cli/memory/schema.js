// Shared memory record validators. Kept separate from graph/vault storage so
// archive imports can reuse the canonical write schema without a module cycle.
import { hasSensitiveAssignment, isSensitive } from "./security.js";

export class MemoryValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "MemoryValidationError";
  }
}

export const NODE_TYPES = ["decision", "bug", "solution", "refactor", "preference", "atom", "supernode"];
export const NODE_STATUSES = ["draft", "confirmed"];
export const EDGE_RELS = ["caused-by", "depends-on", "supersedes", "summarizes", "fixes", "relates-to"];
export const PROJECT_NODE_TYPES = ["decision", "bug", "solution", "refactor", "preference"];
export const PREFERENCE_CATEGORIES = ["agent_behavior", "workflow", "communication"];

const isStr = (v) => typeof v === "string" && v.length > 0;
const SENSITIVE_TEXT_KEY = /^(?:api[_-]?key|secret|password|passwd|token|credential)$/i;
const ENV_TEXT_KEY = /^[A-Z][A-Z0-9_]*$/;

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
  if (node.priority !== undefined) {
    if (node.type !== "preference" || node.scope !== "global")
      throw new MemoryValidationError("node.priority is only valid for global preference nodes");
    if (node.priority !== "essential" && node.priority !== "normal")
      throw new MemoryValidationError('node.priority must be "essential" or "normal"');
  }
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

export function validateNewTags(tags) {
  if (
    Array.isArray(tags) &&
    (isSensitive(tags.join("\n")) || tags.some(hasSensitiveAssignment))
  )
    throw new MemoryValidationError("node.tags contains sensitive content");
}

function collectText(value, texts, seen = new WeakSet()) {
  if (typeof value === "string") {
    texts.push(value);
    return;
  }
  if (!value || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    for (const item of value) collectText(item, texts, seen);
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    texts.push(key);
    if (SENSITIVE_TEXT_KEY.test(key) || ENV_TEXT_KEY.test(key)) {
      const serialized = child && typeof child === "object" ? JSON.stringify(child) : String(child);
      texts.push(`${key}=${serialized}`);
    }
    collectText(child, texts, seen);
  }
}

function validateNewText(node) {
  const texts = [];
  collectText(node, texts);
  const combined = texts.join("\n");
  if (isSensitive(combined) || hasSensitiveAssignment(combined)) {
    throw new MemoryValidationError("node contains sensitive content");
  }
}

// New writes have a deliberately narrower domain than the legacy read schema.
// In particular, old project preferences/atoms/supernodes remain loadable but
// cannot be inserted through the ordinary graph write API.
export function validateNewNode(node) {
  validateNode(node);
  validateNewTags(node.tags);
  validateNewText(node);
  const scope = node.scope === undefined ? "project" : node.scope;
  if (scope !== "project" && scope !== "global")
    throw new MemoryValidationError('scope must be "project" or "global"');

  if (scope === "project") {
    if (!PROJECT_NODE_TYPES.includes(node.type))
      throw new MemoryValidationError(`project node.type must be one of ${PROJECT_NODE_TYPES.join("|")}`);
    if (node.type === "preference") {
      if (node.scope !== "project")
        throw new MemoryValidationError('project preference scope must be "project"');
      if (!PREFERENCE_CATEGORIES.includes(node.category))
        throw new MemoryValidationError(`project preference category must be one of ${PREFERENCE_CATEGORIES.join("|")}`);
    } else if (node.category !== undefined) {
      throw new MemoryValidationError("category is only valid for preference nodes");
    }
    return node;
  }

  if (node.type !== "preference")
    throw new MemoryValidationError('global scope only allows type "preference"');
  if (!PREFERENCE_CATEGORIES.includes(node.category))
    throw new MemoryValidationError(`global preference category must be one of ${PREFERENCE_CATEGORIES.join("|")}`);
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
