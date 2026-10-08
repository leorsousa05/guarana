const { it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const update = require('./update.js');
const install = require('./install.js');
const { VERSION, PLUGIN_NAME, MEMORY_PLUGIN_NAME, ORCHESTRATOR_PLUGIN_NAME } = require('../constants.js');

it('prints a structured project update summary and refreshes the complete runtime quietly', () => {
  const originalCwd = process.cwd();
  const originalNoColor = process.env.NO_COLOR;
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-update-'));
  const output = [];
  const originalLog = console.log;
  try {
    process.chdir(project);
    process.env.NO_COLOR = '1';
    console.log = (...parts) => output.push(parts.join(' '));

    install.run([], { useProject: true, quiet: true });
    const stamp = path.join(project, '.opencode', 'skills', 'guarana', '.guarana-version');
    fs.writeFileSync(stamp, '0.9.0\n');
    output.length = 0;

    update.run([], { useProject: true });

    const summary = output.join('\n');
    assert.match(summary, /Guarana update/);
    assert.match(summary, /Update complete/);
    assert.ok(summary.includes(`0.9.0 → ${VERSION}`));
    assert.match(summary, /Target\s+Project · /);
    assert.match(summary, /8 skills · 3 plugins · 3 engines · 3 worker profiles/);
    assert.match(summary, /Restart OpenCode/);
    assert.doesNotMatch(summary, /\u001b\[/);

    for (const name of [PLUGIN_NAME, MEMORY_PLUGIN_NAME, ORCHESTRATOR_PLUGIN_NAME]) {
      assert.ok(fs.existsSync(path.join(project, '.opencode', 'plugins', name)));
    }
    for (const name of ['worker-code', 'worker-verify', 'worker-debug']) {
      assert.ok(fs.existsSync(path.join(project, '.opencode', 'agents', `${name}.md`)));
    }
    assert.equal(fs.readFileSync(stamp, 'utf8').trim(), VERSION);
  } finally {
    console.log = originalLog;
    if (originalNoColor === undefined) delete process.env.NO_COLOR;
    else process.env.NO_COLOR = originalNoColor;
    process.chdir(originalCwd);
    fs.rmSync(project, { recursive: true, force: true });
  }
});

it('adds ANSI styling only when explicitly formatting for a capable terminal', () => {
  const summary = update.formatSummary({
    target: '/tmp/project/.opencode/skills/guarana',
    useProject: true,
    previousVersion: null,
    useColor: true,
  });
  assert.match(summary, /\u001b\[36;1m/);
  assert.match(summary, /\u001b\[32;1m/);
});

it('updates the global skill and runtime targets under an isolated home directory', () => {
  const originalHome = process.env.HOME;
  const originalCwd = process.cwd();
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-update-home-'));
  const output = [];
  const originalLog = console.log;
  try {
    process.env.HOME = home;
    process.chdir(home);
    console.log = (...parts) => output.push(parts.join(' '));

    update.run([], { useProject: false });

    const skills = path.join(home, '.agents', 'skills', 'guarana');
    const plugins = path.join(home, '.config', 'opencode', 'plugins');
    const agents = path.join(home, '.config', 'opencode', 'agents');
    assert.ok(fs.existsSync(path.join(skills, 'SKILL.md')));
    assert.match(output.join('\n'), /Target\s+Global · /);
    for (const name of [PLUGIN_NAME, MEMORY_PLUGIN_NAME, ORCHESTRATOR_PLUGIN_NAME]) {
      assert.ok(fs.existsSync(path.join(plugins, name)));
    }
    for (const name of ['worker-code', 'worker-verify', 'worker-debug']) {
      assert.ok(fs.existsSync(path.join(agents, `${name}.md`)));
    }
  } finally {
    console.log = originalLog;
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
    process.chdir(originalCwd);
    fs.rmSync(home, { recursive: true, force: true });
  }
});
