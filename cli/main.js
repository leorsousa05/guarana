'use strict';

const { VERSION, SKILLS } = require('./constants.js');
const { HELP } = require('./help.js');
const COMMANDS = require('./commands/registry.js');
const { parseArgs } = require('./lib/args.js');
const { isTTY, colorize } = require('./lib/terminal.js');
const { stderrLine } = require('./lib/io.js');

const HELP_EXAMPLES = [
  '',
  'Examples:',
  '  guarana --help',
  '  guarana memory search "term" --project HASH',
  '  guarana workflow set specs false --project',
  '',
].join('\n');

function writeHelp(stdout) {
  if (!isTTY(stdout)) {
    stdout.write(HELP);
    return;
  }

  let help = `${HELP}${HELP_EXAMPLES}`;
  help = help.replace(/^(Usage:|Targets:|Memory vault and search filter:|Plugin targets:|Examples:)$/gm,
    (heading) => colorize(heading, stdout, '1;36'));
  stdout.write(help);
}

async function main(args, { stdout = process.stdout, stderr = process.stderr } = {}) {
  const { command, commandArgs, useProject } = parseArgs(args);

  if (command === '--help' || command === '-h' || command === undefined) {
    writeHelp(stdout);
    return 0;
  }
  if (command === '--version' || command === '-v') {
    stdout.write(`${VERSION}\n`);
    return 0;
  }

  const handler = COMMANDS[command];
  if (!handler) {
    stderrLine({ stderr }, `unknown command: ${command}`);
    writeHelp(stdout);
    return 1;
  }

  try {
    const result = await handler.run(commandArgs, { useProject, stdout, stderr });
    if (!Number.isInteger(result) || result < 0 || result > 255) {
      stderrLine({ stderr }, 'command handler contract violation: expected integer exit code 0..255');
      return 1;
    }
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    stderrLine({ stderr }, message);
    return 1;
  }
}

module.exports = { main, HELP, SKILLS };
