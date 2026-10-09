'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const advisor = require('./advisor.js');
const settings = require('../lib/advisor-settings.js');
const profiles = require('../lib/advisor-profiles.js');
const { advisorCommandTarget, advisorAgentsTarget, advisorSubagentTarget } = require('../lib/paths.js');

async function isolated(callback) {
  const cwd = process.cwd();
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-advisor-command-home-'));
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-advisor-command-project-'));
  const oldHome = process.env.HOME;
  const oldXdg = process.env.XDG_CONFIG_HOME;
  const originalLog = console.log;
  const originalError = console.error;
  const originalExitCode = process.exitCode;
  process.env.HOME = home;
  process.env.XDG_CONFIG_HOME = path.join(home, 'xdg');
  process.chdir(project);
  console.log = () => {};
  console.error = () => {};
  try { await callback(); }
  finally {
    console.log = originalLog;
    console.error = originalError;
    process.exitCode = originalExitCode;
    process.chdir(cwd);
    if (oldHome === undefined) delete process.env.HOME;
    else process.env.HOME = oldHome;
    if (oldXdg === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = oldXdg;
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
}

test('advisor enablement requires effective provider and model; enabled profiles are read-only', async () => {
  await isolated(async () => {
    await advisor.run(['set', 'primary.provider', 'anthropic'], { useProject: true });
    await advisor.run(['set', 'primary.model', 'claude-sonnet-4'], { useProject: true });
    await advisor.run(['set', 'advisor.enabled', 'true'], { useProject: true });
    assert.equal(settings.readSettings(true).advisor, undefined);
    assert.equal(process.exitCode, 1);

    await advisor.run(['set', 'advisor.provider', 'openai'], { useProject: true });
    await advisor.run(['set', 'advisor.enabled', 'true'], { useProject: true });
    assert.equal(settings.readSettings(true).advisor.enabled, undefined);
    assert.equal(fs.existsSync(advisorSubagentTarget(true)), false);

    await advisor.run(['set', 'advisor.model', 'gpt-5'], { useProject: true });
    await advisor.run(['set', 'advisor.enabled', 'true'], { useProject: true });
    assert.match(fs.readFileSync(advisorCommandTarget(true), 'utf8'), /agent: guarana/);
    assert.match(fs.readFileSync(advisorAgentsTarget(true), 'utf8'), /mode: primary/);
    assert.match(fs.readFileSync(advisorSubagentTarget(true), 'utf8'), /mode: subagent/);
    await advisor.run(['set', 'advisor.enabled', 'false'], { useProject: true });
    assert.equal(fs.existsSync(advisorAgentsTarget(true)), true);
    assert.equal(fs.existsSync(advisorSubagentTarget(true)), false);
    assert.match(fs.readFileSync(advisorCommandTarget(true), 'utf8'), /agent: guarana/);
    assert.equal(profiles.advisorArtifactStatus(true)[1].status, 'ok (up to date)');
  });
});
