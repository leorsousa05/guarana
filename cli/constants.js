const path = require('path');

const PKG = require('../package.json');

module.exports = {
  VERSION: PKG.version,
  STAMP: '.guarana-version',
  SOURCE: path.join(__dirname, '..', 'skills', 'guarana'),
  SKILLS: ['plan', 'build', 'code', 'verify', 'remember', 'debug', 'measure'],
  PLUGIN_BUNDLE: path.join(__dirname, '..', 'plugin', 'guarana-telemetry.js'),
  PLUGIN_NAME: 'guarana-telemetry.js',
  DASH_SERVER_DIR: path.join(__dirname, '..', 'dashboard', 'server'),
  DASH_DEFAULT_PORT: 4200,
};
