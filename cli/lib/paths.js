const os = require('os');
const path = require('path');
const { PLUGIN_NAME } = require('../constants.js');

function targetDir(useProject) {
  return useProject
    ? path.join(process.cwd(), 'skills', 'guarana')
    : path.join(os.homedir(), '.agents', 'skills', 'guarana');
}

function pluginTarget(useProject) {
  return useProject
    ? path.join(process.cwd(), '.opencode', 'plugins', PLUGIN_NAME)
    : path.join(os.homedir(), '.config', 'opencode', 'plugins', PLUGIN_NAME);
}

module.exports = { targetDir, pluginTarget };
