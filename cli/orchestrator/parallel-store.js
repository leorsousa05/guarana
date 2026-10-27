// Sidecar persistence for parallel run manifests. This intentionally never
// reads or writes workflow.json, whose established version-1 schema is stable.

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validateRunManifest } from './parallel.js';

const RUN_LOCK_VERSION = 1;

export function runManifestFile(directory, runId) {
  if (typeof runId !== 'string' || !/^[a-z][a-z0-9-]{0,47}$/.test(runId)) {
    throw new TypeError('Run ID must be a stable lowercase kebab-case ID');
  }
  return path.join(directory, '.specs', 'state', 'parallel-runs', `${runId}.json`);
}

function lockedError(runId, cause) {
  const error = new Error(`Parallel run ${runId} is locked by another operation`, { cause });
  error.code = 'ERR_PARALLEL_RUN_LOCKED';
  return error;
}

function coordinationLockedError(runId, coordinationPath, cause) {
  const error = new Error(
    `Parallel run ${runId} coordination marker is held at ${coordinationPath}; `
    + 'automatic recovery is unsupported. Do not delete or steal it blindly.',
    { cause },
  );
  error.code = 'ERR_PARALLEL_RUN_LOCKED';
  return error;
}

function lockFileFor(directory, runId) {
  return `${runManifestFile(directory, runId)}.lock`;
}

// Serialize lock creation with recovery. The coordination directory is never
// stolen or automatically recovered: if its owner exits before removing it,
// later operations fail closed until a primary resolves the stuck marker.
function withRunCoordination(directory, runId, callback) {
  const coordinationPath = `${lockFileFor(directory, runId)}.coord`;
  try {
    fs.mkdirSync(coordinationPath, { mode: 0o700 });
  } catch (error) {
    if (error.code === 'EEXIST') throw coordinationLockedError(runId, coordinationPath, error);
    throw error;
  }

  let coordinationStat;
  try {
    coordinationStat = fs.lstatSync(coordinationPath);
    if (!coordinationStat.isDirectory()) throw new TypeError('Run lock coordination marker is not a directory');
    return callback();
  } finally {
    try {
      const current = fs.lstatSync(coordinationPath);
      if (coordinationStat && current.isDirectory()
        && current.dev === coordinationStat.dev && current.ino === coordinationStat.ino) {
        fs.rmdirSync(coordinationPath);
      }
    } catch { /* preserve the operation result and leave uncertain markers fail-closed */ }
  }
}

function readLockMarker(lockFile) {
  let stat;
  try {
    stat = fs.lstatSync(lockFile);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
  if (!stat.isFile() || stat.size > 1024) throw new TypeError('Run lock marker is not a bounded regular file');
  const marker = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
  if (!marker || typeof marker !== 'object' || Array.isArray(marker)
    || Object.keys(marker).some((key) => !['version', 'token', 'pid', 'host', 'createdAt'].includes(key))
    || marker.version !== RUN_LOCK_VERSION || typeof marker.token !== 'string'
    || !/^[a-f0-9]{32}$/.test(marker.token) || !Number.isSafeInteger(marker.pid) || marker.pid <= 0
    || typeof marker.host !== 'string' || marker.host.length < 1 || marker.host.length > 255
    || /[\u0000-\u001f\u007f]/.test(marker.host)
    || !Number.isSafeInteger(marker.createdAt) || marker.createdAt < 0) {
    throw new TypeError('Run lock marker is malformed; refusing recovery');
  }
  return {
    version: marker.version,
    token: marker.token,
    pid: marker.pid,
    host: marker.host,
    createdAt: marker.createdAt,
  };
}

function withRunLock(directory, runId, callback) {
  const file = runManifestFile(directory, runId);
  const lockFile = lockFileFor(directory, runId);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const token = crypto.randomBytes(16).toString('hex');
  const tempLockFile = `${lockFile}.${token}.tmp`;
  let lockFd;
  const marker = {
    version: RUN_LOCK_VERSION,
    token,
    pid: process.pid,
    host: os.hostname(),
    createdAt: Date.now(),
  };
  withRunCoordination(directory, runId, () => {
    try {
      lockFd = fs.openSync(tempLockFile, 'wx', 0o600);
      fs.writeFileSync(lockFd, `${JSON.stringify(marker)}\n`, 'utf8');
      fs.fsyncSync(lockFd);
      fs.closeSync(lockFd);
      lockFd = undefined;
      try {
        fs.linkSync(tempLockFile, lockFile);
      } catch (error) {
        if (error.code === 'EEXIST') throw lockedError(runId, error);
        throw error;
      }
    } catch (error) {
      if (lockFd !== undefined) {
        try { fs.closeSync(lockFd); } catch { /* preserve original error */ }
      }
      try { fs.rmSync(tempLockFile, { force: true }); } catch { /* preserve original error */ }
      throw error;
    }
    try { fs.rmSync(tempLockFile, { force: true }); } catch { /* the hard-linked lock remains valid */ }
  });

  try {
    return callback(file);
  } finally {
    try {
      if (readLockMarker(lockFile)?.token === token) fs.rmSync(lockFile, { force: true });
    } catch { /* preserve callback result/error and avoid deleting an unknown lock */ }
  }
}

export function inspectRunManifestLock(directory, runId) {
  const lockFile = lockFileFor(directory, runId);
  return readLockMarker(lockFile);
}

// Explicit recovery only: require primary confirmation, the observed lock
// token, and proof that its same-host owner PID no longer exists. Foreign-host,
// malformed, active, or changed locks fail closed and are never removed.
export function recoverRunManifestLock(directory, runId, options = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options)
    || Object.keys(options).some((key) => !['primaryConfirmed', 'expectedToken'].includes(key))) {
    throw new TypeError('Run lock recovery options are invalid');
  }
  const { primaryConfirmed, expectedToken } = options;
  if (primaryConfirmed !== true) throw new TypeError('Primary confirmation is required to recover a stale run lock');
  if (typeof expectedToken !== 'string' || !/^[a-f0-9]{32}$/.test(expectedToken)) {
    throw new TypeError('Expected lock token is required for explicit recovery');
  }
  const lockFile = lockFileFor(directory, runId);
  return withRunCoordination(directory, runId, () => {
    const before = fs.lstatSync(lockFile);
    if (!before.isFile()) throw new TypeError('Run lock is not a regular file; refusing recovery');
    const marker = readLockMarker(lockFile);
    if (!marker) {
      const error = new Error(`Parallel run lock not found: ${runId}`);
      error.code = 'ERR_PARALLEL_RUN_LOCK_MISSING';
      throw error;
    }
    if (marker.token !== expectedToken) throw new TypeError('Run lock changed since it was inspected; refusing recovery');
    if (marker.host !== os.hostname()) throw new TypeError('Cannot prove a foreign-host run lock is stale; refusing recovery');
    let ownerIsDead = false;
    try {
      process.kill(marker.pid, 0);
    } catch (error) {
      if (error.code !== 'ESRCH') throw new Error('Cannot prove run lock owner is stale; refusing recovery', { cause: error });
      ownerIsDead = true;
    }
    if (!ownerIsDead) throw new Error('Run lock owner is still alive; refusing recovery');
    const beforeUnlink = fs.lstatSync(lockFile);
    const currentMarker = readLockMarker(lockFile);
    if (before.dev !== beforeUnlink.dev || before.ino !== beforeUnlink.ino
      || currentMarker?.token !== expectedToken) {
      throw new TypeError('Run lock changed during recovery; refusing removal');
    }
    fs.rmSync(lockFile);
    return { recovered: true, runId, token: expectedToken };
  });
}

