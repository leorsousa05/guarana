const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const {
  PLUGIN_BUNDLE, PLUGIN_NAME,
  MEMORY_PLUGIN_BUNDLE, MEMORY_PLUGIN_NAME,
  ORCHESTRATOR_PLUGIN_BUNDLE, ORCHESTRATOR_PLUGIN_NAME,
  MEMORY_ENGINE_SOURCE, MEMORY_ENGINE_NAME,
  ORCHESTRATOR_ENGINE_SOURCE, ORCHESTRATOR_ENGINE_NAME,
  SKILL_ENGINE_SOURCE, SKILL_ENGINE_NAME,
} = require('../constants.js');
const { pluginIsOurs, PLUGIN_MARKER, MEMORY_PLUGIN_MARKER, ORCHESTRATOR_PLUGIN_MARKER } = require('../lib/guard.js');
const { pluginTarget, memoryEngineTarget, orchestratorEngineTarget, skillEngineTarget } = require('../lib/paths.js');

const PLUGINS = [
  { name: PLUGIN_NAME, bundle: PLUGIN_BUNDLE, marker: PLUGIN_MARKER },
  { name: MEMORY_PLUGIN_NAME, bundle: MEMORY_PLUGIN_BUNDLE, marker: MEMORY_PLUGIN_MARKER },
  { name: ORCHESTRATOR_PLUGIN_NAME, bundle: ORCHESTRATOR_PLUGIN_BUNDLE, marker: ORCHESTRATOR_PLUGIN_MARKER },
];

function copyDir(src, dest) {
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function pluginInstall(useProject) {
  for (const { name, bundle, marker } of PLUGINS) {
    const target = pluginTarget(useProject, name);
    if (fs.existsSync(target) && !pluginIsOurs(target, bundle, marker)) {
      console.error(`refuse to install: ${target} exists and was not installed by guarana (content differs from bundle)`);
      process.exit(1);
    }
    const existed = fs.existsSync(target);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(bundle, target);
    console.log(`${existed ? 'updated' : 'installed'} plugin ${name.replace(/\.js$/, '')} -> ${target}`);
  }
  const engineTarget = memoryEngineTarget(useProject);
  copyDir(MEMORY_ENGINE_SOURCE, engineTarget);
  console.log(`${fs.existsSync(path.join(engineTarget, 'capture.js')) ? 'updated' : 'installed'} memory engine -> ${engineTarget}`);
  const orchTarget = orchestratorEngineTarget(useProject);
  copyDir(ORCHESTRATOR_ENGINE_SOURCE, orchTarget);
  console.log(`${fs.existsSync(path.join(orchTarget, 'state.js')) ? 'updated' : 'installed'} orchestrator engine -> ${orchTarget}`);
  const skillsTarget = skillEngineTarget(useProject);
  copyDir(SKILL_ENGINE_SOURCE, skillsTarget);
  console.log(`${fs.existsSync(path.join(skillsTarget, 'index.js')) ? 'updated' : 'installed'} skill engine -> ${skillsTarget}`);
}

function pluginUninstall(useProject) {
  for (const { name, bundle, marker } of PLUGINS) {
    const target = pluginTarget(useProject, name);
    if (!fs.existsSync(target)) {
      console.log(`nothing to uninstall: ${target} does not exist`);
      continue;
    }
    if (!pluginIsOurs(target, bundle, marker)) {
      console.error(`refuse to uninstall: ${target} was not installed by guarana (content differs from bundle)`);
      process.exit(1);
    }
    fs.rmSync(target);
    console.log(`uninstalled plugin ${name.replace(/\.js$/, '')} from ${target}`);
  }
  const engineTarget = memoryEngineTarget(useProject);
  if (fs.existsSync(engineTarget)) {
    fs.rmSync(engineTarget, { recursive: true, force: true });
    console.log(`uninstalled memory engine from ${engineTarget}`);
  }
  const orchTarget = orchestratorEngineTarget(useProject);
  if (fs.existsSync(orchTarget)) {
    fs.rmSync(orchTarget, { recursive: true, force: true });
    console.log(`uninstalled orchestrator engine from ${orchTarget}`);
  }
  const skillsTarget = skillEngineTarget(useProject);
  if (fs.existsSync(skillsTarget)) {
    fs.rmSync(skillsTarget, { recursive: true, force: true });
    console.log(`uninstalled skill engine from ${skillsTarget}`);
  }
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

async function pluginStatus(useProject) {
  console.log('guarana plugin status');
  console.log(`target: ${useProject ? 'project (.opencode/)' : 'global (~/.config/opencode/)'}`);
  for (const { name, bundle, marker } of PLUGINS) {
    const target = pluginTarget(useProject, name);
    const installed = fs.existsSync(target);
    const upToDate = installed && filesEqual(target, bundle);
    console.log(`- ${name}: ${installed ? (upToDate ? 'ok (up to date)' : 'stale (re-run: guarana plugin install)') : 'not installed'}`);
    if (installed && !pluginIsOurs(target, bundle, marker)) {
      console.log(`  ! foreign file (not installed by guarana) — manual review required`);
    }
  }
  const engineTarget = memoryEngineTarget(useProject);
  const hasEngine = fs.existsSync(path.join(engineTarget, 'tools.js')) &&
    fs.existsSync(path.join(engineTarget, 'vault.js')) &&
    fs.existsSync(path.join(engineTarget, 'graph.js'));
  console.log(`- memory engine (${engineTarget}): ${hasEngine ? 'deployed' : 'not deployed (re-run: guarana plugin install)'}`);
  const vaultDir = path.join(process.cwd(), '.guarana', 'memory');
  const vaultInit = fs.existsSync(path.join(vaultDir, 'nodes.jsonl'));
  console.log(`- vault (${vaultDir}): ${vaultInit ? 'initialized' : 'not initialized (created automatically on first task)'}`);
  if (hasEngine) {
    console.log(`- engine health: ${await engineHealthy(engineTarget)}`);
  }
  const orchTarget = orchestratorEngineTarget(useProject);
  const hasOrch = fs.existsSync(path.join(orchTarget, 'state.js')) &&
    fs.existsSync(path.join(orchTarget, 'decide.js')) &&
    fs.existsSync(path.join(orchTarget, 'prompt.js'));
  console.log(`- orchestrator engine (${orchTarget}): ${hasOrch ? 'deployed' : 'not deployed (re-run: guarana plugin install)'}`);
  const skillsTarget = skillEngineTarget(useProject);
  const hasSkills = fs.existsSync(path.join(skillsTarget, 'index.js'));
  console.log(`- skill engine (${skillsTarget}): ${hasSkills ? 'deployed' : 'not deployed (re-run: guarana plugin install)'}`);
}

async function run(args, { useProject }) {
  const sub = args[0];
  switch (sub) {
    case 'install': pluginInstall(useProject); break;
    case 'uninstall': pluginUninstall(useProject); break;
    case 'status': await pluginStatus(useProject); break;
    default:
      console.error(`unknown plugin command: ${sub === undefined ? '(missing)' : sub}`);
      process.stdout.write(require('../help.js').HELP);
      process.exit(1);
  }
}

module.exports = { run, install: pluginInstall, uninstall: pluginUninstall };
