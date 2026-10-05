const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { targetDir } = require('./paths.js');

describe('targetDir', () => {
  let dir;
  let originalCwd;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-paths-'));
    originalCwd = process.cwd();
    process.chdir(dir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('uses the OpenCode-discoverable project skills directory', () => {
    assert.equal(targetDir(true), path.join(dir, '.opencode', 'skills', 'guarana'));
  });

  it('keeps global skills in the external agents skill directory', () => {
    assert.equal(targetDir(false), path.join(os.homedir(), '.agents', 'skills', 'guarana'));
  });
});
