const { it } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const web = require('./web.js');
const registry = require('./registry.js');
const { main } = require('../main.js');

function streams({ stdoutTTY = false, stderrTTY = false } = {}) {
  let stdout = '';
  let stderr = '';
  return {
    stdout: { isTTY: stdoutTTY, write: (chunk) => { stdout += chunk.toString(); } },
    stderr: { isTTY: stderrTTY, write: (chunk) => { stderr += chunk.toString(); } },
    output: () => ({ stdout, stderr }),
  };
}

function fakeProcess({ cwd = '/working/project', env } = {}) {
  const ref = new EventEmitter();
  ref.cwd = () => cwd;
  ref.env = env || {
    EXISTING_ENV: 'preserved',
    HOME: path.join(os.tmpdir(), `guarana-web-test-home-${process.pid}`),
    XDG_CONFIG_HOME: path.join(os.tmpdir(), `guarana-web-test-xdg-${process.pid}`),
  };
  return ref;
}

function fixture(withModules = true, withEncodings = true) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-web-'));
  fs.writeFileSync(path.join(dir, 'index.js'), '');
  if (withModules) {
    const modules = path.join(dir, 'node_modules');
    fs.mkdirSync(path.join(modules, 'express'), { recursive: true });
    fs.writeFileSync(path.join(modules, 'express', 'index.js'), 'module.exports = {};');
    const iconv = path.join(modules, 'iconv-lite');
    fs.mkdirSync(iconv, { recursive: true });
    fs.writeFileSync(path.join(iconv, 'index.js'), `exports.getDecoder = () => require('./${withEncodings ? 'encodings' : 'missing'}');`);
    if (withEncodings) fs.writeFileSync(path.join(iconv, 'encodings.js'), 'module.exports = {};');
  }
  return dir;
}

