// guarana memory — tool-call event → draft atom, with security filters. Zero deps.
import crypto from "node:crypto";
import path from "node:path";
import { addNode, newId } from "./graph.js";
import { isSensitive, sanitize } from "./security.js";

export function projectHashFor(projectDir) {
  return crypto.createHash("sha1").update(path.resolve(projectDir)).digest("hex").slice(0, 12);
}

function projectDirFromVault(vaultDir) {
  const abs = path.resolve(vaultDir);
  if (path.basename(abs) === "memory" && path.basename(path.dirname(abs)) === ".guarana")
    return path.dirname(path.dirname(abs));
  return abs;
}

const TEXT_FIELDS = ["intent", "input", "output", "decision"];

// Returns { captured: true, node } or { captured: false, reason }.
export function captureAtom(vaultDir, eventData = {}) {
  const text = TEXT_FIELDS.map((f) => eventData[f])
    .concat(eventData.summary ? [eventData.summary] : [])
    .filter((v) => typeof v === "string")
    .join("\n");
  if (isSensitive(text)) return { captured: false, reason: "sensitive-content" };

  const node = {
    id: newId(),
    type: "atom",
    status: "draft",
    ts: Date.now(),
    tags: Array.isArray(eventData.tags) ? eventData.tags.map(String) : [],
    projectHash: eventData.projectHash || projectHashFor(projectDirFromVault(vaultDir)),
  };
  for (const f of TEXT_FIELDS)
    if (typeof eventData[f] === "string") node[f] = sanitize(eventData[f]);
  if (typeof eventData.summary === "string") node.summary = sanitize(eventData.summary);
  if (eventData.author != null) node.author = String(eventData.author);
  addNode(vaultDir, node);
  return { captured: true, node };
}
