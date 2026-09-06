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
        if (fs.existsSync(path.join(dir, 'state.js'))) {
          return import(pathToFileURL(path.join(dir, 'state.js')).href);
        }
      }
      return null;
    })();
  }
  return enginePromise;
}

const errMsg = (err) => String(err && err.message ? err.message : err);

// Read the current workflow state; never a 500. `root` is the project root
// (the orchestrator core resolves .specs/state/workflow.json itself). Returns
// a neutral idle shape when the file is absent/corrupt.
export async function current(root) {
  try {
    const state = await engine();
    if (!state) return { state: 'idle', engine: 'not-found' };
    const wf = state.load(root);
    return {
      state: wf.state,
      skill: wf.skill,
      activeTask: wf.activeTask,
      goal: wf.goal,
      condition: wf.condition,
      updatedAt: wf.updatedAt,
      history: wf.history.slice(-20),
      engine: 'ok',
    };
  } catch (err) {
    return { state: 'idle', error: errMsg(err), engine: 'error' };
  }
}