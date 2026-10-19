const os = require('os');
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');
const { DASH_SERVER_DIR } = require('../constants.js');
const { stdoutLine, stderrLine } = require('../lib/io.js');
const { progressLine } = require('../lib/terminal.js');
const webSettings = require('../lib/web-settings.js');
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

function ensureDependencies(serverDir, install = spawnSync, ready = dependenciesReady, { stdout = process.stdout, stderr = process.stderr, env = process.env } = {}) {
  if (ready(serverDir)) return true;
  progressLine(stderr, 'Repairing dashboard server dependencies with `npm ci --omit=dev`...', env);
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
  readSettings = webSettings.readWebSettings,
} = {}) {
  const parsedArgs = parseWebArgs(args);
  const { error } = parsedArgs;
  if (error) {
    stderrLine({ stderr }, error);
    return 1;
  }

  let settings;
  try {
    settings = readSettings({ directory: processRef.cwd(), env: processRef.env });
  } catch (settingsError) {
    stderrLine({ stderr }, `Unable to load web settings: ${settingsError.message}`);
    return 1;
  }
  const port = parsedArgs.portExplicit ? parsedArgs.port : settings.effective.server.port;
  const shouldOpen = parsedArgs.openExplicit ? !parsedArgs.noOpen : settings.effective.server.open;

  const serverEntry = path.join(serverDir, 'index.js');
  if (!fs.existsSync(serverEntry)) {
    stderrLine({ stderr }, `dashboard not bundled: ${serverEntry} is missing`);
    return 1;
  }

  if (!ensureDependencies(serverDir, install, ready, { stdout, stderr, env: processRef.env })) {
    stderrLine({ stderr }, 'dashboard dependencies are unavailable or incomplete; run `npm ci --omit=dev` in the dashboard server directory and try again');
    return 1;
  }

  progressLine(stderr, `Starting dashboard server at http://127.0.0.1:${port}...`, processRef.env);
  const child = spawnChild('node', [serverEntry], {
    cwd: processRef.cwd(),
    env: { ...processRef.env, GUARANA_DASH_PORT: String(port) },
    stdio: ['inherit', stdout, stderr],
  });

  const closed = waitForChild(child, processRef);
  if (shouldOpen) {
    try {
      Promise.resolve(open(`http://127.0.0.1:${port}`)).catch(() => {});
    } catch {
      // Best-effort: never fail the command on browser-open failure.
    }
  }
  return closed;
}

module.exports = { run, dependenciesReady, ensureDependencies };
