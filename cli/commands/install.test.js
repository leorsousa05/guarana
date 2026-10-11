const { it } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const install = require('./install.js');
const update = require('./update.js');
const { SOURCE, STAMP } = require('../constants.js');
const { targetDir, installManifestTarget, pluginTarget, advisorSettingsTarget } = require('../lib/paths.js');
const { PLUGIN_NAME, MEMORY_PLUGIN_NAME, ORCHESTRATOR_PLUGIN_NAME } = require('../constants.js');

function hash(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function sourcePaths(root = SOURCE, relative = '') {
  const result = [];
  for (const entry of fs.readdirSync(path.join(root, relative), { withFileTypes: true })) {
    const child = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) result.push(...sourcePaths(root, child));
    else result.push(child);
  }
  return result;
}

function captureStreams() {
  let stdout = '';
  let stderr = '';
  return {
    stdout: { write: (chunk) => { stdout += chunk.toString(); } },
    stderr: { write: (chunk) => { stderr += chunk.toString(); } },
    output: () => ({ stdout, stderr }),
  };
}

for (const useProject of [true, false]) {
  it(`installs, updates, and uninstalls ${useProject ? 'project' : 'global'} skill manifest entries safely`, () => {
    const originalCwd = process.cwd();
    const originalHome = process.env.HOME;
    const originalXdg = process.env.XDG_CONFIG_HOME;
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-skill-home-'));
    const project = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-skill-project-'));
    const xdg = path.join(home, 'config');
    const scopeRoot = useProject ? project : home;
    try {
      process.env.HOME = home;
      process.env.XDG_CONFIG_HOME = xdg;
      process.chdir(scopeRoot);

      const state = path.join(project, '.guarana');
      const memory = path.join(state, 'memory', 'nodes.jsonl');
      const advisor = advisorSettingsTarget(useProject, project);
      fs.mkdirSync(path.dirname(memory), { recursive: true });
      fs.mkdirSync(path.dirname(advisor), { recursive: true });
      fs.writeFileSync(memory, '{"id":"keep-memory"}\n');
      fs.writeFileSync(advisor, '{"primary":{"provider":"keep"}}\n');

      const output = captureStreams();
      install.run([], { useProject, quiet: true, ...output });
      const skillsRoot = targetDir(useProject);
      const manifestFile = installManifestTarget(useProject);
      const firstManifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
      assert.equal(firstManifest.version, 1);
      assert.deepEqual(Object.keys(firstManifest.engines).sort(), ['memory', 'orchestrator', 'skill-engine']);
      assert.deepEqual(firstManifest.plugins.map((entry) => entry.path).sort(),
        [PLUGIN_NAME, MEMORY_PLUGIN_NAME, ORCHESTRATOR_PLUGIN_NAME].sort());
      for (const entry of firstManifest.plugins) {
        assert.equal(entry.sha256, hash(fs.readFileSync(pluginTarget(useProject, entry.path))));
      }
      assert.ok(Array.isArray(firstManifest.skills.guarana));
      const expectedPaths = [...sourcePaths(), STAMP].sort((a, b) => a.localeCompare(b));
      assert.deepEqual(firstManifest.skills.guarana.map((entry) => entry.path), expectedPaths);
      for (const entry of firstManifest.skills.guarana) {
        assert.equal(entry.sha256, hash(fs.readFileSync(path.join(skillsRoot, ...entry.path.split('/')))));
      }

      const extraDirectory = path.join(skillsRoot, 'local-extra');
      const extra = path.join(extraDirectory, 'notes.txt');
      const emptyExtraDirectory = path.join(skillsRoot, 'local-empty');
      fs.mkdirSync(extraDirectory, { recursive: true });
      fs.mkdirSync(emptyExtraDirectory);
      fs.writeFileSync(extra, 'preserve skill extra\n');
      update.run([], { useProject, ...output });
      const updatedManifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
      assert.deepEqual(updatedManifest.plugins, firstManifest.plugins);
      assert.deepEqual(updatedManifest.engines, firstManifest.engines);
      assert.deepEqual(updatedManifest.skills.guarana, firstManifest.skills.guarana);
      assert.equal(fs.readFileSync(extra, 'utf8'), 'preserve skill extra\n');

      require('./uninstall.js').run([], { useProject, ...output });
      const finalManifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
      assert.deepEqual(finalManifest.engines, {});
      assert.deepEqual(finalManifest.skills, {});
      assert.equal(finalManifest.plugins, undefined);
      assert.equal(fs.readFileSync(extra, 'utf8'), 'preserve skill extra\n');
      assert.equal(fs.existsSync(emptyExtraDirectory), true);
      assert.equal(fs.existsSync(path.join(skillsRoot, 'skills', 'plan')), false);
      assert.equal(fs.readFileSync(memory, 'utf8'), '{"id":"keep-memory"}\n');
      assert.equal(fs.readFileSync(advisor, 'utf8'), '{"primary":{"provider":"keep"}}\n');
      assert.equal(fs.existsSync(state), true);
      assert.equal(fs.existsSync(pluginTarget(useProject)), false);
    } finally {
      process.chdir(originalCwd);
      if (originalHome === undefined) delete process.env.HOME;
      else process.env.HOME = originalHome;
      if (originalXdg === undefined) delete process.env.XDG_CONFIG_HOME;
      else process.env.XDG_CONFIG_HOME = originalXdg;
      fs.rmSync(home, { recursive: true, force: true });
      fs.rmSync(project, { recursive: true, force: true });
    }
  });
}

