const fs = require('fs');
const path = require('path');
const { STAMP } = require('../lib/guard.js');
const { SKILLS } = require('../constants.js');

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
  const pluginPath = require('../lib/paths.js').pluginTarget(useProject);
  console.log(`  plugin: guarana-telemetry ${fs.existsSync(pluginPath) ? 'installed' : 'not installed'} (${pluginPath})`);
}

module.exports = { run };