it('skips install for healthy dashboard dependencies', () => {
  const dir = fixture();
  try {
    let installs = 0;
    assert.equal(web.ensureDependencies(dir, () => { installs++; }), true);
    assert.equal(installs, 0);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

it('runs exactly npm ci --omit=dev for missing and incomplete dependencies', () => {
  for (const dir of [fixture(false), fixture(true, false)]) {
    try {
      let calls = 0;
      const output = streams();
      assert.equal(web.ensureDependencies(dir, (command, args, options) => {
        calls++;
        assert.equal(command, 'npm');
        assert.deepEqual(args, ['ci', '--omit=dev']);
        assert.equal(options.cwd, dir);
        assert.deepEqual(options.stdio, ['inherit', output.stdout, output.stderr]);
        return { status: 1 };
      }, undefined, output), false);
      assert.equal(calls, 1);
      assert.equal(output.output().stdout, 'dashboard server dependencies are missing or incomplete — running `npm ci --omit=dev`...\n');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
});

it('emits dependency-repair progress only to TTY stderr and respects color opt-outs', () => {
  const message = 'Repairing dashboard server dependencies with `npm ci --omit=dev`...';
  for (const mode of [
    { name: 'TTY', tty: true, env: { TERM: 'xterm' }, color: true },
    { name: 'NO_COLOR', tty: true, env: { TERM: 'xterm', NO_COLOR: '1' }, color: false },
    { name: 'TERM=dumb', tty: true, env: { TERM: 'dumb' }, color: false },
    { name: 'non-TTY', tty: false, env: { TERM: 'xterm' }, color: false },
  ]) {
    const dir = fixture(false);
    const output = streams({ stderrTTY: mode.tty });
    try {
      const progress = mode.color ? `\u001b[36m${message}\u001b[39m\n` : mode.tty ? `${message}\n` : '';
      assert.equal(web.ensureDependencies(dir, () => {
        assert.equal(output.output().stderr, progress, mode.name);
        return { status: 1 };
      }, () => false, {
        ...output,
        env: mode.env,
      }), false, mode.name);
      assert.equal(output.output().stderr, progress, mode.name);
      assert.equal(output.output().stdout, 'dashboard server dependencies are missing or incomplete — running `npm ci --omit=dev`...\n', mode.name);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
});

it('allows startup after post-install repair passes the readiness probe', () => {
  const dir = fixture(false);
  try {
    assert.equal(web.ensureDependencies(dir, () => {
      const modules = path.join(dir, 'node_modules');
      fs.mkdirSync(path.join(modules, 'express'), { recursive: true });
      fs.writeFileSync(path.join(modules, 'express', 'index.js'), 'module.exports = {};');
      const iconv = path.join(modules, 'iconv-lite');
      fs.mkdirSync(iconv, { recursive: true });
      fs.writeFileSync(path.join(iconv, 'index.js'), "exports.getDecoder = () => require('./encodings');");
      fs.writeFileSync(path.join(iconv, 'encodings.js'), 'module.exports = {};');
      return { status: 0 };
    }), true);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

it('returns failure when repair does not produce a healthy dependency tree', () => {
  const dir = fixture(true, false);
  try {
    assert.equal(web.ensureDependencies(dir, () => ({ status: 0 })), false);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

it('spawns the dashboard with the requested port, caller cwd, inherited environment, and stdio, then awaits close', async () => {
  const serverDir = fixture(false);
  const processRef = fakeProcess();
  const child = new EventEmitter();
  const output = streams();
  let spawnArgs;
  let opened;
  try {
    let settled = false;
    const result = web.run(['--port', '4321'], {
      serverDir,
      process: processRef,
      stdout: output.stdout,
      stderr: output.stderr,
      dependenciesReady: () => true,
      spawn: (...args) => { spawnArgs = args; return child; },
      openBrowser: (url) => { opened = url; },
    }).then((code) => { settled = true; return code; });

    assert.deepEqual(spawnArgs, ['node', [path.join(serverDir, 'index.js')], {
      cwd: '/working/project',
      env: {
        ...processRef.env,
        GUARANA_DASH_PORT: '4321',
      },
      stdio: ['inherit', output.stdout, output.stderr],
    }]);
    assert.equal(opened, 'http://127.0.0.1:4321');
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(settled, false);
    child.emit('close', 17, null);
    assert.equal(await result, 17);
  } finally { fs.rmSync(serverDir, { recursive: true, force: true }); }
});

it('emits dashboard-start progress only to TTY stderr, including the URL', async () => {
  const message = 'Starting dashboard server at http://127.0.0.1:4321...';
  for (const mode of [
    { name: 'TTY', tty: true, env: { TERM: 'xterm' }, color: true },
    { name: 'NO_COLOR', tty: true, env: { TERM: 'xterm', NO_COLOR: '1' }, color: false },
    { name: 'TERM=dumb', tty: true, env: { TERM: 'dumb' }, color: false },
    { name: 'non-TTY', tty: false, env: { TERM: 'xterm' }, color: false },
  ]) {
    const serverDir = fixture(false);
    const processRef = fakeProcess();
    processRef.env = {
      ...mode.env,
      EXISTING_ENV: 'preserved',
      HOME: path.join(os.tmpdir(), `guarana-web-test-home-${process.pid}`),
      XDG_CONFIG_HOME: path.join(os.tmpdir(), `guarana-web-test-xdg-${process.pid}`),
    };
    const child = new EventEmitter();
    const output = streams({ stderrTTY: mode.tty });
    const progress = mode.color ? `\u001b[36m${message}\u001b[39m\n` : mode.tty ? `${message}\n` : '';
    let spawnCalls = 0;
    try {
      const result = web.run(['--port', '4321', '--no-open'], {
        serverDir,
        process: processRef,
        stdout: output.stdout,
        stderr: output.stderr,
        dependenciesReady: () => true,
        spawn: () => {
          assert.equal(output.output().stderr, progress, mode.name);
          spawnCalls++;
          return child;
        },
      });
      assert.equal(output.output().stderr, progress, mode.name);
      assert.equal(output.output().stdout, '', mode.name);
      assert.equal(spawnCalls, 1, mode.name);
      child.emit('close', 0, null);
      assert.equal(await result, 0, mode.name);
    } finally { fs.rmSync(serverDir, { recursive: true, force: true }); }
  }
});

it('returns zero when the dashboard closes without an exit code', async () => {
  const serverDir = fixture(false);
  const child = new EventEmitter();
  try {
    const result = web.run(['--no-open'], {
      serverDir,
      process: fakeProcess(),
      dependenciesReady: () => true,
      spawn: () => child,
    });
    child.emit('close', null, null);
    assert.equal(await result, 0);
  } finally { fs.rmSync(serverDir, { recursive: true, force: true }); }
});

it('forwards parent signals and removes both listeners on child close', async () => {
  const serverDir = fixture(false);
  const processRef = fakeProcess();
  const child = new EventEmitter();
  const signals = [];
  child.kill = (signal) => signals.push(signal);
  try {
    const result = web.run(['--no-open'], {
      serverDir,
      process: processRef,
      dependenciesReady: () => true,
      spawn: () => child,
    });
    processRef.emit('SIGINT');
    processRef.emit('SIGTERM');
    assert.deepEqual(signals, ['SIGINT', 'SIGTERM']);
    assert.equal(processRef.listenerCount('SIGINT'), 1);
    assert.equal(processRef.listenerCount('SIGTERM'), 1);
    child.emit('close', null, 'SIGTERM');
    assert.equal(await result, 1);
    assert.equal(processRef.listenerCount('SIGINT'), 0);
    assert.equal(processRef.listenerCount('SIGTERM'), 0);
  } finally { fs.rmSync(serverDir, { recursive: true, force: true }); }
});

it('rejects on child spawn error, removes signal listeners, and lets main report one diagnostic with status 1', async () => {
  const serverDir = fixture(false);
  const processRef = fakeProcess();
  const child = new EventEmitter();
  const originalRun = registry.web.run;
  const runWithSeams = web.run;
  const output = streams();
  try {
    registry.web.run = () => runWithSeams(['--no-open'], {
      serverDir,
      process: processRef,
      dependenciesReady: () => true,
      spawn: () => child,
    });
    const result = main(['web'], output);
    child.emit('error', new Error('dashboard spawn failed'));
    assert.equal(await result, 1);
    assert.deepEqual(output.output(), { stdout: '', stderr: 'dashboard spawn failed\n' });
    assert.equal(processRef.listenerCount('SIGINT'), 0);
    assert.equal(processRef.listenerCount('SIGTERM'), 0);
  } finally {
    registry.web.run = originalRun;
    fs.rmSync(serverDir, { recursive: true, force: true });
  }
});

it('returns status 1 with one diagnostic for invalid port, missing server, and unavailable dependencies', () => {
  const serverDir = fixture(false);
  const missingServerDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-web-missing-'));
  try {
    const invalid = streams();
    assert.equal(web.run(['--port', '65536'], { stderr: invalid.stderr }), 1);
    assert.equal(invalid.output().stderr, 'invalid --port value: 65536\n');

    const missing = streams();
    assert.equal(web.run([], { serverDir: missingServerDir, process: fakeProcess(), stderr: missing.stderr }), 1);
    assert.equal(missing.output().stderr, `dashboard not bundled: ${path.join(missingServerDir, 'index.js')} is missing\n`);

    const unavailable = streams();
    assert.equal(web.run([], {
      serverDir,
      process: fakeProcess(),
      stdout: unavailable.stdout,
      stderr: unavailable.stderr,
      dependenciesReady: () => false,
      spawnSync: () => ({ status: 1 }),
    }), 1);
    assert.equal(unavailable.output().stderr, 'dashboard dependencies are unavailable or incomplete; run `npm ci --omit=dev` in the dashboard server directory and try again\n');
    assert.equal(unavailable.output().stdout, 'dashboard server dependencies are missing or incomplete — running `npm ci --omit=dev`...\n');
  } finally {
    fs.rmSync(serverDir, { recursive: true, force: true });
    fs.rmSync(missingServerDir, { recursive: true, force: true });
  }
});

it('uses effective saved port/open settings and lets explicit flags override them', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-web-configured-'));
  const serverDir = fixture(false);
  const project = path.join(root, 'project');
  const xdg = path.join(root, 'xdg');
  const env = { HOME: path.join(root, 'home'), XDG_CONFIG_HOME: xdg };
  fs.mkdirSync(path.join(project, '.guarana'), { recursive: true });
  fs.mkdirSync(path.join(xdg, 'guarana'), { recursive: true });
  fs.writeFileSync(path.join(xdg, 'guarana', 'web.json'), '{"server":{"port":4310,"open":true}}\n');
  fs.writeFileSync(path.join(project, '.guarana', 'web.json'), '{"server":{"port":4320,"open":false}}\n');
  try {
    for (const [args, expectedPort, shouldOpen] of [
      [[], 4320, false],
      [['--port', '4330'], 4330, false],
      [['--no-open'], 4320, false],
      [['--open'], 4320, true],
    ]) {
      const child = new EventEmitter();
      let spawnOptions;
      let opened = 0;
      const processRef = fakeProcess({ cwd: project, env });
      const result = web.run(args, {
        serverDir,
        process: processRef,
        dependenciesReady: () => true,
        spawn: (...call) => { spawnOptions = call[2]; return child; },
        openBrowser: () => { opened++; },
      });
      assert.equal(spawnOptions.env.GUARANA_DASH_PORT, String(expectedPort));
      child.emit('close', 0, null);
      assert.equal(await result, 0);
      assert.equal(opened, Number(shouldOpen));
    }
  } finally {
    fs.rmSync(serverDir, { recursive: true, force: true });
    fs.rmSync(root, { recursive: true, force: true });
  }
});

it('fails closed on malformed saved settings and rejects conflicting open flags before startup', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-web-invalid-settings-'));
  const serverDir = fixture(false);
  const project = path.join(root, 'project');
  fs.mkdirSync(path.join(project, '.guarana'), { recursive: true });
  fs.writeFileSync(path.join(project, '.guarana', 'web.json'), '{invalid\n');
  try {
    const invalid = streams();
    let spawned = false;
    assert.equal(web.run([], {
      serverDir,
      process: fakeProcess({ cwd: project, env: { HOME: path.join(root, 'home'), XDG_CONFIG_HOME: path.join(root, 'xdg') } }),
      stderr: invalid.stderr,
      dependenciesReady: () => true,
      spawn: () => { spawned = true; return new EventEmitter(); },
    }), 1);
    assert.match(invalid.output().stderr, /^Unable to load web settings: invalid JSON in .*web\.json/);
    assert.equal(spawned, false);

    const conflict = streams();
    assert.equal(web.run(['--open', '--no-open'], { stderr: conflict.stderr }), 1);
    assert.equal(conflict.output().stderr, 'cannot use --open and --no-open together\n');
  } finally {
    fs.rmSync(serverDir, { recursive: true, force: true });
    fs.rmSync(root, { recursive: true, force: true });
  }
});

it('does not emit progress on healthy dependency checks or early-return paths', () => {
  const output = streams({ stderrTTY: true });
  const dir = fixture();
  const missingServerDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-web-missing-'));
  try {
    assert.equal(web.ensureDependencies(dir, () => assert.fail('healthy dependencies must skip repair'), undefined, output), true);
    assert.equal(output.output().stderr, '');

    for (const [args, options] of [
      [['--port', '65536'], { stderr: output.stderr }],
      [[], { serverDir: missingServerDir, process: fakeProcess(), stderr: output.stderr }],
    ]) {
      assert.equal(web.run(args, options), 1);
      assert.doesNotMatch(output.output().stderr, /Repairing dashboard server dependencies|Starting dashboard server/);
    }
    assert.equal(output.output().stdout, '');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(missingServerDir, { recursive: true, force: true });
  }
});

it('skips browser open with --no-open and ignores browser failures', async () => {
  const serverDir = fixture(false);
  try {
    for (const [args, open, expectedOpens] of [
      [['--no-open'], () => assert.fail('browser should not open'), 0],
      [[], () => { throw new Error('open failed'); }, 1],
      [[], () => Promise.reject(new Error('open failed')), 1],
    ]) {
      const child = new EventEmitter();
      let opens = 0;
      const result = web.run(args, {
        serverDir,
        process: fakeProcess(),
        dependenciesReady: () => true,
        spawn: () => child,
        openBrowser: (...params) => { opens++; return open(...params); },
      });
      child.emit('close', 0, null);
      assert.equal(await result, 0);
      assert.equal(opens, expectedOpens);
    }
  } finally { fs.rmSync(serverDir, { recursive: true, force: true }); }
});

it('does not use process.exit or process.exitCode', () => {
  const source = fs.readFileSync(path.join(__dirname, 'web.js'), 'utf8');
  assert.doesNotMatch(source, /\bprocess\.(?:exit|exitCode)\b/);
});
