const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const {
  PLUGIN_BUNDLE, PLUGIN_NAME,
  MEMORY_PLUGIN_BUNDLE, MEMORY_PLUGIN_NAME,
  ORCHESTRATOR_PLUGIN_BUNDLE, ORCHESTRATOR_PLUGIN_NAME,
} = require('../constants.js');
const { pluginIsOurs, PLUGIN_MARKER, MEMORY_PLUGIN_MARKER, ORCHESTRATOR_PLUGIN_MARKER } = require('../lib/guard.js');
const { pluginTarget, memoryEngineTarget, orchestratorEngineTarget, skillEngineTarget } = require('../lib/paths.js');
const engineArtifacts = require('../lib/engine-artifacts.js');
const agents = require('../lib/agents.js');
const advisorProfiles = require('../lib/advisor-profiles.js');
const profileArtifacts = require('../lib/profile-artifacts.js');
const artifactTransaction = require('../lib/artifact-transaction.js');
const { stdoutLine, stderrLine, writeStdout } = require('../lib/io.js');

const PLUGINS = [
  { name: PLUGIN_NAME, bundle: PLUGIN_BUNDLE, marker: PLUGIN_MARKER },
  { name: MEMORY_PLUGIN_NAME, bundle: MEMORY_PLUGIN_BUNDLE, marker: MEMORY_PLUGIN_MARKER },
  { name: ORCHESTRATOR_PLUGIN_NAME, bundle: ORCHESTRATOR_PLUGIN_BUNDLE, marker: ORCHESTRATOR_PLUGIN_MARKER },
];

function hash(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function maybeStat(target) {
  try { return fs.lstatSync(target); } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function readPluginEntries(manifest) {
  if (!manifest || manifest.plugins === undefined) return null;
  if (!Array.isArray(manifest.plugins)) {
    throw new Error('refuse to use install manifest: invalid plugins entries');
  }
  const knownNames = new Set(PLUGINS.map(({ name }) => name));
  const seen = new Set();
  for (const entry of manifest.plugins) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry) ||
        typeof entry.path !== 'string' || !knownNames.has(entry.path) ||
        typeof entry.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(entry.sha256) || seen.has(entry.path)) {
      throw new Error('refuse to use install manifest: invalid plugin artifact entry');
    }
    seen.add(entry.path);
  }
  return manifest.plugins;
}

function preflightPlugins(useProject, action, enginePlan) {
  const entries = readPluginEntries(enginePlan.manifest);
  const tracked = entries ? new Map(entries.map((entry) => [entry.path, entry.sha256])) : null;
  return PLUGINS.map(({ name, bundle, marker }) => {
    const target = pluginTarget(useProject, name);
    const stat = maybeStat(target);
    if (stat && (!stat.isFile() || stat.isSymbolicLink())) {
      throw new Error(`refuse to ${action}: ${target} is not a regular plugin file`);
    }
    const exists = Boolean(stat);
    const currentHash = exists ? hash(fs.readFileSync(target)) : null;
    const expectedHash = tracked && tracked.get(name);
    if (expectedHash && exists && currentHash !== expectedHash) {
      throw new Error(`refuse to ${action}: managed plugin file was modified: ${target}`);
    }
    if (exists && !expectedHash && !pluginIsOurs(target, bundle, marker)) {
      const detail = action === 'install'
        ? 'exists and was not installed by guarana (content differs from bundle)'
        : 'was not installed by guarana (content differs from bundle)';
      throw new Error(`refuse to ${action}: ${target} ${detail}`);
    }
    return { name, bundle, target, exists, sha256: hash(fs.readFileSync(bundle)) };
  });
}

function preflightInstall(useProject) {
  agents.assertInstallable(useProject);
  advisorProfiles.assertInstallable(useProject);
  const engines = engineArtifacts.preflight(useProject, 'install');
  const plugins = preflightPlugins(useProject, 'install', engines);
  const profiles = profileArtifacts.preflight(useProject, 'install', engines);
  return { engines, plugins, profiles };
}

