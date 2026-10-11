'use strict';

const { it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const install = require('./install.js');
const update = require('./update.js');
const uninstall = require('./uninstall.js');
const plugin = require('./plugin.js');
const { PLUGIN_NAME, STAMP } = require('../constants.js');
const { targetDir, pluginTarget, advisorSettingsTarget } = require('../lib/paths.js');

function treeSnapshot(root, relative = '', result = new Map()) {
  for (const entry of fs.readdirSync(path.join(root, relative), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const child = relative ? `${relative}/${entry.name}` : entry.name;
    const target = path.join(root, ...child.split('/'));
    const stat = fs.lstatSync(target);
    if (entry.isDirectory()) {
      result.set(target, { type: 'directory', mode: stat.mode & 0o7777 });
      treeSnapshot(root, child, result);
    } else {
      result.set(target, { type: 'file', bytes: fs.readFileSync(target), mode: stat.mode & 0o7777 });
    }
  }
  return result;
}

function snapshotRoots(roots) {
  const result = new Map();
  for (const root of roots) treeSnapshot(root, '', result);
  return result;
}

function withScope(useProject, run) {
  const originalCwd = process.cwd();
  const originalHome = process.env.HOME;
  const originalXdg = process.env.XDG_CONFIG_HOME;
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-transaction-'));
  const home = path.join(temp, 'home');
  const project = path.join(temp, 'project');
  const xdg = path.join(home, 'xdg');
  fs.mkdirSync(home);
  fs.mkdirSync(project);
  process.env.HOME = home;
  process.env.XDG_CONFIG_HOME = xdg;
  process.chdir(project);
  try {
    const settings = advisorSettingsTarget(useProject, project);
    fs.mkdirSync(path.dirname(settings), { recursive: true });
    fs.writeFileSync(settings, '{"primary":{"provider":"anthropic","model":"claude-sonnet-4"}}\n');
    const globalSettings = advisorSettingsTarget(false, project);
    if (globalSettings !== settings) {
      fs.mkdirSync(path.dirname(globalSettings), { recursive: true });
      fs.writeFileSync(globalSettings, '{"primary":{"provider":"openai","model":"gpt-5"}}\n');
    }
    const memory = path.join(project, '.guarana', 'memory', 'nodes.jsonl');
    fs.mkdirSync(path.dirname(memory), { recursive: true });
    fs.writeFileSync(memory, '{"id":"preserve-memory"}\n');
    const extra = path.join(useProject ? project : xdg, '.scope-marker');
    fs.mkdirSync(path.dirname(extra), { recursive: true });
    fs.writeFileSync(extra, 'preserve foreign data\n');
    return run({ project, home, xdg, roots: [project, home] });
  } finally {
    process.chdir(originalCwd);
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
    if (originalXdg === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = originalXdg;
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

function injectAfter(method, matches, occurrence = 1) {
  const original = fs[method];
  let count = 0;
  let injected = false;
  fs[method] = function (...args) {
    const result = original.apply(this, args);
    if (!injected && matches(...args) && ++count === occurrence) {
      injected = true;
      throw new Error(`injected after ${method}`);
    }
    return result;
  };
  return {
    restore() { fs[method] = original; },
    get injected() { return injected; },
  };
}

function assertRestored(roots, before) {
  assert.deepEqual(snapshotRoots(roots), before);
}

function captureStreams() {
  return { stdout: { write() {} }, stderr: { write() {} } };
}

for (const useProject of [true, false]) {
  const scope = useProject ? 'project' : 'global';

  it(`rolls back fresh ${scope} install after a real managed file write`, () => withScope(useProject, ({ roots }) => {
    const target = path.join(targetDir(useProject), 'SKILL.md');
    const before = snapshotRoots(roots);
    const fault = injectAfter('writeFileSync', (file) => file === target);
    try {
      assert.throws(() => install.run([], { useProject, quiet: true }), /injected after writeFileSync/);
      assert.ok(fault.injected);
    } finally { fault.restore(); }
    assertRestored(roots, before);
  }));

  it(`rolls back ${scope} update after the manifest rename commits`, () => withScope(useProject, ({ roots }) => {
    install.run([], { useProject, quiet: true });
    fs.chmodSync(path.join(targetDir(useProject), 'SKILL.md'), 0o600);
    const manifest = path.join(useProject ? process.cwd() : process.env.XDG_CONFIG_HOME, useProject ? '.guarana' : 'guarana', 'install-manifest.json');
    const before = snapshotRoots(roots);
    const fault = injectAfter('renameSync', (_from, to) => to === manifest, 2);
    try {
      assert.throws(() => update.run([], { useProject }), /injected after renameSync/);
      assert.ok(fault.injected);
    } finally { fault.restore(); }
    assertRestored(roots, before);
  }));

  it(`rolls back ${scope} uninstall after a managed file has been deleted`, () => withScope(useProject, ({ roots }) => {
    install.run([], { useProject, quiet: true });
    const target = path.join(targetDir(useProject), STAMP);
    const before = snapshotRoots(roots);
    const fault = injectAfter('unlinkSync', (file) => file === target);
    try {
      assert.throws(() => uninstall.run([], { useProject, ...captureStreams() }), /injected after unlinkSync/);
      assert.ok(fault.injected);
    } finally {
      fault.restore();
    }
    assertRestored(roots, before);
  }));

  it(`rolls back standalone ${scope} plugin install after a real plugin copy`, () => withScope(useProject, ({ roots }) => {
    const target = pluginTarget(useProject, PLUGIN_NAME);
    const before = snapshotRoots(roots);
    const fault = injectAfter('copyFileSync', (_source, destination) => destination === target);
    try {
      assert.throws(() => plugin.install(useProject, { quiet: true }), /injected after copyFileSync/);
      assert.ok(fault.injected);
    } finally { fault.restore(); }
    assertRestored(roots, before);
  }));

  it(`rolls back standalone ${scope} plugin uninstall after a real plugin deletion`, () => withScope(useProject, ({ roots }) => {
    plugin.install(useProject, { quiet: true });
    const target = pluginTarget(useProject, PLUGIN_NAME);
    const before = snapshotRoots(roots);
    const fault = injectAfter('rmSync', (file) => file === target);
    try {
      assert.throws(() => plugin.uninstall(useProject, null, captureStreams()), /injected after rmSync/);
      assert.ok(fault.injected);
    } finally {
      fault.restore();
    }
    assertRestored(roots, before);
  }));
}
