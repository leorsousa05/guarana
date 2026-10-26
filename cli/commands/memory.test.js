// CLI command tests for `guarana memory …`. Faithful end-to-end: spawn the
// real bin/guarana.js against a temp project cwd, then assert on exit code and
// stdout. Uses the in-repo engine via the CLI's own engineDir() resolution.
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { searchMemory } = require('./memory.js');

const BIN = path.join(__dirname, '..', '..', 'bin', 'guarana.js');
const MEMORY_COMMAND = path.join(__dirname, 'memory.js');

function runResult(args, cwd, env = {}) {
  return spawnSync(process.execPath, [BIN, 'memory', ...args], {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      HOME: path.join(tmp, 'home'),
      XDG_CONFIG_HOME: path.join(tmp, 'xdg-config'),
      ...env,
    },
  });
}

function run(args, cwd, env) {
  const res = runResult(args, cwd, env);
  assert.equal(res.status, 0, `exit != 0 for: memory ${args.join(' ')}\nstdout: ${res.stdout}\nstderr: ${res.stderr}`);
  return res.stdout;
}

function listNodes(cwd) {
  const file = path.join(cwd, '.guarana', 'memory', 'nodes.jsonl');
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

function writeNode(cwd, node) {
  fs.appendFileSync(
    path.join(cwd, '.guarana', 'memory', 'nodes.jsonl'),
    JSON.stringify(node) + '\n',
    'utf8'
  );
}

let tmp;
function cwd() {
  return path.join(tmp, 'proj');
}

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-cli-mem-'));
  fs.mkdirSync(cwd(), { recursive: true });
  run(['init'], cwd());
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('guarana memory init', () => {
  it('creates the vault idempotently and records .gitignore entry once', () => {
    const gi = fs.readFileSync(path.join(cwd(), '.gitignore'), 'utf8');
    assert.ok(gi.split('\n').includes('.guarana/memory/'));
    const out = run(['init'], cwd()); // second call
    assert.ok(/already initialized/.test(out));
    const gi2 = fs.readFileSync(path.join(cwd(), '.gitignore'), 'utf8');
    assert.equal(gi2.split('.guarana/memory/').length - 1, 1);
  });
});

describe('guarana memory status', () => {
  it('reports node/edge counts with draft vs confirmed breakdown', () => {
    writeNode(cwd(), { id: 'mem-a', type: 'decision', status: 'confirmed', ts: 1, intent: 'x' });
    writeNode(cwd(), { id: 'mem-b', type: 'atom', status: 'draft', ts: 2, intent: 'y' });
    const out = run(['status'], cwd());
    assert.ok(/nodes: 2 \(1 draft, 1 confirmed\)/.test(out));
    assert.ok(/edges: 0/.test(out));
  });

  it('warns when node count exceeds maxNodes', () => {
    fs.writeFileSync(
      path.join(cwd(), '.guarana', 'memory', 'config.json'),
      JSON.stringify({ maxNodes: 1 }) + '\n'
    );
    writeNode(cwd(), { id: 'mem-a', type: 'decision', status: 'confirmed', ts: 1, intent: 'x' });
    writeNode(cwd(), { id: 'mem-b', type: 'atom', status: 'confirmed', ts: 2, intent: 'y' });
    const out = run(['status'], cwd());
    assert.ok(/WARNING: node count/.test(out));
    assert.ok(/maxNodes/.test(out));
  });
});

describe('guarana memory search', () => {
  it('passes the project filter to the search service as opts.project', async () => {
    let receivedOptions;
    const searchVault = async (_vaultDir, opts) => {
      receivedOptions = opts;
      return [];
    };

    await searchMemory(['search', '--project', 'HASH'], '/test-vault', searchVault);

    assert.equal(receivedOptions.project, 'HASH');
  });

  it('returns only confirmed nodes; drafts never appear', () => {
    writeNode(cwd(), { id: 'mem-c', type: 'decision', status: 'confirmed', ts: 5, intent: 'used storage for memory', summary: 'append-friendly', tags: ['storage'] });
    writeNode(cwd(), { id: 'mem-d', type: 'atom', status: 'draft', ts: 6, intent: 'draft must not show', summary: 'hidden', tags: ['storage'] });
    const out = run(['search', 'storage'], cwd());
    assert.ok(out.includes('mem-c'));
    assert.ok(!out.includes('mem-d'));
    assert.ok(/1 confirmed match/.test(out));
  });

  it('matches accented content by folded query (multilingual PT/EN)', () => {
    writeNode(cwd(), { id: 'mem-e', type: 'bug', status: 'confirmed', ts: 7, intent: 'entendido sem resolução', summary: 'decidimos sobre resolução e armazenamento', tags: ['pt'] });
    const out = run(['search', 'resolucao'], cwd());
    assert.ok(out.includes('mem-e'));
  });
});

describe('guarana memory review', () => {
  it('requires an explicit project type conversion, then the draft becomes searchable', () => {
    writeNode(cwd(), { id: 'mem-c', type: 'atom', status: 'draft', ts: 10, intent: 'pending thing', tags: ['storage'] });
    const list = run(['review', '--list'], cwd());
    assert.ok(list.includes('mem-c'));
    assert.ok(/1 draft node\(s\)/.test(list));

    const nodesFile = path.join(cwd(), '.guarana', 'memory', 'nodes.jsonl');
    const before = fs.readFileSync(nodesFile);
    const implicit = runResult(['review', 'mem-c', '--confirm', '--intent', 'confirmed intent'], cwd());
    assert.equal(implicit.status, 1);
    assert.match(implicit.stderr, /explicit project type conversion/);
    assert.deepEqual(fs.readFileSync(nodesFile), before);

    run(['review', 'mem-c', '--confirm', '--type', 'decision', '--intent', 'confirmed intent'], cwd());
    const n = listNodes(cwd()).find((x) => x.id === 'mem-c');
    assert.equal(n.status, 'confirmed');
    assert.equal(n.type, 'decision');
    assert.equal(n.scope, 'project');
    assert.equal(n.intent, 'confirmed intent');
    assert.ok(run(['search', 'storage'], cwd()).includes('mem-c'));
    const list2 = run(['review', '--list'], cwd());
    assert.ok(/no draft nodes/.test(list2));
  });

  it('discards a draft node and its edges', () => {
    writeNode(cwd(), { id: 'mem-a', type: 'atom', status: 'draft', ts: 10, intent: 'x' });
    writeNode(cwd(), { id: 'mem-b', type: 'atom', status: 'confirmed', ts: 11, intent: 'y' });
    fs.appendFileSync(
      path.join(cwd(), '.guarana', 'memory', 'edges.jsonl'),
      JSON.stringify({ from: 'mem-a', to: 'mem-b', rel: 'caused-by', ts: 12 }) + '\n'
    );
    run(['review', 'mem-a', '--discard'], cwd());
    const nodes = listNodes(cwd());
    assert.ok(!nodes.some((x) => x.id === 'mem-a'));
    const edges = fs.readFileSync(path.join(cwd(), '.guarana', 'memory', 'edges.jsonl'), 'utf8');
    assert.ok(!edges.includes('mem-a'));
  });
});

describe('guarana memory delete', () => {
  const projectEdgesFile = () => path.join(cwd(), '.guarana', 'memory', 'edges.jsonl');

  it('requires confirmation, exact ID, and scope; wrong scope, unknown IDs, and drafts stay untouched', () => {
    writeNode(cwd(), { id: 'mem-confirmed-delete', type: 'decision', status: 'confirmed', scope: 'project', ts: 10, intent: 'x' });
    writeNode(cwd(), { id: 'mem-draft-delete', type: 'atom', status: 'draft', scope: 'project', ts: 11, intent: 'y' });

    for (const [args, diagnostic] of [
      [['delete', 'mem-confirmed-delete'], 'requires --scope project|global'],
      [['delete', 'mem-confirmed-delete', '--scope', 'project'], 'requires explicit --confirm'],
    ]) {
      const result = runResult(args, cwd());
      assert.equal(result.status, 1);
      assert.equal(result.stdout, '');
      assert.match(result.stderr, new RegExp(diagnostic.replace(/[|]/g, '\\|')));
    }

    const isolatedHome = path.join(tmp, 'home');
    const isolatedGlobalVault = path.join(isolatedHome, '.config', 'guarana', 'memory');
    assert.ok(path.resolve(isolatedGlobalVault).startsWith(`${path.resolve(tmp)}${path.sep}`));
    assert.notEqual(path.resolve(isolatedHome), path.resolve(os.homedir()));
    fs.mkdirSync(isolatedGlobalVault, { recursive: true });
    fs.writeFileSync(path.join(isolatedGlobalVault, 'nodes.jsonl'), '');

    for (const id of ['mem-confirmed-delete', 'mem-draft-delete', 'mem-unknown']) {
      const result = runResult(['delete', id, '--scope', 'global', '--confirm'], cwd());
      assert.equal(result.status, 1);
      assert.match(result.stderr, /unknown node id/);
    }
    const draft = runResult(['delete', 'mem-draft-delete', '--scope', 'project', '--confirm'], cwd());
    assert.equal(draft.status, 1);
    assert.match(draft.stderr, /not confirmed/);
    assert.deepEqual(listNodes(cwd()).map((node) => node.id), ['mem-confirmed-delete', 'mem-draft-delete']);
  });

  it('deletes a confirmed project node and all its incident edges', () => {
    writeNode(cwd(), { id: 'mem-delete-target', type: 'decision', status: 'confirmed', scope: 'project', ts: 10, intent: 'target' });
    writeNode(cwd(), { id: 'mem-delete-retained', type: 'bug', status: 'confirmed', scope: 'project', ts: 11, intent: 'retained' });
    fs.writeFileSync(projectEdgesFile(), [
      { from: 'mem-delete-target', to: 'mem-delete-retained', rel: 'fixes', ts: 1 },
      { from: 'mem-delete-retained', to: 'mem-delete-target', rel: 'relates-to', ts: 2 },
      { from: 'mem-delete-retained', to: 'mem-delete-retained', rel: 'depends-on', ts: 3 },
    ].map((edge) => JSON.stringify(edge)).join('\n') + '\n');

    const out = run(['delete', 'mem-delete-target', '--scope', 'project', '--confirm'], cwd());
    assert.match(out, /deleted confirmed memory node mem-delete-target/);
    assert.deepEqual(listNodes(cwd()).map((node) => node.id), ['mem-delete-retained']);
    const edges = fs.readFileSync(projectEdgesFile(), 'utf8').trim().split('\n').map(JSON.parse);
    assert.deepEqual(edges.map((edge) => edge.from), ['mem-delete-retained']);
  });

  it('deletes from an explicitly selected temporary global vault without initializing a missing one', () => {
    const home = path.join(tmp, 'delete-home');
    const globalVault = path.join(home, '.config', 'guarana', 'memory');
    fs.mkdirSync(globalVault, { recursive: true });
    fs.writeFileSync(path.join(globalVault, 'nodes.jsonl'), JSON.stringify({
      id: 'mem-global-delete', type: 'preference', status: 'confirmed', scope: 'global', ts: 1, intent: 'private', summary: 'private text',
    }) + '\n');
    fs.writeFileSync(path.join(globalVault, 'edges.jsonl'), '');

    const out = run(['delete', 'mem-global-delete', '--scope', 'global', '--confirm'], cwd(), { HOME: home });
    assert.match(out, /deleted confirmed memory node mem-global-delete/);
    assert.equal(fs.readFileSync(path.join(globalVault, 'nodes.jsonl'), 'utf8'), '');
    assert.equal(fs.existsSync(path.join(home, '.config', 'guarana', 'memory', 'config.json')), false);
  });
});

describe('guarana memory export / import', () => {
  it('exports a JSON file and imports it into a fresh vault identically', () => {
    writeNode(cwd(), { id: 'mem-1', type: 'decision', status: 'confirmed', ts: 1, intent: 'x' });
    writeNode(cwd(), { id: 'mem-2', type: 'bug', status: 'draft', ts: 2, intent: 'y' });
    const outFile = path.join(tmp, 'vault-export.json');
    run(['export', outFile], cwd());
    const parsed = JSON.parse(fs.readFileSync(outFile, 'utf8'));
    assert.equal(parsed.nodes.length, 2);

    const fresh = path.join(tmp, 'fresh');
    fs.mkdirSync(fresh, { recursive: true });
    fs.writeFileSync(path.join(fresh, '.gitignore'), '');
    const out2 = run(['init'], fresh);
    run(['import', outFile], fresh);
    const freshNodes = listNodes(fresh);
    assert.equal(freshNodes.length, 2);
    assert.ok(freshNodes.some((x) => x.id === 'mem-1' && x.status === 'confirmed'));
    assert.ok(out2.includes('initialized'));
  });

  it('rejects an invalid archive without initializing or writing the project vault', () => {
    const uninitialized = path.join(tmp, 'uninitialized-import');
    fs.mkdirSync(uninitialized);
    const archive = path.join(tmp, 'invalid-project-archive.json');
    fs.writeFileSync(archive, JSON.stringify({
      version: 1,
      exportedAt: '2026-10-25T00:00:00.000Z',
      nodes: [{
        id: 'global-preference',
        type: 'preference',
        status: 'confirmed',
        scope: 'global',
        category: 'workflow',
        ts: 1,
      }],
      edges: [],
    }));

    const result = runResult(['import', archive], uninitialized);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /project archive node.scope/);
    assert.equal(fs.existsSync(path.join(uninitialized, '.guarana')), false);
    assert.equal(fs.existsSync(path.join(uninitialized, '.gitignore')), false);
  });
});

