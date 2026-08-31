// guarana memory — vault paths, lifecycle, export/import (ADR-010). Zero deps.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export const DEFAULT_CONFIG = {
  compactionThreshold: 1000,
  embeddingProvider: null,
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

export const userVaultDir = () =>
  path.join(os.homedir(), ".config", "guarana", "memory");

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
  fs.writeFileSync(file, rows.map((r) => JSON.stringify(r)).join("\n") + (rows.length ? "\n" : ""), "utf8");
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
export function initVault(projectDir) {
  const vaultDir = projectVaultDir(projectDir);
  const p = paths(vaultDir);
  fs.mkdirSync(p.drafts, { recursive: true });
  if (!fs.existsSync(p.nodes)) fs.writeFileSync(p.nodes, "", "utf8");
  if (!fs.existsSync(p.edges)) fs.writeFileSync(p.edges, "", "utf8");
  if (!fs.existsSync(p.config))
    fs.writeFileSync(p.config, JSON.stringify(DEFAULT_CONFIG, null, 2) + "\n", "utf8");
  ensureGitignore(projectDir);
  return vaultDir;
}

export function exportVault(vaultDir, outFile) {
  const p = paths(vaultDir);
  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    nodes: readJsonl(p.nodes),
    edges: readJsonl(p.edges),
  };
  fs.writeFileSync(outFile, JSON.stringify(data, null, 2) + "\n", "utf8");
  return data;
}

export function importVault(vaultDir, inFile) {
  const data = JSON.parse(fs.readFileSync(inFile, "utf8"));
  const p = paths(vaultDir);
  fs.mkdirSync(p.drafts, { recursive: true });
  writeJsonl(p.nodes, Array.isArray(data.nodes) ? data.nodes : []);
  writeJsonl(p.edges, Array.isArray(data.edges) ? data.edges : []);
  if (!fs.existsSync(p.config))
    fs.writeFileSync(p.config, JSON.stringify(DEFAULT_CONFIG, null, 2) + "\n", "utf8");
  return { nodes: data.nodes.length, edges: data.edges.length };
}
