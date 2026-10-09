'use strict';

const fs = require('fs');
const path = require('path');
const { advisorSettingsTarget } = require('./paths.js');

const FIELDS = ['primary.provider', 'primary.model', 'primary.variant', 'advisor.provider', 'advisor.model', 'advisor.variant', 'advisor.enabled'];
const ID_PATTERNS = {
  provider: /^[A-Za-z0-9][A-Za-z0-9._+-]*$/,
  model: /^[A-Za-z0-9~][A-Za-z0-9._:/+~-]*$/,
  variant: /^[A-Za-z0-9][A-Za-z0-9._+-]*$/,
};

function validateSettings(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('settings must be a JSON object');
  for (const role of Object.keys(input)) {
    if (!['primary', 'advisor'].includes(role)) throw new Error(`unknown settings section: ${role}`);
    const section = input[role];
    if (!section || typeof section !== 'object' || Array.isArray(section)) throw new Error(`${role} must be an object`);
    for (const key of Object.keys(section)) {
      if (!['provider', 'model', 'variant', ...(role === 'advisor' ? ['enabled'] : [])].includes(key)) throw new Error(`unknown setting: ${role}.${key}`);
      const value = section[key];
      if (role === 'advisor' && key === 'enabled') {
        if (typeof value !== 'boolean') throw new Error('advisor.enabled must be a boolean');
        continue;
      }
      if (typeof value !== 'string' || value.trim() !== value || !ID_PATTERNS[key].test(value)) {
        throw new Error(`${role}.${key} must be a non-empty OpenCode ID without whitespace`);
      }
    }
  }
  return input;
}

function readSettings(useProject, options = {}) {
  const target = advisorSettingsTarget(useProject, options.projectRoot);
  if (!fs.existsSync(target)) return {};
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(target, 'utf8'));
  } catch (err) {
    throw new Error(`cannot read ${target}: ${err.message}`);
  }
  try {
    return validateSettings(parsed);
  } catch (err) {
    throw new Error(`invalid settings in ${target}: ${err.message}`);
  }
}

function writeSettings(useProject, settings, options = {}) {
  validateSettings(settings);
  const target = advisorSettingsTarget(useProject, options.projectRoot);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = `${target}.tmp-${process.pid}-${Date.now()}`;
  try {
    fs.writeFileSync(temporary, `${JSON.stringify(settings, null, 2)}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    fs.renameSync(temporary, target);
  } catch (err) {
    fs.rmSync(temporary, { force: true });
    throw err;
  }
  return target;
}

function setSetting(useProject, field, value) {
  if (!FIELDS.includes(field)) throw new Error(`unknown setting: ${field}; expected one of ${FIELDS.join(', ')}`);
  const [role, key] = field.split('.');
  validateSettings({ [role]: { [key]: value } });
  if (field === 'advisor.enabled' && value) {
    const effective = useProject ? mergeSettings(readSettings(true), readSettings(false)) : readSettings(false);
    const advisor = { ...(effective.advisor || {}), enabled: true };
    if (!advisor.provider || !advisor.model) throw new Error('enabling Advisor requires advisor.provider and advisor.model');
  }
  const settings = readSettings(useProject);
  settings[role] = { ...(settings[role] || {}), [key]: value };
  return writeSettings(useProject, settings);
}

function clearSettings(useProject, field) {
  const settings = readSettings(useProject);
  if (field !== undefined) {
    if (!FIELDS.includes(field)) throw new Error(`unknown setting: ${field}; expected one of ${FIELDS.join(', ')}`);
    const [role, key] = field.split('.');
    if (settings[role]) {
      delete settings[role][key];
      if (Object.keys(settings[role]).length === 0) delete settings[role];
    }
  } else {
    for (const role of Object.keys(settings)) delete settings[role];
  }
  return writeSettings(useProject, settings);
}

function mergeSettings(project, global) {
  const effective = {};
  for (const role of ['primary', 'advisor']) {
    const section = { ...(global[role] || {}), ...(project[role] || {}) };
    if (Object.keys(section).length) effective[role] = section;
  }
  return effective;
}

function effectiveSettings(useProject, options = {}) {
  const global = readSettings(false, options);
  if (!useProject) return global;
  const project = readSettings(true, options);
  return mergeSettings(project, global);
}

function isPrimaryConfigured(settings) {
  return Boolean(settings.primary && settings.primary.provider && settings.primary.model);
}

function isAdvisorConfigured(settings) {
  return Boolean(settings.advisor && settings.advisor.enabled === true && settings.advisor.provider && settings.advisor.model);
}

function isConfigured(settings) { return isPrimaryConfigured(settings); }

module.exports = { FIELDS, validateSettings, readSettings, writeSettings, setSetting, clearSettings, mergeSettings, effectiveSettings, isConfigured, isPrimaryConfigured, isAdvisorConfigured };
