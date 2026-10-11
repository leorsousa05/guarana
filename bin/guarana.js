#!/usr/bin/env node
'use strict';

(async () => {
  try {
    const { main } = require('../cli/main');
    process.exitCode = await main(process.argv.slice(2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
})();
