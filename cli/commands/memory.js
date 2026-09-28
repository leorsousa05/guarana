const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

// Engine lives at repo-root memory/ in-repo, or at cli/memory/ in the bundle.
function engineDir() {
  const inRepo = path.join(__dirname, '..', '..', 'memory');
  if (fs.existsSync(path.join(inRepo, 'vault.js'))) return inRepo;
  const bundled = path.join(__dirname, '..', 'memory');
  if (fs.existsSync(path.join(bundled, 'vault.js'))) return bundled;
  console.error('memory engine not found (looked in repo memory/ and bundled cli/memory/)');
  process.exit(1);
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

const MEMORY_HELP = `guarana memory — project-local memory vault (.guarana/memory/)

Usage:
  guarana memory init                    Create .guarana/memory/ (idempotent) + .gitignore entry
  guarana memory status                  Show node/edge counts and legacy draft vs confirmed breakdown
  guarana memory search [term] [flags]   Search confirmed nodes (drafts are never returned)
    --type <type>        Filter by node type (decision|bug|solution|refactor|atom|supernode)
    --project <hash>     Filter by project hash
    --since <date|ms>    Only nodes with ts >= value
    --until <date|ms>    Only nodes with ts <= value
    --limit <n>          Max results (default 20)
  guarana memory export <file>           Export the vault to a JSON file
  guarana memory import <file>           Import a vault JSON file (replaces nodes/edges)
  guarana memory compact [--threshold <n>]  Collapse oldest atom nodes into a supernode (lessons/decisions preserved)
    (default threshold from config.json compactionThreshold; atom nodes only — decisions/bugs/etc. never compacted)
  guarana memory prune --keep <n>        Drop oldest legacy DRAFT atom nodes beyond n
  guarana memory review --list           List legacy draft nodes (id, type, intent, ts), most recent first
  guarana memory review <id> --confirm   Migrate a legacy draft (optional edits: --intent "..." --tags a,b)
  guarana memory review <id> --discard   Remove a legacy draft node and its edges
  guarana memory --help                  Show this help
`;

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

function parseFlags(args, spec) {
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const key = spec[args[i]];
    if (key !== undefined) {
      const value = args[++i];
      if (value === undefined) fail(`missing value for ${args[i - 1]}`);
      out[key] = value;
    }
  }
  return out;
}

function parseTime(v, flag) {
  const n = Number(v);
  if (Number.isFinite(n)) return n;
  const d = Date.parse(v);
  if (Number.isNaN(d)) fail(`invalid ${flag} value: ${v}`);
  return d;
}

function requireVault(vaultDir) {
  if (!fs.existsSync(path.join(vaultDir, 'nodes.jsonl'))) {
    fail(`memory vault not initialized at ${vaultDir} — run \`guarana memory init\` first`);
  }
}

