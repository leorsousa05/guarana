const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pluginIsOurs } = require('./guard.js');

const BUNDLE_TEXT = '// guarana telemetry plugin (Component A)\n// current bundle\n';
const OLD_VERSION_TEXT = '// guarana telemetry plugin (Component A)\n// older version, different bytes\n';
const FOREIGN_TEXT = '// some other plugin entirely\n';

describe('pluginIsOurs', () => {
  let dir;
  let bundle;
  let target;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-guard-'));
    bundle = path.join(dir, 'bundle.js');
    target = path.join(dir, 'target.js');
    fs.writeFileSync(bundle, BUNDLE_TEXT, 'utf8');
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('returns false when the target does not exist', () => {
    assert.equal(pluginIsOurs(path.join(dir, 'missing.js'), bundle), false);
  });

  it('accepts a byte-identical target', () => {
    fs.writeFileSync(target, BUNDLE_TEXT, 'utf8');
    assert.equal(pluginIsOurs(target, bundle), true);
  });

  it('accepts an older guarana version carrying the marker', () => {
    fs.writeFileSync(target, OLD_VERSION_TEXT, 'utf8');
    assert.equal(pluginIsOurs(target, bundle), true);
  });

  it('rejects a foreign file without the marker', () => {
    fs.writeFileSync(target, FOREIGN_TEXT, 'utf8');
    assert.equal(pluginIsOurs(target, bundle), false);
  });
});
