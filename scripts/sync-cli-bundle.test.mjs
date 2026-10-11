import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { it } from 'node:test';
import { syncCliBundle } from './sync-cli-bundle.mjs';

it('syncs generated files while preserving destination node_modules', (t) => {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-cli-bundle-'));
  t.after(() => fs.rmSync(fixtureRoot, { recursive: true, force: true }));

  const sourceRoot = path.join(fixtureRoot, 'source');
  const destRoot = path.join(fixtureRoot, 'cli');
  const sourceNested = path.join(sourceRoot, 'feature', 'subdir');
  const destNested = path.join(destRoot, 'feature', 'subdir');
  const sourceRootModules = path.join(sourceRoot, 'node_modules');
  const sourceNestedModules = path.join(sourceRoot, 'feature', 'node_modules');
  const destRootModules = path.join(destRoot, 'node_modules');
  const destNestedModules = path.join(destNested, 'node_modules');
  const staleOutput = path.join(destRoot, 'obsolete-output');
  const staleOutputModules = path.join(staleOutput, 'node_modules');
  const rootSentinel = Buffer.from([0, 1, 2, 255]);
  const nestedSentinel = Buffer.from('preserve nested modules');
  const staleTreeSentinel = Buffer.from('preserve modules below stale output');

  fs.mkdirSync(sourceNested, { recursive: true });
  fs.mkdirSync(sourceRootModules, { recursive: true });
  fs.mkdirSync(sourceNestedModules, { recursive: true });
  fs.writeFileSync(path.join(sourceNested, 'canonical.js'), 'updated canonical content');
  fs.writeFileSync(path.join(sourceRootModules, 'source-only.js'), 'must not be copied');
  fs.writeFileSync(path.join(sourceNestedModules, 'source-only.js'), 'must not be copied');

  fs.mkdirSync(destNested, { recursive: true });
  fs.mkdirSync(destRootModules, { recursive: true });
  fs.mkdirSync(destNestedModules, { recursive: true });
  fs.mkdirSync(staleOutputModules, { recursive: true });
  fs.writeFileSync(path.join(destRoot, 'stale-generated.js'), 'remove this generated file');
  fs.writeFileSync(path.join(staleOutput, 'stale-generated.js'), 'remove this stale subtree file');
  fs.writeFileSync(path.join(destNested, 'canonical.js'), 'outdated canonical content');
  fs.writeFileSync(path.join(destRootModules, 'sentinel.bin'), rootSentinel);
  fs.writeFileSync(path.join(destNestedModules, 'sentinel.bin'), nestedSentinel);
  fs.writeFileSync(path.join(staleOutputModules, 'sentinel.bin'), staleTreeSentinel);

  const preservedRootSentinel = fs.readFileSync(path.join(destRootModules, 'sentinel.bin'));
  const preservedNestedSentinel = fs.readFileSync(path.join(destNestedModules, 'sentinel.bin'));
  const preservedStaleTreeSentinel = fs.readFileSync(path.join(staleOutputModules, 'sentinel.bin'));
  syncCliBundle(fixtureRoot, [{ from: 'source', to: 'cli' }]);

  assert.equal(fs.existsSync(path.join(destRoot, 'stale-generated.js')), false);
  assert.equal(fs.existsSync(path.join(staleOutput, 'stale-generated.js')), false);
  assert.equal(
    fs.readFileSync(path.join(destNested, 'canonical.js'), 'utf8'),
    'updated canonical content',
  );
  assert.equal(fs.existsSync(path.join(destRootModules, 'source-only.js')), false);
  assert.equal(fs.existsSync(path.join(destNestedModules, 'source-only.js')), false);
  assert.deepEqual(fs.readFileSync(path.join(destRootModules, 'sentinel.bin')), preservedRootSentinel);
  assert.deepEqual(fs.readFileSync(path.join(destNestedModules, 'sentinel.bin')), preservedNestedSentinel);
  assert.deepEqual(fs.readFileSync(path.join(staleOutputModules, 'sentinel.bin')), preservedStaleTreeSentinel);
});
