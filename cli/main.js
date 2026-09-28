'use strict';

const { VERSION, SKILLS } = require('./constants.js');
const { HELP } = require('./help.js');

const COMMANDS = {
  install: require('./commands/install.js'),
  uninstall: require('./commands/uninstall.js'),
  list: require('./commands/list.js'),
  update: require('./commands/update.js'),
  plugin: require('./commands/plugin.js'),
  web: require('./commands/web.js'),
  memory: require('./commands/memory.js'),
  specs: require('./commands/specs.js'),
};

function main(args) {
  const useProject = args.includes('--project');
  const rest = args.filter((a) => a !== '--project');
  const cmd = rest[0];

  if (cmd === '--help' || cmd === '-h' || cmd === undefined) {
    process.stdout.write(HELP);
    return;
  }
  if (cmd === '--version' || cmd === '-v') {
    console.log(VERSION);
    return;
  }

  const handler = COMMANDS[cmd];
  if (!handler) {
    console.error(`unknown command: ${cmd}`);
    process.stdout.write(HELP);
    process.exit(1);
  }

  handler.run(rest.slice(1), { useProject });
}

module.exports = { main, HELP, SKILLS };
