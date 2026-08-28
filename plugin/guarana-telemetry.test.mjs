import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { GuaranaTelemetry } from './guarana-telemetry.js';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

describe('GuaranaTelemetry recordTokens', () => {
  let tmpDir;
  let eventsFile;
  let api;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-plugin-'));
    api = await GuaranaTelemetry({ directory: tmpDir });
    eventsFile = path.join(tmpDir, '.specs', 'state', 'telemetry', 'events.jsonl');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function readEvents() {
    return fs
      .readFileSync(eventsFile, 'utf8')
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l));
  }

  it('writes numeric token totals directly', async () => {
    await api['message.part.updated']({ properties: { part: { tokens: 42, sessionID: 's1' } } });
    const events = readEvents();
    assert.equal(events.length, 1);
    assert.equal(events[0].type, 'tokens');
    assert.equal(events[0].tokens, 42);
  });

  it('sums object token fields', async () => {
    await api['message.part.updated']({
      properties: {
        part: {
          tokens: { input: 10, output: 20, reasoning: 5, cache: 3 },
          sessionID: 's2',
        },
      },
    });
    const ev = readEvents()[0];
    assert.equal(ev.tokens, 38);
  });

  it('uses total field when present', async () => {
    await api['message.part.updated']({
      properties: { part: { tokens: { total: 99, input: 1 }, sessionID: 's3' } },
    });
    const ev = readEvents()[0];
    assert.equal(ev.tokens, 99);
  });

  it('does not write tokens when total is zero', async () => {
    await api['message.part.updated']({
      properties: { part: { tokens: { input: 0, output: 0 }, sessionID: 's4' } },
    });
    const ev = readEvents()[0];
    assert.equal('tokens' in ev, false);
  });
});
