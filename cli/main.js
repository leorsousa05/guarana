'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, spawnSync } = require('child_process');

const PKG = require('../package.json');
const VERSION = PKG.version;
const STAMP = '.guarana-version';
const SOURCE = path.join(__dirname, 'skills', 'guarana');
const SKILLS = ['plan', 'build', 'code', 'verify', 'remember', 'debug', 'measure'];
const PLUGIN_BUNDLE = path.join(__dirname, 'plugin', 'guarana-telemetry.js');
const PLUGIN_NAME = 'guarana-telemetry.js';
const DASH_SERVER_DIR = path.join(__dirname, 'dashboard', 'server');
const DASH_DEFAULT_PORT = 4200;

const HELP = `guarana ${VERSION} — installer for the guarana skill suite (OpenCode)

Usage:
  guarana install [--project]     Install the skill suite
  guarana uninstall [--project]   Remove the installed suite
  guarana list [--project]        Show installed skills, version, and plugin presence
  guarana update [--project]      Re-install from the CLI's bundled skills
  guarana plugin install [--project]    Install the telemetry plugin
  guarana plugin uninstall [--project]  Remove the telemetry plugin
  guarana web [--port N] [--no-open]  Start the guarana dashboard and open it in the browser
  guarana --help                  Show this help
  guarana --version               Show version

Targets:
  default      ~/.agents/skills/guarana/
  --project    ./skills/guarana/ (current working directory)

Plugin targets:
  default      ~/.config/opencode/plugins/guarana-telemetry.js
  --project    ./.opencode/plugins/guarana-telemetry.js (current working directory)
`;

function targetDir(useProject) {
  return useProject
    ? path.join(process.cwd(), 'skills', 'guarana')
    : path.join(os.homedir(), '.agents', 'skills', 'guarana');
}

function pluginTarget(useProject) {
  return useProject
    ? path.join(process.cwd(), '.opencode', 'plugins', PLUGIN_NAME)
    : path.join(os.homedir(), '.config', 'opencode', 'plugins', PLUGIN_NAME);
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

// Safety guard: refuse to touch an existing dir that isn't a guarana install.
function assertGuard(target, action) {
  if (!fs.existsSync(target)) return;
  if (fs.existsSync(path.join(target, STAMP))) return;
  const skillMd = path.join(target, 'SKILL.md');
  if (fs.existsSync(skillMd)) {
    const content = fs.readFileSync(skillMd, 'utf8');
    if (/^name:\s*guarana\s*$/m.test(content)) return;
  }
  console.error(`refuse to ${action}: ${target} exists but is not a guarana install (no ${STAMP} stamp or guarana SKILL.md)`);
  process.exit(1);
}

function install(target) {
  const existed = fs.existsSync(target);
  assertGuard(target, 'install');
  copyDir(SOURCE, target);
  fs.writeFileSync(path.join(target, STAMP), VERSION + '\n');
  console.log(`${existed ? 'updated' : 'installed'} guarana ${VERSION} -> ${target}`);
  console.log(`skills: ${SKILLS.map(s => 'guarana:' + s).join(', ')}`);
}

function uninstall(target) {
  if (!fs.existsSync(target)) {
    console.log(`nothing to uninstall: ${target} does not exist`);
    return;
  }
  assertGuard(target, 'uninstall');
  fs.rmSync(target, { recursive: true, force: true });
  console.log(`uninstalled guarana from ${target}`);
}

function list(target, useProject) {
  if (!fs.existsSync(path.join(target, 'SKILL.md'))) {
    console.log(`no guarana install at ${target}`);
    return;
  }
  const stampPath = path.join(target, STAMP);
  const version = fs.existsSync(stampPath) ? fs.readFileSync(stampPath, 'utf8').trim() : 'unknown';
  console.log(`guarana ${version} at ${target}`);
  for (const name of SKILLS) {
    const present = fs.existsSync(path.join(target, 'skills', name, 'SKILL.md'));
    console.log(`  guarana:${name}${present ? '' : ' (missing)'}`);
  }
  const pluginPath = pluginTarget(useProject);
  console.log(`  plugin: guarana-telemetry ${fs.existsSync(pluginPath) ? 'installed' : 'not installed'} (${pluginPath})`);
}

// Plugin guard: a target file is "guarana-installed" iff byte-identical to the bundle.
function pluginIsOurs(target) {
  if (!fs.existsSync(target)) return false;
  const a = fs.readFileSync(target);
  const b = fs.readFileSync(PLUGIN_BUNDLE);
  return a.length === b.length && a.equals(b);
}

function pluginInstall(target) {
  if (fs.existsSync(target) && !pluginIsOurs(target)) {
    console.error(`refuse to install: ${target} exists and was not installed by guarana (content differs from bundle)`);
    process.exit(1);
  }
  const existed = fs.existsSync(target);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(PLUGIN_BUNDLE, target);
  console.log(`${existed ? 'already installed (identical)' : 'installed'} plugin guarana-telemetry -> ${target}`);
}

function pluginUninstall(target) {
  if (!fs.existsSync(target)) {
    console.log(`nothing to uninstall: ${target} does not exist`);
    return;
  }
  if (!pluginIsOurs(target)) {
    console.error(`refuse to uninstall: ${target} was not installed by guarana (content differs from bundle)`);
    process.exit(1);
  }
  fs.rmSync(target);
  console.log(`uninstalled plugin guarana-telemetry from ${target}`);
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

function dashboard(args) {
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

  if (!noOpen) openBrowser(`http://localhost:${port}`);
}

function main(args) {
  const useProject = args.includes('--project');
  const rest = args.filter(a => a !== '--project');
  const cmd = rest[0];

  if (cmd === '--help' || cmd === '-h' || cmd === undefined) {
    process.stdout.write(HELP);
    return;
  }
  if (cmd === '--version' || cmd === '-v') {
    console.log(VERSION);
    return;
  }

  if (cmd === 'plugin') {
    const sub = rest[1];
    const target = pluginTarget(useProject);
    switch (sub) {
      case 'install': pluginInstall(target); break;
      case 'uninstall': pluginUninstall(target); break;
      default:
        console.error(`unknown plugin command: ${sub === undefined ? '(missing)' : sub}`);
        process.stdout.write(HELP);
        process.exit(1);
    }
    return;
  }

  if (cmd === 'web') {
    dashboard(rest.slice(1));
    return;
  }

  const target = targetDir(useProject);
  switch (cmd) {
    case 'install': install(target); break;
    case 'uninstall': uninstall(target); break;
    case 'list': list(target, useProject); break;
    case 'update': install(target); break;
    default:
      console.error(`unknown command: ${cmd}`);
      process.stdout.write(HELP);
      process.exit(1);
  }
}

module.exports = { main };
