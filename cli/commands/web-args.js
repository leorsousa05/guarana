'use strict';

const { DASH_DEFAULT_PORT } = require('../constants.js');

function parseWebArgs(args) {
  let port = DASH_DEFAULT_PORT;
  let portExplicit = false;
  let openFlag = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--no-open') openFlag = false;
    else if (args[i] === '--open') openFlag = true;
    else if (args[i] === '--port') {
      const value = args[++i];
      const parsedPort = Number(value);
      if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
        return { port, noOpen: openFlag === false, portExplicit, openExplicit: openFlag !== null, error: `invalid --port value: ${value}` };
      }
      port = parsedPort;
      portExplicit = true;
    }
  }
  if (args.includes('--open') && args.includes('--no-open')) {
    return { port, noOpen: false, portExplicit, openExplicit: true, error: 'cannot use --open and --no-open together' };
  }
  return { port, noOpen: openFlag === false, portExplicit, openExplicit: openFlag !== null, error: null };
}

module.exports = { parseWebArgs };