async function run(args) {
  const sub = args[0];
  const { vault, graph, search, tools, compact } = await engine();
  const vaultDir = vault.projectVaultDir(process.cwd());

  switch (sub) {
    case 'init': {
      const existed = fs.existsSync(path.join(vaultDir, 'nodes.jsonl'));
      vault.initVault(process.cwd());
      console.log(`${existed ? 'memory vault already initialized' : 'initialized memory vault'} at ${vaultDir}`);
      break;
    }
    case 'status': {
      requireVault(vaultDir);
      const nodes = graph.listNodes(vaultDir);
      const edges = graph.listEdges(vaultDir);
      const drafts = nodes.filter((n) => n.status === 'draft').length;
      const cfg = vault.loadConfig(vaultDir);
      console.log(`vault: ${vaultDir}`);
      console.log(`nodes: ${nodes.length} (${drafts} draft, ${nodes.length - drafts} confirmed)`);
      console.log(`edges: ${edges.length}`);
      if (cfg.maxNodes != null && nodes.length > cfg.maxNodes) {
        console.log(`WARNING: node count (${nodes.length}) exceeds maxNodes (${cfg.maxNodes}). Run \`guarana memory compact\` or \`guarana memory prune\`.`);
      }
      break;
    }
    case 'search': {
      requireVault(vaultDir);
      const term = args[1] && !args[1].startsWith('--') ? args[1] : undefined;
      const flags = parseFlags(args.slice(term ? 2 : 1), {
        '--type': 'type', '--project': 'project', '--since': 'since', '--until': 'until', '--limit': 'limit',
      });
      const opts = { query: term, type: flags.type, project: flags.project };
      if (flags.since !== undefined) opts.since = parseTime(flags.since, '--since');
      if (flags.until !== undefined) opts.until = parseTime(flags.until, '--until');
      if (flags.limit !== undefined) {
        opts.limit = Number(flags.limit);
        if (!Number.isInteger(opts.limit) || opts.limit < 1) fail(`invalid --limit value: ${flags.limit}`);
      }
      const results = await search.searchVault(vaultDir, opts);
      if (!results.length) {
        console.log('no confirmed matches');
        break;
      }
      for (const n of results) {
        console.log(`[${n.type}] ${n.id} (${new Date(n.ts).toISOString()})${n.score ? ` score=${n.score.toFixed(3)}` : ''}`);
        if (n.summary) console.log(`  ${n.summary}`);
      }
      console.log(`${results.length} confirmed match(es)`);
      break;
    }
    case 'export': {
      requireVault(vaultDir);
      const file = args[1];
      if (!file) fail('missing file: guarana memory export <file>');
      const data = vault.exportVault(vaultDir, file);
      console.log(`exported ${data.nodes.length} nodes, ${data.edges.length} edges -> ${file}`);
      break;
    }
    case 'import': {
      const file = args[1];
      if (!file) fail('missing file: guarana memory import <file>');
      if (!fs.existsSync(file)) fail(`file not found: ${file}`);
      vault.initVault(process.cwd());
      const { nodes, edges } = vault.importVault(vaultDir, file);
      console.log(`imported ${nodes} nodes, ${edges} edges from ${file}`);
      break;
    }
    case 'compact': {
      requireVault(vaultDir);
      const flags = parseFlags(args.slice(1), { '--threshold': 'threshold' });
      const opts = {};
      if (flags.threshold !== undefined) {
        const t = Number(flags.threshold);
        if (!Number.isInteger(t) || t < 0) fail(`invalid --threshold value: ${flags.threshold}`);
        opts.threshold = t;
      }
      const r = compact.compactVault(vaultDir, opts);
      if (r.removedSupernodes) {
        console.log(`removed ${r.removedSupernodes} metadata-only legacy supernode(s)`);
      }
      if (r.compacted === 0) {
        console.log(`nothing to compact (${r.remaining} atom node(s), below threshold)`);
      } else {
        console.log(`compacted ${r.compacted} atom node(s) into supernode ${r.supernodeId}; ${r.remaining} atom node(s) remaining`);
      }
      break;
    }
    case 'prune': {
      requireVault(vaultDir);
      const flags = parseFlags(args.slice(1), { '--keep': 'keep' });
      const keep = Number(flags.keep);
      if (!Number.isInteger(keep) || keep < 0) fail(`invalid --keep value: ${flags.keep}`);
      const p = vault.paths(vaultDir);
      const nodes = graph.listNodes(vaultDir);
      const draftAtoms = nodes
        .filter((n) => n.type === 'atom' && n.status === 'draft')
        .sort((a, b) => b.ts - a.ts); // newest first
      const removed = new Set(draftAtoms.slice(keep).map((n) => n.id));
      if (!removed.size) {
        console.log(`nothing to prune (${draftAtoms.length} draft atom node(s), keep ${keep})`);
        break;
      }
      vault.writeJsonl(p.nodes, nodes.filter((n) => !removed.has(n.id)));
      vault.writeJsonl(p.edges, graph.listEdges(vaultDir).filter((e) => !removed.has(e.from) && !removed.has(e.to)));
      console.log(`pruned ${removed.size} draft atom node(s), kept ${Math.min(keep, draftAtoms.length)}:`);
      for (const id of removed) console.log(`  ${id}`);
      break;
    }
    case 'review': {
      requireVault(vaultDir);
      if (args[1] === '--list') {
        const drafts = graph.listNodes(vaultDir)
          .filter((n) => n.status === 'draft')
          .sort((a, b) => b.ts - a.ts); // most recent first
        if (!drafts.length) {
          console.log('no draft nodes');
          break;
        }
        for (const n of drafts) {
          console.log(`[${n.type}] ${n.id} (${new Date(n.ts).toISOString()})${n.intent ? `\n  ${n.intent}` : ''}`);
        }
        console.log(`${drafts.length} draft node(s)`);
        break;
      }
      const id = args[1] && !args[1].startsWith('--') ? args[1] : undefined;
      if (!id) fail('missing node id: guarana memory review <id> --confirm|--discard (or --list)');
      const rest = args.slice(2);
      const action = rest.includes('--confirm') ? 'confirm' : rest.includes('--discard') ? 'discard' : undefined;
      if (!action) fail('specify --confirm or --discard');
      const flags = parseFlags(rest.filter((a) => a !== '--confirm' && a !== '--discard'), {
        '--intent': 'intent', '--tags': 'tags',
      });
      const opts = { id, action };
      if (action === 'confirm' && (flags.intent !== undefined || flags.tags !== undefined)) {
        opts.edits = {};
        if (flags.intent !== undefined) opts.edits.intent = flags.intent;
        if (flags.tags !== undefined) opts.edits.tags = flags.tags.split(',').map((t) => t.trim()).filter(Boolean);
      }
      let result;
      try {
        result = await tools.memoryReviewDraft(vaultDir, opts);
      } catch (err) {
        fail(err.message);
      }
      if (action === 'discard') {
        console.log(`discarded draft node ${id}`);
      } else {
        console.log(`confirmed draft node ${id} (${result.node.type})`);
      }
      break;
    }
    case '--help':
    case '-h':
    case undefined:
      process.stdout.write(MEMORY_HELP);
      break;
    default:
      console.error(`unknown memory command: ${sub}`);
      process.stdout.write(MEMORY_HELP);
      process.exit(1);
  }
}

module.exports = { run };
