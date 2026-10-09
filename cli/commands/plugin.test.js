const { it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const plugin = require('./plugin.js');
const { pluginTarget, workerAgentsTarget, advisorCommandTarget } = require('../lib/paths.js');

it('deploys, reports, and removes the skill engine with the plugin set', async () => {
  const originalCwd = process.cwd();
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-plugin-skills-'));
  const installedEngine = path.join(project, '.opencode', 'skill-engine', 'index.js');
  try {
    process.chdir(project);
    plugin.install(true);
    assert.ok(fs.existsSync(installedEngine));

    const output = [];
    const originalLog = console.log;
    console.log = (...parts) => output.push(parts.join(' '));
    try {
      await plugin.run(['status'], { useProject: true });
    } finally {
      console.log = originalLog;
    }
    assert.ok(output.some((line) => line.includes('skill engine') && line.includes('deployed')));

    plugin.uninstall(true);
    assert.equal(fs.existsSync(path.dirname(installedEngine)), false);
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(project, { recursive: true, force: true });
  }
});

it('deploys Task subagents, reports their health, and removes Guarana-owned profiles', async () => {
  const originalCwd = process.cwd();
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-plugin-agents-'));
  const agentDir = path.join(project, '.opencode', 'agents');
  const expectedAgents = ['worker-code', 'worker-verify', 'worker-debug', 'worker-specs'];
  try {
    process.chdir(project);
    plugin.install(true);
    for (const name of expectedAgents) {
      const profile = fs.readFileSync(path.join(agentDir, `${name}.md`), 'utf8');
      assert.match(profile, /mode: subagent/);
      assert.match(profile, /guarana-managed-worker-profile/);
    }

    const output = [];
    const originalLog = console.log;
    console.log = (...parts) => output.push(parts.join(' '));
    try {
      await plugin.run(['status'], { useProject: true });
    } finally {
      console.log = originalLog;
    }
    assert.equal(output.filter((line) => line.includes('subagent') && line.includes('ok (up to date)')).length, expectedAgents.length);

    const foreign = path.join(agentDir, 'my-worker.md');
    fs.writeFileSync(foreign, 'foreign profile\n');
    plugin.uninstall(true);
    assert.equal(fs.existsSync(path.join(agentDir, 'worker-code.md')), false);
    assert.equal(fs.readFileSync(foreign, 'utf8'), 'foreign profile\n');
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(project, { recursive: true, force: true });
  }
});

it('deploys global plugins, agents, and the setup command under XDG_CONFIG_HOME/opencode', () => {
  const oldHome = process.env.HOME;
  const oldXdg = process.env.XDG_CONFIG_HOME;
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-plugin-xdg-home-'));
  const xdg = path.join(home, 'isolated-config');
  try {
    process.env.HOME = home;
    process.env.XDG_CONFIG_HOME = xdg;

    plugin.install(false, { quiet: true });

    const root = path.join(xdg, 'opencode');
    assert.ok(fs.existsSync(pluginTarget(false)));
    assert.ok(fs.existsSync(path.join(root, 'plugins', path.basename(pluginTarget(false)))));
    assert.ok(fs.existsSync(path.join(workerAgentsTarget(false), 'worker-code.md')));
    assert.ok(fs.existsSync(advisorCommandTarget(false)));
    assert.match(fs.readFileSync(advisorCommandTarget(false), 'utf8'), /setup-only command/i);
    assert.equal(fs.existsSync(path.join(root, 'agents', 'guarana-advisor-primary.md')), false);
  } finally {
    if (oldHome === undefined) delete process.env.HOME;
    else process.env.HOME = oldHome;
    if (oldXdg === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = oldXdg;
    fs.rmSync(home, { recursive: true, force: true });
  }
});
