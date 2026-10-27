const { it } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const plugin = require('./plugin.js');
const agents = require('../lib/agents.js');
const {
  pluginTarget, workerAgentsTarget, advisorCommandTarget, advisorAgentsTarget, advisorSubagentTarget,
  legacyAdvisorAgentsTarget, advisorSettingsTarget, openCodeRootTarget, installManifestTarget,
} = require('../lib/paths.js');
const { PLUGIN_NAME, MEMORY_PLUGIN_NAME, ORCHESTRATOR_PLUGIN_NAME } = require('../constants.js');
const { PLUGIN_MARKER, MEMORY_PLUGIN_MARKER, ORCHESTRATOR_PLUGIN_MARKER } = require('../lib/guard.js');
const BIN = path.join(__dirname, '..', '..', 'bin', 'guarana.js');
const PLUGIN_MARKERS = new Map([
  [PLUGIN_NAME, PLUGIN_MARKER],
  [MEMORY_PLUGIN_NAME, MEMORY_PLUGIN_MARKER],
  [ORCHESTRATOR_PLUGIN_NAME, ORCHESTRATOR_PLUGIN_MARKER],
]);

function captureStreams() {
  let stdout = '';
  let stderr = '';
  return {
    stdout: { write: (chunk) => { stdout += chunk.toString(); } },
    stderr: { write: (chunk) => { stderr += chunk.toString(); } },
    output: () => ({ stdout, stderr }),
  };
}

function snapshotTree(root, relative = '', result = new Map()) {
  const directory = path.join(root, relative);
  for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const child = relative ? `${relative}/${entry.name}` : entry.name;
    const target = path.join(root, ...child.split('/'));
    if (entry.isDirectory()) {
      result.set(child, { type: 'directory' });
      snapshotTree(root, child, result);
    } else {
      result.set(child, { type: 'file', bytes: fs.readFileSync(target) });
    }
  }
  return [...result.entries()];
}

it('rethrows plugin preflight errors', () => {
  const original = agents.assertInstallable;
  const refusal = new Error('preflight refusal');
  agents.assertInstallable = () => { throw refusal; };
  try {
    assert.throws(() => plugin.install(true, { quiet: true }), refusal);
  } finally {
    agents.assertInstallable = original;
  }
});

it('refuses foreign plugin installs and uninstalls without changing target bytes', () => {
  const foreignBytes = Buffer.from([0, 1, 2, 0xfe, 0xff, 10]);
  for (const [subcommand, message] of [
    ['install', 'exists and was not installed by guarana'],
    ['uninstall', 'was not installed by guarana'],
  ]) {
    const project = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-plugin-foreign-'));
    const target = path.join(project, '.opencode', 'plugins', 'guarana-telemetry.js');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, foreignBytes);
    try {
      const result = spawnSync(process.execPath, [BIN, 'plugin', subcommand, '--project'], {
        cwd: project,
        encoding: 'utf8',
      });
      assert.equal(result.status, 1);
      assert.equal(result.stdout, '');
      assert.equal(result.stderr, `refuse to ${subcommand}: ${target} ${message} (content differs from bundle)\n`);
      assert.deepEqual(fs.readFileSync(target), foreignBytes);
    } finally {
      fs.rmSync(project, { recursive: true, force: true });
    }
  }
});

it('keeps process.exit and process.exitCode out of plugin and guard sources', () => {
  for (const source of [
    path.join(__dirname, 'plugin.js'),
    path.join(__dirname, '..', 'lib', 'guard.js'),
  ]) {
    assert.doesNotMatch(fs.readFileSync(source, 'utf8'), /\bprocess\.(?:exit|exitCode)\b/);
  }
});

it('deploys, reports, and removes the skill engine with the plugin set', async () => {
  const originalCwd = process.cwd();
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-plugin-skills-'));
  const installedEngine = path.join(project, '.opencode', 'skill-engine', 'index.js');
  try {
    process.chdir(project);
    plugin.install(true, { quiet: true });
    assert.ok(fs.existsSync(installedEngine));

    const output = captureStreams();
    await plugin.run(['status'], { useProject: true, ...output });
    assert.ok(output.output().stdout.includes('skill engine') && output.output().stdout.includes('deployed'));
    assert.match(output.output().stdout, /engine health: ok/);

    plugin.uninstall(true, null, { stdout: output.stdout });
    assert.equal(fs.existsSync(path.dirname(installedEngine)), false);
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(project, { recursive: true, force: true });
  }
});

it('installs and updates the three engines through a project ownership manifest, preserving extras and unrelated groups on uninstall', () => {
  const originalCwd = process.cwd();
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-plugin-manifest-'));
  try {
    process.chdir(project);
    plugin.install(true, { quiet: true });
    const manifestPath = installManifestTarget(true);
    const first = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert.equal(first.version, 1);
    assert.deepEqual(Object.keys(first.engines).sort(), ['memory', 'orchestrator', 'skill-engine']);
    const memoryFile = path.join(project, '.opencode', 'memory', 'capture.js');
    assert.equal(first.engines.memory.find((file) => file.path === 'capture.js').sha256,
      crypto.createHash('sha256').update(fs.readFileSync(memoryFile)).digest('hex'));

    const extra = path.join(project, '.opencode', 'memory', 'local-extra.txt');
    fs.writeFileSync(extra, 'preserve me\n');
    plugin.install(true, { quiet: true });
    assert.equal(fs.readFileSync(extra, 'utf8'), 'preserve me\n');

    const beforeUninstall = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const preservedGroups = {
      skills: { guarana: [{ path: 'skills/keep.md', sha256: 'a'.repeat(64) }] },
      workers: beforeUninstall.workers,
      advisor: beforeUninstall.advisor,
      future: { installMetadata: { enabled: true } },
    };
    Object.assign(beforeUninstall, preservedGroups);
    fs.writeFileSync(manifestPath, `${JSON.stringify(beforeUninstall, null, 2)}\n`);

    plugin.uninstall(true);
    assert.equal(fs.existsSync(memoryFile), false);
    assert.equal(fs.existsSync(path.join(project, '.opencode', 'orchestrator', 'state.js')), false);
    assert.equal(fs.existsSync(path.join(project, '.opencode', 'skill-engine', 'index.js')), false);
    assert.equal(fs.readFileSync(extra, 'utf8'), 'preserve me\n');
    const uninstalled = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert.deepEqual(uninstalled.engines, {});
    assert.equal(uninstalled.plugins, undefined);
    assert.equal(uninstalled.workers, undefined);
    assert.equal(uninstalled.advisor, undefined);
    assert.deepEqual(uninstalled.skills, preservedGroups.skills);
    assert.deepEqual(uninstalled.future, preservedGroups.future);
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(project, { recursive: true, force: true });
  }
});

