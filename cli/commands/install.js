const fs = require('fs');
const path = require('path');
const { copyDir } = require('../lib/fs.js');
const { assertGuard, STAMP } = require('../lib/guard.js');
const { SOURCE, VERSION, SKILLS } = require('../constants.js');

function run(args, { useProject }) {
  const target = require('../lib/paths.js').targetDir(useProject);
  const existed = fs.existsSync(target);
  assertGuard(target, 'install');
  copyDir(SOURCE, target);
  fs.writeFileSync(path.join(target, STAMP), VERSION + '\n');
  console.log(`${existed ? 'updated' : 'installed'} guarana ${VERSION} -> ${target}`);
  console.log(`skills: ${SKILLS.map((s) => 'guarana:' + s).join(', ')}`);
  // The orchestrator and memory hooks are part of automatic operation, not a
  // second opt-in installation step.
  require('./plugin.js').install(useProject);
}

module.exports = { run };
