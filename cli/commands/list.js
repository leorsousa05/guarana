const fs = require('fs');
const path = require('path');
const { STAMP } = require('../lib/guard.js');
const { SKILLS, PLUGIN_NAME, MEMORY_PLUGIN_NAME, ORCHESTRATOR_PLUGIN_NAME } = require('../constants.js');
const { stdoutLine } = require('../lib/io.js');

function run(args, { useProject, stdout = process.stdout, stderr = process.stderr } = {}) {
  const context = { stdout, stderr };
  const target = require('../lib/paths.js').targetDir(useProject);
  if (!fs.existsSync(path.join(target, 'SKILL.md'))) {
    stdoutLine(context, `no guarana install at ${target}`);
    return 0;
  }
  const stampPath = path.join(target, STAMP);
  const version = fs.existsSync(stampPath) ? fs.readFileSync(stampPath, 'utf8').trim() : 'unknown';
  stdoutLine(context, `guarana ${version} at ${target}`);
  for (const name of SKILLS) {
    const present = fs.existsSync(path.join(target, 'skills', name, 'SKILL.md'));
    stdoutLine(context, `  guarana:${name}${present ? '' : ' (missing)'}`);
  }
  for (const name of [PLUGIN_NAME, MEMORY_PLUGIN_NAME, ORCHESTRATOR_PLUGIN_NAME]) {
    const pluginPath = require('../lib/paths.js').pluginTarget(useProject, name);
    stdoutLine(context, `  plugin: ${name.replace(/\.js$/, '')} ${fs.existsSync(pluginPath) ? 'installed' : 'not installed'} (${pluginPath})`);
  }
  return 0;
}

module.exports = { run };
