import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  MAX_EVIDENCE_REFERENCES, MAX_OWNED_PATHS, MAX_PARALLEL_SUBTASKS, MAX_TASK_ATTEMPTS,
  cancelRun, confirmTaskTermination, createRunManifest, integrateCodeSubtask,
  markNeedsReconciliation, readySubtasks, recordCodeWorktree, reconcileSubtask,
  retrySubtask, transitionSubtask, validateRunManifest, validateSubtaskDag,
} from './parallel.js';
import {
  createRunManifestExclusive, inspectRunManifestLock, loadRunManifest, recoverRunManifestLock,
  runManifestFile, saveRunManifest, updateRunManifest,
} from './parallel-store.js';

function tempDirectory() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-parallel-'));
}

function startNode(script, args) {
  const child = spawn(process.execPath, ['--input-type=module', '-e', script], {
    env: { ...process.env, PARALLEL_TEST_ARGS: JSON.stringify(args) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk; });
  child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });
  const closed = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => resolve({ code, signal, stdout, stderr }));
  });
  return { child, closed };
}

async function waitForFile(file, execution) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (fs.existsSync(file)) return;
    if (execution.child.exitCode !== null) {
      const result = await execution.closed;
      throw new Error(`Child exited before signal (${result.code}): ${result.stderr || result.stdout}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error(`Timed out waiting for child signal: ${file}`);
}

const recoveryChildScript = `
import fs from 'node:fs';
import { recoverRunManifestLock, runManifestFile } from ${JSON.stringify(new URL('./parallel-store.js', import.meta.url).href)};
const args = JSON.parse(process.env.PARALLEL_TEST_ARGS);
if (args.pauseBeforeRemove) {
  const originalRmSync = fs.rmSync;
  const lockFile = runManifestFile(args.directory, args.runId) + '.lock';
  fs.rmSync = function (target, ...rest) {
    if (String(target) === lockFile) {
      fs.writeFileSync(args.readyFile, 'ready');
      const waitCell = new Int32Array(new SharedArrayBuffer(4));
      while (!fs.existsSync(args.releaseFile)) Atomics.wait(waitCell, 0, 0, 10);
    }
    return originalRmSync.call(this, target, ...rest);
  };
}
try {
  const result = recoverRunManifestLock(args.directory, args.runId, {
    primaryConfirmed: true, expectedToken: args.token,
  });
  process.stdout.write(JSON.stringify({ result }) + '\\n');
} catch (error) {
  process.stdout.write(JSON.stringify({ error: { code: error.code, message: error.message } }) + '\\n');
}
`;

const writerChildScript = `
import fs from 'node:fs';
import { updateRunManifest } from ${JSON.stringify(new URL('./parallel-store.js', import.meta.url).href)};
const args = JSON.parse(process.env.PARALLEL_TEST_ARGS);
try {
  updateRunManifest(args.directory, args.runId, (manifest) => {
    fs.writeFileSync(args.readyFile, 'ready');
    const waitCell = new Int32Array(new SharedArrayBuffer(4));
    while (!fs.existsSync(args.releaseFile)) Atomics.wait(waitCell, 0, 0, 10);
    return manifest;
  });
  process.stdout.write(JSON.stringify({ ok: true }) + '\\n');
} catch (error) {
  process.stdout.write(JSON.stringify({ error: { code: error.code, message: error.message } }) + '\\n');
}
`;

async function runRecoveryChild(args) {
  const execution = startNode(recoveryChildScript, args);
  const result = await execution.closed;
  assert.equal(result.code, 0, result.stderr);
  return JSON.parse(result.stdout.trim());
}

function readOnlyTask(id, fields = {}) {
  return { id, mode: 'read-only', ownedPaths: [], ...fields };
}

function graphManifest(now = 10) {
  return createRunManifest('run-a', [
    readOnlyTask('leaf-c', { dependsOn: ['leaf-a'] }),
    readOnlyTask('leaf-b'),
    readOnlyTask('leaf-a'),
  ], { now });
}

test('DAG validation enforces stable unique IDs, known dependencies, and acyclicity', () => {
  assert.deepEqual(validateSubtaskDag([
    readOnlyTask('z-last', { dependsOn: ['a-first'], ownedPaths: ['src/z.js'] }),
    readOnlyTask('a-first', { ownedPaths: ['src/a.js'] }),
  ]), [
    { id: 'a-first', dependsOn: [], mode: 'read-only', ownedPaths: ['src/a.js'] },
    { id: 'z-last', dependsOn: ['a-first'], mode: 'read-only', ownedPaths: ['src/z.js'] },
  ]);
  for (const graph of [
    [readOnlyTask('same'), readOnlyTask('same')],
    [readOnlyTask('first', { dependsOn: ['missing'] })],
    [readOnlyTask('first', { dependsOn: ['first'] })],
    [readOnlyTask('first', { dependsOn: ['second'] }), readOnlyTask('second', { dependsOn: ['first'] })],
    [readOnlyTask('not stable')],
    [readOnlyTask('first', { prompt: 'must not be persisted' })],
  ]) assert.throws(() => validateSubtaskDag(graph), TypeError);
});

test('modes and bounded ownedPaths are required, canonical, and repo-relative', () => {
  const graph = validateSubtaskDag([
    { id: 'code-step', mode: 'code', ownedPaths: ['src/z.js', 'src/a.js'] },
    readOnlyTask('inspect-step'),
  ]);
  assert.deepEqual(graph[0], {
    id: 'code-step', mode: 'code', dependsOn: [], ownedPaths: ['src/a.js', 'src/z.js'],
  });
  assert.deepEqual(graph[1], {
    id: 'inspect-step', mode: 'read-only', dependsOn: [], ownedPaths: [],
  });

  for (const invalid of [
    { id: 'missing-mode', ownedPaths: [] },
    { id: 'bad-mode', mode: 'write', ownedPaths: [] },
    { id: 'code-without-owner', mode: 'code', ownedPaths: [] },
    readOnlyTask('parent-path', { ownedPaths: ['../secret'] }),
    readOnlyTask('absolute-path', { ownedPaths: ['/etc/passwd'] }),
    readOnlyTask('windows-path', { ownedPaths: ['src\\secret.js'] }),
    readOnlyTask('dot-segment', { ownedPaths: ['src/./main.js'] }),
    readOnlyTask('duplicate-path', { ownedPaths: ['src/a.js', 'src/a.js'] }),
    readOnlyTask('too-many-paths', { ownedPaths: Array.from({ length: MAX_OWNED_PATHS + 1 }, (_, i) => `src/${i}.js`) }),
    readOnlyTask('too-long-path', { ownedPaths: [`src/${'x'.repeat(254)}`] }),
  ]) assert.throws(() => validateSubtaskDag([invalid]), TypeError);
});

test('ready subtasks are only dependency-complete, bounded, and independent', () => {
  let manifest = graphManifest();
  assert.deepEqual(readySubtasks(manifest), ['leaf-a', 'leaf-b']);
  assert.deepEqual(readySubtasks(manifest, 1), ['leaf-a']);
  assert.throws(() => readySubtasks(manifest, MAX_PARALLEL_SUBTASKS + 1), TypeError);
  assert.throws(() => transitionSubtask(manifest, 'leaf-c', 'running', { now: 11 }), /not ready/);

  manifest = transitionSubtask(manifest, 'leaf-a', 'running', { now: 11 });
  assert.deepEqual(readySubtasks(manifest), ['leaf-b']);
  manifest = transitionSubtask(manifest, 'leaf-a', 'completed', {
    now: 12, evidence: ['test-leaf-a'],
  });
  assert.deepEqual(readySubtasks(manifest), ['leaf-b', 'leaf-c']);
  assert.equal(manifest.status, 'running');

  manifest = transitionSubtask(manifest, 'leaf-b', 'running', { now: 13 });
  manifest = transitionSubtask(manifest, 'leaf-b', 'failed', { now: 14 });
  assert.equal(manifest.status, 'running');
  assert.deepEqual(readySubtasks(manifest), ['leaf-c']);
  assert.throws(() => transitionSubtask(manifest, 'leaf-b', 'running', { now: 15 }), /Illegal/);
});

test('dispatch batch skips tasks with overlapping or nested owned paths', () => {
  let manifest = createRunManifest('ownership-run', [
    readOnlyTask('task-a', { ownedPaths: ['src'] }),
    readOnlyTask('task-b', { ownedPaths: ['src/lib'] }),
    readOnlyTask('task-c', { ownedPaths: ['docs'] }),
  ], { now: 1 });
  assert.deepEqual(readySubtasks(manifest), ['task-a', 'task-c']);
  manifest = transitionSubtask(manifest, 'task-a', 'running', { now: 2 });
  assert.deepEqual(readySubtasks(manifest), ['task-c']);
  assert.throws(() => transitionSubtask(manifest, 'task-b', 'running', { now: 3 }), /overlaps owned paths/);
  assert.throws(() => validateRunManifest({
    ...manifest,
    tasks: manifest.tasks.map((task) => task.id === 'task-b'
      ? {
        ...task,
        status: 'running',
        attempts: 1,
        attemptHistory: [{ attempt: 1, startedAt: 3, endedAt: null, status: 'running' }],
      }
      : task),
  }), /overlap owned paths/);
});

test('parallel limit caps total running tasks and offers slots as they complete', () => {
  assert.equal(MAX_PARALLEL_SUBTASKS, 2);
  const ids = Array.from({ length: MAX_PARALLEL_SUBTASKS + 1 }, (_, index) => `task-${index}`);
  let manifest = createRunManifest('bounded-run', ids.map((id) => readOnlyTask(id)), { now: 1 });
  for (const id of ids.slice(0, MAX_PARALLEL_SUBTASKS)) {
    manifest = transitionSubtask(manifest, id, 'running', { now: 2 });
  }
  assert.deepEqual(readySubtasks(manifest), []);
   assert.throws(() => transitionSubtask(manifest, ids.at(-1), 'running', { now: 3 }), /already has .* active subtasks/);
  manifest = transitionSubtask(manifest, ids[0], 'completed', { now: 3 });
  assert.deepEqual(readySubtasks(manifest), [ids.at(-1)]);
});

test('running and uncertain workers retain one slot and their owned paths', () => {
  for (const activeStatus of ['running', 'cancel-requested', 'needs-reconciliation']) {
    let manifest = createRunManifest(`active-${activeStatus}`, [
      readOnlyTask('active-task', { ownedPaths: ['src'] }),
      readOnlyTask('overlapping-task', { ownedPaths: ['src/lib'] }),
      readOnlyTask('independent-task', { ownedPaths: ['docs'] }),
      readOnlyTask('z-extra-task', { ownedPaths: ['tests'] }),
    ], { now: 1 });
    manifest = transitionSubtask(manifest, 'active-task', 'running', { now: 2 });
    if (activeStatus === 'cancel-requested') {
      manifest = transitionSubtask(manifest, 'active-task', 'cancel-requested', { now: 3 });
    } else if (activeStatus === 'needs-reconciliation') {
      manifest = markNeedsReconciliation(manifest, 'active-task', { now: 3 });
    }

    assert.equal(manifest.tasks.find((task) => task.id === 'active-task').status, activeStatus);
    assert.deepEqual(readySubtasks(manifest), ['independent-task']);
    assert.throws(() => transitionSubtask(manifest, 'overlapping-task', 'running', { now: 4 }), /overlaps owned paths with active work/);

    manifest = transitionSubtask(manifest, 'independent-task', 'running', { now: 4 });
    assert.deepEqual(readySubtasks(manifest), []);
    assert.throws(() => transitionSubtask(manifest, 'z-extra-task', 'running', { now: 5 }), /already has 2 active subtasks/);
  }
});

test('run cancellation prevents dispatch while in-flight work awaits termination', () => {
  let manifest = createRunManifest('cancel-dispatch-run', [
    readOnlyTask('in-flight', { ownedPaths: ['src'] }),
    readOnlyTask('queued-a', { ownedPaths: ['docs'] }),
    readOnlyTask('queued-b', { ownedPaths: ['tests'] }),
  ], { now: 1 });
  manifest = transitionSubtask(manifest, 'in-flight', 'running', { now: 2 });
  manifest = cancelRun(manifest, { now: 3 });

  assert.equal(manifest.tasks.find((task) => task.id === 'in-flight').status, 'cancel-requested');
  assert.equal(manifest.tasks.find((task) => task.id === 'queued-a').status, 'cancelled');
  assert.equal(manifest.tasks.find((task) => task.id === 'queued-b').status, 'cancelled');
  assert.deepEqual(readySubtasks(manifest), []);
  assert.throws(() => transitionSubtask(manifest, 'queued-a', 'running', { now: 4 }), /Illegal subtask status transition/);
});

test('code tasks persist worktree preflight before entering running status', () => {
  const initial = createRunManifest('code-run', [
    { id: 'edit-source', mode: 'code', ownedPaths: ['src/main.js'] },
  ], { now: 1 });
  assert.throws(() => transitionSubtask(initial, 'edit-source', 'running', { now: 2 }), /worktree preflight/);
  assert.throws(() => recordCodeWorktree(initial, 'edit-source', {
    baseCommit: 'abc123', worktreePath: 'relative/worktree', now: 2,
  }), TypeError);

  const preflighted = recordCodeWorktree(initial, 'edit-source', {
    baseCommit: 'a'.repeat(40), worktreePath: '/tmp/worktrees/code-run', now: 2,
  });
  assert.equal(preflighted.tasks[0].baseCommit, 'a'.repeat(40));
  assert.equal(preflighted.tasks[0].worktreePath, '/tmp/worktrees/code-run');
  assert.deepEqual(validateRunManifest(preflighted), preflighted);
  const running = transitionSubtask(preflighted, 'edit-source', 'running', { now: 3 });
  assert.equal(running.tasks[0].status, 'running');
  const directory = tempDirectory();
  saveRunManifest(directory, running);
  assert.deepEqual(loadRunManifest(directory, 'code-run'), running);
  assert.throws(() => recordCodeWorktree(preflighted, 'edit-source', {
    baseCommit: 'b'.repeat(40), worktreePath: '/tmp/worktrees/other', now: 4,
  }), /already recorded/);

  const malformed = {
    ...initial,
    status: 'running',
    tasks: [{ ...initial.tasks[0], status: 'running' }],
  };
  assert.throws(() => validateRunManifest(malformed), /worktree preflight/);
});

test('every code-task attempt receives a distinct worktree across tasks and retries', () => {
  const baseCommit = 'c'.repeat(40);
  let manifest = createRunManifest('unique-worktree-run', [
    { id: 'code-a', mode: 'code', ownedPaths: ['src/a.js'] },
    { id: 'code-b', mode: 'code', ownedPaths: ['src/b.js'] },
  ], { now: 1 });
  manifest = recordCodeWorktree(manifest, 'code-a', {
    baseCommit, worktreePath: '/tmp/worktrees/shared', now: 2,
  });
  assert.throws(() => recordCodeWorktree(manifest, 'code-b', {
    baseCommit, worktreePath: '/tmp/worktrees/shared', now: 3,
  }), /already assigned to subtask code-a/);

  const duplicateCurrentAssignment = {
    ...manifest,
    tasks: manifest.tasks.map((task) => task.id === 'code-b'
      ? { ...task, baseCommit, worktreePath: '/tmp/worktrees/shared' }
      : task),
  };
  assert.throws(() => validateRunManifest(duplicateCurrentAssignment), /assigned to both/);

  let retried = createRunManifest('unique-retry-run', [
    { id: 'patch', mode: 'code', ownedPaths: ['src/patch.js'] },
  ], { now: 1 });
  retried = recordCodeWorktree(retried, 'patch', {
    baseCommit, worktreePath: '/tmp/worktrees/attempt-one', now: 2,
  });
  retried = transitionSubtask(retried, 'patch', 'running', { now: 3 });
  retried = transitionSubtask(retried, 'patch', 'failed', { now: 4 });
  retried = retrySubtask(retried, 'patch', { primaryReviewed: true, now: 5 });
  assert.throws(() => recordCodeWorktree(retried, 'patch', {
    baseCommit, worktreePath: '/tmp/worktrees/attempt-one', now: 6,
  }), /already used by subtask patch/);

  retried = recordCodeWorktree(retried, 'patch', {
    baseCommit, worktreePath: '/tmp/worktrees/attempt-two', now: 6,
  });
  assert.equal(validateRunManifest(retried).tasks[0].worktreePath, '/tmp/worktrees/attempt-two');
  const reusedHistoricalPath = {
    ...retried,
    tasks: retried.tasks.map((task) => ({ ...task, worktreePath: '/tmp/worktrees/attempt-one' })),
  };
  assert.throws(() => validateRunManifest(reusedHistoricalPath), /assigned to both/);
});

test('manifest transitions accept only bounded evidence references and reject invalid shapes', () => {
  const manifest = graphManifest();
  assert.equal(manifest.version, 1);
  assert.equal(manifest.status, 'pending');
  assert.throws(() => transitionSubtask(manifest, 'leaf-a', 'running', {
    now: 11, evidence: ['raw worker output: test passed'],
  }), /stable lowercase/);
  assert.throws(() => transitionSubtask(manifest, 'leaf-a', 'running', {
    now: 11, evidence: Array.from({ length: MAX_EVIDENCE_REFERENCES + 1 }, (_, index) => `proof-${index}`),
  }), /at most/);
  assert.throws(() => transitionSubtask(manifest, 'leaf-a', 'completed', { now: 11 }), /Illegal/);
  assert.throws(() => validateRunManifest({ ...manifest, prompt: 'not part of the manifest' }), /Unknown run manifest field/);
});

test('explicitly blocked work produces a blocked terminal run status', () => {
  const started = createRunManifest('blocked-run', [readOnlyTask('needs-human')], { now: 1 });
  const blocked = transitionSubtask(started, 'needs-human', 'blocked', { now: 2 });
  assert.equal(blocked.tasks[0].status, 'blocked');
  assert.equal(blocked.status, 'blocked');
  assert.deepEqual(readySubtasks(blocked), []);
});

test('failed dependencies block all descendants but leave independent work schedulable', () => {
  let manifest = createRunManifest('failure-run', [
    readOnlyTask('root-step'),
    readOnlyTask('child-step', { dependsOn: ['root-step'] }),
    readOnlyTask('grandchild-step', { dependsOn: ['child-step'] }),
    readOnlyTask('independent-step'),
  ], { now: 1 });
  manifest = transitionSubtask(manifest, 'root-step', 'running', { now: 2 });
  manifest = transitionSubtask(manifest, 'root-step', 'failed', { now: 3 });
  const statuses = new Map(manifest.tasks.map(({ id, status }) => [id, status]));
  assert.equal(statuses.get('child-step'), 'blocked');
  assert.equal(statuses.get('grandchild-step'), 'blocked');
  assert.deepEqual(readySubtasks(manifest), ['independent-step']);
  assert.throws(() => validateRunManifest({
    ...manifest,
    tasks: manifest.tasks.map((task) => task.id === 'grandchild-step'
      ? (({ blockedBy: _blockedBy, ...rest }) => ({ ...rest, status: 'pending' }))(task)
      : task),
  }), /pending or stale blocked work/);
});

test('a failure is nonterminal while independent work is running or ready', () => {
  let manifest = createRunManifest('mixed-run', [
    readOnlyTask('task-a'), readOnlyTask('task-b'),
  ], { now: 1 });
  manifest = transitionSubtask(manifest, 'task-a', 'running', { now: 2 });
  manifest = transitionSubtask(manifest, 'task-a', 'failed', { now: 3 });
  assert.equal(manifest.status, 'running');
  assert.deepEqual(readySubtasks(manifest), ['task-b']);
  manifest = transitionSubtask(manifest, 'task-b', 'running', { now: 4 });
  assert.equal(manifest.status, 'running');
  manifest = transitionSubtask(manifest, 'task-b', 'completed', { now: 5 });
  assert.equal(manifest.status, 'failed');
});

test('code completion waits for primary integration before unlocking dependencies or completing the run', () => {
  let manifest = createRunManifest('integration-run', [
    { id: 'code-a', mode: 'code', ownedPaths: ['src/a.js'] },
    { id: 'code-b', dependsOn: ['code-a'], mode: 'code', ownedPaths: ['src/b.js'] },
  ], { now: 1 });
  manifest = recordCodeWorktree(manifest, 'code-a', {
    baseCommit: 'a'.repeat(40), worktreePath: '/tmp/worktrees/code-a', now: 2,
  });
  manifest = transitionSubtask(manifest, 'code-a', 'running', { now: 3 });
  manifest = transitionSubtask(manifest, 'code-a', 'integration-pending', { now: 4 });
  assert.equal(manifest.status, 'integration-pending');
  assert.deepEqual(readySubtasks(manifest), []);
  assert.throws(() => integrateCodeSubtask(manifest, 'code-a', { now: 5 }), /Primary review confirmation/);

  manifest = integrateCodeSubtask(manifest, 'code-a', { primaryReviewed: true, now: 5 });
  assert.equal(manifest.tasks[0].status, 'integrated');
  assert.deepEqual(readySubtasks(manifest), ['code-b']);
  manifest = recordCodeWorktree(manifest, 'code-b', {
    baseCommit: 'b'.repeat(40), worktreePath: '/tmp/worktrees/code-b', now: 6,
  });
  manifest = transitionSubtask(manifest, 'code-b', 'running', { now: 7 });
  manifest = transitionSubtask(manifest, 'code-b', 'integration-pending', { now: 8 });
  assert.equal(manifest.status, 'integration-pending');
  manifest = integrateCodeSubtask(manifest, 'code-b', { primaryReviewed: true, now: 9 });
  assert.equal(manifest.status, 'completed');
});

test('cancellation stops queued tasks and waits for host termination confirmation', () => {
  let manifest = createRunManifest('cancel-run', [
    readOnlyTask('active-task'), readOnlyTask('queued-task'),
  ], { now: 1 });
  manifest = transitionSubtask(manifest, 'active-task', 'running', { now: 2 });
  manifest = cancelRun(manifest, { now: 3 });
  assert.equal(manifest.tasks.find((task) => task.id === 'active-task').status, 'cancel-requested');
  assert.equal(manifest.tasks.find((task) => task.id === 'queued-task').status, 'cancelled');
  assert.equal(manifest.status, 'cancel-requested');
  assert.deepEqual(readySubtasks(manifest), []);
  assert.throws(() => confirmTaskTermination(manifest, 'active-task', { now: 4 }), /Host termination confirmation/);
  assert.throws(() => retrySubtask(manifest, 'active-task', { primaryReviewed: true, now: 4 }), /confirmed failed/);

  manifest = confirmTaskTermination(manifest, 'active-task', { hostConfirmed: true, now: 4 });
  assert.equal(manifest.tasks.find((task) => task.id === 'active-task').status, 'cancelled');
  assert.equal(manifest.status, 'cancelled');
});

test('restart reconciliation is explicit and never treats a persisted running task as retryable', () => {
  let manifest = createRunManifest('restart-run', [readOnlyTask('interrupted')], { now: 1 });
  manifest = transitionSubtask(manifest, 'interrupted', 'running', { now: 2 });
  assert.equal(manifest.status, 'running');
  manifest = markNeedsReconciliation(manifest, 'interrupted', { now: 3 });
  assert.equal(manifest.tasks[0].status, 'needs-reconciliation');
  assert.equal(manifest.status, 'needs-reconciliation');
  assert.throws(() => transitionSubtask(manifest, 'interrupted', 'running', { now: 4 }), /Illegal/);
  assert.throws(() => retrySubtask(manifest, 'interrupted', { primaryReviewed: true, now: 4 }), /confirmed failed/);
  assert.throws(() => reconcileSubtask(manifest, 'interrupted', { outcome: 'completed', now: 4 }), /Primary reconciliation confirmation/);

  manifest = reconcileSubtask(manifest, 'interrupted', {
    primaryReviewed: true, outcome: 'completed', now: 4,
  });
  assert.equal(manifest.tasks[0].status, 'completed');
  assert.equal(manifest.status, 'completed');
});

test('retry requires primary review, preserves bounded attempt history, and unblocks descendants', () => {
  let manifest = createRunManifest('retry-run', [
    readOnlyTask('failed-parent'),
    readOnlyTask('dependent', { dependsOn: ['failed-parent'] }),
  ], { now: 1 });
  const failAttempt = (start, end) => {
    manifest = transitionSubtask(manifest, 'failed-parent', 'running', { now: start });
    manifest = transitionSubtask(manifest, 'failed-parent', 'failed', { now: end });
  };

  failAttempt(2, 3);
  assert.equal(manifest.tasks.find((task) => task.id === 'dependent').status, 'blocked');
  assert.throws(() => retrySubtask(manifest, 'failed-parent', { now: 4 }), /Primary review confirmation/);
  manifest = retrySubtask(manifest, 'failed-parent', { primaryReviewed: true, now: 4 });
  assert.equal(manifest.tasks.find((task) => task.id === 'dependent').status, 'blocked');
  manifest = transitionSubtask(manifest, 'failed-parent', 'running', { now: 5 });
  assert.equal(manifest.tasks.find((task) => task.id === 'dependent').status, 'blocked');
  manifest = transitionSubtask(manifest, 'failed-parent', 'completed', { now: 6 });
  assert.equal(manifest.tasks.find((task) => task.id === 'dependent').status, 'pending');
  assert.deepEqual(readySubtasks(manifest), ['dependent']);

  let capped = createRunManifest('attempt-cap-run', [readOnlyTask('retry-limit')], { now: 1 });
  for (let attempt = 1; attempt <= MAX_TASK_ATTEMPTS; attempt += 1) {
    capped = transitionSubtask(capped, 'retry-limit', 'running', { now: attempt * 2 });
    capped = transitionSubtask(capped, 'retry-limit', 'failed', { now: attempt * 2 + 1 });
    if (attempt < MAX_TASK_ATTEMPTS) {
      capped = retrySubtask(capped, 'retry-limit', { primaryReviewed: true, now: attempt * 2 + 2 });
    }
  }
  const failedParent = capped.tasks.find((task) => task.id === 'retry-limit');
  assert.equal(failedParent.attempts, MAX_TASK_ATTEMPTS);
  assert.deepEqual(failedParent.attemptHistory.map((attempt) => attempt.status), ['failed', 'failed', 'failed']);
  assert.ok(failedParent.attemptHistory.every((attempt) => !Object.hasOwn(attempt, 'output')));
  assert.throws(() => retrySubtask(capped, 'retry-limit', { primaryReviewed: true, now: 10 }), /attempt limit/);
});

test('manifest sidecar round-trips separately without changing workflow.json v1', () => {
  const directory = tempDirectory();
  const workflowFile = path.join(directory, '.specs', 'state', 'workflow.json');
  fs.mkdirSync(path.dirname(workflowFile), { recursive: true });
  const workflowBytes = Buffer.from('{"version":1,"state":"coding","history":[]}\n');
  fs.writeFileSync(workflowFile, workflowBytes);

  const manifest = graphManifest();
  const file = runManifestFile(directory, manifest.runId);
  assert.equal(file, path.join(directory, '.specs', 'state', 'parallel-runs', 'run-a.json'));
  saveRunManifest(directory, manifest);
  assert.deepEqual(loadRunManifest(directory, manifest.runId), manifest);
  assert.deepEqual(fs.readFileSync(workflowFile), workflowBytes);
  assert.equal(loadRunManifest(directory, 'missing-run'), null);

  for (const unsafe of ['../escape', '/tmp/escape', '.', '..', 'Uppercase']) {
    assert.throws(() => runManifestFile(directory, unsafe), TypeError);
  }
});

test('exclusive manifest creation holds the run lock and never replaces a duplicate run', () => {
  const directory = tempDirectory();
  const original = graphManifest();
  const file = runManifestFile(directory, original.runId);
  createRunManifestExclusive(directory, original);
  const originalBytes = fs.readFileSync(file);
  const duplicate = createRunManifest('run-a', [readOnlyTask('different-task')], { now: 20 });

  assert.throws(
    () => createRunManifestExclusive(directory, duplicate),
    (error) => error.code === 'ERR_PARALLEL_RUN_EXISTS',
  );
  assert.deepEqual(fs.readFileSync(file), originalBytes);
  assert.equal(inspectRunManifestLock(directory, original.runId), null);

  assert.throws(() => updateRunManifest(directory, original.runId, () => {
    createRunManifestExclusive(directory, duplicate);
    return original;
  }), (error) => error.code === 'ERR_PARALLEL_RUN_LOCKED');
  assert.deepEqual(fs.readFileSync(file), originalBytes);
  assert.equal(inspectRunManifestLock(directory, original.runId), null);
});

test('update holds an exclusive writer lock for the full read-modify-write transaction', () => {
  const directory = tempDirectory();
  const manifest = graphManifest();
  saveRunManifest(directory, manifest);

  const updated = updateRunManifest(directory, manifest.runId, (current) => {
    assert.throws(
      () => updateRunManifest(directory, manifest.runId, (nested) => nested),
      (error) => error.code === 'ERR_PARALLEL_RUN_LOCKED',
    );
    return transitionSubtask(current, 'leaf-a', 'running', { now: 11 });
  });
  assert.equal(updated.tasks.find((task) => task.id === 'leaf-a').status, 'running');
  assert.equal(loadRunManifest(directory, manifest.runId).updatedAt, 11);
  assert.equal(fs.existsSync(`${runManifestFile(directory, manifest.runId)}.lock`), false);
});

test('stale lock recovery requires primary confirmation, matching identity, and a dead local owner', () => {
  const directory = tempDirectory();
  const manifest = graphManifest();
  const file = runManifestFile(directory, manifest.runId);
  const lockFile = `${file}.lock`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const stale = {
    version: 1, token: 'a'.repeat(32), pid: process.pid,
    host: os.hostname(), createdAt: 1,
  };
  fs.writeFileSync(lockFile, `${JSON.stringify(stale)}\n`, { mode: 0o600 });

  assert.deepEqual(inspectRunManifestLock(directory, manifest.runId), stale);
  assert.throws(() => saveRunManifest(directory, manifest), (error) => error.code === 'ERR_PARALLEL_RUN_LOCKED');
  assert.throws(() => recoverRunManifestLock(directory, manifest.runId, {
    expectedToken: stale.token,
  }), /Primary confirmation/);
  assert.throws(() => recoverRunManifestLock(directory, manifest.runId, {
    primaryConfirmed: true, expectedToken: 'b'.repeat(32),
  }), /changed since it was inspected/);
  assert.throws(() => recoverRunManifestLock(directory, manifest.runId, {
    primaryConfirmed: true, expectedToken: stale.token,
  }), /still alive/);
  fs.writeFileSync(lockFile, `${JSON.stringify({ ...stale, host: 'foreign-host' })}\n`, { mode: 0o600 });
  assert.throws(() => recoverRunManifestLock(directory, manifest.runId, {
    primaryConfirmed: true, expectedToken: stale.token,
  }), /foreign-host/);

  const deadOwner = { ...stale, pid: 2147483647 };
  fs.writeFileSync(lockFile, `${JSON.stringify(deadOwner)}\n`, { mode: 0o600 });
  assert.deepEqual(recoverRunManifestLock(directory, manifest.runId, {
    primaryConfirmed: true, expectedToken: stale.token,
  }), { recovered: true, runId: manifest.runId, token: stale.token });
  assert.equal(inspectRunManifestLock(directory, manifest.runId), null);
  saveRunManifest(directory, manifest);
  assert.deepEqual(loadRunManifest(directory, manifest.runId), manifest);
});

test('competing recovery cannot unlink a fresh writer lock after recovering the stale lock', async () => {
  const directory = tempDirectory();
  const manifest = graphManifest();
  saveRunManifest(directory, manifest);
  const lockFile = `${runManifestFile(directory, manifest.runId)}.lock`;
  const stale = {
    version: 1, token: 'c'.repeat(32), pid: 2147483647,
    host: os.hostname(), createdAt: 1,
  };
  fs.writeFileSync(lockFile, `${JSON.stringify(stale)}\n`, { mode: 0o600 });

  const recovererReady = path.join(directory, 'recoverer-ready');
  const recovererRelease = path.join(directory, 'recoverer-release');
  const recoverer = startNode(recoveryChildScript, {
    directory, runId: manifest.runId, token: stale.token,
    readyFile: recovererReady, releaseFile: recovererRelease, pauseBeforeRemove: true,
  });
  let writer;
  let writerReleaseFile;
  try {
    await waitForFile(recovererReady, recoverer);
    assert.equal(fs.existsSync(`${lockFile}.coord`), true, 'recovery owns the coordination marker');

    const concurrentRecovery = await runRecoveryChild({
      directory, runId: manifest.runId, token: stale.token,
    });
    assert.equal(concurrentRecovery.error?.code, 'ERR_PARALLEL_RUN_LOCKED');
    assert.deepEqual(inspectRunManifestLock(directory, manifest.runId), stale);

    const racingWriter = startNode(writerChildScript, {
      directory, runId: manifest.runId,
      readyFile: path.join(directory, 'racing-writer-ready'),
      releaseFile: path.join(directory, 'racing-writer-release'),
    });
    const racingWriterResult = await racingWriter.closed;
    assert.equal(racingWriterResult.code, 0, racingWriterResult.stderr);
    assert.equal(JSON.parse(racingWriterResult.stdout.trim()).error?.code, 'ERR_PARALLEL_RUN_LOCKED');
    assert.deepEqual(inspectRunManifestLock(directory, manifest.runId), stale);

    fs.writeFileSync(recovererRelease, 'continue');
    const recovered = await recoverer.closed;
    assert.equal(recovered.code, 0, recovered.stderr);
    assert.deepEqual(JSON.parse(recovered.stdout.trim()).result, {
      recovered: true, runId: manifest.runId, token: stale.token,
    });
    assert.equal(fs.existsSync(`${lockFile}.coord`), false);

    const writerReady = path.join(directory, 'writer-ready');
    writerReleaseFile = path.join(directory, 'writer-release');
    writer = startNode(writerChildScript, {
      directory, runId: manifest.runId, readyFile: writerReady, releaseFile: writerReleaseFile,
    });
    await waitForFile(writerReady, writer);
    const fresh = inspectRunManifestLock(directory, manifest.runId);
    assert.notEqual(fresh.token, stale.token);
    assert.equal(fresh.pid, writer.child.pid);

    const delayedRecovery = await runRecoveryChild({
      directory, runId: manifest.runId, token: stale.token,
    });
    assert.match(delayedRecovery.error?.message ?? '', /changed since it was inspected/);
    assert.deepEqual(inspectRunManifestLock(directory, manifest.runId), fresh);

    fs.writeFileSync(writerReleaseFile, 'continue');
    const writerResult = await writer.closed;
    assert.equal(writerResult.code, 0, writerResult.stderr);
    assert.deepEqual(JSON.parse(writerResult.stdout.trim()), { ok: true });
    assert.equal(inspectRunManifestLock(directory, manifest.runId), null);
  } finally {
    if (recoverer.child.exitCode === null) {
      fs.writeFileSync(recovererRelease, 'continue');
      await recoverer.closed;
    }
    if (writer && writer.child.exitCode === null) {
      fs.writeFileSync(writerReleaseFile, 'continue');
      await writer.closed;
    }
  }
});

test('a stuck coordination marker fails closed with actionable diagnostics and remains unchanged', () => {
  const directory = tempDirectory();
  const manifest = graphManifest();
  const lockFile = `${runManifestFile(directory, manifest.runId)}.lock`;
  const coordinationPath = `${lockFile}.coord`;
  const stale = {
    version: 1, token: 'd'.repeat(32), pid: 2147483647,
    host: os.hostname(), createdAt: 1,
  };
  fs.mkdirSync(path.dirname(lockFile), { recursive: true });
  fs.writeFileSync(lockFile, `${JSON.stringify(stale)}\n`, { mode: 0o600 });
  fs.mkdirSync(coordinationPath);
  const markerFile = path.join(coordinationPath, 'owner');
  fs.writeFileSync(markerFile, 'coordinator marker\n');
  const markerStat = fs.lstatSync(coordinationPath);
  const markerBytes = fs.readFileSync(markerFile);
  const assertCoordinationError = (error) => {
    assert.equal(error.code, 'ERR_PARALLEL_RUN_LOCKED');
    assert.ok(error.message.includes(coordinationPath), 'diagnostic names the exact coordination path');
    assert.match(error.message, /automatic recovery is unsupported/i);
    assert.match(error.message, /do not delete or steal it blindly/i);
    return true;
  };

  assert.throws(() => recoverRunManifestLock(directory, manifest.runId, {
    primaryConfirmed: true, expectedToken: stale.token,
  }), assertCoordinationError);
  assert.throws(() => saveRunManifest(directory, manifest), assertCoordinationError);
  assert.deepEqual(inspectRunManifestLock(directory, manifest.runId), stale);
  const markerAfter = fs.lstatSync(coordinationPath);
  assert.equal(markerAfter.isDirectory(), true);
  assert.equal(markerAfter.dev, markerStat.dev);
  assert.equal(markerAfter.ino, markerStat.ino);
  assert.deepEqual(fs.readFileSync(markerFile), markerBytes);
});

test('atomic replacement preserves the old manifest and removes its temporary file on failure', () => {
  const directory = tempDirectory();
  const manifest = graphManifest();
  saveRunManifest(directory, manifest);
  const file = runManifestFile(directory, manifest.runId);
  const before = fs.readFileSync(file);
  const originalRename = fs.renameSync;
  fs.renameSync = function (source, destination, ...args) {
    if (destination === file) throw new Error('injected rename failure');
    return originalRename.call(this, source, destination, ...args);
  };
  try {
    assert.throws(
      () => saveRunManifest(directory, transitionSubtask(manifest, 'leaf-a', 'running', { now: 11 })),
      /injected rename failure/,
    );
  } finally {
    fs.renameSync = originalRename;
  }

  assert.deepEqual(fs.readFileSync(file), before);
  assert.equal(fs.existsSync(`${file}.lock`), false);
  assert.deepEqual(fs.readdirSync(path.dirname(file)), ['run-a.json']);
});