function readManifest(file, runId) {
  let source;
  try {
    source = fs.readFileSync(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
  const manifest = validateRunManifest(JSON.parse(source));
  if (manifest.runId !== runId) throw new TypeError('Run manifest ID does not match its sidecar path');
  return manifest;
}

function atomicWriteJson(file, value) {
  const directory = path.dirname(file);
  const tempFile = path.join(directory,
    `.${path.basename(file)}.${process.pid}.${crypto.randomBytes(8).toString('hex')}.tmp`);
  let fd;
  try {
    fd = fs.openSync(tempFile, 'wx', 0o600);
    fs.writeFileSync(fd, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;
    fs.renameSync(tempFile, file);
  } catch (error) {
    if (fd !== undefined) {
      try { fs.closeSync(fd); } catch { /* preserve original failure */ }
    }
    try { fs.rmSync(tempFile, { force: true }); } catch { /* preserve original failure */ }
    throw error;
  }
}

export function loadRunManifest(directory, runId) {
  const file = runManifestFile(directory, runId);
  return readManifest(file, runId);
}

// Writers fail fast rather than waiting or stealing a lock. Atomic rename keeps
// readers on either the prior complete manifest or the new complete manifest.
export function saveRunManifest(directory, manifest) {
  const normalized = validateRunManifest(manifest);
  return withRunLock(directory, normalized.runId, (file) => {
    atomicWriteJson(file, normalized);
    return normalized;
  });
}

// Creates a run exactly once while holding the same per-run lock as updates.
// Existing manifests are never replaced by a concurrent or duplicate creator.
export function createRunManifestExclusive(directory, manifest) {
  const normalized = validateRunManifest(manifest);
  return withRunLock(directory, normalized.runId, (file) => {
    try {
      fs.lstatSync(file);
      const error = new Error(`Parallel run already exists: ${normalized.runId}`);
      error.code = 'ERR_PARALLEL_RUN_EXISTS';
      throw error;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    atomicWriteJson(file, normalized);
    return normalized;
  });
}

// Holds the exclusive lock across read/modify/replace, avoiding lost updates.
// The updater must be synchronous and return a complete valid manifest.
export function updateRunManifest(directory, runId, updater) {
  if (typeof updater !== 'function') throw new TypeError('Run manifest updater must be a function');
  return withRunLock(directory, runId, (file) => {
    const current = readManifest(file, runId);
    if (!current) {
      const error = new Error(`Parallel run manifest not found: ${runId}`);
      error.code = 'ERR_PARALLEL_RUN_NOT_FOUND';
      throw error;
    }
    const next = validateRunManifest(updater(current));
    if (next.runId !== runId) throw new TypeError('Updater cannot change the run ID');
    atomicWriteJson(file, next);
    return next;
  });
}
