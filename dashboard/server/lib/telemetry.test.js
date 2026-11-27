import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readJsonl, summarize, summaryForFile, eventsForFile, advisorHistory, advisorHistoryForFile, learningReviewHistory, learningReviewHistoryForFile } from './telemetry.js';
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
      fs.writeFileSync(file, '{"n":10}\n{"n":11}\n{"n":12}\n', 'utf8');
      assert.deepEqual(readJsonl(file), [{ n: 10 }, { n: 11 }, { n: 12 }]);
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

describe('file-derived telemetry indexes', () => {
  it('reuses derived work for a representative 28 MB snapshot and incrementally indexes appends', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-large-telemetry-'));
    const file = path.join(dir, 'events.jsonl');
    const targetBytes = 28_347_021;
    const event = { type: 'tool', sessionID: 'large-session', ts: 10, ok: true, payload: 'x'.repeat(100) };
    const line = `${JSON.stringify(event)}\n`;
    const lineBytes = Buffer.byteLength(line);
    const completeLines = Math.ceil(targetBytes / lineBytes);
    const contents = line.repeat(completeLines);
    const fileBytes = Buffer.byteLength(contents);
    assert.ok(fileBytes >= targetBytes && fileBytes < targetBytes + lineBytes);
    fs.writeFileSync(file, contents);

    const originalRead = fs.readSync;
    let bytesRead = 0;
    fs.readSync = function (...args) {
      const count = originalRead.apply(this, args);
      bytesRead += count;
      return count;
    };
    try {
      const initialRuns = summaryForFile(file);
      const initialEvents = eventsForFile(file, ['large-session'], 3);
      const initialAdvisor = advisorHistoryForFile(file, 10);
      assert.equal(initialRuns[0].eventCount, completeLines);
      assert.equal(initialRuns[0].toolCalls, initialRuns[0].eventCount);
      assert.equal(initialEvents.length, 3);
      assert.equal(bytesRead, fileBytes);

      const repeatedRuns = summaryForFile(file);
      const repeatedEvents = eventsForFile(file, ['large-session'], 3);
      const repeatedAdvisor = advisorHistoryForFile(file, 10);
      assert.strictEqual(repeatedRuns, initialRuns);
      assert.strictEqual(repeatedEvents, initialEvents);
      assert.strictEqual(repeatedAdvisor, initialAdvisor);
      assert.equal(bytesRead, fileBytes, 'unchanged requests must not reread file bytes');

      fs.appendFileSync(file, [
        JSON.stringify({ type: 'tool', sessionID: 'large-session', ts: 20, ok: false, tokens: 5 }),
        JSON.stringify({ type: 'session', sessionID: 'new-session', status: 'running', ts: 30, project: 'new-project' }),
      ].join('\n') + '\n');
      const updatedRuns = summaryForFile(file);
      assert.notStrictEqual(updatedRuns, initialRuns);
      assert.equal(updatedRuns.find((run) => run.sessionID === 'large-session').eventCount, initialRuns[0].eventCount + 1);
      assert.equal(updatedRuns.find((run) => run.sessionID === 'large-session').errors, 1);
      assert.equal(updatedRuns.find((run) => run.sessionID === 'new-session').project, 'new-project');
      assert.deepEqual(eventsForFile(file, ['large-session'], 1), [
        { type: 'tool', sessionID: 'large-session', ts: 20, ok: false, tokens: 5 },
      ]);
      assert.deepEqual(eventsForFile(file, ['new-session']), [
        { type: 'session', sessionID: 'new-session', status: 'running', ts: 30, project: 'new-project' },
      ]);
      assert.deepEqual(summaryForFile(file), summarize(readJsonl(file)));
    } finally {
      fs.readSync = originalRead;
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rebuilds all indexes after in-place rewrites and keeps per-file snapshots separate', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-rewritten-telemetry-'));
    const firstFile = path.join(dir, 'first.jsonl');
    const secondFile = path.join(dir, 'second.jsonl');
    try {
      fs.writeFileSync(firstFile, `${JSON.stringify({ type: 'tool', sessionID: 'old', ts: 1 })}\n`);
      fs.writeFileSync(secondFile, `${JSON.stringify({ type: 'tool', sessionID: 'other-project', ts: 2 })}\n`);
      const firstSummary = summaryForFile(firstFile);
      assert.equal(firstSummary[0].sessionID, 'old');
      assert.equal(summaryForFile(secondFile)[0].sessionID, 'other-project');

      fs.writeFileSync(firstFile, [
        { type: 'session', sessionID: 'rewritten', status: 'idle', ts: 10 },
        { type: 'tool', sessionID: 'rewritten', ts: 11 },
        { type: 'tool', sessionID: 'rewritten', ts: 12 },
      ].map((row) => JSON.stringify(row)).join('\n') + '\n');
      assert.deepEqual(eventsForFile(firstFile, ['old']), []);
      assert.deepEqual(eventsForFile(firstFile, ['rewritten']).map((row) => row.ts), [10, 11, 12]);
      assert.equal(summaryForFile(firstFile)[0].eventCount, 3);
      assert.equal(summaryForFile(secondFile)[0].sessionID, 'other-project');
    } finally {
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

  it('merges late metadata into an observed running session without replacing status or status timestamp', () => {
    const [run] = summarize([
      { type: 'session', status: 'running', sessionID: 'late-child', ts: 200 },
      { type: 'session', sessionID: 'late-child', parentSessionID: 'parent', agent: 'worker-code', ts: 300 },
    ]);
    assert.equal(run.parentSessionID, 'parent');
    assert.equal(run.agent, 'worker-code');
    assert.equal(run.status, 'running');
    assert.equal(run.statusTs, 200);
  });

  it('does not let a later-listed stale lifecycle status replace newer running status', () => {
    const [run] = summarize([
      { type: 'session', status: 'running', sessionID: 'child', ts: 200 },
      { type: 'session', status: 'idle', sessionID: 'child', ts: 100 },
    ]);
    assert.equal(run.status, 'running');
    assert.equal(run.statusTs, 200);
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

describe('learningReviewHistory', () => {
  it('projects allow-listed outcomes, keeps unknown cost distinct from zero, and bounds newest-first history', () => {
    const events = [
      { ts: 1, type: 'learning-review-outcome', status: 'success', tokens: 4, cost: 0, summary: 'PRIVATE', taskIdentity: 'PRIVATE', proposal: { secret: 'PRIVATE' } },
      { ts: 3, type: 'learning-review-outcome', status: 'proposal', tokens: 10 },
      { ts: 2, type: 'learning-review-outcome', status: 'failure', tokens: null, cost: null, error: 'PRIVATE' },
      { ts: 4, type: 'learning-review-outcome', status: 'unknown', tokens: 9, cost: 2 },
    ];
    const rows = learningReviewHistory(events, 2);
    assert.deepEqual(rows, [
      { ts: 3, status: 'proposal', providerID: null, modelID: null, tokens: 10, cost: null },
      { ts: 2, status: 'failure', providerID: null, modelID: null, tokens: null, cost: null },
    ]);
    assert.equal(learningReviewHistory(events)[2].cost, 0);
    assert.doesNotMatch(JSON.stringify(learningReviewHistory(events)), /PRIVATE|taskIdentity|"error"|secret/);
  });

  it('reads historical receipts from files without altering Advisor projection', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-review-history-'));
    const file = path.join(dir, 'events.jsonl');
    try {
      fs.writeFileSync(file, [
        { ts: 1, type: 'advisor-dispatch', status: 'completed', callID: 'legacy' },
        { ts: 2, type: 'learning-review-outcome', status: 'no_change', tokens: 0, cost: 0 },
      ].map(JSON.stringify).join('\n') + '\n');
      assert.deepEqual(learningReviewHistoryForFile(file), [
        { ts: 2, status: 'no_change', providerID: null, modelID: null, tokens: 0, cost: 0 },
      ]);
      assert.equal(advisorHistoryForFile(file)[0].callID, 'legacy');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