it('installs project plugins and engines only without creating native profiles', () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-plugin-only-project-'));
  try {
    const result = spawnSync(process.execPath, [BIN, 'plugin', 'install', '--plugins-only', '--project'], {
      cwd: project,
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    for (const name of [PLUGIN_NAME, MEMORY_PLUGIN_NAME, ORCHESTRATOR_PLUGIN_NAME]) {
      assert.ok(fs.existsSync(path.join(project, '.opencode', 'plugins', name)));
    }
    assert.ok(fs.existsSync(path.join(project, '.opencode', 'memory', 'capture.js')));
    assert.ok(fs.existsSync(path.join(project, '.opencode', 'orchestrator', 'state.js')));
    assert.ok(fs.existsSync(path.join(project, '.opencode', 'skill-engine', 'index.js')));
    assert.equal(fs.existsSync(path.join(workerAgentsTarget(true, project), 'worker-specs.md')), false);
    assert.equal(fs.existsSync(advisorCommandTarget(true, project)), false);
    const manifest = JSON.parse(fs.readFileSync(installManifestTarget(true, project), 'utf8'));
    assert.ok(manifest.engines);
    assert.ok(manifest.plugins);
    assert.equal(manifest.workers, undefined);
    assert.equal(manifest.advisor, undefined);

    const uninstalled = spawnSync(process.execPath, [BIN, 'plugin', 'uninstall', '--plugins-only', '--project'], {
      cwd: project,
      encoding: 'utf8',
    });
    assert.equal(uninstalled.status, 0, uninstalled.stderr);
    for (const name of [PLUGIN_NAME, MEMORY_PLUGIN_NAME, ORCHESTRATOR_PLUGIN_NAME]) {
      assert.equal(fs.existsSync(path.join(project, '.opencode', 'plugins', name)), false);
    }
    assert.ok(fs.existsSync(path.join(project, '.opencode', 'memory', 'capture.js')));
    assert.ok(fs.existsSync(path.join(project, '.opencode', 'orchestrator', 'state.js')));
    assert.ok(fs.existsSync(path.join(project, '.opencode', 'skill-engine', 'index.js')));
    const afterUninstall = JSON.parse(fs.readFileSync(installManifestTarget(true, project), 'utf8'));
    assert.deepEqual(afterUninstall.engines, manifest.engines);
    assert.equal(afterUninstall.plugins, undefined);
  } finally {
    fs.rmSync(project, { recursive: true, force: true });
  }
});

it('uninstalls only plugins in project and global scopes, preserving modified profiles and all other manifest groups', () => {
  const originalCwd = process.cwd();
  const oldHome = process.env.HOME;
  const oldXdg = process.env.XDG_CONFIG_HOME;
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-plugin-only-uninstall-home-'));
  const xdg = path.join(home, 'xdg');
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-plugin-only-uninstall-project-'));
  try {
    process.env.HOME = home;
    process.env.XDG_CONFIG_HOME = xdg;
    process.chdir(project);

    for (const useProject of [true, false]) {
      plugin.install(useProject, { quiet: true });
      const worker = path.join(workerAgentsTarget(useProject), 'worker-specs.md');
      const advisor = advisorCommandTarget(useProject);
      const workerBytes = Buffer.concat([fs.readFileSync(worker), Buffer.from('\nuser-owned worker change\n')]);
      const advisorBytes = Buffer.concat([fs.readFileSync(advisor), Buffer.from('\nuser-owned advisor change\n')]);
      fs.writeFileSync(worker, workerBytes);
      fs.writeFileSync(advisor, advisorBytes);

      const manifestFile = installManifestTarget(useProject);
      const before = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
      before.skills = { guarana: [{ path: 'skills/keep.md', sha256: 'a'.repeat(64) }] };
      before.future = { installMetadata: { enabled: true } };
      fs.writeFileSync(manifestFile, `${JSON.stringify(before, null, 2)}\n`);
      const preservedGroups = Object.fromEntries(['engines', 'workers', 'advisor', 'skills', 'future']
        .map((group) => [group, before[group]]));
      const engineRoots = ['memory', 'orchestrator', 'skill-engine'].map((name) =>
        snapshotTree(path.join(openCodeRootTarget(useProject), name)));

      plugin.uninstall(useProject, null, { pluginsOnly: true });

      for (const name of [PLUGIN_NAME, MEMORY_PLUGIN_NAME, ORCHESTRATOR_PLUGIN_NAME]) {
        assert.equal(fs.existsSync(pluginTarget(useProject, name)), false);
      }
      assert.deepEqual(fs.readFileSync(worker), workerBytes);
      assert.deepEqual(fs.readFileSync(advisor), advisorBytes);
      assert.deepEqual(['memory', 'orchestrator', 'skill-engine'].map((name) =>
        snapshotTree(path.join(openCodeRootTarget(useProject), name))), engineRoots);
      const after = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
      for (const [group, entries] of Object.entries(preservedGroups)) assert.deepEqual(after[group], entries);
      assert.equal(after.plugins, undefined);
    }
  } finally {
    process.chdir(originalCwd);
    if (oldHome === undefined) delete process.env.HOME;
    else process.env.HOME = oldHome;
    if (oldXdg === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = oldXdg;
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

it('refuses plugins-only uninstall of a modified tracked plugin without changing any files', () => {
  const originalCwd = process.cwd();
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-plugin-only-modified-'));
  try {
    process.chdir(project);
    plugin.install(true, { quiet: true });
    const target = pluginTarget(true, PLUGIN_NAME);
    const modified = Buffer.from('user-owned plugin revision\0\xff');
    fs.writeFileSync(target, modified);
    const before = snapshotTree(project);

    assert.throws(() => plugin.uninstall(true, null, { pluginsOnly: true }), /managed plugin file was modified/);
    assert.deepEqual(snapshotTree(project), before);
    assert.deepEqual(fs.readFileSync(target), modified);
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(project, { recursive: true, force: true });
  }
});

it('refreshes global plugins and engines without reading or changing modified tracked profiles', () => {
  const originalCwd = process.cwd();
  const oldHome = process.env.HOME;
  const oldXdg = process.env.XDG_CONFIG_HOME;
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-plugin-only-global-home-'));
  const xdg = path.join(home, 'xdg');
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-plugin-only-global-project-'));
  try {
    process.env.HOME = home;
    process.env.XDG_CONFIG_HOME = xdg;
    process.chdir(project);
    plugin.install(false, { quiet: true });

    const worker = path.join(workerAgentsTarget(false), 'worker-specs.md');
    const advisor = advisorCommandTarget(false);
    const workerBytes = Buffer.concat([fs.readFileSync(worker), Buffer.from('\nuser-owned worker change\n')]);
    const advisorBytes = Buffer.concat([fs.readFileSync(advisor), Buffer.from('\nuser-owned advisor change\n')]);
    fs.writeFileSync(worker, workerBytes);
    fs.writeFileSync(advisor, advisorBytes);
    const manifestFile = installManifestTarget(false);
    const beforeManifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
    const beforeGroups = { workers: beforeManifest.workers, advisor: beforeManifest.advisor };
    const beforeTree = snapshotTree(home);

    const result = spawnSync(process.execPath, [BIN, 'plugin', 'install', '--plugins-only'], {
      cwd: project,
      env: { ...process.env, HOME: home, XDG_CONFIG_HOME: xdg },
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(snapshotTree(home), beforeTree);
    assert.deepEqual(fs.readFileSync(worker), workerBytes);
    assert.deepEqual(fs.readFileSync(advisor), advisorBytes);
    const afterManifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
    assert.deepEqual({ workers: afterManifest.workers, advisor: afterManifest.advisor }, beforeGroups);
  } finally {
    process.chdir(originalCwd);
    if (oldHome === undefined) delete process.env.HOME;
    else process.env.HOME = oldHome;
    if (oldXdg === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = oldXdg;
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

it('tracks worker and Advisor profile hashes relative to project and XDG OpenCode roots', () => {
  const originalCwd = process.cwd();
  const oldHome = process.env.HOME;
  const oldXdg = process.env.XDG_CONFIG_HOME;
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-profile-manifest-home-'));
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-profile-manifest-project-'));
  try {
    process.env.HOME = home;
    process.env.XDG_CONFIG_HOME = path.join(home, 'xdg');
    process.chdir(project);
    for (const useProject of [true, false]) {
      for (const [field, value] of Object.entries({
        'primary.provider': 'anthropic',
        'primary.model': 'claude-sonnet-4',
        'advisor.provider': 'openai',
        'advisor.model': 'gpt-5',
        'advisor.enabled': true,
      })) require('../lib/advisor-settings.js').setSetting(useProject, field, value);

      plugin.install(useProject, { quiet: true });
      const root = openCodeRootTarget(useProject);
      const manifest = JSON.parse(fs.readFileSync(installManifestTarget(useProject), 'utf8'));
      assert.equal(manifest.workers.length, 5);
      assert.deepEqual(manifest.workers.map(({ path: relative }) => relative).sort(), [
        'agents/worker-code.md', 'agents/worker-debug.md', 'agents/worker-research.md', 'agents/worker-specs.md', 'agents/worker-verify.md',
      ]);
      assert.deepEqual(manifest.advisor.map(({ path: relative }) => relative).sort(), [
        'agents/guarana-advisor.md', 'agents/guarana.md', 'commands/guarana-advisor.md',
      ]);
      for (const group of ['workers', 'advisor']) {
        for (const entry of manifest[group]) {
          assert.equal(entry.sha256, crypto.createHash('sha256')
            .update(fs.readFileSync(path.join(root, ...entry.path.split('/')))).digest('hex'));
        }
      }
      assert.ok(fs.existsSync(advisorSettingsTarget(useProject)));
      plugin.uninstall(useProject);
      const after = JSON.parse(fs.readFileSync(installManifestTarget(useProject), 'utf8'));
      assert.equal(after.workers, undefined);
      assert.equal(after.advisor, undefined);
      assert.ok(fs.existsSync(advisorSettingsTarget(useProject)));
    }
  } finally {
    process.chdir(originalCwd);
    if (oldHome === undefined) delete process.env.HOME;
    else process.env.HOME = oldHome;
    if (oldXdg === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = oldXdg;
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

it('preflights modified tracked profiles before plugin, engine, manifest, or other profile mutation', () => {
  const originalCwd = process.cwd();
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-profile-modified-'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-profile-modified-home-'));
  const oldHome = process.env.HOME;
  const oldXdg = process.env.XDG_CONFIG_HOME;
  try {
    process.env.HOME = home;
    process.env.XDG_CONFIG_HOME = path.join(home, 'xdg');
    process.chdir(project);
    for (const [useProject, target, expectedGroup] of [
      [true, path.join(workerAgentsTarget(true), 'worker-code.md'), 'workers'],
      [false, advisorCommandTarget(false), 'advisor'],
    ]) {
      plugin.install(useProject, { quiet: true });
      const modified = Buffer.concat([fs.readFileSync(target), Buffer.from('\nlocal change\n')]);
      fs.writeFileSync(target, modified);
      const scopeRoot = useProject ? project : path.join(home, 'xdg');
      const before = snapshotTree(scopeRoot);
      assert.throws(() => plugin.install(useProject, { quiet: true }), new RegExp(`managed ${expectedGroup} profile was modified`));
      assert.deepEqual(snapshotTree(scopeRoot), before);
      assert.throws(() => plugin.uninstall(useProject), new RegExp(`managed ${expectedGroup} profile was modified`));
      assert.deepEqual(snapshotTree(scopeRoot), before);
    }
  } finally {
    process.chdir(originalCwd);
    if (oldHome === undefined) delete process.env.HOME;
    else process.env.HOME = oldHome;
    if (oldXdg === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = oldXdg;
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

it('refuses markerless foreign worker and Advisor profiles in project and global roots without mutation', () => {
  const originalCwd = process.cwd();
  const oldHome = process.env.HOME;
  const oldXdg = process.env.XDG_CONFIG_HOME;
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-foreign-profile-home-'));
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-foreign-profile-project-'));
  try {
    process.env.HOME = home;
    process.env.XDG_CONFIG_HOME = path.join(home, 'xdg');
    process.chdir(project);
    for (const [useProject, target] of [
      [true, path.join(workerAgentsTarget(true), 'worker-code.md')],
      [false, advisorCommandTarget(false)],
    ]) {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, 'foreign profile owned by another tool\n');
      const root = useProject ? project : path.join(home, 'xdg');
      const before = snapshotTree(root);
      assert.throws(() => plugin.install(useProject, { quiet: true }), /exists and is not managed by Guarana/);
      assert.deepEqual(snapshotTree(root), before);
    }
  } finally {
    process.chdir(originalCwd);
    if (oldHome === undefined) delete process.env.HOME;
    else process.env.HOME = oldHome;
    if (oldXdg === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = oldXdg;
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

it('refuses a markerless foreign worker profile in the global scope without changing the install tree', () => {
  const originalCwd = process.cwd();
  const oldHome = process.env.HOME;
  const oldXdg = process.env.XDG_CONFIG_HOME;
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-global-foreign-worker-home-'));
  const xdg = path.join(home, 'xdg');
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-global-foreign-worker-project-'));
  try {
    process.env.HOME = home;
    process.env.XDG_CONFIG_HOME = xdg;
    process.chdir(project);
    const target = path.join(workerAgentsTarget(false), 'worker-code.md');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, 'foreign worker profile owned by another tool\n');
    const before = snapshotTree(xdg);

    assert.throws(() => plugin.install(false, { quiet: true }),
      /refuse to install worker profile: .*worker-code\.md exists and is not managed by Guarana/);
    assert.deepEqual(snapshotTree(xdg), before);
  } finally {
    process.chdir(originalCwd);
    if (oldHome === undefined) delete process.env.HOME;
    else process.env.HOME = oldHome;
    if (oldXdg === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = oldXdg;
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

it('rejects unsafe profile paths in the install manifest before touching installed artifacts', () => {
  const originalCwd = process.cwd();
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-profile-unsafe-path-'));
  try {
    process.chdir(project);
    plugin.install(true, { quiet: true });
    const manifestFile = installManifestTarget(true);
    const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
    manifest.workers[0].path = '../outside.md';
    fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
    const before = snapshotTree(project);
    assert.throws(() => plugin.install(true, { quiet: true }), /invalid workers artifact entry/);
    assert.deepEqual(snapshotTree(project), before);
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(project, { recursive: true, force: true });
  }
});

it('adopts marked and byte-identical legacy profiles, removes obsolete advisor targets, and preserves foreign extras', () => {
  const originalCwd = process.cwd();
  const oldHome = process.env.HOME;
  const oldXdg = process.env.XDG_CONFIG_HOME;
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-profile-legacy-home-'));
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-profile-legacy-'));
  try {
    process.env.HOME = home;
    process.env.XDG_CONFIG_HOME = path.join(home, 'xdg');
    process.chdir(project);
    for (const useProject of [true, false]) {
      const worker = path.join(workerAgentsTarget(useProject), 'worker-code.md');
      const command = advisorCommandTarget(useProject);
      const legacy = legacyAdvisorAgentsTarget(useProject);
      const extraAgent = path.join(workerAgentsTarget(useProject), 'my-profile.md');
      const identicalWorker = path.join(workerAgentsTarget(useProject), 'worker-verify.md');
      const extraCommand = path.join(path.dirname(command), 'my-command.md');
      fs.mkdirSync(path.dirname(worker), { recursive: true });
      fs.mkdirSync(path.dirname(command), { recursive: true });
      fs.writeFileSync(worker, `${agents.WORKER_MARKER}\nlegacy worker\n`);
      fs.writeFileSync(identicalWorker, agents.profiles(useProject).find(({ name }) => name === 'worker-verify').content);
      fs.writeFileSync(command, '<!-- guarana-managed-advisor-artifact -->\nlegacy command\n');
      fs.writeFileSync(legacy, '<!-- guarana-managed-advisor-artifact -->\nold primary\n');
      fs.writeFileSync(extraAgent, 'foreign agent survives\n');
      fs.writeFileSync(extraCommand, 'foreign command survives\n');

      plugin.install(useProject, { quiet: true });
      const manifest = JSON.parse(fs.readFileSync(installManifestTarget(useProject), 'utf8'));
      assert.equal(manifest.workers.find(({ path: relative }) => relative === 'agents/worker-code.md').sha256,
        crypto.createHash('sha256').update(fs.readFileSync(worker)).digest('hex'));
      assert.ok(manifest.workers.some(({ path: relative }) => relative === 'agents/worker-verify.md'));
      assert.equal(fs.existsSync(legacy), false);
      assert.equal(fs.readFileSync(extraAgent, 'utf8'), 'foreign agent survives\n');
      assert.equal(fs.readFileSync(extraCommand, 'utf8'), 'foreign command survives\n');
      plugin.uninstall(useProject);
      assert.equal(fs.existsSync(worker), false);
      assert.equal(fs.existsSync(identicalWorker), false);
      assert.equal(fs.existsSync(command), false);
      assert.equal(fs.readFileSync(extraAgent, 'utf8'), 'foreign agent survives\n');
      assert.equal(fs.readFileSync(extraCommand, 'utf8'), 'foreign command survives\n');
    }
  } finally {
    process.chdir(originalCwd);
    if (oldHome === undefined) delete process.env.HOME;
    else process.env.HOME = oldHome;
    if (oldXdg === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = oldXdg;
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

it('removes obsolete tracked Advisor profiles only while their recorded hashes still match', () => {
  const originalCwd = process.cwd();
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-profile-obsolete-'));
  try {
    process.chdir(project);
    const settings = require('../lib/advisor-settings.js');
    for (const [field, value] of Object.entries({
      'primary.provider': 'anthropic', 'primary.model': 'claude-sonnet-4',
      'advisor.provider': 'openai', 'advisor.model': 'gpt-5', 'advisor.enabled': true,
    })) settings.setSetting(true, field, value);
    plugin.install(true, { quiet: true });
    const advisor = advisorSubagentTarget(true);
    assert.ok(fs.existsSync(advisor));

    settings.setSetting(true, 'advisor.enabled', false);
    plugin.install(true, { quiet: true });
    assert.equal(fs.existsSync(advisor), false);
    let manifest = JSON.parse(fs.readFileSync(installManifestTarget(true), 'utf8'));
    assert.deepEqual(manifest.advisor.map(({ path: relative }) => relative).sort(), [
      'agents/guarana.md', 'commands/guarana-advisor.md',
    ]);

    settings.setSetting(true, 'advisor.enabled', true);
    plugin.install(true, { quiet: true });
    fs.appendFileSync(advisor, '\nlocal edit\n');
    const before = snapshotTree(project);
    assert.throws(() => plugin.install(true, { quiet: true }), /managed advisor profile was modified/);
    assert.deepEqual(snapshotTree(project), before);
    manifest = JSON.parse(fs.readFileSync(installManifestTarget(true), 'utf8'));
    assert.equal(manifest.advisor.some(({ path: relative }) => relative === 'agents/guarana-advisor.md'), true);
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(project, { recursive: true, force: true });
  }
});

it('refuses install and uninstall when a tracked engine file changed, without changing bytes', () => {
  const originalCwd = process.cwd();
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-plugin-modified-'));
  try {
    process.chdir(project);
    plugin.install(true, { quiet: true });
    const memoryFile = path.join(project, '.opencode', 'memory', 'capture.js');
    const localBytes = Buffer.from('local modification\0\xff');
    fs.writeFileSync(memoryFile, localBytes);
    const plugins = [
      pluginTarget(true, 'guarana-telemetry.js'),
      pluginTarget(true, 'guarana-memory.js'),
      pluginTarget(true, 'guarana-orchestrator.js'),
    ].map((file) => fs.readFileSync(file));

    assert.throws(() => plugin.install(true, { quiet: true }), /managed memory file was modified/);
    assert.throws(() => plugin.uninstall(true), /managed memory file was modified/);
    assert.deepEqual(fs.readFileSync(memoryFile), localBytes);
    for (const [index, file] of [
      pluginTarget(true, 'guarana-telemetry.js'),
      pluginTarget(true, 'guarana-memory.js'),
      pluginTarget(true, 'guarana-orchestrator.js'),
    ].entries()) assert.deepEqual(fs.readFileSync(file), plugins[index]);
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(project, { recursive: true, force: true });
  }
});

it('refuses modified manifest-tracked plugins before install or uninstall mutation', () => {
  const originalCwd = process.cwd();
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-plugin-modified-plugin-'));
  try {
    process.chdir(project);
    plugin.install(true, { quiet: true });
    const target = pluginTarget(true, PLUGIN_NAME);
    const modified = Buffer.from('user-owned plugin revision\0\xff');
    fs.writeFileSync(target, modified);
    const before = snapshotTree(project);

    assert.throws(() => plugin.install(true, { quiet: true }), /managed plugin file was modified/);
    assert.deepEqual(snapshotTree(project), before);
    assert.throws(() => plugin.uninstall(true), /managed plugin file was modified/);
    assert.deepEqual(snapshotTree(project), before);
    assert.deepEqual(fs.readFileSync(target), modified);
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(project, { recursive: true, force: true });
  }
});

it('adopts current marked bytes for exactly one allowlisted plugin and leaves normal install strict', () => {
  const originalCwd = process.cwd();
  for (const name of [PLUGIN_NAME, MEMORY_PLUGIN_NAME, ORCHESTRATOR_PLUGIN_NAME]) {
    const project = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-plugin-adopt-'));
    try {
      process.chdir(project);
      plugin.install(true, { quiet: true });
      const target = pluginTarget(true, name);
      const adoptedBytes = Buffer.from(`${PLUGIN_MARKERS.get(name)}\nlocal accepted revision\0\xff\n`);
      fs.writeFileSync(target, adoptedBytes);

      const manifestFile = installManifestTarget(true);
      const beforeManifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
      beforeManifest.skills = { guarana: [{ path: 'skills/keep.md', sha256: 'a'.repeat(64) }] };
      beforeManifest.future = { installMetadata: { enabled: true, label: 'preserve' } };
      fs.writeFileSync(manifestFile, `${JSON.stringify(beforeManifest, null, 2)}\n`);
      const beforeEntries = structuredClone(beforeManifest.plugins);

      const adopted = spawnSync(process.execPath, [BIN, 'plugin', 'adopt', name, '--accept-current', '--project'], {
        cwd: project,
        encoding: 'utf8',
      });
      assert.equal(adopted.status, 0, adopted.stderr);
      assert.equal(adopted.stderr, '');
      assert.equal(adopted.stdout, `adopted current bytes for plugin ${name}; updated its manifest SHA-256\n`);
      assert.deepEqual(fs.readFileSync(target), adoptedBytes, 'adoption must not touch plugin bytes');

      const afterManifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
      const expectedManifest = structuredClone(beforeManifest);
      expectedManifest.plugins.find((entry) => entry.path === name).sha256 =
        crypto.createHash('sha256').update(adoptedBytes).digest('hex');
      assert.deepEqual(afterManifest, expectedManifest, 'only the selected manifest hash may change');
      const changedHashes = beforeEntries.filter((entry) =>
        entry.sha256 !== afterManifest.plugins.find((after) => after.path === entry.path).sha256);
      assert.deepEqual(changedHashes.map(({ path: entryPath }) => entryPath), [name]);

      if (name === PLUGIN_NAME) {
        const installed = spawnSync(process.execPath, [BIN, 'plugin', 'install', '--project'], {
          cwd: project,
          encoding: 'utf8',
        });
        assert.equal(installed.status, 0, installed.stderr);
        assert.deepEqual(fs.readFileSync(target), fs.readFileSync(require('../constants.js').PLUGIN_BUNDLE));
      }
    } finally {
      process.chdir(originalCwd);
      fs.rmSync(project, { recursive: true, force: true });
    }
  }
});

it('adopts only the selected isolated global plugin scope when --project is omitted', () => {
  const originalCwd = process.cwd();
  const oldHome = process.env.HOME;
  const oldXdg = process.env.XDG_CONFIG_HOME;
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-plugin-adopt-global-home-'));
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-plugin-adopt-global-project-'));
  const xdg = path.join(home, 'xdg');
  try {
    process.env.HOME = home;
    process.env.XDG_CONFIG_HOME = xdg;
    process.chdir(project);
    plugin.install(false, { quiet: true });

    const target = pluginTarget(false, ORCHESTRATOR_PLUGIN_NAME);
    const adoptedBytes = Buffer.from(`${PLUGIN_MARKERS.get(ORCHESTRATOR_PLUGIN_NAME)}\nlocal global revision\n`);
    fs.writeFileSync(target, adoptedBytes);
    const manifestFile = installManifestTarget(false);
    const before = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
    const projectTreeBefore = snapshotTree(project);

    const adopted = spawnSync(process.execPath, [BIN, 'plugin', 'adopt', ORCHESTRATOR_PLUGIN_NAME, '--accept-current'], {
      cwd: project,
      env: { ...process.env, HOME: home, XDG_CONFIG_HOME: xdg },
      encoding: 'utf8',
    });
    assert.equal(adopted.status, 0, adopted.stderr);
    assert.equal(adopted.stderr, '');
    assert.deepEqual(fs.readFileSync(target), adoptedBytes);
    const after = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
    const expected = structuredClone(before);
    expected.plugins.find((entry) => entry.path === ORCHESTRATOR_PLUGIN_NAME).sha256 =
      crypto.createHash('sha256').update(adoptedBytes).digest('hex');
    assert.deepEqual(after, expected);
    assert.deepEqual(snapshotTree(project), projectTreeBefore, 'global adoption must not touch project scope');
  } finally {
    process.chdir(originalCwd);
    if (oldHome === undefined) delete process.env.HOME;
    else process.env.HOME = oldHome;
    if (oldXdg === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = oldXdg;
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});

it('rejects adoption without writes for missing acknowledgment, invalid names/arguments, manifests, entries, or targets', async () => {
  const scenarios = [
    { name: 'missing acknowledgment', args: [PLUGIN_NAME], error: /--accept-current is required/ },
    { name: 'unknown plugin', args: ['custom-plugin.js', '--accept-current'], error: /unknown Guarana plugin filename/ },
    { name: 'unexpected flag', args: [PLUGIN_NAME, '--force'], error: /usage: guarana plugin adopt/ },
    { name: 'unexpected extra argument', args: [PLUGIN_NAME, '--accept-current', '--force'], error: /usage: guarana plugin adopt/ },
    { name: 'duplicate acknowledgment', args: [PLUGIN_NAME, '--accept-current', '--accept-current'], error: /usage: guarana plugin adopt/ },
    { name: 'wrong argument order', args: ['--accept-current', PLUGIN_NAME], error: /usage: guarana plugin adopt/ },
    { name: 'missing plugin filename', args: ['--accept-current'], error: /usage: guarana plugin adopt/ },
    { name: 'absent manifest', args: [PLUGIN_NAME, '--accept-current'], prepare: ({ manifestFile }) => fs.unlinkSync(manifestFile), error: /manifest does not exist/ },
    { name: 'malformed manifest', args: [PLUGIN_NAME, '--accept-current'], prepare: ({ manifestFile }) => fs.writeFileSync(manifestFile, '{invalid json\n'), error: /invalid JSON/ },
    {
      name: 'unsupported manifest format', args: [PLUGIN_NAME, '--accept-current'],
      prepare: ({ manifestFile }) => {
        const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
        manifest.version = 99;
        fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
      },
      error: /unsupported format/,
    },
    {
      name: 'missing tracked entry', args: [PLUGIN_NAME, '--accept-current'],
      prepare: ({ manifestFile }) => {
        const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
        manifest.plugins = manifest.plugins.filter((entry) => entry.path !== PLUGIN_NAME);
        fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
      },
      error: /exactly one tracked entry/,
    },
    {
      name: 'duplicate tracked entry', args: [PLUGIN_NAME, '--accept-current'],
      prepare: ({ manifestFile }) => {
        const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
        manifest.plugins.push({ ...manifest.plugins.find((entry) => entry.path === PLUGIN_NAME) });
        fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
      },
      error: /invalid plugin artifact entry/,
    },
    {
      name: 'invalid tracked entry', args: [PLUGIN_NAME, '--accept-current'],
      prepare: ({ manifestFile }) => {
        const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
        manifest.plugins.find((entry) => entry.path === PLUGIN_NAME).sha256 = 'not-a-hash';
        fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
      },
      error: /invalid plugin artifact entry/,
    },
    {
      name: 'already tracked hash', args: [PLUGIN_NAME, '--accept-current'],
      prepare: ({ manifestFile, target }) => {
        const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
        manifest.plugins.find((entry) => entry.path === PLUGIN_NAME).sha256 =
          crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex');
        fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
      },
      error: /already tracked/,
    },
    {
      name: 'missing target', args: [PLUGIN_NAME, '--accept-current'],
      prepare: ({ target }) => fs.unlinkSync(target),
      error: /target does not exist/,
    },
    {
      name: 'symlink target', args: [PLUGIN_NAME, '--accept-current'],
      prepare: ({ project, target }) => {
        fs.unlinkSync(target);
        const source = path.join(project, 'plugin-link-source.js');
        fs.writeFileSync(source, 'source remains untouched\n');
        fs.symlinkSync(source, target);
      },
      error: /not a regular non-symlink file/,
    },
    {
      name: 'non-regular target', args: [PLUGIN_NAME, '--accept-current'],
      prepare: ({ target }) => {
        fs.unlinkSync(target);
        fs.mkdirSync(target);
      },
      error: /not a regular non-symlink file/,
    },
    {
      name: 'missing plugin-specific marker', args: [PLUGIN_NAME, '--accept-current'],
      prepare: ({ target }) => fs.writeFileSync(target, '// some other plugin\nlocal bytes\n'),
      error: /no recognized Guarana marker/,
    },
  ];

  const originalCwd = process.cwd();
  for (const scenario of scenarios) {
    const project = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-plugin-adopt-reject-'));
    try {
      process.chdir(project);
      plugin.install(true, { quiet: true });
      const target = pluginTarget(true, PLUGIN_NAME);
      fs.writeFileSync(target, `${PLUGIN_MARKER}\nlocal accepted revision\n`);
      const manifestFile = installManifestTarget(true);
      const options = { project, target, manifestFile };
      scenario.prepare?.(options);
      const before = snapshotTree(project);
      const streams = captureStreams();

      await assert.rejects(plugin.run(['adopt', ...scenario.args], {
        useProject: true,
        ...streams,
      }), scenario.error, scenario.name);
      assert.deepEqual(streams.output(), { stdout: '', stderr: '' }, `${scenario.name} must not report success`);
      assert.deepEqual(snapshotTree(project), before, `${scenario.name} must not write files`);
      if (scenario.name === 'symlink target') assert.ok(fs.lstatSync(target).isSymbolicLink());
    } finally {
      process.chdir(originalCwd);
      fs.rmSync(project, { recursive: true, force: true });
    }
  }
});

it('rolls back the manifest if an ordinary filesystem error follows its replacement', async () => {
  const originalCwd = process.cwd();
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-plugin-adopt-rollback-'));
  try {
    process.chdir(project);
    plugin.install(true, { quiet: true });
    const target = pluginTarget(true, PLUGIN_NAME);
    const pluginBytes = Buffer.from(`${PLUGIN_MARKER}\nlocal accepted revision\n`);
    fs.writeFileSync(target, pluginBytes);
    const manifestFile = installManifestTarget(true);
    const manifestBytes = fs.readFileSync(manifestFile);
    const before = snapshotTree(project);
    const rename = fs.renameSync;
    let injected = false;
    fs.renameSync = function renameAndFailAfterManifestReplacement(source, destination) {
      const result = rename.call(fs, source, destination);
      if (!injected && destination === manifestFile && source.startsWith(`${manifestFile}.tmp-`)) {
        injected = true;
        throw new Error('simulated post-replacement filesystem error');
      }
      return result;
    };
    try {
      await assert.rejects(plugin.run(['adopt', PLUGIN_NAME, '--accept-current'], { useProject: true }),
        /simulated post-replacement filesystem error/);
    } finally {
      fs.renameSync = rename;
    }

    assert.equal(injected, true);
    assert.deepEqual(fs.readFileSync(manifestFile), manifestBytes);
    assert.deepEqual(fs.readFileSync(target), pluginBytes);
    assert.deepEqual(snapshotTree(project), before, 'rollback must leave no temporary or partial file');
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(project, { recursive: true, force: true });
  }
});

it('documents the explicit one-plugin ownership transition in help and README', () => {
  const help = require('../help.js').HELP;
  const readme = fs.readFileSync(path.join(__dirname, '..', '..', 'README.md'), 'utf8');
  for (const text of [help, readme]) {
    assert.match(text, /guarana plugin adopt <plugin-file> --accept-current \[--project\]/);
    assert.match(text, /ownership transition/);
    assert.match(text, /normal install\/uninstall ownership guards remain strict|Normal install and uninstall continue to reject tracked modifications/);
  }
});

it('adopts marker-owned legacy plugins and preserves unknown plugin-directory extras', () => {
  const originalCwd = process.cwd();
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-plugin-legacy-adoption-'));
  const unknown = path.join(project, '.opencode', 'plugins', 'my-local-plugin.js');
  const legacyBytes = Buffer.from('// guarana telemetry plugin (legacy owned)\nlocal legacy bytes\0');
  try {
    process.chdir(project);
    const legacy = pluginTarget(true, PLUGIN_NAME);
    fs.mkdirSync(path.dirname(unknown), { recursive: true });
    fs.writeFileSync(unknown, 'keep this extra plugin\n');
    fs.writeFileSync(legacy, legacyBytes);

    plugin.install(true, { quiet: true });
    const manifest = JSON.parse(fs.readFileSync(installManifestTarget(true), 'utf8'));
    assert.deepEqual(manifest.plugins.map((entry) => entry.path).sort(),
      [PLUGIN_NAME, MEMORY_PLUGIN_NAME, ORCHESTRATOR_PLUGIN_NAME].sort());
    assert.equal(fs.readFileSync(unknown, 'utf8'), 'keep this extra plugin\n');

    plugin.uninstall(true);
    assert.equal(fs.existsSync(legacy), false);
    assert.equal(fs.readFileSync(unknown, 'utf8'), 'keep this extra plugin\n');
    const uninstalled = JSON.parse(fs.readFileSync(installManifestTarget(true), 'utf8'));
    assert.equal(uninstalled.plugins, undefined);
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(project, { recursive: true, force: true });
  }
});

it('preflights every engine before plugin mutations and refuses an ambiguous legacy root', () => {
  const originalCwd = process.cwd();
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-plugin-ambiguous-'));
  const conflictingBytes = Buffer.from('unmanaged skill engine file\0');
  const conflictingFile = path.join(project, '.opencode', 'skill-engine', 'index.js');
  try {
    process.chdir(project);
    fs.mkdirSync(path.dirname(conflictingFile), { recursive: true });
    fs.writeFileSync(conflictingFile, conflictingBytes);
    assert.throws(() => plugin.install(true, { quiet: true }), /existing Guarana plugin .* is required/);
    for (const name of ['guarana-telemetry.js', 'guarana-memory.js', 'guarana-orchestrator.js']) {
      assert.equal(fs.existsSync(pluginTarget(true, name)), false);
    }
    assert.equal(fs.existsSync(path.join(project, '.opencode', 'memory')), false);
    assert.equal(fs.existsSync(path.join(project, '.opencode', 'orchestrator')), false);
    assert.deepEqual(fs.readFileSync(conflictingFile), conflictingBytes);
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(project, { recursive: true, force: true });
  }
});

it('adopts a marker-associated legacy engine by touching only bundle paths', () => {
  const originalCwd = process.cwd();
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-plugin-legacy-'));
  const engineRoot = path.join(project, '.opencode', 'memory');
  const knownFile = path.join(engineRoot, 'capture.js');
  const extra = path.join(engineRoot, 'user-data.bin');
  try {
    process.chdir(project);
    fs.mkdirSync(engineRoot, { recursive: true });
    fs.writeFileSync(knownFile, 'legacy known engine file\n');
    fs.writeFileSync(extra, Buffer.from([0, 1, 0xff, 2]));
    const memoryPlugin = pluginTarget(true, 'guarana-memory.js');
    fs.mkdirSync(path.dirname(memoryPlugin), { recursive: true });
    fs.writeFileSync(memoryPlugin, '// guarana memory plugin (legacy owned)\n');

    plugin.install(true, { quiet: true });
    assert.deepEqual(fs.readFileSync(knownFile), fs.readFileSync(path.join(__dirname, '..', '..', 'cli', 'memory', 'capture.js')));
    assert.deepEqual(fs.readFileSync(extra), Buffer.from([0, 1, 0xff, 2]));
    plugin.uninstall(true);
    assert.equal(fs.existsSync(knownFile), false);
    assert.deepEqual(fs.readFileSync(extra), Buffer.from([0, 1, 0xff, 2]));
    assert.equal(fs.existsSync(engineRoot), true);
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(project, { recursive: true, force: true });
  }
});

it('deploys Task subagents, reports their health, and removes Guarana-owned profiles', async () => {
  const originalCwd = process.cwd();
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-plugin-agents-'));
  const agentDir = path.join(project, '.opencode', 'agents');
  const expectedAgents = ['worker-code', 'worker-verify', 'worker-research', 'worker-debug', 'worker-specs'];
  try {
    process.chdir(project);
    plugin.install(true, { quiet: true });
    for (const name of expectedAgents) {
      const profile = fs.readFileSync(path.join(agentDir, `${name}.md`), 'utf8');
      assert.match(profile, /mode: subagent/);
      assert.match(profile, /guarana-managed-worker-profile/);
    }

    const output = captureStreams();
    await plugin.run(['status'], { useProject: true, ...output });
    assert.equal(output.output().stdout.split('\n').filter((line) => line.includes('subagent') && line.includes('ok (up to date)')).length, expectedAgents.length);

    const foreign = path.join(agentDir, 'my-worker.md');
    fs.writeFileSync(foreign, 'foreign profile\n');
    plugin.uninstall(true, null, { stdout: output.stdout });
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
    assert.ok(fs.existsSync(path.join(xdg, 'guarana', 'install-manifest.json')));
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
