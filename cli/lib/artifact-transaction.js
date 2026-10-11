'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function statOrNull(target) {
  try { return fs.lstatSync(target); } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function ancestors(directory) {
  const result = [];
  let current = path.resolve(directory);
  while (true) {
    result.push(current);
    const parent = path.dirname(current);
    if (parent === current) return result.reverse();
    current = parent;
  }
}

function validateDirectoryChain(directory) {
  for (const entry of ancestors(directory)) {
    const stat = statOrNull(entry);
    if (stat && (!stat.isDirectory() || stat.isSymbolicLink())) {
      throw new Error(`refuse to transact through non-directory or symlink: ${entry}`);
    }
  }
}

function snapshot(targets) {
  const files = new Map();
  const directories = new Map();
  for (const target of new Set(targets.map((file) => path.resolve(file)))) {
    const parent = path.dirname(target);
    for (const directory of ancestors(parent)) {
      if (directories.has(directory)) continue;
      const stat = statOrNull(directory);
      if (stat && (!stat.isDirectory() || stat.isSymbolicLink())) {
        throw new Error(`refuse to transact through non-directory or symlink: ${directory}`);
      }
      directories.set(directory, stat
        ? { exists: true, mode: stat.mode & 0o7777 }
        : { exists: false });
    }
    const stat = statOrNull(target);
    if (stat && (!stat.isFile() || stat.isSymbolicLink())) {
      throw new Error(`refuse to transact on non-regular file or symlink: ${target}`);
    }
    files.set(target, stat
      ? { exists: true, bytes: fs.readFileSync(target), mode: stat.mode & 0o7777 }
      : { exists: false });
  }
  return { files, directories };
}

function ensureDirectory(directory, mode) {
  validateDirectoryChain(path.dirname(directory));
  const stat = statOrNull(directory);
  if (stat) {
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`unsafe rollback directory: ${directory}`);
    return false;
  }
  fs.mkdirSync(directory, { mode: mode ?? 0o777 });
  const created = fs.lstatSync(directory);
  if (!created.isDirectory() || created.isSymbolicLink()) throw new Error(`unsafe rollback directory: ${directory}`);
  return true;
}

function restoreFile(target, prior) {
  validateDirectoryChain(path.dirname(target));
  const current = statOrNull(target);
  if (current && (!current.isFile() || current.isSymbolicLink())) {
    throw new Error(`unsafe rollback target: ${target}`);
  }
  if (!prior.exists) {
    if (current) fs.unlinkSync(target);
    return;
  }

  const temporary = `${target}.rollback-${process.pid}-${crypto.randomBytes(8).toString('hex')}`;
  let descriptor;
  try {
    validateDirectoryChain(path.dirname(target));
    descriptor = fs.openSync(temporary, 'wx', prior.mode);
    fs.writeFileSync(descriptor, prior.bytes);
    fs.fchmodSync(descriptor, prior.mode);
    fs.closeSync(descriptor);
    descriptor = undefined;
    validateDirectoryChain(path.dirname(target));
    const beforeRename = statOrNull(target);
    if (beforeRename && (!beforeRename.isFile() || beforeRename.isSymbolicLink())) {
      throw new Error(`unsafe rollback target: ${target}`);
    }
    fs.renameSync(temporary, target);
  } finally {
    if (descriptor !== undefined) {
      try { fs.closeSync(descriptor); } catch { /* preserve the restoration error */ }
    }
    try { fs.unlinkSync(temporary); } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
}

function rollback(before) {
  const failures = [];
  const record = (operation) => {
    try { operation(); } catch (error) { failures.push(error); }
  };

  const existingDirectories = [...before.directories.entries()]
    .filter(([, prior]) => prior.exists)
    .sort(([a], [b]) => a.length - b.length);
  const recreated = new Set();
  for (const [directory, prior] of existingDirectories) {
    record(() => {
      if (ensureDirectory(directory, prior.mode)) recreated.add(directory);
    });
  }

  for (const [target, prior] of before.files) record(() => restoreFile(target, prior));

  for (const directory of [...recreated].sort((a, b) => b.length - a.length)) {
    const prior = before.directories.get(directory);
    record(() => fs.chmodSync(directory, prior.mode));
  }

  const newDirectories = [...before.directories.entries()]
    .filter(([, prior]) => !prior.exists)
    .map(([directory]) => directory)
    .sort((a, b) => b.length - a.length);
  for (const directory of newDirectories) {
    record(() => {
      validateDirectoryChain(path.dirname(directory));
      const stat = statOrNull(directory);
      if (!stat) return;
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`unsafe rollback directory: ${directory}`);
      try { fs.rmdirSync(directory); } catch (error) {
        if (error.code !== 'ENOENT' && error.code !== 'ENOTEMPTY' && error.code !== 'EEXIST') throw error;
      }
    });
  }
  return failures;
}

function run(targets, operation) {
  const before = snapshot(targets);
  try {
    return operation();
  } catch (originalError) {
    const failures = rollback(before);
    if (failures.length === 0) throw originalError;
    const error = new Error(`${originalError.message}; rollback failed for ${failures.length} managed path operation(s)`, { cause: originalError });
    error.rollbackErrors = failures;
    throw error;
  }
}

function profileTargets(plan) {
  return [
    ...(plan.action === 'install' ? [
      ...plan.workers.map(({ target }) => target),
      ...plan.advisor.map(({ target }) => target),
    ] : []),
    ...plan.removePaths.map((relative) => path.join(plan.root, ...relative.split('/'))),
  ];
}

function pluginTargets(plan) {
  return [
    ...(plan.engines.action === 'install' || plan.engines.manifestExists ? [plan.engines.manifestFile] : []),
    ...plan.plugins.filter(({ exists }) => plan.engines.action === 'install' || exists).map(({ target }) => target),
    ...plan.engines.engines.flatMap((item) => [
      ...(plan.engines.action === 'install'
        ? item.bundleFiles.map(({ path: relative }) => path.join(item.root, ...relative.split('/')))
        : []),
      ...item.managedPaths.map((relative) => path.join(item.root, ...relative.split('/'))),
    ]),
    ...profileTargets(plan.profiles),
  ];
}

function skillTargets(plan) {
  return [
    ...(plan.action === 'install' || plan.manifestExists ? [plan.manifestFile] : []),
    ...(plan.action === 'install'
      ? plan.bundleFiles.map(({ path: relative }) => path.join(plan.root, ...relative.split('/')))
      : []),
    ...plan.managedPaths.map((relative) => path.join(plan.root, ...relative.split('/'))),
  ];
}

module.exports = { run, pluginTargets, skillTargets, profileTargets };
