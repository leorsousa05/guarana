import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { GuaranaTelemetry } from './guarana-telemetry.js';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

describe('GuaranaTelemetry', () => {
  let tmpDir;
  let eventsFile;
  let api;
  const projectName = () => path.basename(tmpDir);

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-plugin-'));
    api = await GuaranaTelemetry({ directory: tmpDir });
    eventsFile = path.join(tmpDir, '.specs', 'state', 'telemetry', 'events.jsonl');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function readEvents() {
    try {
      return fs
        .readFileSync(eventsFile, 'utf8')
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l));
    } catch {
      return [];
    }
  }

  describe('recordTokens via message.part.updated', () => {
    it('writes numeric token totals directly, tagged with the project', async () => {
      await api['message.part.updated']({ properties: { part: { tokens: 42, sessionID: 's1' } } });
      const events = readEvents();
      assert.equal(events.length, 1);
      assert.equal(events[0].type, 'tokens');
      assert.equal(events[0].tokens, 42);
      assert.equal(events[0].project, projectName());
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

    it('writes no event when there is no usable total', async () => {
      await api['message.part.updated']({
        properties: { part: { tokens: { input: 0, output: 0 }, sessionID: 's4' } },
      });
      assert.equal(readEvents().length, 0);
    });
  });

  describe('recordTokens via message.updated (assistant messages)', () => {
    it('records tokens from properties.info.tokens', async () => {
      await api.event({
        event: {
          type: 'message.updated',
          properties: {
            info: {
              sessionID: 's5',
              tokens: { input: 100, output: 200, reasoning: 0, cache: 50 },
              cost: 0.01,
              providerID: 'anthropic',
              modelID: 'claude',
            },
          },
        },
      });
      const events = readEvents();
      assert.equal(events.length, 1);
      assert.equal(events[0].tokens, 350);
      assert.equal(events[0].sessionID, 's5');
      assert.equal(events[0].cost, 0.01);
      assert.equal(events[0].project, projectName());
    });

    it('ignores message.updated without tokens (e.g. user messages)', async () => {
      await api.event({
        event: { type: 'message.updated', properties: { info: { sessionID: 's6' } } },
      });
      assert.equal(readEvents().length, 0);
    });
  });

  describe('project tagging', () => {
    it('tags tool events with the project basename', async () => {
      await api['tool.execute.after']({ tool: 'bash', sessionID: 's7' }, {});
      const ev = readEvents()[0];
      assert.equal(ev.project, projectName());
    });

    it('tags session events with the project basename', async () => {
      await api.event({
        event: { type: 'session.idle', properties: { info: { id: 's8' } } },
      });
      const ev = readEvents()[0];
      assert.equal(ev.project, projectName());
    });
  });

  describe('tool result error detection', () => {
    it('flags object { error } results as ok:false with the message', async () => {
      await api['tool.execute.after'](
        { tool: 'memory_save_decision', sessionID: 'e1' },
        { error: 'memory engine not available' }
      );
      const ev = readEvents()[0];
      assert.equal(ev.ok, false);
      assert.equal(ev.error, 'memory engine not available');
    });

    it('flags JSON-string { error } results (custom tool boundary) as ok:false', async () => {
      await api['tool.execute.after'](
        { tool: 'memory_save_decision', sessionID: 'e2' },
        { output: JSON.stringify({ error: 'memory engine not available' }) }
      );
      const ev = readEvents()[0];
      assert.equal(ev.ok, false);
      assert.equal(ev.error, 'memory engine not available');
    });

    it('treats a non-error JSON-string result as ok:true', async () => {
      await api['tool.execute.after'](
        { tool: 'memory_save_decision', sessionID: 'e3' },
        { output: JSON.stringify({ id: 'mem-x', status: 'confirmed' }) }
      );
      const ev = readEvents()[0];
      assert.equal(ev.ok, true);
      assert.equal(ev.error, undefined);
    });

    it('treats a plain string result as ok:true', async () => {
      await api['tool.execute.after']({ tool: 'bash', sessionID: 'e4' }, { output: 'all good' });
      const ev = readEvents()[0];
      assert.equal(ev.ok, true);
      assert.equal(ev.error, undefined);
    });
  });
});
