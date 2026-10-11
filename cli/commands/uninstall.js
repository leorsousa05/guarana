const fs = require('fs');
const skillArtifacts = require('../lib/skill-artifacts.js');
const artifactTransaction = require('../lib/artifact-transaction.js');
const { stdoutLine } = require('../lib/io.js');

function run(args, { useProject, stdout = process.stdout, stderr = process.stderr } = {}) {
  const context = { stdout, stderr };
  const target = require('../lib/paths.js').targetDir(useProject);
  if (!fs.existsSync(target)) {
    stdoutLine(context, `nothing to uninstall: ${target} does not exist`);
    return 0;
  }
  const plugin = require('./plugin.js');
  const pluginPlan = plugin.preflightUninstall(useProject);
  const skillPlan = skillArtifacts.preflight(useProject, 'uninstall', pluginPlan.engines);
  artifactTransaction.run([
    ...artifactTransaction.skillTargets(skillPlan),
    ...artifactTransaction.pluginTargets(pluginPlan),
  ], () => {
    skillArtifacts.applyUninstall(skillPlan);
    stdoutLine(context, `uninstalled guarana from ${target}`);
    plugin.uninstall(useProject, pluginPlan, { skipTransaction: true, stdout, stderr });
  });
  return 0;
}

module.exports = { run };
