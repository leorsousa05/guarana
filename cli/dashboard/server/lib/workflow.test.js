import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { current } from './workflow.js';
import { createApp } from '../app.js';
import { createRunManifest } from '../../../orchestrator/parallel.js';
import { runManifestFile } from '../../../orchestrator/parallel-store.js';

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-dash-wf-'));
}

function writeWorkflow(dir, history, state = 'coding') {
  const stateDir = path.join(dir, '.specs', 'state');
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(path.join(stateDir, 'workflow.json'), JSON.stringify({
    version: 1, state, activeTask: 'Current task', updatedAt: history.at(-1)?.ts || 0, history,
  }), 'utf8');
}

function bindRun(dir, runId, manifest) {
  const manifestFile = runManifestFile(dir, runId);
  fs.mkdirSync(path.dirname(manifestFile), { recursive: true });
  fs.writeFileSync(`${manifestFile.slice(0, -'.json'.length)}.bound`, JSON.stringify({ version: 1, runId }), 'utf8');
  if (manifest !== undefined) fs.writeFileSync(manifestFile, JSON.stringify(manifest), 'utf8');
  return manifestFile;
}

function runStart(ts) {
  return [
    { ts: ts - 20, event: 'new_task', from: 'idle', to: 'planning' },
    { ts: ts - 10, event: 'plan_complete', from: 'planning', to: 'building' },
    { ts, event: 'run_start', from: 'building', to: 'coding' },
  ];
}

test('workflow.current returns idle for a missing workflow.json', async () => {
  const dir = tmp();
  const res = await current(dir);
  assert.equal(res.state, 'idle');
  assert.equal(res.engine, 'ok');
});

test('workflow.current reads the persisted state machine', async () => {
  const dir = tmp();
  const specs = path.join(dir, '.specs', 'state');
  fs.mkdirSync(specs, { recursive: true });
  const wf = {
    version: 1, state: 'coding', skill: 'code', activeTask: 'implement oauth',
    goal: 'implement OAuth', condition: 'npm test green', updatedAt: 5,
    history: [{ ts: 1, event: 'new_task', from: 'idle', to: 'planning', note: '' }],
  };
  fs.writeFileSync(path.join(specs, 'workflow.json'), JSON.stringify(wf), 'utf8');
  const res = await current(dir);
  assert.equal(res.state, 'coding');
  assert.equal(res.skill, 'code');
  assert.equal(res.goal, 'implement OAuth');
  assert.equal(res.history.length, 1);
});

test('workflow.current degrades to idle on corrupt file', async () => {
  const dir = tmp();
  const specs = path.join(dir, '.specs', 'state');
  fs.mkdirSync(specs, { recursive: true });
  fs.writeFileSync(path.join(specs, 'workflow.json'), '{nope', 'utf8');
  const res = await current(dir);
  assert.equal(res.state, 'idle');
});

test('workflow.current projects only the latest bound run after the latest task boundary', async () => {
  const dir = tmp();
  const earlier = createRunManifest('workflow-200', [
    { id: 'historical-only', mode: 'read-only', ownedPaths: [] },
  ], { now: 200 });
  const currentManifest = createRunManifest('workflow-400', [
    { id: 'current-only', mode: 'read-only', ownedPaths: [] },
  ], { now: 400 });
  const history = [
    ...runStart(200),
    { ts: 300, event: 'new_task', from: 'coding', to: 'planning' },
    { ts: 310, event: 'plan_complete', from: 'planning', to: 'building' },
    { ts: 400, event: 'run_start', from: 'building', to: 'coding' },
    { ts: 500, event: 'verify_pass', from: 'verifying', to: 'completed' },
  ];
  writeWorkflow(dir, history, 'completed');
  bindRun(dir, earlier.runId, earlier);
  bindRun(dir, currentManifest.runId, currentManifest);

  const currentRun = await current(dir);
  assert.deepEqual(currentRun.parallelRun, {
    status: 'pending',
    updatedAt: 400,
    tasks: [{ id: 'current-only', mode: 'read-only', status: 'pending', dependsOn: [] }],
  });

  writeWorkflow(dir, [...history, { ts: 600, event: 'abort', from: 'completed', to: 'idle' }], 'idle');
  assert.equal((await current(dir)).parallelRun, null, 'abort clears current DAG visibility without browsing old runs');
});

test('workflow.current returns null when the current run has no DAG binding', async () => {
  const dir = tmp();
  writeWorkflow(dir, runStart(700));
  assert.equal((await current(dir)).parallelRun, null);

  const orphan = createRunManifest('workflow-700', [
    { id: 'orphan', mode: 'read-only', ownedPaths: [] },
  ], { now: 700 });
  const orphanFile = runManifestFile(dir, orphan.runId);
  fs.mkdirSync(path.dirname(orphanFile), { recursive: true });
  fs.writeFileSync(orphanFile, JSON.stringify(orphan), 'utf8');
  assert.deepEqual((await current(dir)).parallelRun, { status: 'unavailable' },
    'an orphan manifest is uncertain and cannot masquerade as an unbound run');
});

