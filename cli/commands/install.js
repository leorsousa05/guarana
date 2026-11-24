const path = require('path');
const { VERSION, SKILLS } = require('../constants.js');
const skillArtifacts = require('../lib/skill-artifacts.js');
const { targetDir } = require('../lib/paths.js');
const artifactTransaction = require('../lib/artifact-transaction.js');
const { stdoutLine } = require('../lib/io.js');
const { isTTY, colorize } = require('../lib/terminal.js');

function writeInstallSummary(stdout, { existed, target, pluginPlan }) {
  const label = (text) => colorize(text, stdout, '1;36');
  const status = (text, color = '32') => colorize(`[${text}]`, stdout, color);
  const listRows = (items, size) => {
    const chunks = [];
    for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
    return chunks.map((chunk, index) =>
      `|   ${index === chunks.length - 1 ? '\\--' : '|--'} ${chunk.join(', ')}`);
  };
  const pluginStatus = pluginPlan.plugins.every(({ exists }) => exists)
    ? 'updated'
    : pluginPlan.plugins.every(({ exists }) => !exists) ? 'installed' : 'refreshed';
  const engines = pluginPlan.engines.engines;
  const workers = pluginPlan.profiles.workers;
  const advisor = pluginPlan.profiles.advisor;
  const advisorHasSibling = pluginPlan.profiles.setupOnly;
  const advisorIndent = advisorHasSibling ? '|   ' : '    ';
  const advisorDirectories = new Map();
  for (const { target: profileTarget } of advisor) {
    const directory = path.dirname(profileTarget);
    if (!advisorDirectories.has(directory)) advisorDirectories.set(directory, []);
    advisorDirectories.get(directory).push(path.basename(profileTarget));
  }
  const advisorRows = [...advisorDirectories].flatMap(([directory, files], index, entries) => [
    `${advisorIndent}${index === entries.length - 1 ? '\\--' : '|--'} ${directory}`,
    `${advisorIndent}    \\-- ${files.join(', ')}`,
  ]);
  const lines = [
    `Guarana ${VERSION} ${status(existed ? 'updated' : 'installed')}`,
    `+-- ${label('Skills')} ${status(existed ? 'updated' : 'installed')} -> ${target} (${SKILLS.length})`,
    ...listRows(SKILLS.map((skill) => `guarana:${skill}`), 4),
    `+-- ${label('Plugins')} ${status(pluginStatus)} -> ${path.dirname(pluginPlan.plugins[0].target)}`,
    `|   \\-- ${pluginPlan.plugins.map(({ name }) => name).join(', ')}`,
    `+-- ${label('Engines')} ${status('ready')}`,
    ...engines.map(({ engine, root }, index) =>
      `|   ${index === engines.length - 1 ? '\\--' : '|--'} ${engine.name === 'skill-engine' ? 'skill engine' : engine.name}: ${root}`),
    `+-- ${label('Workers')} ${status('ready')} -> ${path.dirname(workers[0].target)} (${workers.length})`,
    ...listRows(workers.map(({ name }) => name), 3),
    `${advisorHasSibling ? '+--' : '\\--'} ${label('Advisor')} ${status(advisorHasSibling ? 'setup required' : 'configured', advisorHasSibling ? '33' : '32')}`,
    ...advisorRows,
  ];
  if (pluginPlan.profiles.setupOnly) {
    lines.push(
      '\\-- Next: configure your Primary model IDs:',
      '    |-- guarana advisor set primary.provider <provider-id>',
      '    \\-- guarana advisor set primary.model <model-id>',
    );
  }
  stdout.write(`${lines.join('\n')}\n`);
}

function run(args, { useProject, quiet = false, stdout = process.stdout, stderr = process.stderr } = {}) {
  const context = { stdout, stderr };
  const interactive = isTTY(stdout);
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
    if (!quiet && !interactive) {
      stdoutLine(context, `${existed ? 'updated' : 'installed'} guarana ${VERSION} -> ${target}`);
      stdoutLine(context, `skills: ${SKILLS.map((s) => 'guarana:' + s).join(', ')}`);
    }
    // The orchestrator and memory hooks are part of automatic operation, not a
    // second opt-in installation step.
    plugin.install(useProject, {
      quiet: quiet || interactive,
      preflight: pluginPlan,
      skipTransaction: true,
      stdout,
      stderr,
    });
    if (!quiet && interactive) writeInstallSummary(stdout, { existed, target, pluginPlan });
  });
  return 0;
}

module.exports = { run };
