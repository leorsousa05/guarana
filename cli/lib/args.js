'use strict';

function parseArgs(argv) {
  const commandIndex = argv.findIndex((arg) => arg !== '--project');
  const topLevelCommand = argv[commandIndex];
  const subcommandIndex = topLevelCommand === 'memory'
    ? argv.findIndex((arg, index) => index > commandIndex && arg !== '--project')
    : -1;
  const memorySearchIndex = argv[subcommandIndex] === 'search' ? subcommandIndex : -1;
  const isGlobalProject = (arg, index) =>
    arg === '--project' && !(memorySearchIndex !== -1 && index > memorySearchIndex);
  const useProject = argv.some(isGlobalProject);
  const remainingArgs = argv.filter((arg, index) => !isGlobalProject(arg, index));
  const [command, ...commandArgs] = remainingArgs;

  return { command, commandArgs, useProject };
}

module.exports = { parseArgs };
