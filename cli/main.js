'use strict';

const { VERSION, SKILLS } = require('./constants.js');
const { HELP } = require('./help.js');
const COMMANDS = require('./commands/registry.js');
const { parseArgs } = require('./lib/args.js');

async function main(args, { stdout = process.stdout, stderr = process.stderr } = {}) {
  const { command, commandArgs, useProject } = parseArgs(args);

  if (command === '--help' || command === '-h' || command === undefined) {
    stdout.write(HELP);
    return 0;
  }
  if (command === '--version' || command === '-v') {
    stdout.write(`${VERSION}\n`);
    return 0;
  }

  const handler = COMMANDS[command];
  if (!handler) {
    stderr.write(`unknown command: ${command}\n`);
    stdout.write(HELP);
    return 1;
  }

  try {
    const result = await handler.run(commandArgs, { useProject, stdout, stderr });
    if (!Number.isInteger(result) || result < 0 || result > 255) {
      stderr.write('command handler contract violation: expected integer exit code 0..255\n');
      return 1;
    }
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    stderr.write(`${message}\n`);
    return 1;
  }
}

module.exports = { main, HELP, SKILLS };
