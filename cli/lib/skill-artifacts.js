const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { SOURCE, VERSION } = require('../constants.js');
const { STAMP } = require('./guard.js');
const { targetDir, installManifestTarget } = require('./paths.js');

const SKILL_NAME = 'guarana';
const MANIFEST_VERSION = 1;

function hash(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
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

function assertSafePath(target, action) {
  const absolute = path.resolve(target);
  const parsed = path.parse(absolute);
  let current = parsed.root;
  for (const part of absolute.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    const stat = maybeStat(current);
    if (!stat) break;
    if (stat.isSymbolicLink()) throw new Error(`refuse to ${action}: symlink in skill path ${current}`);
    if (current !== absolute && !stat.isDirectory()) {
      throw new Error(`refuse to ${action}: ${current} is not a regular directory`);
    }
  }
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
      throw new Error(`refuse to deploy skill: unsupported source entry ${path.join(root, child)}`);
    }
  }
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

function inventory() {
  const files = sourceFiles(SOURCE);
  const stampContent = Buffer.from(`${VERSION}\n`);
  files.push({ path: STAMP, content: stampContent, sha256: hash(stampContent) });
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

function inspectFile(root, relative, action) {
  if (!validRelativePath(relative)) throw new Error(`refuse to ${action}: unsafe skill artifact path`);
  const rootStat = maybeStat(root);
  if (!rootStat) return null;
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new Error(`refuse to ${action}: ${root} is not a regular skill directory`);
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

function hasLegacyProof(root, action) {
  const stamp = inspectFile(root, STAMP, action);
  if (stamp) return true;
  const skillMd = inspectFile(root, 'SKILL.md', action);
  return Boolean(skillMd && /^name:\s*guarana\s*$/m.test(fs.readFileSync(skillMd.target, 'utf8')));
}

function readEntries(manifest) {
  if (!manifest || manifest.skills === undefined) return null;
  if (!manifest.skills || typeof manifest.skills !== 'object' || Array.isArray(manifest.skills)) {
    throw new Error('refuse to use install manifest: invalid skills entries');
  }
  if (manifest.skills[SKILL_NAME] === undefined) return null;
  const entries = manifest.skills[SKILL_NAME];
  if (!Array.isArray(entries)) throw new Error(`refuse to use install manifest: invalid ${SKILL_NAME} skill entries`);
  const seen = new Set();
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object' || !validRelativePath(entry.path) ||
        typeof entry.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(entry.sha256) || seen.has(entry.path)) {
      throw new Error(`refuse to use install manifest: invalid ${SKILL_NAME} skill artifact entry`);
    }
    seen.add(entry.path);
  }
  return entries;
}

function preflight(useProject, action, manifestPlan) {
  if (action !== 'install' && action !== 'uninstall') throw new Error(`unsupported skill action: ${action}`);
  const root = targetDir(useProject);
  assertSafePath(root, action);
  const rootStat = maybeStat(root);
  const entries = readEntries(manifestPlan.manifest);
  const tracked = entries ? new Map(entries.map((entry) => [entry.path, entry.sha256])) : null;
  const legacy = Boolean(rootStat && !entries);
  if (legacy && !hasLegacyProof(root, action)) {
    throw new Error(`refuse to ${action}: ${root} exists but is not a guarana install (no ${STAMP} stamp or guarana SKILL.md)`);
  }

  const bundleFiles = inventory();
  const managedPaths = [];
  const identicalLegacyFiles = new Set();
  if (legacy) {
    for (const file of bundleFiles) {
      if (file.path === STAMP) continue;
      const current = inspectFile(root, file.path, action);
      if (!current) continue;
      if (!fs.readFileSync(current.target).equals(file.content)) {
        throw new Error(`refuse to use legacy skill root: canonical file differs from bundle: ${current.target}`);
      }
      identicalLegacyFiles.add(file.path);
    }
  }

  if (tracked) {
    for (const [relative, expected] of tracked) {
      const current = inspectFile(root, relative, action);
      if (current && current.sha256 !== expected) {
        throw new Error(`refuse to ${action}: managed skill file was modified: ${current.target}`);
      }
      if (action === 'uninstall') managedPaths.push(relative);
    }
  }

  if (action === 'install') {
    for (const file of bundleFiles) {
      const current = inspectFile(root, file.path, action);
      if (tracked && !tracked.has(file.path) && current) {
        throw new Error(`refuse to install: untracked skill file conflicts with bundle: ${current.target}`);
      }
    }
    if (tracked) {
      const currentPaths = new Set(bundleFiles.map((file) => file.path));
      for (const relative of tracked.keys()) {
        if (!currentPaths.has(relative)) managedPaths.push(relative);
      }
    }
  } else if (legacy) {
    for (const file of bundleFiles) {
      if (file.path === STAMP) {
        if (inspectFile(root, file.path, action)) managedPaths.push(file.path);
      } else if (identicalLegacyFiles.has(file.path)) {
        managedPaths.push(file.path);
      }
    }
  }

  if (!manifestPlan.manifest && action === 'install') {
    manifestPlan.manifest = { version: MANIFEST_VERSION, engines: {} };
  }
  return {
    action,
    root,
    rootExisted: Boolean(rootStat),
    legacy,
    tracked,
    bundleFiles,
    managedPaths: [...new Set(managedPaths)],
    manifestFile: installManifestTarget(useProject),
    manifest: manifestPlan.manifest,
    manifestExists: manifestPlan.manifestExists,
  };
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
  try { fs.rmdirSync(root); } catch { /* preserve extras and non-empty skill roots */ }
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

function applyInstall(plan) {
  for (const relative of plan.managedPaths) removeFileIfPresent(plan.root, relative);
  fs.mkdirSync(plan.root, { recursive: true });
  for (const file of plan.bundleFiles) {
    const target = path.join(plan.root, ...file.path.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, file.content);
  }
  plan.manifest.skills = { ...(plan.manifest.skills || {}) };
  plan.manifest.skills[SKILL_NAME] = plan.bundleFiles.map(({ path: relative, sha256 }) => ({ path: relative, sha256 }));
  writeManifest(plan.manifestFile, plan.manifest);
}

function applyUninstall(plan) {
  for (const relative of plan.managedPaths) removeFileIfPresent(plan.root, relative);
  if (plan.rootExisted) removeRootIfEmpty(plan.root);
  if (plan.manifestExists) {
    plan.manifest.skills = { ...(plan.manifest.skills || {}) };
    delete plan.manifest.skills[SKILL_NAME];
    writeManifest(plan.manifestFile, plan.manifest);
  }
}

module.exports = { preflight, applyInstall, applyUninstall };
