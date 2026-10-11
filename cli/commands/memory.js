const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { MEMORY, renderDetailedHelp } = require('../command-metadata.js');
const { stdoutLine, stderrLine, writeStdout } = require('../lib/io.js');
const { parseMemoryArgs } = require('./memory-args.js');

// Engine lives at repo-root memory/ in-repo, or at cli/memory/ in the bundle.
function engineDir() {
  const inRepo = path.join(__dirname, '..', '..', 'memory');
  if (fs.existsSync(path.join(inRepo, 'vault.js'))) return inRepo;
  const bundled = path.join(__dirname, '..', 'memory');
  if (fs.existsSync(path.join(bundled, 'vault.js'))) return bundled;
  throw new Error('memory engine not found (looked in repo memory/ and bundled cli/memory/)');
}

let enginePromise = null;
async function engine() {
  if (!enginePromise) {
    const dir = engineDir();
    enginePromise = Promise.all([
      import(pathToFileURL(path.join(dir, 'vault.js')).href),
      import(pathToFileURL(path.join(dir, 'graph.js')).href),
      import(pathToFileURL(path.join(dir, 'search.js')).href),
      import(pathToFileURL(path.join(dir, 'tools.js')).href),
      import(pathToFileURL(path.join(dir, 'compact.js')).href),
    ]).then(([vault, graph, search, tools, compact]) => ({ vault, graph, search, tools, compact }));
  }
  return enginePromise;
}

const MEMORY_HELP = renderDetailedHelp(MEMORY);

function fail(msg) {
  throw new Error(msg);
}

function requireVault(vaultDir) {
  if (!fs.existsSync(path.join(vaultDir, 'nodes.jsonl'))) {
    fail(`memory vault not initialized at ${vaultDir} — run \`guarana memory init\` first`);
  }
}

async function searchMemory(parsed, vaultDir, searchVault, context = {}) {
  if (Array.isArray(parsed)) parsed = parseMemoryArgs(parsed);
  const results = await searchVault(vaultDir, parsed.options);
  if (!results.length) {
    stdoutLine(context, 'no confirmed matches');
    return;
  }
  for (const n of results) {
    stdoutLine(context, `[${n.type}] ${n.id} (${new Date(n.ts).toISOString()})${n.score ? ` score=${n.score.toFixed(3)}` : ''}`);
    if (n.summary) stdoutLine(context, `  ${n.summary}`);
  }
  stdoutLine(context, `${results.length} confirmed match(es)`);
}

async function run(args, context = {}) {
  const { vault, graph, search, tools, compact } = await engine();
  const vaultDir = vault.projectVaultDir(process.cwd());
  const parsed = parseMemoryArgs(args);

  switch (parsed.command) {
    case 'help':
      writeStdout(context, MEMORY_HELP);
      break;
    case 'init': {
      const existed = fs.existsSync(path.join(vaultDir, 'nodes.jsonl'));
      vault.initVault(process.cwd());
      stdoutLine(context, `${existed ? 'memory vault already initialized' : 'initialized memory vault'} at ${vaultDir}`);
      break;
    }
    case 'status': {
      requireVault(vaultDir);
      const nodes = graph.listNodes(vaultDir);
      const edges = graph.listEdges(vaultDir);
      const drafts = nodes.filter((n) => n.status === 'draft').length;
      const cfg = vault.loadConfig(vaultDir);
      stdoutLine(context, `vault: ${vaultDir}`);
      stdoutLine(context, `nodes: ${nodes.length} (${drafts} draft, ${nodes.length - drafts} confirmed)`);
      stdoutLine(context, `edges: ${edges.length}`);
      if (cfg.maxNodes != null && nodes.length > cfg.maxNodes) {
        stdoutLine(context, `WARNING: node count (${nodes.length}) exceeds maxNodes (${cfg.maxNodes}). Run \`guarana memory compact\` or \`guarana memory prune\`.`);
      }
      break;
    }
    case 'search': {
      requireVault(vaultDir);
      await searchMemory(parsed, vaultDir, search.searchVault, context);
      break;
    }
    case 'export': {
      requireVault(vaultDir);
      const { file } = parsed;
      const data = vault.exportVault(vaultDir, file);
      stdoutLine(context, `exported ${data.nodes.length} nodes, ${data.edges.length} edges -> ${file}`);
      break;
    }
    case 'import': {
      const { file } = parsed;
      if (!fs.existsSync(file)) fail(`file not found: ${file}`);
      vault.initVault(process.cwd());
      const { nodes, edges } = vault.importVault(vaultDir, file);
      stdoutLine(context, `imported ${nodes} nodes, ${edges} edges from ${file}`);
      break;
    }
    case 'compact': {
      requireVault(vaultDir);
      const r = compact.compactVault(vaultDir, parsed.options);
      if (r.removedSupernodes) {
        stdoutLine(context, `removed ${r.removedSupernodes} metadata-only legacy supernode(s)`);
      }
      if (r.compacted === 0) {
        stdoutLine(context, `nothing to compact (${r.remaining} atom node(s), below threshold)`);
      } else {
        stdoutLine(context, `compacted ${r.compacted} atom node(s) into supernode ${r.supernodeId}; ${r.remaining} atom node(s) remaining`);
      }
      break;
    }
    case 'prune': {
      requireVault(vaultDir);
      const { keep } = parsed;
      const p = vault.paths(vaultDir);
      const nodes = graph.listNodes(vaultDir);
      const draftAtoms = nodes
        .filter((n) => n.type === 'atom' && n.status === 'draft')
        .sort((a, b) => b.ts - a.ts); // newest first
      const removed = new Set(draftAtoms.slice(keep).map((n) => n.id));
      if (!removed.size) {
        stdoutLine(context, `nothing to prune (${draftAtoms.length} draft atom node(s), keep ${keep})`);
        break;
      }
      vault.writeJsonl(p.nodes, nodes.filter((n) => !removed.has(n.id)));
      vault.writeJsonl(p.edges, graph.listEdges(vaultDir).filter((e) => !removed.has(e.from) && !removed.has(e.to)));
      stdoutLine(context, `pruned ${removed.size} draft atom node(s), kept ${Math.min(keep, draftAtoms.length)}:`);
      for (const id of removed) stdoutLine(context, `  ${id}`);
      break;
    }
    case 'review': {
      requireVault(vaultDir);
      if (parsed.mode === 'list') {
        const drafts = graph.listNodes(vaultDir)
          .filter((n) => n.status === 'draft')
          .sort((a, b) => b.ts - a.ts); // most recent first
        if (!drafts.length) {
          stdoutLine(context, 'no draft nodes');
          break;
        }
        for (const n of drafts) {
          stdoutLine(context, `[${n.type}] ${n.id} (${new Date(n.ts).toISOString()})${n.intent ? `\n  ${n.intent}` : ''}`);
        }
        stdoutLine(context, `${drafts.length} draft node(s)`);
        break;
      }
      const { id, action, edits } = parsed;
      const opts = { id, action };
      if (edits) opts.edits = edits;
      let result;
      try {
        result = await tools.memoryReviewDraft(vaultDir, opts);
      } catch (err) {
        fail(err.message);
      }
      if (action === 'discard') {
        stdoutLine(context, `discarded draft node ${id}`);
      } else {
        stdoutLine(context, `confirmed draft node ${id} (${result.node.type})`);
      }
      break;
    }
    default:
      stderrLine(context, `unknown memory command: ${parsed.command}`);
      writeStdout(context, MEMORY_HELP);
      return 1;
  }
  return 0;
}

module.exports = { run, searchMemory };
