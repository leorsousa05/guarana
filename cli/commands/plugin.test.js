const { it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const plugin = require('./plugin.js');

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
  try {
    process.chdir(project);
    plugin.install(true);
    for (const name of ['worker-code', 'worker-verify', 'worker-debug']) {
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
    assert.ok(output.filter((line) => line.includes('subagent') && line.includes('ok (up to date)')).length === 3);

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
