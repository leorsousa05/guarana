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

  it('records one sanitized completed Advisor execution correlated to its parent', async () => {
    await api.event({ event: { type: 'session.created', properties: { info: { id: 'advisor-child-proof', parentID: 'parent-proof' } } } });
    const completed = { role: 'assistant', agent: 'guarana-advisor', sessionID: 'advisor-child-proof', time: { completed: 123 }, providerID: 'openai', modelID: 'gpt-proof', variant: 'high', prompt: 'PRIVATE PROMPT', output: 'PRIVATE OUTPUT', apiKey: 'PRIVATE CREDENTIAL' };
    await api.event({ event: { type: 'message.updated', properties: { info: completed } } });
    await api.event({ event: { type: 'message.updated', properties: { info: completed } } });
    const events = readEvents().filter((event) => event.type === 'advisor-execution');
    assert.equal(events.length, 1);
    assert.deepEqual(events[0], { project: projectName(), ts: events[0].ts, type: 'advisor-execution', childSessionID: 'advisor-child-proof', status: 'completed', parentSessionID: 'parent-proof', providerID: 'openai', modelID: 'gpt-proof', variant: 'high' });
    const created = readEvents().find((event) => event.type === 'session' && event.status === 'created');
    assert.equal(created.sessionID, 'advisor-child-proof');
    assert.equal(created.parentSessionID, 'parent-proof');
    assert.doesNotMatch(JSON.stringify(events[0]), /PRIVATE|prompt|output|apiKey|tokens|cost/i);
  });

  it('does not use an assistant message parentID as a parent session ID', async () => {
    await api.event({ event: { type: 'message.updated', properties: { info: {
      role: 'assistant', agent: 'guarana-advisor', sessionID: 'advisor-unmapped-proof',
      time: { completed: 125 }, parentID: 'parent-message', providerID: 'openai', modelID: 'gpt-proof',
    } } } });
    const event = readEvents().find((row) => row.type === 'advisor-execution');
    assert.equal(event.parentSessionID, undefined);
  });

  it('does not infer an omitted Advisor runtime variant', async () => {
    await api.event({ event: { type: 'message.updated', properties: { info: { role: 'assistant', agent: 'guarana-advisor', sessionID: 'advisor-no-variant-proof', time: { completed: 124 }, providerID: 'openai', modelID: 'gpt-proof' } } } });
    const event = readEvents().find((row) => row.type === 'advisor-execution');
    assert.equal(event.variant, undefined);
  });

  it('records only safe native Advisor Task dispatch metadata and observed session status', async () => {
    const before = { tool: 'task', sessionID: 'root-session', callID: 'advisor-call-1' };
    await api['tool.execute.before'](before, { args: { subagent_type: 'guarana-advisor', prompt: 'PRIVATE PROMPT', description: 'Compare failed retry options' } });
    await api['tool.execute.after'](before, {
      metadata: { sessionID: 'advisor-child' },
      error: 'PRIVATE ERROR',
      output: 'PRIVATE OUTPUT',
    });
    await api.event({ event: { type: 'session.created', properties: { info: { id: 'root-session', agent: 'primary', parentID: null } } } });
    await api.event({ event: { type: 'session.status', properties: { info: { id: 'root-session', status: { type: 'busy' } } } } });
    const events = readEvents();
    const dispatch = events.filter((event) => event.type === 'advisor-dispatch');
    assert.deepEqual(dispatch.map(({ status }) => status), ['dispatched', 'error']);
    assert.deepEqual(dispatch.map(({ reason }) => reason), ['Compare failed retry options', 'Compare failed retry options']);
    assert.equal(dispatch[0].parentSessionID, 'root-session');
    assert.equal(dispatch[1].callID, 'advisor-call-1');
    assert.equal(dispatch[1].childSessionID, 'advisor-child');
    assert.equal(events.find((event) => event.type === 'session' && event.status === 'busy').sessionID, 'root-session');
    assert.doesNotMatch(JSON.stringify(events), /PRIVATE|prompt|description|output/i);
  });

  it('omits secret-shaped Advisor Task descriptions', async () => {
    const descriptions = [
      'Inspect sk-privatevalue now',
      'Review ghp_privatevalue issue',
      'Check api_key=privatevalue now',
      'Check bearer privatevalue now',
    ];
    for (const [index, description] of descriptions.entries()) {
      const input = { tool: 'task', sessionID: 'root-session', callID: `advisor-secret-call-${index}` };
      await api['tool.execute.before'](input, { args: { subagent_type: 'guarana-advisor', prompt: 'PRIVATE PROMPT', description } });
    }
    const events = readEvents().filter((event) => event.type === 'advisor-dispatch');
    assert.equal(events.length, descriptions.length);
    assert.ok(events.every((event) => event.reason === undefined));
    assert.doesNotMatch(JSON.stringify(events), /privatevalue|PRIVATE PROMPT|prompt/i);
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
