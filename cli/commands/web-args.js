'use strict';

const { DASH_DEFAULT_PORT } = require('../constants.js');

function parseWebArgs(args) {
  let port = DASH_DEFAULT_PORT;
  let noOpen = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--no-open') noOpen = true;
    else if (args[i] === '--port') {
      const value = args[++i];
      const parsedPort = Number(value);
      if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
        return { port, noOpen, error: `invalid --port value: ${value}` };
      }
      port = parsedPort;
    }
  }
  return { port, noOpen, error: null };
}

module.exports = { parseWebArgs };
