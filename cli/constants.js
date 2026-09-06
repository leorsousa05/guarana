const path = require('path');

const PKG = require('../package.json');

module.exports = {
  VERSION: PKG.version,
  STAMP: '.guarana-version',
  SOURCE: path.join(__dirname, '..', 'skills', 'guarana'),
  SKILLS: ['plan', 'build', 'code', 'verify', 'remember', 'debug', 'measure'],
  PLUGIN_BUNDLE: path.join(__dirname, '..', 'plugin', 'guarana-telemetry.js'),
  PLUGIN_NAME: 'guarana-telemetry.js',
  MEMORY_PLUGIN_BUNDLE: path.join(__dirname, '..', 'plugin', 'guarana-memory.js'),
  MEMORY_PLUGIN_NAME: 'guarana-memory.js',
  ORCHESTRATOR_PLUGIN_BUNDLE: path.join(__dirname, '..', 'plugin', 'guarana-orchestrator.js'),
  ORCHESTRATOR_PLUGIN_NAME: 'guarana-orchestrator.js',
  MEMORY_ENGINE_SOURCE: path.join(__dirname, '..', 'memory'),
  MEMORY_ENGINE_NAME: 'memory',
  ORCHESTRATOR_ENGINE_SOURCE: path.join(__dirname, '..', 'orchestrator'),
  ORCHESTRATOR_ENGINE_NAME: 'orchestrator',
  DASH_SERVER_DIR: path.join(__dirname, '..', 'dashboard', 'server'),
  DASH_DEFAULT_PORT: 4200,
};
