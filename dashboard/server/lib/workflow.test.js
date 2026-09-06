import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { current } from './workflow.js';
import { createApp } from '../app.js';

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-dash-wf-'));
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