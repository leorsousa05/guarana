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
