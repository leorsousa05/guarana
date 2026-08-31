import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { initVault } from '../memory/vault.js';

// ADR-004 deployability: an INSTALLED copy of the plugin (plugin/guarana-memory.js
// copied verbatim to a foreign <config>/plugins/) must resolve the memory engine
// from its sibling <config>/memory/ (plugin's `../memory` resolution), not rely on
// the repo calling-into layout. Regression for the "memory engine not available"
// bug that only surfaced with standalone installs.
describe('GuaranaMemory standalone deploy (ADR-004)', () => {
  let tmpDir;
  let pluginsDir;
  let memoryDir;
  let projDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-deploy-'));
    pluginsDir = path.join(tmpDir, 'plugins');
    memoryDir = path.join(tmpDir, 'memory');
    fs.mkdirSync(pluginsDir, { recursive: true });
    fs.mkdirSync(memoryDir, { recursive: true });
    fs.writeFileSync(path.join(pluginsDir, 'package.json'), '{"type":"module"}\n');
    fs.copyFileSync(
      path.resolve('plugin/guarana-memory.js'),
      path.join(pluginsDir, 'guarana-memory.js')
    );
    for (const f of fs.readdirSync(path.resolve('memory'))) {
      const s = path.resolve('memory', f);
      if (fs.statSync(s).isFile()) fs.copyFileSync(s, path.join(memoryDir, f));
    }
    projDir = path.join(tmpDir, 'proj');
    fs.mkdirSync(projDir, { recursive: true });
    initVault(projDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('an installed plugin writes a confirmed decision via its sibling engine', async () => {
    const { GuaranaMemory } = await import(
      pathToFileURL(path.join(pluginsDir, 'guarana-memory.js')).href
    );
    const api = await GuaranaMemory({ directory: projDir });
    const raw = await api.tool.memory_save_decision.execute(
      {
        intent: 'choose storage for the deployed engine',
        decision: 'deploy cli/memory next to the plugin so ../memory resolves',
        rejectedAlternatives: ['bundling into the plugin file'],
        tags: ['deploy'],
      },
      {}
    );
    const res = JSON.parse(raw);
    assert.equal(res.type, 'decision');
    assert.equal(res.status, 'confirmed');
    assert.notEqual(res.error, 'memory engine not available');
    assert.ok(typeof res.id === 'string');
    const nodes = fs
      .readFileSync(path.join(projDir, '.guarana', 'memory', 'nodes.jsonl'), 'utf8')
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l));
    assert.ok(nodes.some((n) => n.id === res.id && n.status === 'confirmed'));
  });
});