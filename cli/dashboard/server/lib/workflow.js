import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The orchestrator core lives at repo-root orchestrator/ in-repo, or at
// cli/orchestrator/ in the bundle. Same relative path pattern as the memory lib.
function engineCandidates() {
  return [
    path.join(__dirname, '..', '..', '..', 'orchestrator'),
    path.join(__dirname, '..', '..', 'orchestrator'),
  ];
}

let enginePromise = null;
function engine() {
  if (!enginePromise) {
    enginePromise = (async () => {
      for (const dir of engineCandidates()) {
        if (!fs.existsSync(path.join(dir, 'state.js'))) continue;
        return import(pathToFileURL(path.join(dir, 'state.js')).href);
      }
      return null;
    })();
  }
  return enginePromise;
}

let parallelEnginePromise = null;
function parallelEngine() {
  if (!parallelEnginePromise) {
    parallelEnginePromise = (async () => {
      for (const dir of engineCandidates()) {
        if (!fs.existsSync(path.join(dir, 'parallel.js'))) continue;
        return import(pathToFileURL(path.join(dir, 'parallel.js')).href);
      }
      return null;
    })();
  }
  return parallelEnginePromise;
}

const errMsg = (err) => String(err && err.message ? err.message : err);

const MAX_BOUND_MARKER_BYTES = 1024;
const MAX_RUN_MANIFEST_BYTES = 1024 * 1024;

function readBounded(fd, maxBytes) {
  const buffer = Buffer.alloc(maxBytes + 1);
  let length = 0;
  while (length < buffer.length) {
    const read = fs.readSync(fd, buffer, length, buffer.length - length, null);
    if (read === 0) break;
    length += read;
  }
  if (length > maxBytes) throw new TypeError('Sidecar exceeds its read bound');
  return buffer.toString('utf8', 0, length);
}

function readBoundMarker(file, runId) {
  let fd;
  try {
    fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
  } catch (error) {
    if (error.code === 'ENOENT') return { present: false };
    throw error;
  }

  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.size > MAX_BOUND_MARKER_BYTES) {
      throw new TypeError('Invalid run binding marker');
    }
    const marker = JSON.parse(readBounded(fd, MAX_BOUND_MARKER_BYTES));
    if (!marker || typeof marker !== 'object' || Array.isArray(marker)
      || Object.keys(marker).some((key) => !['version', 'runId'].includes(key))
      || marker.version !== 1 || marker.runId !== runId) {
      throw new TypeError('Invalid run binding marker');
    }
    return { present: true };
  } finally {
    fs.closeSync(fd);
  }
}

function sidecarExists(file) {
  try {
    fs.lstatSync(file);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

function readManifest(file, runId, parallel) {
  const lockFile = `${file}.lock`;
  const coordinationDirectory = `${lockFile}.coord`;
  if (sidecarExists(lockFile) || sidecarExists(coordinationDirectory)) {
    throw new TypeError('Run manifest is locked');
  }

  let fd;
  try {
    fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
  } catch (error) {
    if (error.code === 'ENOENT') throw new TypeError('Bound run manifest is missing');
    throw error;
  }

  let manifest;
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.size > MAX_RUN_MANIFEST_BYTES) {
      throw new TypeError('Invalid run manifest');
    }
    manifest = parallel.validateRunManifest(JSON.parse(readBounded(fd, MAX_RUN_MANIFEST_BYTES)));
  } finally {
    fs.closeSync(fd);
  }

  // A writer may have started while the snapshot was being read. Valid atomic
  // snapshots are safe, but report uncertainty if its lock is still held.
  if (sidecarExists(lockFile) || sidecarExists(coordinationDirectory)) {
    throw new TypeError('Run manifest is locked');
  }
  if (manifest.runId !== runId) {
    throw new TypeError('Bound run manifest does not match its sidecar');
  }
  return manifest;
}

function currentRunId(history) {
  let boundaryIndex = -1;
  let runStartIndex = -1;
  for (let index = 0; index < history.length; index += 1) {
    const entry = history[index];
    if (entry?.event === 'new_task' || entry?.event === 'abort') boundaryIndex = index;
    if (entry?.event === 'run_start' && entry?.to === 'coding') runStartIndex = index;
  }
  if (runStartIndex <= boundaryIndex) return null;
  const timestamp = history[runStartIndex]?.ts;
  if (!Number.isSafeInteger(timestamp) || timestamp < 0) return 'uncertain';
  return `workflow-${timestamp}`;
}

async function parallelRunProjection(directory, workflow) {
  const runId = currentRunId(Array.isArray(workflow.history) ? workflow.history : []);
  if (!runId) return null;
  if (runId === 'uncertain') return { status: 'unavailable' };

  try {
    const runDirectory = path.join(directory, '.specs', 'state', 'parallel-runs');
    const manifestFile = path.join(runDirectory, `${runId}.json`);
    const bindingFile = path.join(runDirectory, `${runId}.bound`);
    const binding = readBoundMarker(bindingFile, runId);
    if (!binding.present) {
      // The durable binding marker is written before the manifest. A manifest
      // or lock without it is inconsistent sidecar state, not a no-DAG result.
      const uncertain = [manifestFile, `${manifestFile}.lock`, `${manifestFile}.lock.coord`]
        .some((file) => sidecarExists(file));
      return uncertain ? { status: 'unavailable' } : null;
    }

    const parallel = await parallelEngine();
    if (!parallel) return { status: 'unavailable' };
    const manifest = readManifest(manifestFile, runId, parallel);
    return {
      status: manifest.status,
      updatedAt: manifest.updatedAt,
      tasks: manifest.tasks.map(({ id, mode, status, dependsOn }) => ({
        id, mode, status, dependsOn,
      })),
    };
  } catch {
    // Sidecar errors may contain paths, lock identities, or manifest details.
    return { status: 'unavailable' };
  }
}

// Read the current workflow state; never a 500. `root` is the project root
// (the orchestrator core resolves .specs/state/workflow.json itself). Returns
// a neutral idle shape when the file is absent/corrupt.
export async function current(root) {
  try {
    const state = await engine();
    if (!state) return { state: 'idle', engine: 'not-found', parallelRun: null };
    const wf = state.load(root);
    return {
      state: wf.state,
      skill: wf.skill,
      activeTask: wf.activeTask,
      goal: wf.goal,
      condition: wf.condition,
      updatedAt: wf.updatedAt,
      history: wf.history.slice(-20),
      parallelRun: await parallelRunProjection(root, wf),
      engine: 'ok',
    };
  } catch (err) {
    return { state: 'idle', error: errMsg(err), engine: 'error', parallelRun: null };
  }
}
