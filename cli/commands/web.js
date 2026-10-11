const os = require('os');
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');
const { DASH_SERVER_DIR } = require('../constants.js');
const { stdoutLine, stderrLine } = require('../lib/io.js');
const { parseWebArgs } = require('./web-args.js');

function dependenciesReady(serverDir) {
  try {
    const requireFromServer = createRequire(path.join(serverDir, 'index.js'));
    requireFromServer.resolve('express');
    requireFromServer('express');
    requireFromServer('iconv-lite').getDecoder('utf-8');
    return true;
  } catch {
    return false;
  }
}

function ensureDependencies(serverDir, install = spawnSync, ready = dependenciesReady, { stdout = process.stdout, stderr = process.stderr } = {}) {
  if (ready(serverDir)) return true;
  stdoutLine({ stdout }, 'dashboard server dependencies are missing or incomplete — running `npm ci --omit=dev`...');
  let res;
  try {
    res = install('npm', ['ci', '--omit=dev'], { cwd: serverDir, stdio: ['inherit', stdout, stderr] });
  } catch {
    return false;
  }
  return !res.error && res.status === 0 && ready(serverDir);
}

function openBrowser(url) {
  const opener = process.platform === 'linux' ? 'xdg-open' : process.platform === 'darwin' ? 'open' : 'start';
  try {
    const child = spawn(opener, [url], { detached: true, stdio: 'ignore', shell: process.platform === 'win32' });
    child.on('error', () => {});
    child.unref();
  } catch {
    // best-effort: never fail the command on open failure
  }
}

function waitForChild(child, processRef) {
  return new Promise((resolve, reject) => {
    const forwardInt = () => child.kill('SIGINT');
    const forwardTerm = () => child.kill('SIGTERM');
    let settled = false;

    const cleanup = () => {
      processRef.removeListener('SIGINT', forwardInt);
      processRef.removeListener('SIGTERM', forwardTerm);
    };
    const settle = (callback, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback(value);
    };

    child.once('close', (code, signal) => {
      settle(resolve, signal ? 1 : (code ?? 0));
    });
    child.once('error', (error) => settle(reject, error));
    processRef.on('SIGINT', forwardInt);
    processRef.on('SIGTERM', forwardTerm);
  });
}

function run(args, {
  stdout = process.stdout,
  stderr = process.stderr,
  spawn: spawnChild = spawn,
  spawnSync: install = spawnSync,
  process: processRef = process,
  serverDir = DASH_SERVER_DIR,
  dependenciesReady: ready = dependenciesReady,
  openBrowser: open = openBrowser,
} = {}) {
  const { port, noOpen, error } = parseWebArgs(args);
  if (error) {
    stderrLine({ stderr }, error);
    return 1;
  }

  const serverEntry = path.join(serverDir, 'index.js');
  if (!fs.existsSync(serverEntry)) {
    stderrLine({ stderr }, `dashboard not bundled: ${serverEntry} is missing`);
    return 1;
  }

  if (!ensureDependencies(serverDir, install, ready, { stdout, stderr })) {
    stderrLine({ stderr }, 'dashboard dependencies are unavailable or incomplete; run `npm ci --omit=dev` in the dashboard server directory and try again');
    return 1;
  }

  const child = spawnChild('node', [serverEntry], {
    cwd: processRef.cwd(),
    env: { ...processRef.env, GUARANA_DASH_PORT: String(port) },
    stdio: ['inherit', stdout, stderr],
  });

  const closed = waitForChild(child, processRef);
  if (!noOpen) {
    try {
      Promise.resolve(open(`http://127.0.0.1:${port}`)).catch(() => {});
    } catch {
      // Best-effort: never fail the command on browser-open failure.
    }
  }
  return closed;
}

module.exports = { run, dependenciesReady, ensureDependencies };