describe('guarana memory compact / prune', () => {
  it('compact is a byte-preserving no-op for legacy atoms and supernodes', () => {
    for (let i = 0; i < 5; i++) writeNode(cwd(), { id: `atom-${i}`, type: 'atom', status: 'confirmed', ts: i, intent: `a${i}`, summary: `lesson ${i}` });
    writeNode(cwd(), { id: 'legacy-supernode', type: 'supernode', status: 'confirmed', ts: 6, summary: 'supernode summarizing 1 atom node(s) ts range: 1..1' });
    const edgesFile = path.join(cwd(), '.guarana', 'memory', 'edges.jsonl');
    fs.writeFileSync(edgesFile, JSON.stringify({ from: 'atom-0', to: 'legacy-supernode', rel: 'summarizes', ts: 7 }) + '\n');
    const nodesFile = path.join(cwd(), '.guarana', 'memory', 'nodes.jsonl');
    const beforeNodes = fs.readFileSync(nodesFile);
    const beforeEdges = fs.readFileSync(edgesFile);
    const out = run(['compact', '--threshold', '2'], cwd());
    assert.match(out, /legacy memory preserved; no atoms or supernodes changed/);
    assert.deepEqual(fs.readFileSync(nodesFile), beforeNodes);
    assert.deepEqual(fs.readFileSync(edgesFile), beforeEdges);
    const nodes = listNodes(cwd());
    assert.equal(nodes.filter((x) => x.type === 'atom').length, 5);
    assert.equal(nodes.filter((x) => x.type === 'supernode').length, 1);
  });

  it('prune is a byte-preserving no-op for legacy draft atoms and their edges', () => {
    for (let i = 0; i < 4; i++) {
      writeNode(cwd(), { id: `draft-${i}`, type: 'atom', status: 'draft', ts: i, intent: `d${i}` });
    }
    writeNode(cwd(), { id: 'keep', type: 'atom', status: 'confirmed', ts: 100, intent: 'k' });
    writeNode(cwd(), { id: 'legacy-supernode', type: 'supernode', status: 'confirmed', ts: 101, summary: 'Keep me.' });
    const edgesFile = path.join(cwd(), '.guarana', 'memory', 'edges.jsonl');
    fs.writeFileSync(edgesFile, JSON.stringify({ from: 'draft-0', to: 'legacy-supernode', rel: 'summarizes', ts: 102 }) + '\n');
    const nodesFile = path.join(cwd(), '.guarana', 'memory', 'nodes.jsonl');
    const beforeNodes = fs.readFileSync(nodesFile);
    const beforeEdges = fs.readFileSync(edgesFile);
    const out = run(['prune', '--keep', '1'], cwd());
    assert.match(out, /legacy draft atoms preserved; nothing pruned/);
    assert.deepEqual(fs.readFileSync(nodesFile), beforeNodes);
    assert.deepEqual(fs.readFileSync(edgesFile), beforeEdges);
    const nodes = listNodes(cwd());
    assert.equal(nodes.filter((x) => x.type === 'atom' && x.status === 'draft').length, 4);
    assert.ok(nodes.some((x) => x.id === 'keep'));
    assert.ok(nodes.some((x) => x.id === 'legacy-supernode'));
  });
});

