import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readJsonl, summarize, advisorHistory } from './telemetry.js';
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

  it('caches unchanged reads, completes partial lines, and reloads rewrites and recovered files', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-cache-'));
    const file = path.join(dir, 'events.jsonl');
    fs.writeFileSync(file, '{"n":1}\n{"n":', 'utf8');
    assert.deepEqual(readJsonl(file), [{ n: 1 }]);
    const originalRead = fs.readSync;
    let bytesRead = 0;
    fs.readSync = function (...args) {
      const count = originalRead.apply(this, args);
      bytesRead += count;
      return count;
    };
    try {
      readJsonl(file);
      assert.equal(bytesRead, 0, 'unchanged snapshots must not read file bytes');
      fs.appendFileSync(file, '2}\nnot json\n{"n":3}\n', 'utf8');
      assert.deepEqual(readJsonl(file), [{ n: 1 }, { n: 2 }, { n: 3 }]);
      fs.writeFileSync(file, '{"n":4}\n{"n":5}\n', 'utf8');
      assert.deepEqual(readJsonl(file), [{ n: 4 }, { n: 5 }]);
      fs.truncateSync(file, 0);
      assert.deepEqual(readJsonl(file), []);
      fs.writeFileSync(file, '{"n":7}\n', 'utf8');
      assert.deepEqual(readJsonl(file), [{ n: 7 }]);
      const replacement = path.join(dir, 'replacement.jsonl');
      fs.writeFileSync(replacement, '{"n":8}\n', 'utf8');
      fs.renameSync(replacement, file);
      assert.deepEqual(readJsonl(file), [{ n: 8 }]);
      fs.unlinkSync(file);
      assert.deepEqual(readJsonl(file), []);
      fs.writeFileSync(file, '{"n":6}\n', 'utf8');
      assert.deepEqual(readJsonl(file), [{ n: 6 }]);
    } finally {
      fs.readSync = originalRead;
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('summarize', () => {
  it('aggregates events into per-session runs sorted by start desc', () => {
    const events = [
      { type: 'session', status: 'created', sessionID: 'a', ts: 1000, project: 'proj-x' },
      { type: 'tool', sessionID: 'a', ts: 1100, ok: true, project: 'proj-x' },
      { type: 'tokens', sessionID: 'a', ts: 1200, tokens: 100, project: 'proj-x' },
      { type: 'session', status: 'idle', sessionID: 'a', ts: 2000, project: 'proj-x' },
      { type: 'tool', sessionID: 'b', ts: 3000, ok: false, error: 'boom', project: 'proj-y' },
      { type: 'tokens', sessionID: 'b', ts: 3100, tokens: 50, project: 'proj-y' },
      { type: 'session', status: 'error', sessionID: 'b', ts: 3200, project: 'proj-y' },
    ];
    const runs = summarize(events);
    assert.equal(runs.length, 2);
    assert.equal(runs[0].sessionID, 'b'); // latest start first
    assert.equal(runs[0].toolCalls, 1);
    assert.equal(runs[0].errors, 2); // failed tool + error session
    assert.equal(runs[0].tokens, 50);
    assert.equal(runs[0].durationMs, 200);
    assert.equal(runs[0].project, 'proj-y');

    assert.equal(runs[1].sessionID, 'a');
    assert.equal(runs[1].toolCalls, 1);
    assert.equal(runs[1].errors, 0);
    assert.equal(runs[1].tokens, 100);
    assert.equal(runs[1].project, 'proj-x');
  });

  it('fills project from any later event when the first one lacks it', () => {
    const runs = summarize([
      { type: 'tool', sessionID: 'c', ts: 1, ok: true },
      { type: 'tokens', sessionID: 'c', ts: 2, tokens: 5, project: 'proj-z' },
    ]);
    assert.equal(runs[0].project, 'proj-z');
  });

  it('leaves project null when no event carries one (legacy events)', () => {
    const runs = summarize([{ type: 'tool', sessionID: 'c', ts: 1, ok: true }]);
    assert.equal(runs[0].project, null);
  });

  it('ignores events without sessionID', () => {
    const runs = summarize([{ type: 'tool', ts: 1, ok: true }]);
    assert.equal(runs.length, 0);
  });

  it('preserves observed session status, parent, and agent metadata', () => {
    const [run] = summarize([
      { type: 'session', status: 'created', sessionID: 'child', parentSessionID: 'root', agent: 'worker-code', ts: 1 },
      { type: 'session', status: 'busy', sessionID: 'child', ts: 2 },
    ]);
    assert.equal(run.parentSessionID, 'root');
    assert.equal(run.agent, 'worker-code');
    assert.equal(run.status, 'busy');
  });
});

describe('advisorHistory', () => {
  it('joins dispatch and execution events, collapses child turns, and exposes only safe fields', () => {
    const history = advisorHistory([
      { ts: 1, type: 'advisor-dispatch', status: 'dispatched', callID: 'call-1', parentSessionID: 'root', reason: 'Compare failed retry options' },
      { ts: 3, type: 'advisor-execution', status: 'completed', childSessionID: 'child', parentSessionID: 'root', providerID: 'old-provider', modelID: 'old-model', prompt: 'SECRET', reason: 'sk-legacysecret' },
      { ts: 4, type: 'advisor-execution', status: 'error', childSessionID: 'child', parentSessionID: 'root', providerID: 'new-provider', modelID: 'new-model', variant: 'low', output: 'SECRET', credential: 'SECRET' },
      { ts: 5, type: 'advisor-dispatch', status: 'completed', callID: 'call-1', parentSessionID: 'root', childSessionID: 'child' },
    ]);
    assert.deepEqual(history, [{
      ts: 1, status: 'error', callID: 'call-1', parentSessionID: 'root', childSessionID: 'child',
      providerID: 'new-provider', modelID: 'new-model', variant: 'low', reason: 'Compare failed retry options',
    }]);
    assert.doesNotMatch(JSON.stringify(history), /SECRET|prompt|output|credential/i);
  });

  it('omits secret-shaped legacy dispatch reasons', () => {
    const history = advisorHistory([
      { ts: 1, type: 'advisor-dispatch', status: 'dispatched', callID: 'unsafe-call', reason: 'ghp_privatevalue' },
      { ts: 2, type: 'advisor-dispatch', status: 'completed', callID: 'unsafe-call', reason: 'api_key=privatevalue' },
    ]);
    assert.deepEqual(history, [{ ts: 1, status: 'completed', callID: 'unsafe-call' }]);
    assert.doesNotMatch(JSON.stringify(history), /privatevalue|reason/i);
  });

  it('bounds the requested history and reports observed running Advisor sessions', () => {
    const rows = advisorHistory([
      { ts: 10, type: 'session', status: 'busy', sessionID: 'child', parentSessionID: 'root', agent: 'guarana-advisor' },
      ...Array.from({ length: 5 }, (_, index) => ({ ts: index + 2, type: 'advisor-dispatch', status: 'completed', callID: `call-${index}` })),
    ], 2);
    assert.equal(rows.length, 2);
    assert.ok(rows.some((row) => row.status === 'running'));
  });
});
