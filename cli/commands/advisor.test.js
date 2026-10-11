'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const advisor = require('./advisor.js');
const settings = require('../lib/advisor-settings.js');
const profiles = require('../lib/advisor-profiles.js');
const modelCatalog = require('../lib/opencode-model-catalog.js');
const { advisorSettingsTarget, advisorCommandTarget, advisorAgentsTarget, advisorSubagentTarget, installManifestTarget } = require('../lib/paths.js');

const BIN = path.join(__dirname, '..', '..', 'bin', 'guarana.js');

async function captureOutput(callback) {
  let stdout = '';
  let stderr = '';
  const streams = {
    stdout: { write: (chunk) => { stdout += chunk.toString(); } },
    stderr: { write: (chunk) => { stderr += chunk.toString(); } },
  };
  const result = await callback(streams);
  return { result, stdout, stderr };
}

async function isolated(callback) {
  const cwd = process.cwd();
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-advisor-command-home-'));
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-advisor-command-project-'));
  const oldHome = process.env.HOME;
  const oldXdg = process.env.XDG_CONFIG_HOME;
  const originalExitCode = process.exitCode;
  process.env.HOME = home;
  process.env.XDG_CONFIG_HOME = path.join(home, 'xdg');
  process.chdir(project);
  try { await callback(); }
  finally {
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
    process.exitCode = 23;
    const run = async (args) => {
      const { result } = await captureOutput((streams) => advisor.run(args, { useProject: true, ...streams }));
      assert.equal(process.exitCode, 23);
      return result;
    };
    assert.equal(await run(['set', 'primary.provider', 'anthropic']), 0);
    assert.equal(await run(['set', 'primary.model', 'claude-sonnet-4']), 0);
    assert.equal(await run(['set', 'advisor.enabled', 'true']), 1);
    assert.equal(settings.readSettings(true).advisor, undefined);

    assert.equal(await run(['set', 'advisor.provider', 'openai']), 0);
    assert.equal(await run(['set', 'advisor.enabled', 'true']), 1);
    assert.equal(settings.readSettings(true).advisor.enabled, undefined);
    assert.equal(fs.existsSync(advisorSubagentTarget(true)), false);

    assert.equal(await run(['set', 'advisor.model', 'gpt-5']), 0);
    assert.equal(await run(['set', 'advisor.enabled', 'true']), 0);
    assert.equal(await run(['read']), 0);
    assert.equal(await run(['status']), 0);
    assert.match(fs.readFileSync(advisorCommandTarget(true), 'utf8'), /agent: guarana/);
    assert.match(fs.readFileSync(advisorAgentsTarget(true), 'utf8'), /mode: primary/);
    assert.match(fs.readFileSync(advisorSubagentTarget(true), 'utf8'), /mode: subagent/);
    assert.equal(await run(['set', 'advisor.enabled', 'false']), 0);
    assert.equal(await run(['clear', 'advisor.enabled']), 0);
    assert.equal(fs.existsSync(advisorAgentsTarget(true)), true);
    assert.equal(fs.existsSync(advisorSubagentTarget(true)), false);
    assert.match(fs.readFileSync(advisorCommandTarget(true), 'utf8'), /agent: guarana/);
    assert.equal(profiles.advisorArtifactStatus(true)[1].status, 'ok (up to date)');
  });
});

test('advisor model discovery and caught exceptions return numeric statuses without changing process.exitCode', async () => {
  await isolated(async () => {
    const originalDiscoverModels = modelCatalog.discoverModels;
    process.exitCode = 23;
    try {
      const models = [{ id: 'openai/gpt-5' }];
      modelCatalog.discoverModels = async () => ({ models, error: null });
      const success = await captureOutput((streams) => advisor.run(['models', 'openai'], { useProject: false, ...streams }));
      assert.equal(success.result, 0);
      assert.equal(success.stdout, `${JSON.stringify(models, null, 2)}\n`);
      assert.equal(success.stderr, '');
      assert.equal(process.exitCode, 23);

      modelCatalog.discoverModels = async () => ({ models: [], error: 'catalog unavailable' });
      const discoveryError = await captureOutput((streams) => advisor.run(['models'], { useProject: false, ...streams }));
      assert.equal(discoveryError.result, 1);
      assert.equal(discoveryError.stdout, '[]\n');
      assert.equal(discoveryError.stderr, 'advisor models: catalog unavailable\n');
      assert.equal(process.exitCode, 23);

      modelCatalog.discoverModels = async () => { throw new Error('catalog failed'); };
      const caughtError = await captureOutput((streams) => advisor.run(['models'], { useProject: false, ...streams }));
      assert.equal(caughtError.result, 1);
      assert.equal(caughtError.stdout, '');
      assert.equal(caughtError.stderr, 'advisor: catalog failed\n');
      assert.equal(process.exitCode, 23);
    } finally {
      modelCatalog.discoverModels = originalDiscoverModels;
    }
  });
});

