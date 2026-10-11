const os = require('os');
const path = require('path');
const { PLUGIN_NAME } = require('../constants.js');

function opencodeConfigDir() {
  return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'opencode');
}

function openCodeRootTarget(useProject, projectRoot = process.cwd()) {
  return useProject ? path.join(projectRoot, '.opencode') : opencodeConfigDir();
}

function targetDir(useProject) {
  return useProject
    ? path.join(process.cwd(), '.opencode', 'skills', 'guarana')
    : path.join(os.homedir(), '.agents', 'skills', 'guarana');
}

function pluginTarget(useProject, name = PLUGIN_NAME) {
  return useProject
    ? path.join(process.cwd(), '.opencode', 'plugins', name)
    : path.join(opencodeConfigDir(), 'plugins', name);
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

function installManifestTarget(useProject, projectRoot = process.cwd()) {
  const root = useProject
    ? path.join(projectRoot, '.guarana')
    : path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'guarana');
  return path.join(root, 'install-manifest.json');
}

function workerAgentsTarget(useProject, projectRoot = process.cwd()) {
  return useProject
    ? path.join(projectRoot, '.opencode', 'agents')
    : path.join(opencodeConfigDir(), 'agents');
}

function advisorSettingsTarget(useProject, projectRoot = process.cwd()) {
  return useProject
    ? path.join(projectRoot, '.guarana', 'advisor.json')
    : path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'guarana', 'advisor.json');
}

function advisorCommandTarget(useProject, projectRoot = process.cwd()) {
  const root = useProject
    ? path.join(projectRoot, '.opencode')
    : opencodeConfigDir();
  return path.join(root, 'commands', 'guarana-advisor.md');
}

function advisorAgentsTarget(useProject, projectRoot = process.cwd()) {
  return path.join(workerAgentsTarget(useProject, projectRoot), 'guarana.md');
}

function legacyAdvisorAgentsTarget(useProject, projectRoot = process.cwd()) {
  return path.join(workerAgentsTarget(useProject, projectRoot), 'guarana-advisor-primary.md');
}

function advisorSubagentTarget(useProject, projectRoot = process.cwd()) {
  return path.join(workerAgentsTarget(useProject, projectRoot), 'guarana-advisor.md');
}

module.exports = {
  targetDir,
  opencodeConfigDir,
  openCodeRootTarget,
  pluginTarget,
  memoryEngineTarget,
  orchestratorEngineTarget,
  skillEngineTarget,
  installManifestTarget,
  workerAgentsTarget,
  advisorSettingsTarget,
  advisorCommandTarget,
  advisorAgentsTarget,
  legacyAdvisorAgentsTarget,
  advisorSubagentTarget,
};
