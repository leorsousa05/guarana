// Shared, host-independent workflow preference storage.
// Workflow settings are intentionally separate from advisor.json.

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PREFERENCE_NAMES = ['specs', 'verify'];
const PREFERENCE_BUDGET_FIELD = 'preferenceInjectionBudgetTokens';
const MEMORY_AUTO_INJECT_FIELD = 'autoInject';
const LEARNING_REVIEW_AUTO_ACCEPT_FIELD = 'autoAccept';
const ADVISOR_POLICY_FIELD = 'consultationPolicy';
const ADVISOR_LIMIT_FIELD = 'maxConsultationsPerTask';

function assertObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
}

function lstatIfPresent(file) {
  try {
    return fs.lstatSync(file);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function assertSafeScopePath(file) {
  const directory = lstatIfPresent(path.dirname(file));
  if (directory?.isSymbolicLink()) {
    throw new Error('Workflow settings scope contains a symlink; refusing access');
  }
  if (directory && !directory.isDirectory()) {
    throw new Error('Workflow settings scope directory is not a directory');
  }
  const target = lstatIfPresent(file);
  if (target?.isSymbolicLink()) {
    throw new Error('Workflow settings file is a symlink; refusing access');
  }
  if (target && !target.isFile()) {
    throw new Error('Workflow settings target is not a regular file');
  }
}

// Settings files are partial: omitted fields inherit from the next scope.
export function validateWorkflowSettings(settings) {
  assertObject(settings, 'Workflow settings');
  const normalized = {};

  for (const section of Object.keys(settings)) {
    if (![...PREFERENCE_NAMES, 'memory', 'learningReview', 'advisor'].includes(section)) {
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
      if (field !== PREFERENCE_BUDGET_FIELD && field !== MEMORY_AUTO_INJECT_FIELD) {
        throw new TypeError(`Unknown workflow settings field: memory.${field}`);
      }
    }
    if (Object.hasOwn(memory, MEMORY_AUTO_INJECT_FIELD)) {
      if (typeof memory[MEMORY_AUTO_INJECT_FIELD] !== 'boolean') {
        throw new TypeError(`Workflow setting memory.${MEMORY_AUTO_INJECT_FIELD} must be a boolean`);
      }
      normalized.memory = { [MEMORY_AUTO_INJECT_FIELD]: memory[MEMORY_AUTO_INJECT_FIELD] };
    }
    if (Object.hasOwn(memory, PREFERENCE_BUDGET_FIELD)) {
      const budget = memory[PREFERENCE_BUDGET_FIELD];
      if (!Number.isSafeInteger(budget) || budget <= 0) {
        throw new TypeError(`Workflow setting memory.${PREFERENCE_BUDGET_FIELD} must be a positive integer token budget`);
      }
      normalized.memory = { ...(normalized.memory || {}), [PREFERENCE_BUDGET_FIELD]: budget };
    }
  }

  if (Object.hasOwn(settings, 'learningReview')) {
    const learningReview = settings.learningReview;
    assertObject(learningReview, 'Workflow settings section "learningReview"');
    for (const field of Object.keys(learningReview)) {
      if (field !== LEARNING_REVIEW_AUTO_ACCEPT_FIELD && field !== 'enabled') {
        throw new TypeError(`Unknown workflow settings field: learningReview.${field}`);
      }
    }
    normalized.learningReview = {};
    for (const field of ['enabled', LEARNING_REVIEW_AUTO_ACCEPT_FIELD]) {
      if (!Object.hasOwn(learningReview, field)) continue;
      if (typeof learningReview[field] !== 'boolean') throw new TypeError(`Workflow setting learningReview.${field} must be a boolean`);
      normalized.learningReview[field] = learningReview[field];
    }
  }

  if (Object.hasOwn(settings, 'advisor')) {
    const advisor = settings.advisor;
    assertObject(advisor, 'Workflow settings section "advisor"');
    for (const field of Object.keys(advisor)) {
      if (![ADVISOR_POLICY_FIELD, ADVISOR_LIMIT_FIELD].includes(field)) throw new TypeError(`Unknown workflow settings field: advisor.${field}`);
    }
    normalized.advisor = {};
    if (Object.hasOwn(advisor, ADVISOR_POLICY_FIELD)) {
      if (!['manual', 'recommended'].includes(advisor[ADVISOR_POLICY_FIELD])) throw new TypeError(`Workflow setting advisor.${ADVISOR_POLICY_FIELD} must be "manual" or "recommended"`);
      normalized.advisor[ADVISOR_POLICY_FIELD] = advisor[ADVISOR_POLICY_FIELD];
    }
    if (Object.hasOwn(advisor, ADVISOR_LIMIT_FIELD)) {
      if (!Number.isSafeInteger(advisor[ADVISOR_LIMIT_FIELD]) || advisor[ADVISOR_LIMIT_FIELD] <= 0) throw new TypeError(`Workflow setting advisor.${ADVISOR_LIMIT_FIELD} must be a positive integer`);
      normalized.advisor[ADVISOR_LIMIT_FIELD] = advisor[ADVISOR_LIMIT_FIELD];
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
  assertSafeScopePath(file);
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
  const projectAutoInject = project.memory?.[MEMORY_AUTO_INJECT_FIELD];
  const globalAutoInject = global.memory?.[MEMORY_AUTO_INJECT_FIELD];
  const budget = projectBudget ?? globalBudget ?? null;
  effective.memory = { [PREFERENCE_BUDGET_FIELD]: budget };
  sources.memory = {
    [PREFERENCE_BUDGET_FIELD]: projectBudget !== undefined
      ? 'project'
      : globalBudget !== undefined ? 'global' : 'default',
  };
  if (projectAutoInject !== undefined || globalAutoInject !== undefined) {
    effective.memory[MEMORY_AUTO_INJECT_FIELD] = projectAutoInject ?? globalAutoInject;
    sources.memory[MEMORY_AUTO_INJECT_FIELD] = projectAutoInject !== undefined ? 'project' : 'global';
  }

  effective.learningReview = {};
  sources.learningReview = {};
  for (const field of ['enabled', LEARNING_REVIEW_AUTO_ACCEPT_FIELD]) {
    const fallback = false;
    const projectValue = project.learningReview?.[field];
    const globalValue = global.learningReview?.[field];
    effective.learningReview[field] = projectValue ?? globalValue ?? fallback;
    sources.learningReview[field] = projectValue !== undefined ? 'project' : globalValue !== undefined ? 'global' : 'default';
  }
  effective.advisor = {};
  sources.advisor = {};
  for (const [field, fallback] of [[ADVISOR_POLICY_FIELD, 'recommended'], [ADVISOR_LIMIT_FIELD, 3]]) {
    const projectValue = project.advisor?.[field];
    const globalValue = global.advisor?.[field];
    effective.advisor[field] = projectValue ?? globalValue ?? fallback;
    sources.advisor[field] = projectValue !== undefined ? 'project' : globalValue !== undefined ? 'global' : 'default';
  }

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
  assertSafeScopePath(file);
  fs.mkdirSync(directory, { recursive: true });
  assertSafeScopePath(file);
  const tempFile = path.join(directory, `.${path.basename(file)}.${process.pid}.${crypto.randomBytes(8).toString('hex')}.tmp`);
  let fd;
  try {
    fd = fs.openSync(tempFile, 'wx', 0o600);
    fs.writeFileSync(fd, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;
    assertSafeScopePath(file);
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
  if (name === 'memory') {
    const file = scopeFile(scope, options);
    const current = readScope(file);
    delete current.memory;
    return writeWorkflowSettings(scope, current, options);
  }
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

export function setMemoryAutoInject(scope, enabled, options = {}) {
  if (typeof enabled !== 'boolean') {
    throw new TypeError(`Workflow setting memory.${MEMORY_AUTO_INJECT_FIELD} must be a boolean`);
  }
  const file = scopeFile(scope, options);
  const current = readScope(file);
  current.memory = { ...(current.memory || {}), [MEMORY_AUTO_INJECT_FIELD]: enabled };
  return writeWorkflowSettings(scope, current, options);
}

export function clearMemoryAutoInject(scope, options = {}) {
  const file = scopeFile(scope, options);
  const current = readScope(file);
  if (current.memory) {
    delete current.memory[MEMORY_AUTO_INJECT_FIELD];
    if (!Object.keys(current.memory).length) delete current.memory;
  }
  return writeWorkflowSettings(scope, current, options);
}

export function setLearningReviewAutoAccept(scope, enabled, options = {}) {
  if (typeof enabled !== 'boolean') {
    throw new TypeError(`Workflow setting learningReview.${LEARNING_REVIEW_AUTO_ACCEPT_FIELD} must be a boolean`);
  }
  const file = scopeFile(scope, options);
  const current = readScope(file);
  current.learningReview = {
    ...(current.learningReview || {}),
    [LEARNING_REVIEW_AUTO_ACCEPT_FIELD]: enabled,
  };
  return writeWorkflowSettings(scope, current, options);
}

export function clearLearningReviewAutoAccept(scope, options = {}) {
  const file = scopeFile(scope, options);
  const current = readScope(file);
  if (current.learningReview) {
    delete current.learningReview[LEARNING_REVIEW_AUTO_ACCEPT_FIELD];
    if (!Object.keys(current.learningReview).length) delete current.learningReview;
  }
  return writeWorkflowSettings(scope, current, options);
}

export function setScopedWorkflowField(scope, section, field, value, options = {}) {
  const file = scopeFile(scope, options);
  const current = readScope(file);
  current[section] = { ...(current[section] || {}), [field]: value };
  return writeWorkflowSettings(scope, current, options);
}

export function clearScopedWorkflowField(scope, section, field, options = {}) {
  const file = scopeFile(scope, options);
  const current = readScope(file);
  if (current[section]) {
    delete current[section][field];
    if (!Object.keys(current[section]).length) delete current[section];
  }
  return writeWorkflowSettings(scope, current, options);
}
