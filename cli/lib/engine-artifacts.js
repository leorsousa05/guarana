const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  MEMORY_ENGINE_SOURCE, MEMORY_ENGINE_NAME, MEMORY_PLUGIN_BUNDLE, MEMORY_PLUGIN_NAME,
  ORCHESTRATOR_ENGINE_SOURCE, ORCHESTRATOR_ENGINE_NAME, ORCHESTRATOR_PLUGIN_BUNDLE, ORCHESTRATOR_PLUGIN_NAME,
  SKILL_ENGINE_SOURCE, SKILL_ENGINE_NAME,
} = require('../constants.js');
const { pluginIsOurs, MEMORY_PLUGIN_MARKER, ORCHESTRATOR_PLUGIN_MARKER } = require('./guard.js');
const {
  memoryEngineTarget, orchestratorEngineTarget, skillEngineTarget, pluginTarget, installManifestTarget,
} = require('./paths.js');

const MANIFEST_VERSION = 1;
const ENGINES = [
  {
    name: MEMORY_ENGINE_NAME,
    source: MEMORY_ENGINE_SOURCE,
    target: memoryEngineTarget,
    plugin: MEMORY_PLUGIN_NAME,
    bundle: MEMORY_PLUGIN_BUNDLE,
    marker: MEMORY_PLUGIN_MARKER,
  },
  {
    name: ORCHESTRATOR_ENGINE_NAME,
    source: ORCHESTRATOR_ENGINE_SOURCE,
    target: orchestratorEngineTarget,
    plugin: ORCHESTRATOR_PLUGIN_NAME,
    bundle: ORCHESTRATOR_PLUGIN_BUNDLE,
    marker: ORCHESTRATOR_PLUGIN_MARKER,
  },
  {
    name: SKILL_ENGINE_NAME,
    source: SKILL_ENGINE_SOURCE,
    target: skillEngineTarget,
    plugin: ORCHESTRATOR_PLUGIN_NAME,
    bundle: ORCHESTRATOR_PLUGIN_BUNDLE,
    marker: ORCHESTRATOR_PLUGIN_MARKER,
  },
];

function hash(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function sourceFiles(root, relative = '') {
  const files = [];
  for (const entry of fs.readdirSync(path.join(root, relative), { withFileTypes: true })) {
    const child = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...sourceFiles(root, child));
    else if (entry.isFile()) {
      const content = fs.readFileSync(path.join(root, child));
      files.push({ path: child, content, sha256: hash(content) });
    } else {
      throw new Error(`refuse to deploy engine: unsupported bundle entry ${path.join(root, child)}`);
    }
  }
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

function validRelativePath(value) {
  return typeof value === 'string' && value.length > 0 && !value.startsWith('/') &&
    !value.includes('\\') && !value.includes('\0') && !path.win32.isAbsolute(value) &&
    !/^[a-zA-Z]:/.test(value) && value.split('/').every((part) => part && part !== '.' && part !== '..');
}

function maybeStat(target) {
  try { return fs.lstatSync(target); } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function manifestState(file) {
  const directory = path.dirname(file);
  const dirStat = maybeStat(directory);
  if (dirStat && (!dirStat.isDirectory() || dirStat.isSymbolicLink())) {
    throw new Error(`refuse to use install manifest: ${directory} is not a regular directory`);
  }
  const stat = maybeStat(file);
  if (!stat) return { manifest: null, exists: false };
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(`refuse to use install manifest: ${file} is not a regular file`);
  }
  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(file, 'utf8')); } catch {
    throw new Error(`refuse to use install manifest: ${file} is invalid JSON`);
  }
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest) ||
       manifest.version !== MANIFEST_VERSION || !manifest.engines ||
       typeof manifest.engines !== 'object' || Array.isArray(manifest.engines) ||
       (manifest.skills !== undefined && (!manifest.skills || typeof manifest.skills !== 'object' || Array.isArray(manifest.skills))) ||
       (manifest.plugins !== undefined && !Array.isArray(manifest.plugins))) {
    throw new Error(`refuse to use install manifest: ${file} has an unsupported format`);
  }
  for (const group of ['workers', 'advisor']) readArtifactEntries(manifest, group);
  return { manifest, exists: true };
}

