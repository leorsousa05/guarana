// guarana memory — vault paths, lifecycle, export/import (ADR-010). Zero deps.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { MemoryValidationError, validateEdge, validateNewNode } from "./schema.js";

export const DEFAULT_CONFIG = {
  compactionThreshold: 1000,
  embeddingProvider: null, // allowlisted ids only (see search.js EMBEDDING_PROVIDERS)
  maxNodes: 20000, // soft warning cap for `guarana memory status`; null disables
  // Retained for compatibility with vaults created before explicit-only memory.
  capture: { enabled: true },
};

export const paths = (vaultDir) => ({
  nodes: path.join(vaultDir, "nodes.jsonl"),
  edges: path.join(vaultDir, "edges.jsonl"),
  config: path.join(vaultDir, "config.json"),
  drafts: path.join(vaultDir, "drafts"),
});

export const projectVaultDir = (projectDir) =>
  path.join(projectDir, ".guarana", "memory");

export const userVaultDir = (home = os.homedir()) =>
  path.join(home, ".config", "guarana", "memory");

export function readJsonl(file) {
  try {
    return fs
      .readFileSync(file, "utf8")
      .split("\n")
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l));
  } catch {
    return [];
  }
}

export function writeJsonl(file, rows) {
  // Atomic replace: write to a temp file in the same directory, then rename
  // over the target. Protects against partial/torn writes (crash mid-write,
  // concurrent reader seeing a truncated buffer). rename() is atomic on a
  // single filesystem.
  const dir = path.dirname(file);
  const tmp = path.join(
    dir,
    `.${path.basename(file)}.${process.pid}.${Date.now()}.tmp`
  );
  const content =
    rows.map((r) => JSON.stringify(r)).join("\n") + (rows.length ? "\n" : "");
  fs.writeFileSync(tmp, content, "utf8");
  fs.renameSync(tmp, file);
}

function deepMerge(base, over) {
  const out = { ...base };
  for (const k of Object.keys(over || {})) {
    const b = base ? base[k] : undefined;
    const o = over[k];
    out[k] =
      b && o && typeof b === "object" && typeof o === "object" && !Array.isArray(b) && !Array.isArray(o)
        ? deepMerge(b, o)
        : o;
  }
  return out;
}

export function loadConfig(vaultDir) {
  let file = {};
  try {
    file = JSON.parse(fs.readFileSync(paths(vaultDir).config, "utf8"));
  } catch {
    /* defaults */
  }
  return deepMerge(DEFAULT_CONFIG, file);
}

function ensureGitignore(projectDir) {
  const entry = ".guarana/memory/";
  const gi = path.join(projectDir, ".gitignore");
  let content = fs.existsSync(gi) ? fs.readFileSync(gi, "utf8") : "";
  const has = content.split("\n").some((l) => l.trim() === entry);
  if (!has) {
    if (content && !content.endsWith("\n")) content += "\n";
    fs.writeFileSync(gi, content + entry + "\n", "utf8");
  }
}

// Create <project>/.guarana/memory/ idempotently + gitignore entry.
function initVaultFiles(vaultDir) {
  const p = paths(vaultDir);
  fs.mkdirSync(p.drafts, { recursive: true });
  if (!fs.existsSync(p.nodes)) fs.writeFileSync(p.nodes, "", "utf8");
  if (!fs.existsSync(p.edges)) fs.writeFileSync(p.edges, "", "utf8");
  if (!fs.existsSync(p.config))
    fs.writeFileSync(p.config, JSON.stringify(DEFAULT_CONFIG, null, 2) + "\n", "utf8");
  return vaultDir;
}

export function initVault(projectDir) {
  const vaultDir = initVaultFiles(projectVaultDir(projectDir));
  ensureGitignore(projectDir);
  return vaultDir;
}

// Create the private per-user vault without touching any project files.
export function initUserVault(home = os.homedir()) {
  return initVaultFiles(userVaultDir(home));
}

export function exportVault(vaultDir, outFile) {
  const p = paths(vaultDir);
  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    // CAVEAT (ADR-010): the vault stores memory at rest in PLAINTEXT JSONL.
    // Exports inherit that. No encryption or key material is applied here;
    // secrets are rejected/redacted at capture time (security.js), never stored.
    nodes: readJsonl(p.nodes),
    edges: readJsonl(p.edges),
  };
  fs.writeFileSync(outFile, JSON.stringify(data, null, 2) + "\n", "utf8");
  return data;
}

export function importVault(vaultDir, inFile) {
  const data = JSON.parse(fs.readFileSync(inFile, "utf8"));
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new MemoryValidationError("archive must be an object");
  if (data.version !== 1)
    throw new MemoryValidationError("archive.version must be 1");
  if (typeof data.exportedAt !== "string" || !Number.isFinite(Date.parse(data.exportedAt)))
    throw new MemoryValidationError("archive.exportedAt must be a valid date string");
  if (!Array.isArray(data.nodes))
    throw new MemoryValidationError("archive.nodes must be an array");
  if (!Array.isArray(data.edges))
    throw new MemoryValidationError("archive.edges must be an array");

  const nodeIds = new Set();
  for (const node of data.nodes) {
    if (node?.scope !== undefined && node.scope !== "project")
      throw new MemoryValidationError('project archive node.scope must be "project"');
    validateNewNode(node);
    if (nodeIds.has(node.id))
      throw new MemoryValidationError(`duplicate archive node.id: ${node.id}`);
    nodeIds.add(node.id);
  }
  for (const edge of data.edges) validateEdge(edge, nodeIds);

  // No target write occurs before the complete archive has passed validation.
  const p = paths(vaultDir);
  fs.mkdirSync(p.drafts, { recursive: true });
  writeJsonl(p.nodes, data.nodes);
  writeJsonl(p.edges, data.edges);
  if (!fs.existsSync(p.config))
    fs.writeFileSync(p.config, JSON.stringify(DEFAULT_CONFIG, null, 2) + "\n", "utf8");
  return { nodes: data.nodes.length, edges: data.edges.length };
}