function pluginInstall(useProject, { quiet = false, preflight = null, skipTransaction = false, stdout = process.stdout } = {}) {
  const context = { stdout };
  const plan = preflight || preflightInstall(useProject);
  const { engines, plugins, profiles } = plan;
  const apply = () => {
    for (const { name, bundle, target, exists } of plugins) {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(bundle, target);
      if (!quiet) stdoutLine(context, `${exists ? 'updated' : 'installed'} plugin ${name.replace(/\.js$/, '')} -> ${target}`);
    }
    profileArtifacts.applyInstall(profiles);
    engineArtifacts.applyInstall(engines, plugins.map(({ name, sha256 }) => ({ path: name, sha256 })), profiles.groups);
    if (!quiet) {
      const [memory, orchestrator, skills] = engines.engines;
      stdoutLine(context, `updated memory engine -> ${memory.root}`);
      stdoutLine(context, `updated orchestrator engine -> ${orchestrator.root}`);
      stdoutLine(context, `updated skill engine -> ${skills.root}`);
    }
    for (const { name, target } of profiles.workers) {
      if (!quiet) stdoutLine(context, `installed/updated subagent ${name} -> ${target}`);
    }
    for (const { name, target } of profiles.advisor) {
      if (!quiet) stdoutLine(context, `installed/updated ${name} -> ${target}`);
    }
    if (!quiet && profiles.setupOnly) stdoutLine(context, `advisor setup-only command installed; model profiles unavailable: undefined`);
  };
  if (skipTransaction) return apply();
  return artifactTransaction.run(artifactTransaction.pluginTargets(plan), apply);
}

function preflightUninstall(useProject) {
  const engines = engineArtifacts.preflight(useProject, 'uninstall');
  const plugins = preflightPlugins(useProject, 'uninstall', engines);
  const profiles = profileArtifacts.preflight(useProject, 'uninstall', engines);
  return { engines, plugins, profiles };
}

function pluginUninstall(useProject, preflight = null, { skipTransaction = false, stdout = process.stdout } = {}) {
  const context = { stdout };
  const plan = preflight || preflightUninstall(useProject);
  const { engines, plugins, profiles } = plan;
  const apply = () => {
    for (const { name, target, exists } of plugins) {
      if (!exists) {
        stdoutLine(context, `nothing to uninstall: ${target} does not exist`);
        continue;
      }
      fs.rmSync(target);
      stdoutLine(context, `uninstalled plugin ${name.replace(/\.js$/, '')} from ${target}`);
    }
    engineArtifacts.applyUninstall(engines, true, true);
    for (const item of engines.engines) {
      if (item.rootExisted) stdoutLine(context, `uninstalled ${item.engine.name === 'skill-engine' ? 'skill' : item.engine.name} engine from ${item.root}`);
    }
    const profileResult = profileArtifacts.applyUninstall(profiles);
    const removedProfiles = new Set(profileResult.removed);
    for (const { target } of profiles.workers) {
      if (removedProfiles.has(target)) stdoutLine(context, `removed Guarana worker agent -> ${target}`);
    }
    for (const target of profiles.preserved.filter((target) => profiles.workers.some((profile) => profile.target === target))) {
      stdoutLine(context, `preserved foreign worker agent -> ${target}`);
    }
    for (const { target } of profiles.advisorTargets) {
      if (removedProfiles.has(target)) stdoutLine(context, `removed Guarana advisor artifact -> ${target}`);
    }
    for (const target of profiles.preserved.filter((target) => !profiles.workers.some((profile) => profile.target === target))) {
      stdoutLine(context, `preserved foreign advisor artifact -> ${target}`);
    }
  };
  if (skipTransaction) return apply();
  return artifactTransaction.run(artifactTransaction.pluginTargets(plan), apply);
}

function filesEqual(a, b) {
  try {
    return fs.readFileSync(a).equals(fs.readFileSync(b));
  } catch {
    return false;
  }
}

