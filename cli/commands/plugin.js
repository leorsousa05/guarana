const fs = require('fs');
const path = require('path');
const {
  PLUGIN_BUNDLE, PLUGIN_NAME,
  MEMORY_PLUGIN_BUNDLE, MEMORY_PLUGIN_NAME,
  MEMORY_ENGINE_SOURCE, MEMORY_ENGINE_NAME,
} = require('../constants.js');
const { pluginIsOurs, PLUGIN_MARKER, MEMORY_PLUGIN_MARKER } = require('../lib/guard.js');
const { pluginTarget, memoryEngineTarget } = require('../lib/paths.js');

const PLUGINS = [
  { name: PLUGIN_NAME, bundle: PLUGIN_BUNDLE, marker: PLUGIN_MARKER },
  { name: MEMORY_PLUGIN_NAME, bundle: MEMORY_PLUGIN_BUNDLE, marker: MEMORY_PLUGIN_MARKER },
];

function copyDir(src, dest) {
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function pluginInstall(useProject) {
  for (const { name, bundle, marker } of PLUGINS) {
    const target = pluginTarget(useProject, name);
    if (fs.existsSync(target) && !pluginIsOurs(target, bundle, marker)) {
      console.error(`refuse to install: ${target} exists and was not installed by guarana (content differs from bundle)`);
      process.exit(1);
    }
    const existed = fs.existsSync(target);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(bundle, target);
    console.log(`${existed ? 'updated' : 'installed'} plugin ${name.replace(/\.js$/, '')} -> ${target}`);
  }
  const engineTarget = memoryEngineTarget(useProject);
  copyDir(MEMORY_ENGINE_SOURCE, engineTarget);
  console.log(`${fs.existsSync(path.join(engineTarget, 'capture.js')) ? 'updated' : 'installed'} memory engine -> ${engineTarget}`);
}

function pluginUninstall(useProject) {
  for (const { name, bundle, marker } of PLUGINS) {
    const target = pluginTarget(useProject, name);
    if (!fs.existsSync(target)) {
      console.log(`nothing to uninstall: ${target} does not exist`);
      continue;
    }
    if (!pluginIsOurs(target, bundle, marker)) {
      console.error(`refuse to uninstall: ${target} was not installed by guarana (content differs from bundle)`);
      process.exit(1);
    }
    fs.rmSync(target);
    console.log(`uninstalled plugin ${name.replace(/\.js$/, '')} from ${target}`);
  }
  const engineTarget = memoryEngineTarget(useProject);
  if (fs.existsSync(engineTarget)) {
    fs.rmSync(engineTarget, { recursive: true, force: true });
    console.log(`uninstalled memory engine from ${engineTarget}`);
  }
}

function run(args, { useProject }) {
  const sub = args[0];
  switch (sub) {
    case 'install': pluginInstall(useProject); break;
    case 'uninstall': pluginUninstall(useProject); break;
    default:
      console.error(`unknown plugin command: ${sub === undefined ? '(missing)' : sub}`);
      process.stdout.write(require('../help.js').HELP);
      process.exit(1);
  }
}

module.exports = { run };
