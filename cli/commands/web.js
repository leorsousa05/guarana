const os = require('os');
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { DASH_SERVER_DIR, DASH_DEFAULT_PORT } = require('../constants.js');

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

function run(args) {
  let port = DASH_DEFAULT_PORT;
  let noOpen = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--no-open') noOpen = true;
    else if (args[i] === '--port') {
      const n = Number(args[++i]);
      if (!Number.isInteger(n) || n < 1 || n > 65535) {
        console.error(`invalid --port value: ${args[i]}`);
        process.exit(1);
      }
      port = n;
    }
  }

  const serverEntry = path.join(DASH_SERVER_DIR, 'index.js');
  if (!fs.existsSync(serverEntry)) {
    console.error(`dashboard not bundled: ${serverEntry} is missing`);
    process.exit(1);
  }

  if (!fs.existsSync(path.join(DASH_SERVER_DIR, 'node_modules'))) {
    console.log('dashboard server dependencies missing — running `npm install --omit=dev` (network required, one-time)...');
    const res = spawnSync('npm', ['install', '--omit=dev'], { cwd: DASH_SERVER_DIR, stdio: 'inherit' });
    if (res.error || res.status !== 0) {
      console.error('failed to install dashboard server dependencies');
      process.exit(1);
    }
  }

  const child = spawn('node', [serverEntry], {
    cwd: process.cwd(),
    env: { ...process.env, GUARANA_DASH_PORT: String(port) },
    stdio: 'inherit',
  });

  const forward = (sig) => () => { child.kill(sig); };
  process.on('SIGINT', forward('SIGINT'));
  process.on('SIGTERM', forward('SIGTERM'));

  child.on('exit', (code, signal) => {
    process.exit(signal ? 1 : (code ?? 0));
  });

  if (!noOpen) openBrowser(`http://127.0.0.1:${port}`);
}

module.exports = { run };
