const fs = require('fs');
const { assertGuard } = require('../lib/guard.js');

function run(args, { useProject }) {
  const target = require('../lib/paths.js').targetDir(useProject);
  if (!fs.existsSync(target)) {
    console.log(`nothing to uninstall: ${target} does not exist`);
    return;
  }
  assertGuard(target, 'uninstall');
  fs.rmSync(target, { recursive: true, force: true });
  console.log(`uninstalled guarana from ${target}`);
}

module.exports = { run };
