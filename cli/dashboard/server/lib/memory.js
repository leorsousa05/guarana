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
          const [graph, search, tools, vault, security] = await Promise.all([
            import(pathToFileURL(path.join(dir, 'graph.js')).href),
            import(pathToFileURL(path.join(dir, 'search.js')).href),
            import(pathToFileURL(path.join(dir, 'tools.js')).href),
            import(pathToFileURL(path.join(dir, 'vault.js')).href),
            import(pathToFileURL(path.join(dir, 'security.js')).href),
          ]);
          return { graph, search, tools, vault, security };
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
const preferenceCategories = new Set(['agent_behavior', 'workflow', 'communication']);
const preferenceCategory = (node) =>
  preferenceCategories.has(node.category) ? node.category : 'general';
const isPreferencePriority = (priority) => priority === 'essential' || priority === 'normal';

// Node/edge counts broken down by type and draft/confirmed status.
export async function summary(vaultDir, opts = {}) {
  try {
    const { graph, vault } = await engine();
    const scope = opts.scope;
    const projectNodes = scope === 'global' ? [] : (vaultExists(vaultDir) ? graph.listNodes(vaultDir) : [])
      .filter((n) => !isMetadataOnlySupernode(n));
    const globalVaultDir = scope === 'project' ? null : vault.userVaultDir();
    const globalNodes = globalVaultDir
      ? graph.listNodes(globalVaultDir).filter((n) => scope === 'global'
        ? n.status === 'confirmed' && n.type === 'preference' && n.scope === 'global'
        : !isMetadataOnlySupernode(n))
      : [];
    const nodes = [...projectNodes, ...globalNodes];
    const projectIds = new Set(projectNodes.map((n) => n.id));
    const globalIds = new Set(globalNodes.map((n) => n.id));
    const edges = [
      ...(scope !== 'global' && vaultExists(vaultDir)
        ? graph.listEdges(vaultDir).filter((e) => projectIds.has(e.from) && projectIds.has(e.to))
        : []),
      ...(globalVaultDir ? graph.listEdges(globalVaultDir).filter((e) => globalIds.has(e.from) && globalIds.has(e.to)) : []),
    ];
    const byType = {};
    for (const n of nodes) byType[n.type] = (byType[n.type] || 0) + 1;
    const draft = nodes.filter((n) => n.status === 'draft').length;
    const byScope = scope === 'project'
      ? { project: projectNodes.length }
      : scope === 'global'
        ? { global: globalNodes.length }
        : { project: projectNodes.length, global: globalNodes.length };
    return {
      nodes: {
        total: nodes.length,
        byType,
        byScope,
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

// Complete read-only library of confirmed global preferences. This is
// deliberately independent of the bounded automatic-injection selector.
export async function preferences(opts = {}) {
  try {
    const { graph, vault, security } = await engine();
    const globalVaultDir = vault.userVaultDir();
    const nodes = graph.listNodes(globalVaultDir)
      .filter((node) => node.status === 'confirmed' && node.type === 'preference' && node.scope === 'global');
    const superseded = new Set(graph.listEdges(globalVaultDir)
      .filter((edge) => edge.rel === 'supersedes')
      .map((edge) => edge.to));
    const query = typeof opts.q === 'string' ? opts.q.trim().toLowerCase() : '';

    const result = nodes.map((node) => {
      const tags = security.filterSensitiveTags(node.tags);
      const status = superseded.has(node.id) ? 'superseded' : 'active';
      return {
        id: node.id,
        type: node.type,
        scope: 'global',
        category: preferenceCategory(node),
        intent: typeof node.intent === 'string' ? node.intent : '',
        summary: typeof node.summary === 'string' ? node.summary : '',
        tags,
        ts: node.ts ?? null,
        ...(isPreferencePriority(node.priority) ? { priority: node.priority } : {}),
        status,
      };
    })
      .filter((node) => opts.category === undefined || node.category === opts.category)
      .filter((node) => opts.status === undefined || opts.status === 'all' || node.status === opts.status)
      .filter((node) => !query || [node.intent, node.summary, ...node.tags]
        .some((value) => value.toLowerCase().includes(query)))
      .sort((a, b) => (Number(b.ts) || 0) - (Number(a.ts) || 0) || String(a.id).localeCompare(String(b.id)));
    return { preferences: result, count: result.length };
  } catch (err) {
    return { error: errMsg(err) };
  }
}

// Confirmed-only search; draft isolation is enforced by the engine.
export async function search(vaultDir, opts = {}) {
  try {
    const { search: searchMod, security } = await engine();
    if (!vaultExists(vaultDir)) return { results: [], count: 0 };
    const limit = Number.isInteger(opts.limit) && opts.limit > 0 ? opts.limit : 20;
    const results = (await searchMod.searchVault(vaultDir, {
      query: opts.q || undefined,
      type: opts.type || undefined,
      limit: limit * 4,
    }))
      .filter((n) => !isMetadataOnlySupernode(n))
      .slice(0, limit)
      .map((node) => ({ ...node, tags: security.filterSensitiveTags(node.tags) }));
    return { results, count: results.length };
  } catch (err) {
    return { error: errMsg(err) };
  }
}

// Bounded graph: latest `limit` confirmed nodes (newest first) + edges between them.
export async function graph(vaultDir, opts = {}) {
  try {
    const { graph: g, vault, security } = await engine();
    const scope = opts.scope;
    const limit = Number.isInteger(opts.limit) && opts.limit > 0 ? opts.limit : 200;
    const projectNodes = scope === 'global' ? [] : (vaultExists(vaultDir) ? g.listNodes(vaultDir) : [])
      .filter((n) => n.status === 'confirmed' && !isMetadataOnlySupernode(n))
      .map((node) => ({ ...node, scope: 'project', tags: security.filterSensitiveTags(node.tags) }));
    const globalVaultDir = scope === 'project' ? null : vault.userVaultDir();
    const globalNodes = globalVaultDir
      ? g.listNodes(globalVaultDir)
        .filter((n) => n.status === 'confirmed' && !isMetadataOnlySupernode(n)
          && (scope !== 'global' || (n.type === 'preference' && n.scope === 'global')))
        .map((node) => ({ ...node, scope: 'global', tags: security.filterSensitiveTags(node.tags) }))
      : [];
    const confirmed = [...projectNodes, ...globalNodes]
      .sort((a, b) => b.ts - a.ts)
      .slice(0, limit);
    const projectIds = new Set(confirmed.filter((n) => n.scope === 'project').map((n) => n.id));
    const globalIds = new Set(confirmed.filter((n) => n.scope === 'global').map((n) => n.id));
    const edges = [
      ...(scope !== 'global' && vaultExists(vaultDir)
        ? g.listEdges(vaultDir)
          .filter((e) => projectIds.has(e.from) && projectIds.has(e.to))
          .map((edge) => ({ ...edge, scope: 'project' }))
        : []),
      ...(globalVaultDir ? g.listEdges(globalVaultDir)
        .filter((e) => globalIds.has(e.from) && globalIds.has(e.to))
        .map((edge) => ({ ...edge, scope: 'global' })) : []),
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
    const { graph: g, vault, security } = await engine();
    const scope = opts.scope;
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
    if (!injectionEvents.length) return { injections: [] };

    const projectNodes = scope === 'global' ? new Map() : new Map(
      g.listNodes(vaultDir).filter((node) => node.status === 'confirmed').map((node) => [node.id, node])
    );
    const userVaultDir = scope === 'project' ? null : vault.userVaultDir();
    const globalNodes = userVaultDir ? new Map(g.listNodes(userVaultDir)
      .filter((node) => node.status === 'confirmed'
        && (scope !== 'global' || (node.type === 'preference' && node.scope === 'global')))
      .map((node) => [node.id, node])) : new Map();
    const projectEdges = scope === 'global' ? [] : g.listEdges(vaultDir).map((edge) => ({ ...edge, scope: 'project' }));
    const globalEdges = userVaultDir
      ? g.listEdges(userVaultDir).map((edge) => ({ ...edge, scope: 'global' }))
      : [];
    const projectedEvents = scope === undefined ? injectionEvents : injectionEvents
      .map((event) => ({
        ...event,
        memories: event.memories
          .filter((ref) => {
            const refScope = ref.scope || 'project';
            if (scope === 'project') return refScope === 'project';
            return refScope === 'global' && globalNodes.get(ref.id)?.type === 'preference';
          })
          .map((ref) => scope === 'project' && !ref.scope ? { ...ref, scope: 'project' } : ref),
      }))
      .filter((event) => event.memories.length > 0);
    const events = projectedEvents
      .sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0))
      .slice(0, limit);
    if (!events.length) return { injections: [] };

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
              tags: security.filterSensitiveTags(node?.tags),
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
    const { graph, security } = await engine();
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
        tags: security.filterSensitiveTags(n.tags),
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

const relationshipError = (error, statusCode = 400) => ({ error, statusCode });

// Relationship edits always operate on the supplied project vault only. In
// particular, endpoint lookup never consults the private user vault.
export async function createRelationship(vaultDir, opts = {}) {
  try {
    const { graph: g } = await engine();
    if (opts.scope !== undefined && opts.scope !== 'project') {
      return relationshipError('scope must be project', 400);
    }
    const candidate = { from: opts.from, to: opts.to, rel: opts.rel, ts: Date.now() };
    try {
      g.validateEdge(candidate);
    } catch (err) {
      return relationshipError(errMsg(err), 400);
    }
    if (candidate.from === candidate.to) {
      return relationshipError('relationship endpoints must be different', 400);
    }
    if (!vaultExists(vaultDir)) return relationshipError('project memory vault not initialized', 404);

    const nodes = g.listNodes(vaultDir);
    for (const endpoint of ['from', 'to']) {
      const node = nodes.find((entry) => entry.id === candidate[endpoint]);
      if (!node) return relationshipError(`${endpoint} must reference an existing project memory node`, 404);
      if (node.status !== 'confirmed') {
        return relationshipError(`${endpoint} must reference a confirmed project memory node`, 400);
      }
    }
    if (g.listEdges(vaultDir).some(
      (edge) => edge.from === candidate.from && edge.to === candidate.to && edge.rel === candidate.rel
    )) {
      return relationshipError('relationship already exists', 409);
    }

    return { edge: g.createEdge(vaultDir, { from: candidate.from, to: candidate.to, rel: candidate.rel }) };
  } catch (err) {
    return relationshipError(errMsg(err), 500);
  }
}

export async function deleteRelationship(vaultDir, opts = {}) {
  try {
    const { graph: g } = await engine();
    if (opts.scope !== undefined && opts.scope !== 'project') {
      return relationshipError('scope must be project', 400);
    }
    const edge = { from: opts.from, to: opts.to, rel: opts.rel, ts: opts.ts };
    try {
      g.validateEdge(edge);
    } catch (err) {
      return relationshipError(errMsg(err), 400);
    }
    if (!vaultExists(vaultDir)) return relationshipError('project memory vault not initialized', 404);
    const removed = g.removeEdge(vaultDir, edge);
    return removed ? { edge: removed } : relationshipError('relationship not found', 404);
  } catch (err) {
    return relationshipError(errMsg(err), 500);
  }
}