test('advisor caught usage errors preserve their diagnostic and executable exit status', async () => {
  await isolated(async () => {
    process.exitCode = 23;
    const result = await captureOutput((streams) => advisor.run(['unknown'], { useProject: false, ...streams }));
    assert.equal(result.result, 1);
    assert.equal(result.stdout, '');
    assert.equal(result.stderr, 'advisor: usage: guarana advisor <models|read|set|clear|status>\n');
    assert.equal(process.exitCode, 23);
  });

  const result = spawnSync(process.execPath, [BIN, 'advisor', 'unknown'], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, 'advisor: usage: guarana advisor <models|read|set|clear|status>\n');

  const discovery = spawnSync(process.execPath, [BIN, 'advisor', 'models'], {
    encoding: 'utf8',
    env: { ...process.env, OPENCODE_BIN: path.join(os.tmpdir(), 'guarana-no-such-opencode-executable') },
  });
  assert.equal(discovery.status, 1);
  assert.equal(discovery.stdout, '[]\n');
  assert.equal(discovery.stderr, 'advisor models: OpenCode is not installed or is not available on PATH.\n');
});

test('advisor set and clear roll back settings, profiles, and manifest on profile or manifest I/O failures', async () => {
  for (const args of [
    ['set', 'advisor.variant', 'max'],
    ['clear', 'advisor.enabled'],
  ]) {
    for (const failure of ['profile-write', 'manifest-rename']) {
      await isolated(async () => {
        for (const [field, value] of Object.entries({
          'primary.provider': 'anthropic',
          'primary.model': 'claude-sonnet-4',
          'advisor.provider': 'openai',
          'advisor.model': 'gpt-5',
          'advisor.enabled': true,
          'advisor.variant': 'high',
        })) settings.setSetting(true, field, value);
        profiles.installAdvisorArtifacts(true);

        const targets = [
          advisorSettingsTarget(true),
          advisorCommandTarget(true),
          advisorAgentsTarget(true),
          advisorSubagentTarget(true),
          installManifestTarget(true),
        ];
        targets.forEach((target, index) => fs.chmodSync(target, index === targets.length - 1 ? 0o604 : 0o640));
        const before = new Map(targets.map((target) => [target, {
          bytes: fs.readFileSync(target),
          mode: fs.statSync(target).mode & 0o7777,
        }]));
        const manifest = installManifestTarget(true);
        const failureTarget = failure === 'profile-write' ? advisorAgentsTarget(true) : manifest;
        const originalWrite = fs.writeFileSync;
        const originalRename = fs.renameSync;
        let injected = false;
        let settingsChangedAtFailure = false;
        let advisorSubagentWasRemoved = false;
        const settingsFile = advisorSettingsTarget(true);
        try {
          if (failure === 'profile-write') {
            fs.writeFileSync = function (target, ...writeArgs) {
              if (!injected && typeof target === 'string' && path.resolve(target) === failureTarget) {
                injected = true;
                settingsChangedAtFailure = !fs.readFileSync(settingsFile).equals(before.get(settingsFile).bytes);
                throw new Error('injected profile write failure');
              }
              return originalWrite.call(fs, target, ...writeArgs);
            };
          } else {
            fs.renameSync = function (source, destination, ...renameArgs) {
              if (!injected && path.resolve(destination) === failureTarget) {
                injected = true;
                settingsChangedAtFailure = !fs.readFileSync(settingsFile).equals(before.get(settingsFile).bytes);
                if (args[0] === 'clear') advisorSubagentWasRemoved = !fs.existsSync(advisorSubagentTarget(true));
                throw new Error('injected manifest rename failure');
              }
              return originalRename.call(fs, source, destination, ...renameArgs);
            };
          }

          const result = await captureOutput((streams) => advisor.run(args, { useProject: true, ...streams }));
          assert.equal(result.result, 1);
          assert.equal(result.stdout, '');
          assert.equal(result.stderr, `advisor: injected ${failure === 'profile-write' ? 'profile write' : 'manifest rename'} failure\n`);
          assert.equal(injected, true);
          assert.equal(settingsChangedAtFailure, true, 'the settings write must precede the injected profile/manifest failure');
          if (args[0] === 'clear' && failure === 'manifest-rename') {
            assert.equal(advisorSubagentWasRemoved, true, 'clear preflight must use the candidate effective settings');
          }
          for (const [target, prior] of before) {
            assert.deepEqual(fs.readFileSync(target), prior.bytes, `${target} bytes restored`);
            assert.equal(fs.statSync(target).mode & 0o7777, prior.mode, `${target} mode restored`);
          }
        } finally {
          fs.writeFileSync = originalWrite;
          fs.renameSync = originalRename;
        }
      });
    }
  }
});

test('advisor set refuses a preflight conflict without changing settings', async () => {
  await isolated(async () => {
    settings.setSetting(true, 'primary.provider', 'anthropic');
    const settingsFile = advisorSettingsTarget(true);
    const before = fs.readFileSync(settingsFile);
    const foreign = advisorAgentsTarget(true);
    fs.mkdirSync(path.dirname(foreign), { recursive: true });
    fs.writeFileSync(foreign, 'foreign profile\n');

    const result = await captureOutput((streams) => advisor.run(['set', 'primary.model', 'claude-sonnet-4'], {
      useProject: true,
      ...streams,
    }));
    assert.equal(result.result, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /advisor: refuse to install advisor profile: .* exists and is not managed by Guarana/);
    assert.deepEqual(fs.readFileSync(settingsFile), before);
  });
});
