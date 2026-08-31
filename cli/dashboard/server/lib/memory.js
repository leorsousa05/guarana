import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The memory engine lives at repo-root memory/ in-repo, or at cli/memory/ in
// the bundle. From this lib file (dashboard/server/lib or cli/dashboard/server/lib)
// the same relative path ../../../memory covers both; extra candidates are a
// robustness fallback. Matches how cli/commands/memory.js and the plugin resolve.
function engineCandidates() {
  return [
    path.join(__dirname, '..', '..', '..', 'memory'),
    path.join(__dirname, '..', '..', 'memory'),
  ];
}

let enginePromise = null;
function engine() {
  if (!enginePromise) {
    enginePromise = (async () => {
      for (const dir of engineCandidates()) {
        if (fs.existsSync(path.join(dir, 'vault.js')) && fs.existsSync(path.join(dir, 'graph.js'))) {
          const [graph, search, tools] = await Promise.all([
            import(pathToFileURL(path.join(dir, 'graph.js')).href),
            import(pathToFileURL(path.join(dir, 'search.js')).href),
            import(pathToFileURL(path.join(dir, 'tools.js')).href),
          ]);
          return { graph, search, tools };
        }
      }
      throw new Error('memory engine not found');
    })();
  }
  return enginePromise;
}

// Neutral empty shape for a vault that does not exist (never a 500).
function vaultExists(vaultDir) {
  return fs.existsSync(path.join(vaultDir, 'nodes.jsonl'));
}

const errMsg = (err) => String(err && err.message ? err.message : err);

// Node/edge counts broken down by type and draft/confirmed status.
export async function summary(vaultDir) {
  try {
    const { graph } = await engine();
    if (!vaultExists(vaultDir)) {
      return { nodes: { total: 0, byType: {}, draft: 0, confirmed: 0 }, edges: 0, supernodes: 0 };
    }
    const nodes = graph.listNodes(vaultDir);
    const edges = graph.listEdges(vaultDir);
    const byType = {};
    for (const n of nodes) byType[n.type] = (byType[n.type] || 0) + 1;
    const draft = nodes.filter((n) => n.status === 'draft').length;
    return {
      nodes: { total: nodes.length, byType, draft, confirmed: nodes.length - draft },
      edges: edges.length,
      supernodes: byType.supernode || 0,
    };
  } catch (err) {
    return { error: errMsg(err) };
  }
}

// Confirmed-only search; draft isolation is enforced by the engine.
export async function search(vaultDir, opts = {}) {
  try {
    const { search: searchMod } = await engine();
    if (!vaultExists(vaultDir)) return { results: [], count: 0 };
    const results = await searchMod.searchVault(vaultDir, {
      query: opts.q || undefined,
      type: opts.type || undefined,
      limit: Number.isInteger(opts.limit) && opts.limit > 0 ? opts.limit : 20,
    });
    return { results, count: results.length };
  } catch (err) {
    return { error: errMsg(err) };
  }
}

// Bounded graph: latest `limit` confirmed nodes (newest first) + edges between them.
export async function graph(vaultDir, opts = {}) {
  try {
    const { graph: g } = await engine();
    if (!vaultExists(vaultDir)) return { nodes: [], edges: [] };
    const limit = Number.isInteger(opts.limit) && opts.limit > 0 ? opts.limit : 200;
    const confirmed = g
      .listNodes(vaultDir)
      .filter((n) => n.status === 'confirmed')
      .sort((a, b) => b.ts - a.ts)
      .slice(0, limit);
    const ids = new Set(confirmed.map((n) => n.id));
    const edges = g.listEdges(vaultDir).filter((e) => ids.has(e.from) && ids.has(e.to));
    return { nodes: confirmed, edges };
  } catch (err) {
    return { error: errMsg(err) };
  }
}

// Draft nodes only (never confirmed), most recent first.
export async function drafts(vaultDir) {
  try {
    const { graph } = await engine();
    if (!vaultExists(vaultDir)) return { drafts: [] };
    const list = graph
      .listNodes(vaultDir)
      .filter((n) => n.status === 'draft')
      .sort((a, b) => b.ts - a.ts)
      .map((n) => ({
        id: n.id,
        type: n.type,
        intent: n.intent || '',
        ts: n.ts,
        tags: n.tags || [],
      }));
    return { drafts: list };
  } catch (err) {
    return { error: errMsg(err) };
  }
}

// Confirm/discard a draft, delegating to the engine tool handler.
export async function review(vaultDir, opts = {}) {
  try {
    const { tools } = await engine();
    if (!vaultExists(vaultDir)) return { error: 'memory vault not initialized' };
    return await tools.memoryReviewDraft(vaultDir, opts);
  } catch (err) {
    return { error: errMsg(err) };
  }
}