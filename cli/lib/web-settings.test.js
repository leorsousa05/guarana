'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  DEFAULT_WEB_SETTINGS,
  mergeWebSettings,
  readWebSettings,
  validateWebSettings,
  webSettingsPaths,
  writeWebSettings,
} = require('./web-settings.js');

function tempDirectory() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-web-settings-'));
}

test('resolves project, XDG global, and home-fallback paths', () => {
  const project = '/work/project';
  assert.deepEqual(webSettingsPaths({ directory: project, env: { XDG_CONFIG_HOME: '/custom/config' }, home: '/unused' }), {
    project: path.join(project, '.guarana', 'web.json'),
    global: path.join('/custom/config', 'guarana', 'web.json'),
  });
  assert.deepEqual(webSettingsPaths({ directory: project, env: { HOME: '/home/example' }, home: '/unused' }), {
    project: path.join(project, '.guarana', 'web.json'),
    global: path.join('/home/example', '.config', 'guarana', 'web.json'),
  });
  assert.deepEqual(webSettingsPaths({ directory: project, env: {}, home: '/home/fallback' }), {
    project: path.join(project, '.guarana', 'web.json'),
    global: path.join('/home/fallback', '.config', 'guarana', 'web.json'),
  });
});

test('provides real defaults and merges partial settings per field with sources', () => {
  assert.deepEqual(DEFAULT_WEB_SETTINGS, {
    appearance: { theme: 'light', startPage: 'overview' },
    refresh: { intervalSeconds: 5 },
    server: { port: 4200, open: true },
  });
  assert.deepEqual(mergeWebSettings(
    { appearance: { theme: 'dark' }, server: { port: 4312, open: false } },
    { appearance: { startPage: 'runs' }, server: { port: 4400 } },
  ), {
    global: { appearance: { theme: 'dark' }, server: { port: 4312, open: false } },
    project: { appearance: { startPage: 'runs' }, server: { port: 4400 } },
    effective: {
      appearance: { theme: 'dark', startPage: 'runs' },
      refresh: { intervalSeconds: 5 },
      server: { port: 4400, open: false },
    },
    sources: {
      appearance: { theme: 'global', startPage: 'project' },
      refresh: { intervalSeconds: 'default' },
      server: { port: 'project', open: 'global' },
    },
  });
});

test('reads XDG global and project files, reporting defaults and field sources', () => {
  const root = tempDirectory();
  try {
    const options = { directory: path.join(root, 'project'), env: { XDG_CONFIG_HOME: path.join(root, 'xdg') } };
    const files = webSettingsPaths(options);
    fs.mkdirSync(path.dirname(files.global), { recursive: true });
    fs.mkdirSync(path.dirname(files.project), { recursive: true });
    fs.writeFileSync(files.global, '{"appearance":{"theme":"dark"},"server":{"open":false}}\n');
    fs.writeFileSync(files.project, '{"appearance":{"startPage":"settings"},"server":{"port":4521}}\n');

    const result = readWebSettings(options);
    assert.deepEqual(result.effective, {
      appearance: { theme: 'dark', startPage: 'settings' },
      refresh: { intervalSeconds: 5 },
      server: { port: 4521, open: false },
    });
    assert.deepEqual(result.sources, {
      appearance: { theme: 'global', startPage: 'project' },
      refresh: { intervalSeconds: 'default' },
      server: { port: 'project', open: 'global' },
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('rejects malformed JSON, unknown fields, wrong types, and invalid ranges', () => {
  for (const settings of [
    null,
    [],
    { unknown: {} },
    { appearance: null },
    { appearance: { color: 'blue' } },
    { appearance: { theme: 'system' } },
    { appearance: { startPage: 'models' } },
    { refresh: { intervalSeconds: 10 } },
    { refresh: { intervalSeconds: '5' } },
    { server: { port: 0 } },
    { server: { port: 65536 } },
    { server: { port: 1.5 } },
    { server: { open: 'false' } },
  ]) {
    assert.throws(() => validateWebSettings(settings), undefined, JSON.stringify(settings));
  }

  const root = tempDirectory();
  try {
    const options = { directory: path.join(root, 'project'), env: { XDG_CONFIG_HOME: path.join(root, 'xdg') } };
    const files = webSettingsPaths(options);
    fs.mkdirSync(path.dirname(files.global), { recursive: true });
    fs.writeFileSync(files.global, '{not JSON\n');
    assert.throws(() => readWebSettings(options), /invalid JSON/);
    assert.equal(fs.readFileSync(files.global, 'utf8'), '{not JSON\n');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('does not silently default when a settings file cannot be read', () => {
  const options = { directory: '/fixture/project', env: { XDG_CONFIG_HOME: '/fixture/xdg' } };
  const files = webSettingsPaths(options);
  const originalReadFile = fs.readFileSync;
  fs.readFileSync = (file, ...args) => {
    if (file === files.global) {
      const error = new Error('permission denied');
      error.code = 'EACCES';
      throw error;
    }
    return originalReadFile(file, ...args);
  };
  try {
    assert.throws(() => readWebSettings(options), /cannot read .*web\.json: permission denied/);
  } finally {
    fs.readFileSync = originalReadFile;
  }
});

test('writes atomically to only the selected scope with restrictive file permissions', () => {
  const root = tempDirectory();
  try {
    const options = { directory: path.join(root, 'project'), env: { XDG_CONFIG_HOME: path.join(root, 'xdg') } };
    const files = webSettingsPaths(options);
    fs.mkdirSync(path.dirname(files.global), { recursive: true });
    fs.writeFileSync(files.global, '{"server":{"port":4201}}\n');
    const globalBefore = fs.readFileSync(files.global);
    const written = writeWebSettings('project', { server: { open: false } }, options);

    assert.deepEqual(written, { server: { open: false } });
    assert.deepEqual(JSON.parse(fs.readFileSync(files.project, 'utf8')), { server: { open: false } });
    assert.equal(fs.statSync(files.project).mode & 0o777, 0o600);
    assert.deepEqual(fs.readFileSync(files.global), globalBefore);
    assert.equal(fs.readdirSync(path.dirname(files.project)).some((name) => name.endsWith('.tmp')), false);

    const projectBefore = fs.readFileSync(files.project);
    const originalRename = fs.renameSync;
    fs.renameSync = () => { throw new Error('injected rename failure'); };
    try {
      assert.throws(() => writeWebSettings('project', { server: { port: 4210 } }, options), /injected rename failure/);
    } finally {
      fs.renameSync = originalRename;
    }
    assert.deepEqual(fs.readFileSync(files.project), projectBefore);
    assert.equal(fs.readdirSync(path.dirname(files.project)).some((name) => name.endsWith('.tmp')), false);
    assert.throws(() => writeWebSettings('project', { server: { port: 70000 } }, options));
    assert.throws(() => writeWebSettings('invalid', {}, options));
    assert.deepEqual(fs.readFileSync(files.project), projectBefore);
    assert.deepEqual(fs.readFileSync(files.global), globalBefore);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('does not overwrite malformed settings in the selected scope', () => {
  const root = tempDirectory();
  try {
    const options = { directory: path.join(root, 'project'), env: {} , home: root };
    const files = webSettingsPaths(options);
    fs.mkdirSync(path.dirname(files.project), { recursive: true });
    const corrupt = '{broken\n';
    fs.writeFileSync(files.project, corrupt);
    assert.throws(() => writeWebSettings('project', { server: { port: 4201 } }, options), /invalid JSON/);
    assert.equal(fs.readFileSync(files.project, 'utf8'), corrupt);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
