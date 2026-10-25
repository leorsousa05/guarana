import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createApp } from '../app.js';

const ACTIVE_PATH = '/api/session/active';
const SESSIONS_PATH = '/api/session?limit=100&order=desc';

async function withServer(execFileImpl, run) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-opencode-active-'));
  const root = path.join(tmp, 'project');
  fs.mkdirSync(root, { recursive: true });
  const app = createApp({ root, distDir: path.join(tmp, 'dist'), execFileImpl });
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, () => resolve(listener));
  });
  const base = `http://localhost:${server.address().port}`;
  try {
    await run({ base, root });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

function requestOutputs(outputs, calls) {
  return (executable, args, options, callback) => {
    calls.push({ executable, args, options });
    const output = outputs[args[2]];
    callback(output?.error || null, output?.stdout ?? '', output?.stderr ?? '');
  };
}

test('active-subagents projects distinct explicitly linked busy/running sessions only', async () => {
  const calls = [];
  const outputs = {
    [ACTIVE_PATH]: { stdout: JSON.stringify({ data: {
      busy: { type: 'busy' },
      running: { type: 'running' },
      idle: { type: 'idle' },
      noParent: { type: 'busy' },
      noAgent: { type: 'running' },
      whitespace: { type: 'busy' },
      unlisted: { type: 'running' },
    } }) },
    [SESSIONS_PATH]: { stdout: JSON.stringify({ data: [
      { id: 'busy', parentID: 'parent-1', agent: 'worker', title: 'PRIVATE_TITLE', prompt: 'PRIVATE_PROMPT' },
      { id: 'busy', parentID: 'parent-1', agent: 'worker' },
      { id: 'running', parentID: 'parent-2', agent: 'verify' },
      { id: 'idle', parentID: 'parent-3', agent: 'worker' },
      { id: 'noParent', parentID: '', agent: 'worker' },
      { id: 'noAgent', parentID: 'parent-4', agent: '' },
      { id: 'whitespace', parentID: '  ', agent: 'worker' },
      { id: 'missing-agent', parentID: 'parent-5' },
    ] }) },
  };

  await withServer(requestOutputs(outputs, calls), async ({ base, root }) => {
    const response = await fetch(`${base}/api/opencode/active-subagents`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.available, true);
    assert.equal(body.runningCount, 2);
    assert.deepEqual(body.workers.map(({ agent, status }) => ({ agent, status })), [
      { agent: 'worker', status: 'busy' },
      { agent: 'verify', status: 'running' },
    ]);
    assert.deepEqual(Object.keys(body).sort(), ['available', 'runningCount', 'workers']);
    assert.doesNotMatch(JSON.stringify(body), /parent-1|parent-2|PRIVATE_TITLE|PRIVATE_PROMPT/);
    assert.match(JSON.stringify(body), /worker|busy/);
    assert.doesNotMatch(JSON.stringify(body), /PRIVATE_TITLE|PRIVATE_PROMPT/);
    assert.equal(calls.length, 2);
    assert.deepEqual(calls.map(({ args }) => args).sort((a, b) => a[2].localeCompare(b[2])), [
      ['api', 'get', ACTIVE_PATH],
      ['api', 'get', SESSIONS_PATH],
    ].sort((a, b) => a[2].localeCompare(b[2])));
    for (const call of calls) {
      assert.equal(call.executable, process.env.OPENCODE_BIN || 'opencode');
      assert.equal(call.options.cwd, root);
      assert.equal(call.options.shell, false);
      assert.ok(call.options.timeout > 0 && call.options.timeout <= 5000);
      assert.ok(call.options.maxBuffer > 0 && call.options.maxBuffer <= 4 * 1024 * 1024);
    }
  });
});

test('active-subagents preserves a valid zero as available', async () => {
  const outputs = {
    [ACTIVE_PATH]: { stdout: JSON.stringify({}) },
    [SESSIONS_PATH]: { stdout: JSON.stringify([]) },
  };
  await withServer(requestOutputs(outputs, []), async ({ base }) => {
    const response = await fetch(`${base}/api/opencode/active-subagents`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { available: true, runningCount: 0, workers: [] });
  });
});

test('active-subagents returns opaque stable workers with safe newest-first matching activity', async () => {
  const privateSessionID = 'SESSION_PRIVATE_DO_NOT_LEAK';
  const calls = [];
  const outputs = {
    [ACTIVE_PATH]: { stdout: JSON.stringify({ data: {
      [privateSessionID]: { type: 'busy' },
      runningSession: { type: 'running' },
      secretAgent: { type: 'busy' },
      duplicate: { type: 'running' },
      noParent: { type: 'busy' },
      idle: { type: 'idle' },
    } }) },
    [SESSIONS_PATH]: { stdout: JSON.stringify({ data: [
      { id: privateSessionID, parentID: 'PARENT_PRIVATE_DO_NOT_LEAK', agent: 'worker-one', title: 'PRIVATE_TITLE', prompt: 'PRIVATE_PROMPT', time: { created: 1000, updated: 2000 } },
      { id: privateSessionID, parentID: 'another-parent', agent: 'duplicate-agent' },
      { id: 'runningSession', parentID: 'parent-running', agent: 'verify_worker', time: { created: '3000', updated: 1e100 } },
      { id: 'secretAgent', parentID: 'parent-secret', agent: 'api_key' },
      { id: 'duplicate', parentID: 'parent-duplicate', agent: 'worker two' },
      { id: 'noParent', parentID: '  ', agent: 'worker' },
      { id: 'idle', parentID: 'parent-idle', agent: 'worker' },
    ] }) },
  };
  const eventRows = [
    ...Array.from({ length: 25 }, (_, index) => ({
      ts: index + 1,
      type: 'workflow',
      status: index === 24 ? 'busy' : 'PRIVATE_STATUS',
      sessionID: privateSessionID,
      note: 'PRIVATE_NOTE',
      task: 'PRIVATE_TASK',
    })),
    { ts: 30, type: 'tool', status: 'private-status', tool: 'read_file', ok: true, sessionID: privateSessionID, args: 'PRIVATE_ARGS', output: 'PRIVATE_OUTPUT' },
    { ts: 40, type: 'tool', tool: 'api_key=PRIVATE_CREDENTIAL', ok: false, sessionID: privateSessionID, error: 'PRIVATE_ERROR' },
    { ts: 50, type: 'secret-event', status: 'error', sessionID: privateSessionID, prompt: 'PRIVATE_PROMPT' },
    { ts: 60, type: 'session', status: 'error', sessionID: 'unrelated-session', prompt: 'PRIVATE_OTHER_SESSION' },
    { ts: 'invalid', type: 'todo', status: 'completed', sessionID: privateSessionID, todo: 'PRIVATE_TODO' },
    { ts: 100, type: 'session', status: 'running', sessionID: 'runningSession', parentSessionID: 'PRIVATE_PARENT_EVENT', output: 'PRIVATE_OUTPUT' },
  ];

  await withServer(requestOutputs(outputs, calls), async ({ base, root }) => {
    const telemetryDir = path.join(root, '.specs', 'state', 'telemetry');
    fs.mkdirSync(telemetryDir, { recursive: true });
    fs.writeFileSync(path.join(telemetryDir, 'events.jsonl'), `${eventRows.map((row) => JSON.stringify(row)).join('\n')}\n`);

    const first = await (await fetch(`${base}/api/opencode/active-subagents`)).json();
    const second = await (await fetch(`${base}/api/opencode/active-subagents`)).json();
    assert.equal(first.available, true);
    assert.equal(first.runningCount, 4);
    assert.equal(first.workers.length, 2);
    assert.deepEqual(first.workers.map(({ agent, status, createdAt, updatedAt }) => ({ agent, status, createdAt, updatedAt })), [
      { agent: 'worker-one', status: 'busy', createdAt: 1000, updatedAt: 2000 },
      { agent: 'verify_worker', status: 'running', createdAt: null, updatedAt: null },
    ]);
    assert.deepEqual(first.workers.map((worker) => worker.key), second.workers.map((worker) => worker.key));
    assert.match(first.workers[0].key, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    assert.notEqual(first.workers[0].key, privateSessionID);
    assert.equal(first.workers[0].activity.length, 20);
    assert.equal(first.workers[0].activity[0].ts, 40);
    assert.deepEqual(first.workers[0].activity[0], { ts: 40, type: 'tool', status: 'error', ok: false });
    assert.deepEqual(first.workers[0].activity[1], { ts: 30, type: 'tool', status: 'ok', tool: 'read_file', ok: true });
    assert.deepEqual(first.workers[0].activity[2], { ts: 25, type: 'workflow', status: 'busy' });
    assert.deepEqual(first.workers[0].activity.at(-1), { ts: 8, type: 'workflow', status: 'observed' });
    assert.deepEqual(first.workers[1].activity, [{ ts: 100, type: 'session', status: 'running' }]);
    assert.deepEqual(Object.keys(first.workers[0]).sort(), ['activity', 'agent', 'createdAt', 'key', 'status', 'updatedAt']);
    assert.deepEqual(Object.keys(first.workers[0].activity[1]).sort(), ['ok', 'status', 'tool', 'ts', 'type']);
    assert.doesNotMatch(JSON.stringify(first), /SESSION_PRIVATE|PARENT_PRIVATE|PRIVATE_|parent-running|parent-secret/);
    assert.doesNotMatch(JSON.stringify(first), /secretAgent|api_key|worker two|duplicate-agent/);
    assert.equal(calls.length, 4);
  });
});

test('active-subagents bounds the returned worker list to the public session limit', async () => {
  const sessions = Array.from({ length: 101 }, (_, index) => ({
    id: `session-${index}`, parentID: 'parent', agent: 'worker', time: { created: index, updated: index + 1 },
  }));
  const active = Object.fromEntries(sessions.map((session, index) => [session.id, { type: index % 2 ? 'running' : 'busy' }]));
  const outputs = {
    [ACTIVE_PATH]: { stdout: JSON.stringify(active) },
    [SESSIONS_PATH]: { stdout: JSON.stringify(sessions) },
  };
  await withServer(requestOutputs(outputs, []), async ({ base }) => {
    const body = await (await fetch(`${base}/api/opencode/active-subagents`)).json();
    assert.equal(body.available, true);
    assert.equal(body.runningCount, 101);
    assert.equal(body.workers.length, 100);
    assert.equal(new Set(body.workers.map((worker) => worker.key)).size, 100);
  });
});

test('active-subagents returns the privacy-safe unavailable shape for malformed output and command failures', async () => {
  let mode = 'malformed-json';
  const calls = [];
  const execFileImpl = (executable, args, options, callback) => {
    calls.push({ executable, args, options });
    if (mode === 'malformed-json') {
      callback(null, args[2] === ACTIVE_PATH ? '{not json SECRET_SESSION' : '[]', 'SECRET_STDERR');
    } else if (mode === 'malformed-shape') {
      callback(null, args[2] === ACTIVE_PATH ? '{"data":[]}' : '[]', 'SECRET_STDERR');
    } else {
      callback(Object.assign(new Error('PRIVATE_RAW_ERROR /secret/path'), { code: mode === 'missing' ? 'ENOENT' : 'ETIMEDOUT' }),
        'PRIVATE_RAW_OUTPUT', 'PRIVATE_STDERR');
    }
  };

  await withServer(execFileImpl, async ({ base }) => {
    for (const nextMode of ['malformed-json', 'malformed-shape', 'error', 'missing']) {
      mode = nextMode;
      calls.length = 0;
      const response = await fetch(`${base}/api/opencode/active-subagents`);
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.deepEqual(body, { available: false, runningCount: 0 });
      assert.deepEqual(Object.keys(body).sort(), ['available', 'runningCount']);
      assert.doesNotMatch(JSON.stringify(body), /SECRET|PRIVATE|ENOENT|ETIMEDOUT|secret\/path/);
      assert.equal(calls.length, 2);
    }
  });
});
