import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createSingleFlightRunner, pollIntervalFor } from './usePoll.js';

const hookDir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(hookDir, '../..');

test('poll runner skips interval overlap and coalesces manual refetches', async () => {
  const runner = createSingleFlightRunner();
  let active = 0;
  let maximumActive = 0;
  const finish = [];
  let requests = 0;
  runner.setTask(() => new Promise((resolve) => {
    requests += 1;
    active += 1;
    maximumActive = Math.max(maximumActive, active);
    finish.push(() => {
      active -= 1;
      resolve();
    });
  }));

  const first = runner.run(true);
  await runner.run();
  await runner.run();
  await runner.run(true);
  await runner.run(true);
  assert.equal(requests, 1, 'ticks and manual requests do not overlap the active fetch');

  finish[0]();
  await first;
  assert.equal(requests, 2, 'manual refetches coalesce into one follow-up');
  finish[1]();
  await Promise.resolve();
  assert.equal(active, 0);
  assert.equal(maximumActive, 1);
});

test('configured refresh intervals remain bounded and SSE ticks are not poll inputs', () => {
  for (const milliseconds of [5000, 15000, 30000]) {
    assert.equal(pollIntervalFor(5000, milliseconds), milliseconds);
  }
  assert.equal(pollIntervalFor(15000, 30000), 15000);

  const app = fs.readFileSync(path.join(webRoot, 'src/App.jsx'), 'utf8');
  assert.doesNotMatch(app, /useLiveTick|liveTick/);
  for (const file of ['hooks/usePoll.js', 'components/Activity.jsx', 'components/Overview.jsx',
    'components/MemoryInjections.jsx', 'components/Specs.jsx']) {
    assert.doesNotMatch(fs.readFileSync(path.join(webRoot, 'src', file), 'utf8'), /\btick\b/);
  }
});
