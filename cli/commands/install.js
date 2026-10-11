const { VERSION, SKILLS } = require('../constants.js');
const skillArtifacts = require('../lib/skill-artifacts.js');
const { targetDir } = require('../lib/paths.js');
const artifactTransaction = require('../lib/artifact-transaction.js');
const { stdoutLine } = require('../lib/io.js');

function run(args, { useProject, quiet = false, stdout = process.stdout, stderr = process.stderr } = {}) {
  const context = { stdout, stderr };
  const target = targetDir(useProject);
  const plugin = require('./plugin.js');
  const pluginPlan = plugin.preflightInstall(useProject);
  const skillPlan = skillArtifacts.preflight(useProject, 'install', pluginPlan.engines);
  const existed = skillPlan.rootExisted;
  artifactTransaction.run([
    ...artifactTransaction.skillTargets(skillPlan),
    ...artifactTransaction.pluginTargets(pluginPlan),
  ], () => {
    skillArtifacts.applyInstall(skillPlan);
    if (!quiet) {
      stdoutLine(context, `${existed ? 'updated' : 'installed'} guarana ${VERSION} -> ${target}`);
      stdoutLine(context, `skills: ${SKILLS.map((s) => 'guarana:' + s).join(', ')}`);
    }
    // The orchestrator and memory hooks are part of automatic operation, not a
    // second opt-in installation step.
    plugin.install(useProject, { quiet, preflight: pluginPlan, skipTransaction: true, stdout, stderr });
  });
  return 0;
}

module.exports = { run };
