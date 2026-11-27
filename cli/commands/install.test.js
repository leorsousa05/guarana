const { it } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const install = require('./install.js');
const update = require('./update.js');
const { SOURCE, STAMP, LEARNING_REVIEW_BUNDLE, VERSION, SKILLS, WORKER_AGENTS } = require('../constants.js');
const {
  targetDir, installManifestTarget, pluginTarget, advisorSettingsTarget, workerAgentsTarget,
  advisorCommandTarget, memoryEngineTarget, memoryModuleTarget, orchestratorEngineTarget, skillEngineTarget,
} = require('../lib/paths.js');
const {
  PLUGIN_NAME, MEMORY_PLUGIN_NAME, LEARNING_REVIEW_NAME, ORCHESTRATOR_PLUGIN_NAME,
} = require('../constants.js');

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

function captureStreams({ stdoutTTY = false, stderrTTY = false } = {}) {
  let stdout = '';
  let stderr = '';
  return {
    stdout: { isTTY: stdoutTTY, write: (chunk) => { stdout += chunk.toString(); } },
    stderr: { isTTY: stderrTTY, write: (chunk) => { stderr += chunk.toString(); } },
    output: () => ({ stdout, stderr }),
  };
}

async function withEnv(values, callback) {
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  try {
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    return await callback();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

it('keeps redirected install bytes unchanged', () => {
  const originalCwd = process.cwd();
  const originalHome = process.env.HOME;
  const originalXdg = process.env.XDG_CONFIG_HOME;
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-install-output-'));
  try {
    process.env.HOME = path.join(project, 'home');
    process.env.XDG_CONFIG_HOME = path.join(project, 'xdg-config');
    process.chdir(project);
    const streams = captureStreams();
    install.run([], { useProject: true, ...streams });
    const target = targetDir(true);
    const plugins = [
      [PLUGIN_NAME, 'plugin'],
      [MEMORY_PLUGIN_NAME, 'plugin'],
      [ORCHESTRATOR_PLUGIN_NAME, 'plugin'],
    ];
    const expected = [
      `installed guarana ${VERSION} -> ${target}`,
      `skills: ${SKILLS.map((skill) => `guarana:${skill}`).join(', ')}`,
      ...plugins.map(([name, kind]) => `installed ${kind} ${name.replace(/\.js$/, '')} -> ${pluginTarget(true, name)}`),
      `updated memory engine -> ${memoryEngineTarget(true)}`,
      `updated orchestrator engine -> ${orchestratorEngineTarget(true)}`,
      `updated skill engine -> ${skillEngineTarget(true)}`,
      ...WORKER_AGENTS.map(({ name }) => `installed/updated subagent ${name} -> ${path.join(workerAgentsTarget(true), `${name}.md`)}`),
      `installed/updated command -> ${advisorCommandTarget(true)}`,
      'advisor setup-only command installed; model profiles unavailable: undefined',
      '',
    ].join('\n');
    assert.deepEqual(streams.output(), { stdout: expected, stderr: '' });
  } finally {
    process.chdir(originalCwd);
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
    if (originalXdg === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = originalXdg;
    fs.rmSync(project, { recursive: true, force: true });
  }
});

it('renders a grouped, colored install summary only on an interactive TTY', async () => {
  const originalCwd = process.cwd();
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-install-tty-'));
  try {
    process.chdir(project);
    await withEnv({
      NO_COLOR: undefined,
      TERM: 'xterm-256color',
      HOME: path.join(project, 'home'),
      XDG_CONFIG_HOME: path.join(project, 'xdg-config'),
    }, () => {
      const streams = captureStreams({ stdoutTTY: true });
      install.run([], { useProject: true, ...streams });
      const { stdout, stderr } = streams.output();
      assert.equal(stderr, '');
      const plain = stdout.replace(/\u001b\[[0-9;]+m/g, '');
      assert.match(plain, new RegExp(`^Guarana ${VERSION.replace(/\./g, '\\.')} \\[installed\\]$`, 'm'));
      assert.match(plain, /^\+-- Skills \[installed\] -> .*\.opencode\/skills\/guarana \(11\)$/m);
      assert.match(plain, /^\+-- Plugins \[installed\] -> .*\.opencode\/plugins$/m);
      assert.match(plain, /^\|   \|-- guarana:plan, guarana:build, guarana:code, guarana:verify$/m);
      for (const name of [
        'guarana-telemetry.js', 'guarana-memory.js', 'guarana-orchestrator.js',
      ]) assert.ok(plain.includes(name), `missing plugin artifact ${name}`);
      assert.match(plain, /^\+-- Engines \[ready\]$/m);
      assert.match(plain, /^\|   \|-- memory: .*\.opencode\/memory$/m);
      assert.match(plain, /^\|   \|-- orchestrator: .*\.opencode\/orchestrator$/m);
      assert.match(plain, /^\|   \\-- skill engine: .*\.opencode\/skill-engine$/m);
      assert.match(plain, /^\+-- Workers \[ready\] -> .*\.opencode\/agents \(5\)$/m);
      for (const skill of SKILLS) assert.ok(plain.includes(`guarana:${skill}`), `missing skill ${skill}`);
      for (const { name } of WORKER_AGENTS) assert.ok(plain.includes(name), `missing worker ${name}`);
      assert.equal(plain.split(targetDir(true)).length - 1, 1, 'skill target directory appears once');
      assert.equal(plain.split(workerAgentsTarget(true)).length - 1, 1, 'worker target directory appears once');
      assert.match(plain, /^\+-- Advisor \[setup required\]$/m);
      assert.ok(plain.includes(`|   \\-- ${path.dirname(advisorCommandTarget(true))}`));
      assert.match(plain, /^\|       \\-- guarana-advisor\.md$/m);
      assert.equal(plain.split(path.dirname(advisorCommandTarget(true))).length - 1, 1);
      assert.match(plain, /^\\-- Next: configure your Primary model IDs:$/m);
      assert.match(plain, /guarana advisor set primary\.provider <provider-id>\n    \\-- guarana advisor set primary\.model <model-id>/);
      assert.doesNotMatch(stdout, /undefined|installed plugin|installed\/updated subagent/);
      const escapes = stdout.match(/\u001b\[[0-9;]+m/g) || [];
      assert.equal(escapes.length % 2, 0);
      assert.equal((stdout.match(/\u001b\[0m/g) || []).length, escapes.length / 2);

      const quiet = captureStreams({ stdoutTTY: true });
      install.run([], { useProject: true, quiet: true, ...quiet });
      assert.deepEqual(quiet.output(), { stdout: '', stderr: '' });
    });
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(project, { recursive: true, force: true });
  }
});

it('keeps the interactive install summary uncolored for NO_COLOR and TERM=dumb', async () => {
  for (const env of [{ NO_COLOR: '1', TERM: 'xterm' }, { NO_COLOR: undefined, TERM: 'dumb' }]) {
    const originalCwd = process.cwd();
    const project = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-install-no-color-'));
    try {
      process.chdir(project);
      await withEnv(env, () => {
        const streams = captureStreams({ stdoutTTY: true });
        install.run([], { useProject: true, ...streams });
        const { stdout, stderr } = streams.output();
        assert.equal(stderr, '');
        assert.doesNotMatch(stdout, /\u001b\[/);
        assert.match(stdout, new RegExp(`^Guarana ${VERSION.replace(/\./g, '\\.')} \\[installed\\]$`, 'm'));
        assert.doesNotMatch(stdout, /undefined/);
      });
    } finally {
      process.chdir(originalCwd);
      fs.rmSync(project, { recursive: true, force: true });
    }
  }
});

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
      const reviewTarget = memoryModuleTarget(useProject, LEARNING_REVIEW_NAME);
      assert.equal(fs.existsSync(reviewTarget), true);
      assert.deepEqual(fs.readFileSync(reviewTarget), fs.readFileSync(LEARNING_REVIEW_BUNDLE));
      assert.ok(firstManifest.engines.memory.some((entry) => entry.path === LEARNING_REVIEW_NAME));
      assert.ok(!firstManifest.plugins.some((entry) => entry.path === LEARNING_REVIEW_NAME));
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
      const legacyReviewTarget = pluginTarget(useProject, LEARNING_REVIEW_NAME);
      const legacyReviewBytes = Buffer.from('// guarana learning review runtime module\nlegacy install copy\n');
      fs.writeFileSync(legacyReviewTarget, legacyReviewBytes);
      const legacyManifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
      legacyManifest.plugins.push({ path: LEARNING_REVIEW_NAME, sha256: hash(legacyReviewBytes) });
      fs.writeFileSync(manifestFile, `${JSON.stringify(legacyManifest, null, 2)}\n`);
      update.run([], { useProject, ...output });
      const updatedManifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
      assert.equal(fs.existsSync(legacyReviewTarget), false);
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
      assert.equal(fs.existsSync(pluginTarget(useProject, LEARNING_REVIEW_NAME)), false);
      assert.equal(fs.existsSync(reviewTarget), false);
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
