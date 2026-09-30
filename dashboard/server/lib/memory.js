import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readJsonl } from './telemetry.js';

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
          const [graph, search, tools, vault] = await Promise.all([
            import(pathToFileURL(path.join(dir, 'graph.js')).href),
            import(pathToFileURL(path.join(dir, 'search.js')).href),
            import(pathToFileURL(path.join(dir, 'tools.js')).href),
            import(pathToFileURL(path.join(dir, 'vault.js')).href),
          ]);
          return { graph, search, tools, vault };
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
const isMetadataOnlySupernode = (node) =>
  node.type === 'supernode' &&
  typeof node.summary === 'string' &&
  /^supernode summarizing \d+ atom node\(s\)\s+ts range: \d+\.\.\d+$/.test(node.summary.trim());

// Node/edge counts broken down by type and draft/confirmed status.
export async function summary(vaultDir) {
  try {
    const { graph, vault } = await engine();
    const projectNodes = (vaultExists(vaultDir) ? graph.listNodes(vaultDir) : [])
      .filter((n) => !isMetadataOnlySupernode(n));
    const globalVaultDir = vault.userVaultDir();
    const globalNodes = graph.listNodes(globalVaultDir).filter((n) => !isMetadataOnlySupernode(n));
    const nodes = [...projectNodes, ...globalNodes];
    const projectIds = new Set(projectNodes.map((n) => n.id));
    const globalIds = new Set(globalNodes.map((n) => n.id));
    const edges = [
      ...(vaultExists(vaultDir) ? graph.listEdges(vaultDir).filter((e) => projectIds.has(e.from) && projectIds.has(e.to)) : []),
      ...graph.listEdges(globalVaultDir).filter((e) => globalIds.has(e.from) && globalIds.has(e.to)),
    ];
    const byType = {};
    for (const n of nodes) byType[n.type] = (byType[n.type] || 0) + 1;
    const draft = nodes.filter((n) => n.status === 'draft').length;
    return {
      nodes: {
        total: nodes.length,
        byType,
        byScope: { project: projectNodes.length, global: globalNodes.length },
        draft,
        confirmed: nodes.length - draft,
      },
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
    const limit = Number.isInteger(opts.limit) && opts.limit > 0 ? opts.limit : 20;
    const results = (await searchMod.searchVault(vaultDir, {
      query: opts.q || undefined,
      type: opts.type || undefined,
      limit: limit * 4,
    })).filter((n) => !isMetadataOnlySupernode(n)).slice(0, limit);
    return { results, count: results.length };
  } catch (err) {
    return { error: errMsg(err) };
  }
}

// Bounded graph: latest `limit` confirmed nodes (newest first) + edges between them.
export async function graph(vaultDir, opts = {}) {
  try {
    const { graph: g, vault } = await engine();
    const limit = Number.isInteger(opts.limit) && opts.limit > 0 ? opts.limit : 200;
    const projectNodes = (vaultExists(vaultDir) ? g.listNodes(vaultDir) : [])
      .filter((n) => n.status === 'confirmed' && !isMetadataOnlySupernode(n))
      .map((node) => ({ ...node, scope: 'project' }));
    const globalVaultDir = vault.userVaultDir();
    const globalNodes = g.listNodes(globalVaultDir)
      .filter((n) => n.status === 'confirmed' && !isMetadataOnlySupernode(n))
      .map((node) => ({ ...node, scope: 'global' }));
    const confirmed = [...projectNodes, ...globalNodes]
      .sort((a, b) => b.ts - a.ts)
      .slice(0, limit);
    const projectIds = new Set(confirmed.filter((n) => n.scope === 'project').map((n) => n.id));
    const globalIds = new Set(confirmed.filter((n) => n.scope === 'global').map((n) => n.id));
    const edges = [
      ...(vaultExists(vaultDir)
        ? g.listEdges(vaultDir)
          .filter((e) => projectIds.has(e.from) && projectIds.has(e.to))
          .map((edge) => ({ ...edge, scope: 'project' }))
        : []),
      ...g.listEdges(globalVaultDir)
        .filter((e) => globalIds.has(e.from) && globalIds.has(e.to))
        .map((edge) => ({ ...edge, scope: 'global' })),
    ];
    return { nodes: confirmed, edges };
  } catch (err) {
    return { error: errMsg(err) };
  }
}

// Recent context-injection events keep only node references in telemetry;
// hydrate their content from the project and private user vaults on read.
export async function injections(vaultDir, telemetryFile, opts = {}) {
  try {
    const { graph: g, vault } = await engine();
    const limit = Number.isInteger(opts.limit) && opts.limit > 0
      ? Math.min(opts.limit, 100)
      : 40;
    const injectionEvents = [];
    const lastBySession = new Map();
    for (const event of readJsonl(telemetryFile)) {
      const sessionID = event.sessionID || 'unknown';
      if (event.type === 'session' && ['created', 'compacted'].includes(event.status)) {
        lastBySession.delete(sessionID);
        continue;
      }
      if (event.type !== 'memory-injected' || !Array.isArray(event.memories)) continue;
      const memories = [...new Map(event.memories
        .filter((ref) => ref && typeof ref.id === 'string')
        .map((ref) => [`${ref.scope || 'project'}:${ref.id}`, ref])).values()];
      const signature = memories.map((ref) => `${ref.scope || 'project'}:${ref.id}`).sort().join('|');
      const previous = lastBySession.get(sessionID);
      const withinOneTurn = previous && Math.abs((event.ts ?? 0) - (previous.event.ts ?? 0)) <= 1000;
      const sameReasonBoundary = previous && (event.reason === 'compacted') === (previous.event.reason === 'compacted');
      if (withinOneTurn && sameReasonBoundary) {
        const merged = new Map(previous.event.memories.map((ref) => [`${ref.scope || 'project'}:${ref.id}`, ref]));
        for (const ref of memories) {
          const key = `${ref.scope || 'project'}:${ref.id}`;
          if (!merged.has(key)) merged.set(key, ref);
        }
        previous.event.memories = [...merged.values()];
        previous.signature = previous.event.memories
          .map((ref) => `${ref.scope || 'project'}:${ref.id}`)
          .sort()
          .join('|');
        continue;
      }
      if (signature && signature === previous?.signature && event.reason !== 'compacted') continue;
      const normalized = { ...event, memories };
      const entry = { event: normalized, signature };
      injectionEvents.push(normalized);
      lastBySession.set(sessionID, entry);
    }
    const events = injectionEvents
      .sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0))
      .slice(0, limit);
    if (!events.length) return { injections: [] };

    const projectNodes = new Map(g.listNodes(vaultDir).filter((node) => node.status === 'confirmed').map((node) => [node.id, node]));
    const userVaultDir = vault.userVaultDir();
    const globalNodes = new Map(g.listNodes(userVaultDir).filter((node) => node.status === 'confirmed').map((node) => [node.id, node]));
    const projectEdges = g.listEdges(vaultDir).map((edge) => ({ ...edge, scope: 'project' }));
    const globalEdges = g.listEdges(userVaultDir).map((edge) => ({ ...edge, scope: 'global' }));

    return {
      injections: events.map((event, index) => {
        const memories = event.memories
          .filter((ref) => ref && typeof ref.id === 'string' && ['project', 'global'].includes(ref.scope))
          .map((ref) => {
            const scope = ref.scope;
            const node = (scope === 'global' ? globalNodes : projectNodes).get(ref.id);
            return {
              id: ref.id,
              type: node?.type || ref.type || 'unknown',
              scope,
              available: Boolean(node),
              intent: node?.intent || '',
              summary: node?.summary || '',
              tags: node?.tags || [],
            };
          });
        const ids = new Set(memories.map((node) => `${node.scope}:${node.id}`));
        const edges = [...projectEdges, ...globalEdges]
          .filter((edge) => ids.has(`${edge.scope}:${edge.from}`) && ids.has(`${edge.scope}:${edge.to}`))
          .map(({ from, to, rel, scope }) => ({ from, to, rel, scope }));
        return {
          id: `${event.ts ?? 0}:${event.sessionID || 'unknown'}:${index}`,
          ts: event.ts ?? null,
          sessionID: event.sessionID || 'unknown',
          workflowState: event.workflowState || null,
          reason: event.reason || null,
          memories,
          edges,
        };
      }),
    };
  } catch (err) {
    return { injections: [], error: errMsg(err) };
  }
}

// Legacy draft nodes only (never confirmed), most recent first.
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
