import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Source checkout: dashboard/server/lib -> repo root; npm bundle: cli/dashboard/server/lib -> cli/.
const engineDir = path.join(__dirname, '..', '..', '..', 'skill-engine');
let enginePromise;

function loadEngine() {
  if (!enginePromise) {
    enginePromise = fs.existsSync(path.join(engineDir, 'index.js'))
      ? import(pathToFileURL(path.join(engineDir, 'index.js')).href)
      : Promise.reject(new Error('skill engine not found'));
  }
  return enginePromise;
}

export async function listGeneratedSkills(projectDir) {
  try {
    const engine = await loadEngine();
    return engine.listSkills({ projectDir, homeDir: os.homedir() });
  } catch (error) {
    return { global: [], project: [], error: String(error?.message || error) };
  }
}
