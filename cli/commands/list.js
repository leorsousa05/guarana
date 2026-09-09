const fs = require('fs');
const path = require('path');
const { STAMP } = require('../lib/guard.js');
const { SKILLS, PLUGIN_NAME, MEMORY_PLUGIN_NAME, ORCHESTRATOR_PLUGIN_NAME } = require('../constants.js');

function run(args, { useProject }) {
  const target = require('../lib/paths.js').targetDir(useProject);
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
  for (const name of [PLUGIN_NAME, MEMORY_PLUGIN_NAME, ORCHESTRATOR_PLUGIN_NAME]) {
    const pluginPath = require('../lib/paths.js').pluginTarget(useProject, name);
    console.log(`  plugin: ${name.replace(/\.js$/, '')} ${fs.existsSync(pluginPath) ? 'installed' : 'not installed'} (${pluginPath})`);
  }
}

module.exports = { run };