it('preflights modified and untracked skill conflicts before changing plugins or artifacts', () => {
  const originalCwd = process.cwd();
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-skill-conflict-'));
  try {
    process.chdir(project);
    install.run([], { useProject: true, quiet: true, ...captureStreams() });
    const root = targetDir(true);
    const manifestFile = installManifestTarget(true);
    const skillFile = path.join(root, 'skills', 'plan', 'SKILL.md');
    const localBytes = Buffer.from('local modification\0\xff');
    fs.writeFileSync(skillFile, localBytes);
    const pluginFiles = ['guarana-telemetry.js', 'guarana-memory.js', 'guarana-orchestrator.js']
      .map((name) => fs.readFileSync(pluginTarget(true, name)));
    const otherSkill = fs.readFileSync(path.join(root, 'SKILL.md'));
    const manifestBytes = fs.readFileSync(manifestFile);

    assert.throws(() => install.run([], { useProject: true, quiet: true }), /managed skill file was modified/);
    assert.deepEqual(fs.readFileSync(skillFile), localBytes);
    assert.deepEqual(fs.readFileSync(path.join(root, 'SKILL.md')), otherSkill);
    assert.deepEqual(fs.readFileSync(manifestFile), manifestBytes);
    for (const [index, name] of ['guarana-telemetry.js', 'guarana-memory.js', 'guarana-orchestrator.js'].entries()) {
      assert.deepEqual(fs.readFileSync(pluginTarget(true, name)), pluginFiles[index]);
    }

    fs.writeFileSync(skillFile, fs.readFileSync(path.join(SOURCE, 'skills', 'plan', 'SKILL.md')));
    const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
    manifest.skills.guarana = manifest.skills.guarana.filter((entry) => entry.path !== 'skills/plan/SKILL.md');
    fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
    const untrackedManifest = fs.readFileSync(manifestFile);
    assert.throws(() => install.run([], { useProject: true, quiet: true }), /untracked skill file conflicts with bundle/);
    assert.deepEqual(fs.readFileSync(skillFile), fs.readFileSync(path.join(SOURCE, 'skills', 'plan', 'SKILL.md')));
    assert.deepEqual(fs.readFileSync(manifestFile), untrackedManifest);
    for (const [index, name] of ['guarana-telemetry.js', 'guarana-memory.js', 'guarana-orchestrator.js'].entries()) {
      assert.deepEqual(fs.readFileSync(pluginTarget(true, name)), pluginFiles[index]);
    }
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(project, { recursive: true, force: true });
  }
});

for (const proof of ['stamp', 'frontmatter']) {
  it(`adopts legacy skill roots with ${proof} proof and preserves extras`, () => {
    const originalCwd = process.cwd();
    const project = fs.mkdtempSync(path.join(os.tmpdir(), `guarana-legacy-${proof}-`));
    try {
      process.chdir(project);
      const root = targetDir(true);
      fs.mkdirSync(root, { recursive: true });
      const canonical = path.join(root, 'SKILL.md');
      for (const relative of sourcePaths()) {
        const target = path.join(root, ...relative.split('/'));
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(path.join(SOURCE, ...relative.split('/')), target);
      }
      if (proof === 'stamp') fs.writeFileSync(path.join(root, STAMP), '0.1.0\n');
      const extra = path.join(root, 'personal', 'extra.md');
      fs.mkdirSync(path.dirname(extra), { recursive: true });
      fs.writeFileSync(extra, 'keep me\n');

       install.run([], { useProject: true, quiet: true, ...captureStreams() });
      assert.deepEqual(fs.readFileSync(canonical), fs.readFileSync(path.join(SOURCE, 'SKILL.md')));
      const manifest = JSON.parse(fs.readFileSync(installManifestTarget(true), 'utf8'));
      assert.ok(manifest.skills.guarana.some((entry) => entry.path === STAMP));
      assert.equal(fs.readFileSync(extra, 'utf8'), 'keep me\n');

       require('./uninstall.js').run([], { useProject: true, ...captureStreams() });
      assert.equal(fs.existsSync(canonical), false);
      assert.equal(fs.existsSync(path.join(root, STAMP)), false);
      assert.equal(fs.readFileSync(extra, 'utf8'), 'keep me\n');
    } finally {
      process.chdir(originalCwd);
      fs.rmSync(project, { recursive: true, force: true });
    }
  });
}
