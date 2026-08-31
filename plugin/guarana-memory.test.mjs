import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { GuaranaMemory } from './guarana-memory.js';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { initVault, paths } from '../memory/vault.js';

describe('GuaranaMemory', () => {
  let tmpDir;
  let eventsFile;
  let api;
  const projectName = () => path.basename(tmpDir);
  const vaultDir = () => path.join(tmpDir, '.guarana', 'memory');
  const nodesFile = () => path.join(vaultDir(), 'nodes.jsonl');

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-mem-plugin-'));
    api = await GuaranaMemory({ directory: tmpDir });
    eventsFile = path.join(tmpDir, '.specs', 'state', 'telemetry', 'events.jsonl');
  });

  afterEach(() => {
    // restore perms in case a test made the vault read-only
    try {
      fs.chmodSync(nodesFile(), 0o644);
      fs.chmodSync(vaultDir(), 0o755);
    } catch { /* ignore */ }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function readEvents() {
    try {
      return fs.readFileSync(eventsFile, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
    } catch {
      return [];
    }
  }

  function readNodes() {
    try {
      return fs.readFileSync(nodesFile(), 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
    } catch {
      return [];
    }
  }

  async function simulateToolCall(input, output) {
    await api['tool.execute.before'](input.input, input.output || {});
    await api['tool.execute.after'](input.input, output);
  }

  // Criterion 8: tool.execute.after -> draft atom in the project vault
  describe('capture (criterion 8)', () => {
    it('appends a draft atom with intent/input/output/ts/projectHash', async () => {
      initVault(tmpDir);
      await simulateToolCall(
        { input: { tool: 'bash', sessionID: 's1', callID: 'c1' }, output: { args: { command: 'ls' } } },
        { output: 'file1\nfile2' }
      );
      const nodes = readNodes();
      assert.equal(nodes.length, 1);
      const n = nodes[0];
      assert.equal(n.type, 'atom');
      assert.equal(n.status, 'draft');
      assert.ok(n.intent.includes('bash'));
      assert.ok(n.input.includes('ls'));
      assert.ok(n.output.includes('file1'));
      assert.equal(typeof n.ts, 'number');
      assert.equal(typeof n.projectHash, 'string');
      assert.ok(n.projectHash.length > 0);
      const ev = readEvents().find((e) => e.type === 'memory-captured');
      assert.ok(ev);
      assert.equal(ev.project, projectName());
      assert.equal(ev.sessionID, 's1');
    });

    it('truncates oversized output', async () => {
      initVault(tmpDir);
      await simulateToolCall(
        { input: { tool: 'read', sessionID: 's1' }, output: { args: { file: 'big.txt' } } },
        { output: 'x'.repeat(5000) }
      );
      const n = readNodes()[0];
      assert.ok(n.output.length < 2100);
      assert.ok(n.output.includes('[truncated]'));
    });

    it('records file.edited as an atom', async () => {
      initVault(tmpDir);
      await api['file.edited']({ properties: { path: 'src/index.js', sessionID: 's9' } });
      const n = readNodes()[0];
      assert.ok(n.intent.includes('src/index.js'));
      assert.equal(n.status, 'draft');
    });

    it('session.created/session.idle write lifecycle telemetry only (no atoms)', async () => {
      initVault(tmpDir);
      await api['session.created']({ properties: { info: { id: 's2' } } });
      await api['session.idle']({ properties: { info: { id: 's2' } } });
      assert.equal(readNodes().length, 0);
      const evs = readEvents().filter((e) => e.type === 'memory-session');
      assert.equal(evs.length, 2);
      assert.equal(evs[0].status, 'created');
      assert.equal(evs[1].status, 'idle');
    });
  });

  // Criterion 9: sensitive content -> no secret verbatim + memory-filtered telemetry
  describe('security filtering (criterion 9)', () => {
    it('rejects a tool call containing an sk- API key', async () => {
      initVault(tmpDir);
      await simulateToolCall(
        { input: { tool: 'read', sessionID: 's3' } },
        { output: 'the key is sk-abc123def456 ok' }
      );
      assert.equal(readNodes().length, 0);
      const raw = fs.existsSync(nodesFile()) ? fs.readFileSync(nodesFile(), 'utf8') : '';
      assert.ok(!raw.includes('sk-abc123def456'));
      const ev = readEvents().find((e) => e.type === 'memory-filtered');
      assert.ok(ev);
      assert.equal(ev.reason, 'sensitive-content');
    });

    it('rejects .env-style blocks', async () => {
      initVault(tmpDir);
      await simulateToolCall(
        { input: { tool: 'read', sessionID: 's3' } },
        { output: 'DB_HOST=localhost\nDB_PASSWORD=hunter2\nPORT=5432' }
      );
      assert.equal(readNodes().length, 0);
      assert.ok(readEvents().some((e) => e.type === 'memory-filtered'));
    });

    it('rejects ghp_ GitHub tokens', async () => {
      initVault(tmpDir);
      await simulateToolCall(
        { input: { tool: 'bash', sessionID: 's3' } },
        { output: 'token: ghp_16charstringxx' }
      );
      assert.equal(readNodes().length, 0);
      const raw = fs.readFileSync(nodesFile(), 'utf8');
      assert.ok(!raw.includes('ghp_16charstringxx'));
      assert.ok(readEvents().some((e) => e.type === 'memory-filtered'));
    });
  });

  // Criterion 10: never throws on missing vault, malformed config, read-only FS
  describe('robustness (criterion 10)', () => {
    it('missing vault: skips silently, does not create it, logs memory-skipped once', async () => {
      await simulateToolCall(
        { input: { tool: 'bash', sessionID: 's4' }, output: { args: { command: 'ls' } } },
        { output: 'ok' }
      );
      await simulateToolCall(
        { input: { tool: 'bash', sessionID: 's4', callID: 'c2' }, output: { args: { command: 'pwd' } } },
        { output: 'ok' }
      );
      assert.ok(!fs.existsSync(vaultDir()));
      const skipped = readEvents().filter((e) => e.type === 'memory-skipped');
      assert.equal(skipped.length, 1);
      assert.equal(skipped[0].reason, 'vault-not-initialized');
    });

    it('malformed config.json: falls back to defaults, captures normally', async () => {
      initVault(tmpDir);
      fs.writeFileSync(paths(vaultDir()).config, '{ not json !!!', 'utf8');
      await simulateToolCall(
        { input: { tool: 'bash', sessionID: 's5' }, output: { args: { command: 'ls' } } },
        { output: 'ok' }
      );
      assert.equal(readNodes().length, 1);
    });

    it('capture.enabled=false skips capture', async () => {
      initVault(tmpDir);
      fs.writeFileSync(paths(vaultDir()).config, JSON.stringify({ capture: { enabled: false } }), 'utf8');
      await simulateToolCall(
        { input: { tool: 'bash', sessionID: 's6' }, output: { args: { command: 'ls' } } },
        { output: 'ok' }
      );
      assert.equal(readNodes().length, 0);
      const skipped = readEvents().filter((e) => e.type === 'memory-skipped');
      assert.equal(skipped.length, 1);
      assert.equal(skipped[0].reason, 'capture-disabled');
    });

    it('read-only vault: hook returns normally, records memory-error', async (t) => {
      if (typeof process.getuid === 'function' && process.getuid() === 0) {
        t.skip('root ignores file permissions');
        return;
      }
      initVault(tmpDir);
      fs.chmodSync(nodesFile(), 0o444);
      fs.chmodSync(vaultDir(), 0o555);
      await simulateToolCall(
        { input: { tool: 'bash', sessionID: 's7' }, output: { args: { command: 'ls' } } },
        { output: 'ok' }
      );
      assert.ok(readEvents().some((e) => e.type === 'memory-error'));
    });
  });
});
