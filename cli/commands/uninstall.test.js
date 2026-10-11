const { it } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const uninstall = require('./uninstall.js');
const plugin = require('./plugin.js');
const { STAMP } = require('../constants.js');
const { pluginTarget, targetDir, installManifestTarget } = require('../lib/paths.js');

const BIN = path.join(__dirname, '..', '..', 'bin', 'guarana.js');

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

it('keeps plugin files unchanged and preserves existing behavior when the skill target is absent', () => {
  const originalCwd = process.cwd();
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-uninstall-absent-'));
  let stdout = '';
  try {
    process.chdir(project);
    plugin.install(true, { quiet: true });
    const before = fs.readFileSync(pluginTarget(true));
    uninstall.run([], { useProject: true, stdout: { write: (chunk) => { stdout += chunk.toString(); } } });
    assert.match(stdout, /nothing to uninstall/);
    assert.deepEqual(fs.readFileSync(pluginTarget(true)), before);
    assert.equal(fs.existsSync(targetDir(true)), false);
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(project, { recursive: true, force: true });
  }
});

it('refuses a modified managed skill before mutating plugins during uninstall', () => {
  const originalCwd = process.cwd();
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-uninstall-conflict-'));
  try {
    process.chdir(project);
    require('./install.js').run([], { useProject: true, quiet: true });
    const skillFile = path.join(targetDir(true), 'skills', 'plan', 'SKILL.md');
    const local = Buffer.from('user-owned revision\n');
    fs.writeFileSync(skillFile, local);
    const plugins = ['guarana-telemetry.js', 'guarana-memory.js', 'guarana-orchestrator.js']
      .map((name) => fs.readFileSync(pluginTarget(true, name)));

    assert.throws(() => uninstall.run([], { useProject: true }), /managed skill file was modified/);
    assert.deepEqual(fs.readFileSync(skillFile), local);
    for (const [index, name] of ['guarana-telemetry.js', 'guarana-memory.js', 'guarana-orchestrator.js'].entries()) {
      assert.deepEqual(fs.readFileSync(pluginTarget(true, name)), plugins[index]);
    }
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(project, { recursive: true, force: true });
  }
});

for (const proof of ['stamp', 'frontmatter']) {
  it(`refuses legacy ${proof}-proved skill changes through CLI install, update, and uninstall without mutation`, () => {
    const originalCwd = process.cwd();
    const project = fs.mkdtempSync(path.join(os.tmpdir(), `guarana-legacy-cli-${proof}-`));
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-legacy-cli-home-'));
    try {
      process.chdir(project);
      require('./install.js').run([], { useProject: true, quiet: true });

      const root = targetDir(true);
      const stamp = path.join(root, STAMP);
      const manifestFile = installManifestTarget(true);
      const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
      delete manifest.skills;
      fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
      if (proof === 'frontmatter') fs.unlinkSync(stamp);

      const modifiedFile = path.join(root, 'skills', 'plan', 'SKILL.md');
      const modifiedBytes = Buffer.from([0x6c, 0x6f, 0x63, 0x61, 0x6c, 0x00, 0xff, 0x0a]);
      fs.writeFileSync(modifiedFile, modifiedBytes);
      const extra = path.join(root, 'personal', 'keep.txt');
      fs.mkdirSync(path.dirname(extra), { recursive: true });
      fs.writeFileSync(extra, 'unrelated user data\n');

      const manifestBytes = fs.readFileSync(manifestFile);
      const pluginNames = ['guarana-telemetry.js', 'guarana-memory.js', 'guarana-orchestrator.js'];
      const pluginBytes = pluginNames.map((name) => fs.readFileSync(pluginTarget(true, name)));
      const before = snapshotTree(project);
      const env = { ...process.env, HOME: home, XDG_CONFIG_HOME: path.join(home, 'config') };

      for (const command of ['uninstall', 'update', 'install']) {
        const result = spawnSync(process.execPath, [BIN, command, '--project'], {
          cwd: project,
          env,
          encoding: 'utf8',
        });
        assert.equal(result.status, 1, `${command}: ${result.stderr}`);
        assert.equal(result.stdout, '');
        assert.match(result.stderr, /refuse to use legacy skill root: canonical file differs from bundle:/);
        assert.deepEqual(fs.readFileSync(modifiedFile), modifiedBytes);
        assert.deepEqual(fs.readFileSync(manifestFile), manifestBytes);
        for (const [index, name] of pluginNames.entries()) {
          assert.deepEqual(fs.readFileSync(pluginTarget(true, name)), pluginBytes[index]);
        }
        assert.deepEqual(snapshotTree(project), before);
      }
    } finally {
      process.chdir(originalCwd);
      fs.rmSync(home, { recursive: true, force: true });
      fs.rmSync(project, { recursive: true, force: true });
    }
  });
}
