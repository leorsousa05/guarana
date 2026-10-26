// Shared, host-independent workflow preference storage.
// Workflow settings are intentionally separate from advisor.json.

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PREFERENCE_NAMES = ['specs', 'verify'];
const PREFERENCE_BUDGET_FIELD = 'preferenceInjectionBudgetTokens';

function assertObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
}

// Settings files are partial: omitted fields inherit from the next scope.
export function validateWorkflowSettings(settings) {
  assertObject(settings, 'Workflow settings');
  const normalized = {};

  for (const section of Object.keys(settings)) {
    if (![...PREFERENCE_NAMES, 'memory'].includes(section)) {
      throw new TypeError(`Unknown workflow settings section: ${section}`);
    }
  }

  for (const name of PREFERENCE_NAMES) {
    if (!Object.prototype.hasOwnProperty.call(settings, name)) continue;
    const section = settings[name];
    assertObject(section, `Workflow settings section "${name}"`);
    for (const field of Object.keys(section)) {
      if (field !== 'enabled') {
        throw new TypeError(`Unknown workflow settings field: ${name}.${field}`);
      }
    }
    if (Object.prototype.hasOwnProperty.call(section, 'enabled')) {
      if (typeof section.enabled !== 'boolean') {
        throw new TypeError(`Workflow setting ${name}.enabled must be a boolean`);
      }
      normalized[name] = { enabled: section.enabled };
    } else {
      normalized[name] = {};
    }
  }

  if (Object.hasOwn(settings, 'memory')) {
    const memory = settings.memory;
    assertObject(memory, 'Workflow settings section "memory"');
    for (const field of Object.keys(memory)) {
      if (field !== PREFERENCE_BUDGET_FIELD) {
        throw new TypeError(`Unknown workflow settings field: memory.${field}`);
      }
    }
    if (Object.hasOwn(memory, PREFERENCE_BUDGET_FIELD)) {
      const budget = memory[PREFERENCE_BUDGET_FIELD];
      if (!Number.isSafeInteger(budget) || budget <= 0) {
        throw new TypeError(`Workflow setting memory.${PREFERENCE_BUDGET_FIELD} must be a positive integer token budget`);
      }
      normalized.memory = { [PREFERENCE_BUDGET_FIELD]: budget };
    } else {
      normalized.memory = {};
    }
  }

  return normalized;
}

export function workflowSettingsPaths({
  directory = process.cwd(),
  env = process.env,
  home = os.homedir(),
} = {}) {
  const configHome = env.XDG_CONFIG_HOME || path.join(home, '.config');
  return {
    project: path.join(directory, '.guarana', 'workflow.json'),
    global: path.join(configHome, 'guarana', 'workflow.json'),
  };
}

function readScope(file) {
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
  return validateWorkflowSettings(JSON.parse(raw));
}

export function mergeWorkflowSettings(globalSettings, projectSettings) {
  const global = validateWorkflowSettings(globalSettings);
  const project = validateWorkflowSettings(projectSettings);
  const effective = {};
  const sources = {};

  for (const name of PREFERENCE_NAMES) {
    if (Object.prototype.hasOwnProperty.call(project[name] || {}, 'enabled')) {
      effective[name] = { enabled: project[name].enabled };
      sources[name] = 'project';
    } else if (Object.prototype.hasOwnProperty.call(global[name] || {}, 'enabled')) {
      effective[name] = { enabled: global[name].enabled };
      sources[name] = 'global';
    } else {
      effective[name] = { enabled: true };
      sources[name] = 'default';
    }
  }

  const projectBudget = project.memory?.[PREFERENCE_BUDGET_FIELD];
  const globalBudget = global.memory?.[PREFERENCE_BUDGET_FIELD];
  const budget = projectBudget ?? globalBudget ?? null;
  effective.memory = { [PREFERENCE_BUDGET_FIELD]: budget };
  sources.memory = {
    [PREFERENCE_BUDGET_FIELD]: projectBudget !== undefined
      ? 'project'
      : globalBudget !== undefined ? 'global' : 'default',
  };

  return { global, project, effective, sources };
}

// Missing scope files and fields keep the established defaults (enabled).
// Malformed or invalid files fail closed by throwing; callers can report it.
export function readWorkflowSettings(options = {}) {
  const files = workflowSettingsPaths(options);
  return mergeWorkflowSettings(readScope(files.global), readScope(files.project));
}

function scopeFile(scope, options) {
  if (scope !== 'global' && scope !== 'project') {
    throw new TypeError('Workflow settings scope must be "global" or "project"');
  }
  return workflowSettingsPaths(options)[scope];
}

function atomicWriteJson(file, value) {
  const directory = path.dirname(file);
  fs.mkdirSync(directory, { recursive: true });
  const tempFile = path.join(directory, `.${path.basename(file)}.${process.pid}.${crypto.randomBytes(8).toString('hex')}.tmp`);
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
      try { fs.closeSync(fd); } catch { /* preserve the original failure */ }
    }
    try { fs.rmSync(tempFile, { force: true }); } catch { /* preserve the original failure */ }
    throw error;
  }
}

// Replaces one scope after full validation; the other scope is never touched.
export function writeWorkflowSettings(scope, settings, options = {}) {
  const normalized = validateWorkflowSettings(settings);
  const file = scopeFile(scope, options);
  atomicWriteJson(file, normalized);
  return normalized;
}

export function setWorkflowPreference(scope, name, enabled, options = {}) {
  if (!PREFERENCE_NAMES.includes(name)) {
    throw new TypeError(`Unknown workflow preference: ${name}`);
  }
  if (typeof enabled !== 'boolean') {
    throw new TypeError(`Workflow setting ${name}.enabled must be a boolean`);
  }
  const file = scopeFile(scope, options);
  const current = readScope(file);
  current[name] = { ...(current[name] || {}), enabled };
  return writeWorkflowSettings(scope, current, options);
}

// Removing a project field restores inheritance from global, then the default.
export function clearWorkflowPreference(scope, name, options = {}) {
  if (!PREFERENCE_NAMES.includes(name)) {
    throw new TypeError(`Unknown workflow preference: ${name}`);
  }
  const file = scopeFile(scope, options);
  const current = readScope(file);
  delete current[name];
  return writeWorkflowSettings(scope, current, options);
}

export function setPreferenceInjectionBudget(scope, budget, options = {}) {
  if (!Number.isSafeInteger(budget) || budget <= 0) {
    throw new TypeError(`Workflow setting memory.${PREFERENCE_BUDGET_FIELD} must be a positive integer token budget`);
  }
  const file = scopeFile(scope, options);
  const current = readScope(file);
  current.memory = { ...(current.memory || {}), [PREFERENCE_BUDGET_FIELD]: budget };
  return writeWorkflowSettings(scope, current, options);
}

export function clearPreferenceInjectionBudget(scope, options = {}) {
  const file = scopeFile(scope, options);
  const current = readScope(file);
  if (current.memory) {
    delete current.memory[PREFERENCE_BUDGET_FIELD];
    if (!Object.keys(current.memory).length) delete current.memory;
  }
  return writeWorkflowSettings(scope, current, options);
}
