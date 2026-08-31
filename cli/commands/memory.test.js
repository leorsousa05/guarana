// CLI command tests for `guarana memory …`. Faithful end-to-end: spawn the
// real bin/guarana.js against a temp project cwd, then assert on exit code and
// stdout. Uses the in-repo engine via the CLI's own engineDir() resolution.
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const BIN = path.join(__dirname, '..', '..', 'bin', 'guarana.js');

function run(args, cwd) {
  const res = spawnSync(process.execPath, [BIN, 'memory', ...args], { cwd, encoding: 'utf8' });
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
  it('lists drafts, confirms one, then it becomes searchable', () => {
    writeNode(cwd(), { id: 'mem-c', type: 'atom', status: 'draft', ts: 10, intent: 'pending thing', tags: ['storage'] });
    const list = run(['review', '--list'], cwd());
    assert.ok(list.includes('mem-c'));
    assert.ok(/1 draft node\(s\)/.test(list));

    run(['review', 'mem-c', '--confirm', '--intent', 'confirmed intent'], cwd());
    const n = listNodes(cwd()).find((x) => x.id === 'mem-c');
    assert.equal(n.status, 'confirmed');
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
});

describe('guarana memory compact / prune', () => {
  it('compacts oldest atoms into a supernode above threshold, preserving lessons', () => {
    for (let i = 0; i < 5; i++) {
      writeNode(cwd(), { id: `atom-${i}`, type: 'atom', status: 'confirmed', ts: i, intent: `a${i}`, summary: `lesson ${i}` });
    }
    const out = run(['compact', '--threshold', '2'], cwd());
    assert.ok(/compacted 3 atom node\(s\) into supernode/.test(out));
    const nodes = listNodes(cwd());
    assert.ok(nodes.some((x) => x.type === 'supernode'));
    const supernode = nodes.find((x) => x.type === 'supernode');
    assert.equal(supernode.collapsedIds.length, 3);
    // atom-0..2 collapsed; atom-3,4 remain
    for (let i = 0; i < 3; i++) assert.ok(!nodes.some((x) => x.id === `atom-${i}`));
    for (let i = 3; i < 5; i++) assert.ok(nodes.some((x) => x.id === `atom-${i}`));
  });

  it('prunes oldest draft atoms beyond --keep, preserving confirmed', () => {
    for (let i = 0; i < 4; i++) {
      writeNode(cwd(), { id: `draft-${i}`, type: 'atom', status: 'draft', ts: i, intent: `d${i}` });
    }
    writeNode(cwd(), { id: 'keep', type: 'atom', status: 'confirmed', ts: 100, intent: 'k' });
    const out = run(['prune', '--keep', '1'], cwd());
    assert.ok(/pruned 3 draft atom node/.test(out));
    const nodes = listNodes(cwd());
    assert.ok(nodes.some((x) => x.id === 'keep'));
    // newest draft survives (draft-3), oldest three pruned
    assert.ok(nodes.some((x) => x.id === 'draft-3'));
    for (let i = 0; i < 3; i++) assert.ok(!nodes.some((x) => x.id === `draft-${i}`));
  });
});