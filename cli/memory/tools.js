// guarana memory — the 4 OpenCode custom-tool handlers (ADR-008).
// Plain async functions delegating to the engine; the plugin is a thin
// wrapper. Zero deps. Handlers throw typed errors (MemoryValidationError);
// the plugin boundary converts them to { error } results, never rethrows.
import { searchVault } from "./search.js";
import {
  MemoryValidationError,
  createNode,
  getNode,
  listEdges,
  removeNode,
  updateNode,
} from "./graph.js";
import { isSensitive, sanitize } from "./security.js";
import { projectHashFor } from "./capture.js";
import path from "node:path";

const CTX_RELS = ["caused-by", "depends-on", "supersedes"];
const DEFAULT_CTX_LIMIT = 10;

const requireStr = (v, name) => {
  if (typeof v !== "string" || !v.trim())
    throw new MemoryValidationError(`${name} is required (non-empty string)`);
  return v;
};

const strArray = (v, name) => {
  if (v == null) return [];
  if (!Array.isArray(v) || v.some((x) => typeof x !== "string"))
    throw new MemoryValidationError(`${name} must be an array of strings`);
  return v;
};

// memory_search: confirmed-only is enforced by searchVault.
export async function memorySearch(vaultDir, opts = {}) {
  const hits = await searchVault(vaultDir, {
    query: opts.query,
    type: opts.type,
    since: opts.since,
    until: opts.until,
    limit: opts.limit,
  });
  const results = hits.map((n) => ({
    id: n.id,
    type: n.type,
    intent: n.intent || "",
    summary: n.summary || "",
    tags: n.tags || [],
    ts: n.ts,
    score: n.score,
  }));
  return { results, count: results.length };
}

// memory_save_decision: writes a confirmed decision node; free text sanitized.
export async function memorySaveDecision(vaultDir, opts = {}) {
  const intent = requireStr(opts.intent, "intent");
  const decision = requireStr(opts.decision, "decision");
  const rejected = strArray(opts.rejectedAlternatives, "rejectedAlternatives");
  const tags = strArray(opts.tags, "tags");
  const all = [intent, decision, ...rejected].join("\n");
  if (isSensitive(all))
    throw new MemoryValidationError("decision text contains sensitive content");
  return createNode(vaultDir, {
    type: "decision",
    status: "confirmed",
    intent: sanitize(intent),
    summary: sanitize(decision),
    rejectedAlternatives: rejected.map(sanitize),
    tags: tags.map(String),
    author: typeof opts.author === "string" && opts.author ? opts.author : "agent",
    projectHash: projectHashFor(path.resolve(vaultDir, "..", "..")),
  });
}

// memory_get_context_for_task: semantic search + 1-hop graph expansion,
// confirmed-only, total nodes capped at `limit`.
export async function memoryGetContextForTask(vaultDir, opts = {}) {
  const task = requireStr(opts.task, "task");
  const limit =
    Number.isInteger(opts.limit) && opts.limit > 0 ? opts.limit : DEFAULT_CTX_LIMIT;
  const hits = await searchVault(vaultDir, { query: task, limit });
  const edges = listEdges(vaultDir);
  const picked = new Map(); // id -> { node, viaSupersedes }
  const add = (node, viaSupersedes) => {
    if (picked.size >= limit || picked.has(node.id)) return;
    picked.set(node.id, { node, viaSupersedes });
  };
  for (const h of hits) {
    add(h, false);
    const hopIds = new Set();
    for (const e of edges) {
      if (!CTX_RELS.includes(e.rel)) continue;
      if (e.from === h.id) hopIds.add(e.to);
      if (e.to === h.id) hopIds.add(e.from);
    }
    for (const id of hopIds) {
      const n = getNode(vaultDir, id);
      if (!n || n.status !== "confirmed") continue; // drafts never returned
      const viaSupersedes = edges.some(
        (e) => e.rel === "supersedes" && e.to === n.id && e.from === h.id
      );
      add(n, viaSupersedes);
    }
  }
  const out = { decisions: [], bugs: [], superseded: [], atoms: [] };
  const brief = (n) => ({
    id: n.id,
    type: n.type,
    intent: n.intent || "",
    summary: n.summary || "",
    tags: n.tags || [],
    ts: n.ts,
    rejectedAlternatives: n.rejectedAlternatives || [],
  });
  for (const { node, viaSupersedes } of picked.values()) {
    if (viaSupersedes) out.superseded.push(brief(node));
    else if (node.type === "decision") out.decisions.push(brief(node));
    else if (node.type === "bug") out.bugs.push(brief(node));
    else out.atoms.push(brief(node));
  }
  out.count =
    out.decisions.length + out.bugs.length + out.superseded.length + out.atoms.length;
  return out;
}

// memory_review_draft: confirm (flip status, optional edits) or discard
// (remove node + edges). Non-draft or unknown id -> typed error.
export async function memoryReviewDraft(vaultDir, opts = {}) {
  const id = requireStr(opts.id, "id");
  const action = opts.action;
  if (action !== "confirm" && action !== "discard")
    throw new MemoryValidationError('action must be "confirm" or "discard"');
  const node = getNode(vaultDir, id);
  if (!node) throw new MemoryValidationError(`unknown node id: ${id}`);
  if (node.status !== "draft")
    throw new MemoryValidationError(`node is not a draft: ${id}`);
  if (action === "discard") {
    removeNode(vaultDir, id);
    return { id, action: "discard", removed: true };
  }
  const patch = { status: "confirmed" };
  const edits = opts.edits && typeof opts.edits === "object" ? opts.edits : {};
  for (const f of ["intent", "summary", "decision", "input", "output"]) {
    if (typeof edits[f] === "string") {
      if (isSensitive(edits[f]))
        throw new MemoryValidationError(`edit field ${f} contains sensitive content`);
      patch[f] = sanitize(edits[f]);
    }
  }
  if (edits.tags !== undefined) patch.tags = strArray(edits.tags, "edits.tags").map(String);
  updateNode(vaultDir, id, patch); // re-validates through graph.js
  return { id, action: "confirm", node: getNode(vaultDir, id) };
}
