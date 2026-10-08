const os = require('os');
const path = require('path');
const { PLUGIN_NAME } = require('../constants.js');

function targetDir(useProject) {
  return useProject
    ? path.join(process.cwd(), '.opencode', 'skills', 'guarana')
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

// Orchestrator core engine, deployed next to the plugin at the same relative
// path the plugin resolves (pluginDir/../orchestrator).
function orchestratorEngineTarget(useProject) {
  const pluginsParent = path.dirname(path.dirname(pluginTarget(useProject)));
  return path.join(pluginsParent, 'orchestrator');
}

function skillEngineTarget(useProject) {
  const pluginsParent = path.dirname(path.dirname(pluginTarget(useProject)));
  return path.join(pluginsParent, 'skill-engine');
}

function workerAgentsTarget(useProject) {
  return useProject
    ? path.join(process.cwd(), '.opencode', 'agents')
    : path.join(os.homedir(), '.config', 'opencode', 'agents');
}

module.exports = { targetDir, pluginTarget, memoryEngineTarget, orchestratorEngineTarget, skillEngineTarget, workerAgentsTarget };
