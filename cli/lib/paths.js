const os = require('os');
const path = require('path');
const { PLUGIN_NAME } = require('../constants.js');

function targetDir(useProject) {
  return useProject
    ? path.join(process.cwd(), 'skills', 'guarana')
    : path.join(os.homedir(), '.agents', 'skills', 'guarana');
}

function pluginTarget(useProject, name = PLUGIN_NAME) {
  return useProject
    ? path.join(process.cwd(), '.opencode', 'plugins', name)
    : path.join(os.homedir(), '.config', 'opencode', 'plugins', name);
}

function memoryEngineTarget(useProject) {
  const pluginsParent = path.dirname(path.dirname(pluginTarget(useProject)));
  return path.join(pluginsParent, 'memory');
}

module.exports = { targetDir, pluginTarget, memoryEngineTarget };