// Async engine health: load the deployed engine's tools and confirm the four
// custom-tool handlers are present. Returns a status string (never throws).
async function engineHealthy(engineTarget) {
  try {
    if (!fs.existsSync(path.join(engineTarget, 'tools.js'))) return 'not deployed';
    const tools = await import(pathToFileURL(path.join(engineTarget, 'tools.js')).href);
    const handlers = [
      'memorySearch', 'memorySaveDecision', 'memoryGetContextForTask', 'memoryReviewDraft',
    ];
    const missing = handlers.filter((h) => typeof tools[h] !== 'function');
    return missing.length === 0 ? 'ok' : `missing handlers: ${missing.join(', ')}`;
  } catch (err) {
    return `load error: ${err && err.message ? err.message : err}`;
  }
}

async function pluginStatus(useProject, context) {
  stdoutLine(context, 'guarana plugin status');
  const globalOpenCodeRoot = path.dirname(path.dirname(pluginTarget(false)));
  stdoutLine(context, `target: ${useProject ? 'project (.opencode/)' : `global (${globalOpenCodeRoot}/)`}`);
  for (const { name, bundle, marker } of PLUGINS) {
    const target = pluginTarget(useProject, name);
    const installed = fs.existsSync(target);
    const upToDate = installed && filesEqual(target, bundle);
    stdoutLine(context, `- ${name}: ${installed ? (upToDate ? 'ok (up to date)' : 'stale (re-run: guarana plugin install)') : 'not installed'}`);
    if (installed && !pluginIsOurs(target, bundle, marker)) {
      stdoutLine(context, `  ! foreign file (not installed by guarana) — manual review required`);
    }
  }
  const engineTarget = memoryEngineTarget(useProject);
  const hasEngine = fs.existsSync(path.join(engineTarget, 'tools.js')) &&
    fs.existsSync(path.join(engineTarget, 'vault.js')) &&
    fs.existsSync(path.join(engineTarget, 'graph.js'));
  stdoutLine(context, `- memory engine (${engineTarget}): ${hasEngine ? 'deployed' : 'not deployed (re-run: guarana plugin install)'}`);
  const vaultDir = path.join(process.cwd(), '.guarana', 'memory');
  const vaultInit = fs.existsSync(path.join(vaultDir, 'nodes.jsonl'));
  stdoutLine(context, `- vault (${vaultDir}): ${vaultInit ? 'initialized' : 'not initialized (created automatically on first task)'}`);
  if (hasEngine) {
    stdoutLine(context, `- engine health: ${await engineHealthy(engineTarget)}`);
  }
  const orchTarget = orchestratorEngineTarget(useProject);
  const hasOrch = fs.existsSync(path.join(orchTarget, 'state.js')) &&
    fs.existsSync(path.join(orchTarget, 'decide.js')) &&
    fs.existsSync(path.join(orchTarget, 'prompt.js'));
  stdoutLine(context, `- orchestrator engine (${orchTarget}): ${hasOrch ? 'deployed' : 'not deployed (re-run: guarana plugin install)'}`);
  const skillsTarget = skillEngineTarget(useProject);
  const hasSkills = fs.existsSync(path.join(skillsTarget, 'index.js'));
  stdoutLine(context, `- skill engine (${skillsTarget}): ${hasSkills ? 'deployed' : 'not deployed (re-run: guarana plugin install)'}`);
  for (const profile of agents.workerAgentStatus(useProject)) {
    stdoutLine(context, `- subagent ${profile.name} (${profile.target}): ${profile.status}`);
  }
  for (const artifact of advisorProfiles.advisorArtifactStatus(useProject)) {
    stdoutLine(context, `- advisor ${artifact.name} (${artifact.target}): ${artifact.status}`);
  }
}

async function run(args, { useProject, stdout = process.stdout, stderr = process.stderr } = {}) {
  const context = { stdout, stderr };
  const sub = args[0];
  switch (sub) {
    case 'install': pluginInstall(useProject, context); break;
    case 'uninstall': pluginUninstall(useProject, null, context); break;
    case 'status': await pluginStatus(useProject, context); break;
    default:
      stderrLine(context, `unknown plugin command: ${sub === undefined ? '(missing)' : sub}`);
      writeStdout(context, require('../help.js').HELP);
      return 1;
  }
  return 0;
}

module.exports = {
  run,
  install: pluginInstall,
  uninstall: pluginUninstall,
  preflightInstall,
  preflightUninstall,
};
