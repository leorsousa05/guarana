const fs = require('fs');
const path = require('path');
const { PLUGIN_BUNDLE, PLUGIN_NAME } = require('../constants.js');
const { pluginIsOurs } = require('../lib/guard.js');

function pluginInstall(target) {
  if (fs.existsSync(target) && !pluginIsOurs(target, PLUGIN_BUNDLE)) {
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
  if (!pluginIsOurs(target, PLUGIN_BUNDLE)) {
    console.error(`refuse to uninstall: ${target} was not installed by guarana (content differs from bundle)`);
    process.exit(1);
  }
  fs.rmSync(target);
  console.log(`uninstalled plugin guarana-telemetry from ${target}`);
}

function run(args, { useProject }) {
  const target = require('../lib/paths.js').pluginTarget(useProject);
  const sub = args[0];
  switch (sub) {
    case 'install': pluginInstall(target); break;
    case 'uninstall': pluginUninstall(target); break;
    default:
      console.error(`unknown plugin command: ${sub === undefined ? '(missing)' : sub}`);
      process.stdout.write(require('../help.js').HELP);
      process.exit(1);
  }
}

module.exports = { run };