function readArtifactEntries(manifest, group) {
  if (!manifest || manifest[group] === undefined) return null;
  const entries = manifest[group];
  if (!Array.isArray(entries)) throw new Error(`refuse to use install manifest: invalid ${group} entries`);
  const seen = new Set();
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry) || !validRelativePath(entry.path) ||
        typeof entry.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(entry.sha256) || seen.has(entry.path)) {
      throw new Error(`refuse to use install manifest: invalid ${group} artifact entry`);
    }
    seen.add(entry.path);
  }
  return entries;
}

function readEntries(manifest, engineName) {
  if (!manifest || manifest.engines[engineName] === undefined) return null;
  const entries = manifest.engines[engineName];
  if (!Array.isArray(entries)) throw new Error(`refuse to use install manifest: invalid ${engineName} entries`);
  const seen = new Set();
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object' || !validRelativePath(entry.path) ||
        typeof entry.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(entry.sha256) || seen.has(entry.path)) {
      throw new Error(`refuse to use install manifest: invalid ${engineName} artifact entry`);
    }
    seen.add(entry.path);
  }
  return entries;
}

function inspectFile(root, relative, action, engineName) {
  if (!validRelativePath(relative)) throw new Error(`refuse to ${action}: unsafe ${engineName} artifact path`);
  const rootStat = maybeStat(root);
  if (!rootStat) return null;
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new Error(`refuse to ${action}: ${root} is not a regular engine directory`);
  }
  const parts = relative.split('/');
  let current = root;
  for (let index = 0; index < parts.length - 1; index += 1) {
    current = path.join(current, parts[index]);
    const stat = maybeStat(current);
    if (!stat) return null;
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      throw new Error(`refuse to ${action}: unsafe path in ${root}/${relative}`);
    }
  }
  const target = path.join(root, ...parts);
  const stat = maybeStat(target);
  if (!stat) return null;
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(`refuse to ${action}: ${target} is not a regular file`);
  }
  return { target, sha256: hash(fs.readFileSync(target)) };
}

function inspectArtifact(root, relative, action, group) {
  if (!validRelativePath(relative)) throw new Error(`refuse to ${action}: unsafe ${group} artifact path`);
  const rootStat = maybeStat(root);
  if (!rootStat) return null;
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new Error(`refuse to ${action}: ${root} is not a regular OpenCode directory`);
  }
  const parts = relative.split('/');
  let current = root;
  for (let index = 0; index < parts.length - 1; index += 1) {
    current = path.join(current, parts[index]);
    const stat = maybeStat(current);
    if (!stat) return null;
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      throw new Error(`refuse to ${action}: unsafe path in ${root}/${relative}`);
    }
  }
  const target = path.join(root, ...parts);
  const stat = maybeStat(target);
  if (!stat) return null;
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(`refuse to ${action}: ${target} is not a regular file`);
  }
  return { target, sha256: hash(fs.readFileSync(target)) };
}

function assertLegacyAssociation(useProject, engine) {
  const plugin = pluginTarget(useProject, engine.plugin);
  if (!pluginIsOurs(plugin, engine.bundle, engine.marker)) {
    throw new Error(`refuse to use legacy ${engine.name} engine: existing Guarana plugin ${plugin} is required`);
  }
}

