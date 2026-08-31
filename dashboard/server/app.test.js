import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './app.js';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

describe('GET /api/telemetry/stream (SSE)', () => {
  let tmp;
  let telemetryDir;
  let eventsFile;
  let server;
  let base;

  beforeEach(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-sse-'));
    telemetryDir = path.join(tmp, '.specs', 'state', 'telemetry');
    fs.mkdirSync(telemetryDir, { recursive: true });
    eventsFile = path.join(telemetryDir, 'events.jsonl');
    const app = createApp({ root: tmp, distDir: path.join(tmp, 'dist') });
    await new Promise((resolve) => {
      server = app.listen(0, () => resolve());
    });
    base = `http://localhost:${server.address().port}`;
  });

  afterEach(async () => {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('pushes an event when the telemetry file changes', async () => {
    const controller = new AbortController();
    const res = await fetch(`${base}/api/telemetry/stream`, { signal: controller.signal });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/event-stream/);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let frames = 0;
    let onFrame = null;
    const waitForFrame = () =>
      new Promise((resolve) => {
        onFrame = resolve;
      });
    const pump = (async () => {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) return;
        buffer += decoder.decode(value);
        const parts = buffer.split('\n\n');
        buffer = parts.pop();
        for (const part of parts) {
          if (part.includes('data:')) {
            frames += 1;
            if (onFrame) {
              const resolve = onFrame;
              onFrame = null;
              resolve(frames);
            }
          }
        }
      }
    })();

    // Frame 1 is emitted immediately on connect.
    await waitForFrame();
    assert.equal(frames, 1);

    // A real file change must produce frame 2.
    fs.appendFileSync(eventsFile, '{"ts":1,"type":"tool","sessionID":"s1","ok":true}\n', 'utf8');
    const second = await Promise.race([
      waitForFrame(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('no SSE push within 3s of file change')), 3000)),
    ]);
    assert.equal(second, 2);

    controller.abort();
    await pump.catch(() => {});
  });
});