test('workflow.current projects only an allowlisted manifest shape and keeps uncertain sidecars private', async () => {
  const dir = tmp();
  const runId = 'workflow-800';
  const manifest = createRunManifest(runId, [
    { id: 'read-root', mode: 'read-only', ownedPaths: ['PRIVATE_OWNED_PATH_SENTINEL'] },
    { id: 'code-child', mode: 'code', dependsOn: ['read-root'], ownedPaths: ['PRIVATE_CODE_PATH_SENTINEL'] },
  ], { now: 800 });
  const codeTask = manifest.tasks.find((task) => task.id === 'code-child');
  codeTask.evidence = ['private-evidence-sentinel'];
  codeTask.baseCommit = 'a'.repeat(40);
  codeTask.worktreePath = '/PRIVATE_WORKTREE_PATH_SENTINEL';
  manifest.tasks.find((task) => task.id === 'read-root').evidence = ['private-read-evidence-sentinel'];
  writeWorkflow(dir, runStart(800));
  const manifestFile = bindRun(dir, runId, manifest);

  const response = await current(dir);
  assert.deepEqual(Object.keys(response.parallelRun), ['status', 'updatedAt', 'tasks']);
  assert.deepEqual(response.parallelRun.tasks.find((task) => task.id === 'code-child'), {
    id: 'code-child', mode: 'code', status: 'pending', dependsOn: ['read-root'],
  });
  const projection = JSON.stringify(response.parallelRun);
  for (const privateValue of [
    'PRIVATE_OWNED_PATH_SENTINEL', 'PRIVATE_CODE_PATH_SENTINEL',
    'private-evidence-sentinel', 'private-read-evidence-sentinel',
    'PRIVATE_WORKTREE_PATH_SENTINEL', 'a'.repeat(40),
  ]) assert.ok(!projection.includes(privateValue), `projection omits ${privateValue}`);
  for (const privateKey of ['ownedPaths', 'evidence', 'worktreePath', 'baseCommit', 'runId']) {
    assert.ok(!projection.includes(`"${privateKey}"`), `projection omits ${privateKey}`);
  }

  const invalidCases = [
    ['missing', undefined, []],
    ['corrupt', '{RAW_MANIFEST_ERROR_SENTINEL', ['RAW_MANIFEST_ERROR_SENTINEL']],
    ['private-fields', JSON.stringify({
      ...createRunManifest('workflow-900', [
        { id: 'private', mode: 'read-only', ownedPaths: [] },
      ], { now: 900 }),
      goal: 'PRIVATE_GOAL_SENTINEL', condition: 'PRIVATE_CONDITION_SENTINEL',
      prompt: 'PRIVATE_PROMPT_SENTINEL', workerOutput: 'PRIVATE_WORKER_OUTPUT_SENTINEL',
      localPath: 'PRIVATE_LOCAL_PATH_SENTINEL', evidenceRefs: ['PRIVATE_EVIDENCE_REFS_SENTINEL'],
    }), [
      'PRIVATE_GOAL_SENTINEL', 'PRIVATE_CONDITION_SENTINEL', 'PRIVATE_PROMPT_SENTINEL',
      'PRIVATE_WORKER_OUTPUT_SENTINEL', 'PRIVATE_LOCAL_PATH_SENTINEL', 'PRIVATE_EVIDENCE_REFS_SENTINEL',
    ]],
  ];
  for (const [label, content, sentinels] of invalidCases) {
    const caseDir = tmp();
    writeWorkflow(caseDir, runStart(900));
    const caseManifest = bindRun(caseDir, 'workflow-900');
    if (content !== undefined) fs.writeFileSync(caseManifest, content, 'utf8');
    const result = await current(caseDir);
    assert.deepEqual(result.parallelRun, { status: 'unavailable' }, `${label} sidecar is bounded unavailable`);
    for (const sentinel of sentinels) assert.ok(!JSON.stringify(result.parallelRun).includes(sentinel));
    assert.doesNotMatch(JSON.stringify(result.parallelRun), /\/tmp\//);
    fs.rmSync(caseDir, { recursive: true, force: true });
  }

  const badBindingDir = tmp();
  writeWorkflow(badBindingDir, runStart(950));
  const badBindingFile = path.join(badBindingDir, '.specs', 'state', 'parallel-runs', 'workflow-950.bound');
  fs.mkdirSync(path.dirname(badBindingFile), { recursive: true });
  fs.writeFileSync(badBindingFile, '{"version":1,"runId":"PRIVATE_BOUND_RUN_ID_SENTINEL"}', 'utf8');
  const badBinding = await current(badBindingDir);
  assert.deepEqual(badBinding.parallelRun, { status: 'unavailable' });
  assert.doesNotMatch(JSON.stringify(badBinding), /PRIVATE_BOUND_RUN_ID_SENTINEL/);

  const lockDir = tmp();
  const lockedManifest = createRunManifest('workflow-1000', [
    { id: 'locked', mode: 'read-only', ownedPaths: [] },
  ], { now: 1000 });
  writeWorkflow(lockDir, runStart(1000));
  const lockedFile = bindRun(lockDir, 'workflow-1000', lockedManifest);
  fs.writeFileSync(`${lockedFile}.lock`, 'PRIVATE_LOCK_IDENTITY_SENTINEL', 'utf8');
  const locked = await current(lockDir);
  assert.deepEqual(locked.parallelRun, { status: 'unavailable' });
  assert.doesNotMatch(JSON.stringify(locked), /PRIVATE_LOCK_IDENTITY_SENTINEL|PRIVATE_WORKTREE_PATH_SENTINEL/);
  assert.ok(fs.existsSync(manifestFile));
});

test('GET /api/workflow/current serves the workflow', async () => {
  const dir = tmp();
  const specs = path.join(dir, '.specs', 'state');
  fs.mkdirSync(specs, { recursive: true });
  fs.writeFileSync(path.join(specs, 'workflow.json'), JSON.stringify({ version: 1, state: 'planning', skill: 'plan', updatedAt: 1, history: [] }), 'utf8');
  const app = createApp({ root: dir, distDir: path.join(tmp(), 'dist') });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://localhost:${server.address().port}`;
  try {
    const res = await fetch(`${base}/api/workflow/current`);
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.state, 'planning');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