function preflight(useProject, action) {
  if (action !== 'install' && action !== 'uninstall') throw new Error(`unsupported engine action: ${action}`);
  const manifestFile = installManifestTarget(useProject);
  const { manifest, exists: manifestExists } = manifestState(manifestFile);
  const enginePlans = ENGINES.map((engine) => {
    const root = engine.target(useProject);
    const rootStat = maybeStat(root);
    const entries = readEntries(manifest, engine.name);
    const tracked = entries ? new Map(entries.map((entry) => [entry.path, entry.sha256])) : null;
    const legacy = Boolean(rootStat && !entries);
    if (legacy) assertLegacyAssociation(useProject, engine);

    const managedPaths = [];
    if (tracked) {
      for (const [relative, expected] of tracked) {
        const current = inspectFile(root, relative, action, engine.name);
        if (current && current.sha256 !== expected) {
          throw new Error(`refuse to ${action}: managed ${engine.name} file was modified: ${current.target}`);
        }
        if (action === 'uninstall') managedPaths.push(relative);
      }
    }

    const bundleFiles = sourceFiles(engine.source);
    if (action === 'install') {
      for (const file of bundleFiles) {
        const current = inspectFile(root, file.path, action, engine.name);
        if (tracked && !tracked.has(file.path) && current) {
          throw new Error(`refuse to install: untracked ${engine.name} file conflicts with bundle: ${current.target}`);
        }
      }
      if (tracked) {
        for (const relative of tracked.keys()) {
          if (!bundleFiles.some((file) => file.path === relative)) managedPaths.push(relative);
        }
      }
    } else if (legacy) {
      for (const file of bundleFiles) {
        inspectFile(root, file.path, action, engine.name);
        managedPaths.push(file.path);
      }
    }

    return { engine, root, rootExisted: Boolean(rootStat), legacy, tracked, bundleFiles, managedPaths };
  });

  return { action, manifestFile, manifest, manifestExists, engines: enginePlans };
}

function removeFileIfPresent(root, relative) {
  const target = path.join(root, ...relative.split('/'));
  if (!maybeStat(target)) return;
  fs.unlinkSync(target);
  let directory = path.dirname(target);
  while (directory !== root && directory.startsWith(`${root}${path.sep}`)) {
    try { fs.rmdirSync(directory); } catch { break; }
    directory = path.dirname(directory);
  }
}

function removeRootIfEmpty(root) {
  try { fs.rmdirSync(root); } catch { /* preserve extras and non-empty engine roots */ }
}

function writeManifest(file, manifest) {
  const directory = path.dirname(file);
  fs.mkdirSync(directory, { recursive: true });
  const temporary = `${file}.tmp-${process.pid}-${crypto.randomBytes(6).toString('hex')}`;
  try {
    fs.writeFileSync(temporary, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
    fs.renameSync(temporary, file);
  } finally {
    try { fs.unlinkSync(temporary); } catch { /* already renamed or never created */ }
  }
}

function applyInstall(plan, pluginEntries, profileGroups) {
  const manifest = plan.manifest || { version: MANIFEST_VERSION, engines: {} };
  manifest.engines = { ...manifest.engines };
  for (const item of plan.engines) {
    for (const relative of item.managedPaths) removeFileIfPresent(item.root, relative);
    fs.mkdirSync(item.root, { recursive: true });
    for (const file of item.bundleFiles) {
      const target = path.join(item.root, ...file.path.split('/'));
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, file.content);
    }
    manifest.engines[item.engine.name] = item.bundleFiles.map(({ path: relative, sha256 }) => ({ path: relative, sha256 }));
  }
  if (pluginEntries !== undefined) manifest.plugins = pluginEntries;
  if (profileGroups) {
    for (const [group, entries] of Object.entries(profileGroups)) manifest[group] = entries;
  }
  writeManifest(plan.manifestFile, manifest);
}

function applyUninstall(plan, removePlugins = false, removeProfiles = false) {
  for (const item of plan.engines) {
    for (const relative of item.managedPaths) removeFileIfPresent(item.root, relative);
    if (item.rootExisted) removeRootIfEmpty(item.root);
  }
  if (plan.manifestExists) {
    const manifest = plan.manifest;
    manifest.engines = { ...manifest.engines };
    for (const engine of ENGINES) delete manifest.engines[engine.name];
    if (removePlugins) delete manifest.plugins;
    if (removeProfiles) {
      delete manifest.workers;
      delete manifest.advisor;
    }
    writeManifest(plan.manifestFile, manifest);
  }
}

function applyPluginOnlyUninstall(plan) {
  if (!plan.manifestExists) return;
  delete plan.manifest.plugins;
  writeManifest(plan.manifestFile, plan.manifest);
}

module.exports = {
  MANIFEST_VERSION,
  hash,
  validRelativePath,
  manifestState,
  readArtifactEntries,
  inspectArtifact,
  writeManifest,
  preflight,
  applyInstall,
  applyUninstall,
  applyPluginOnlyUninstall,
};
