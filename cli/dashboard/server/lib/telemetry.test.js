import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readJsonl, summarize } from './telemetry.js';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

describe('readJsonl', () => {
  it('returns empty array for missing file', () => {
    assert.deepEqual(readJsonl('/nonexistent/file.jsonl'), []);
  });

  it('parses valid lines and skips malformed lines', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-test-'));
    const file = path.join(dir, 'events.jsonl');
    fs.writeFileSync(file, '{"type":"tool","ts":1}\nnot json\n{"type":"tokens","ts":2}\n', 'utf8');
    const events = readJsonl(file);
    assert.equal(events.length, 2);
    assert.equal(events[0].type, 'tool');
    assert.equal(events[1].type, 'tokens');
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe('summarize', () => {
  it('aggregates events into per-session runs sorted by start desc', () => {
    const events = [
      { type: 'session', status: 'created', sessionID: 'a', ts: 1000 },
      { type: 'tool', sessionID: 'a', ts: 1100, ok: true },
      { type: 'tokens', sessionID: 'a', ts: 1200, tokens: 100 },
      { type: 'session', status: 'idle', sessionID: 'a', ts: 2000 },
      { type: 'tool', sessionID: 'b', ts: 3000, ok: false, error: 'boom' },
      { type: 'tokens', sessionID: 'b', ts: 3100, tokens: 50 },
      { type: 'session', status: 'error', sessionID: 'b', ts: 3200 },
    ];
    const runs = summarize(events);
    assert.equal(runs.length, 2);
    assert.equal(runs[0].sessionID, 'b'); // latest start first
    assert.equal(runs[0].toolCalls, 1);
    assert.equal(runs[0].errors, 2); // failed tool + error session
    assert.equal(runs[0].tokens, 50);
    assert.equal(runs[0].durationMs, 200);

    assert.equal(runs[1].sessionID, 'a');
    assert.equal(runs[1].toolCalls, 1);
    assert.equal(runs[1].errors, 0);
    assert.equal(runs[1].tokens, 100);
  });

  it('ignores events without sessionID', () => {
    const runs = summarize([{ type: 'tool', ts: 1, ok: true }]);
    assert.equal(runs.length, 0);
  });
});