describe('guarana memory command failures', () => {
  it('reports an uninitialized vault once and exits 1', () => {
    const uninitialized = path.join(tmp, 'uninitialized');
    fs.mkdirSync(uninitialized);

    const result = runResult(['status'], uninitialized);

    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.equal(result.stderr, `memory vault not initialized at ${path.join(uninitialized, '.guarana', 'memory')} — run \`guarana memory init\` first\n`);
  });

  it('reports invalid and missing flag values once and exits 1', () => {
    for (const [args, diagnostic] of [
      [['search', '--since', 'not-a-date'], 'invalid --since value: not-a-date'],
      [['search', '--since'], 'missing value for --since'],
    ]) {
      const result = runResult(args, cwd());

      assert.equal(result.status, 1, `unexpected status for: memory ${args.join(' ')}`);
      assert.equal(result.stdout, '');
      assert.equal(result.stderr, `${diagnostic}\n`);
    }
  });

  it('prints the unknown-subcommand diagnostic and detailed help, then exits 1', () => {
    const result = runResult(['not-a-subcommand'], cwd());

    assert.equal(result.status, 1);
    assert.equal(result.stderr, 'unknown memory command: not-a-subcommand\n');
    assert.equal(result.stdout, run(['--help'], cwd()));
  });

  it('does not call process.exit or mutate process.exitCode', () => {
    const source = fs.readFileSync(MEMORY_COMMAND, 'utf8');
    assert.doesNotMatch(source, /\bprocess\.(?:exit|exitCode)\b/);
  });
});
