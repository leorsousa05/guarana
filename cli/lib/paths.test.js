const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ORCHESTRATOR_PLUGIN_NAME } = require('../constants.js');
const { targetDir, opencodeConfigDir, pluginTarget, workerAgentsTarget, advisorCommandTarget } = require('./paths.js');

describe('targetDir', () => {
  let dir;
  let originalCwd;
  let originalHome;
  let originalXdg;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-paths-'));
    originalCwd = process.cwd();
    originalHome = process.env.HOME;
    originalXdg = process.env.XDG_CONFIG_HOME;
    process.env.HOME = path.join(dir, 'home');
    process.env.XDG_CONFIG_HOME = path.join(dir, 'xdg');
    process.chdir(dir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
    if (originalXdg === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = originalXdg;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('uses the OpenCode-discoverable project skills directory', () => {
    assert.equal(targetDir(true), path.join(dir, '.opencode', 'skills', 'guarana'));
  });

  it('keeps global skills in the external agents skill directory', () => {
    assert.equal(targetDir(false), path.join(os.homedir(), '.agents', 'skills', 'guarana'));
  });

  it('uses XDG_CONFIG_HOME consistently for global OpenCode plugin, command, and agent roots', () => {
    const root = path.join(process.env.XDG_CONFIG_HOME, 'opencode');
    assert.equal(opencodeConfigDir(), root);
    assert.equal(pluginTarget(false, ORCHESTRATOR_PLUGIN_NAME), path.join(root, 'plugins', ORCHESTRATOR_PLUGIN_NAME));
    assert.equal(advisorCommandTarget(false), path.join(root, 'commands', 'guarana-advisor.md'));
    assert.equal(workerAgentsTarget(false), path.join(root, 'agents'));
  });

  it('preserves the ~/.config/opencode fallback when XDG_CONFIG_HOME is unset', () => {
    delete process.env.XDG_CONFIG_HOME;
    const root = path.join(os.homedir(), '.config', 'opencode');
    assert.equal(opencodeConfigDir(), root);
    assert.equal(pluginTarget(false, ORCHESTRATOR_PLUGIN_NAME), path.join(root, 'plugins', ORCHESTRATOR_PLUGIN_NAME));
    assert.equal(advisorCommandTarget(false), path.join(root, 'commands', 'guarana-advisor.md'));
    assert.equal(workerAgentsTarget(false), path.join(root, 'agents'));
  });
});
