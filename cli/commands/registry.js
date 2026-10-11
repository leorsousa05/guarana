'use strict';

const { COMMANDS } = require('../command-metadata.js');

module.exports = Object.fromEntries(
  COMMANDS.map(({ name, handler }) => [name, require(`./${handler}.js`)])
);
