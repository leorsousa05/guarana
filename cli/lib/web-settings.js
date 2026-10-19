'use strict';

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const START_PAGES = ['overview', 'now', 'runs', 'specs', 'workflow', 'memory', 'skills', 'settings'];
const DEFAULT_WEB_SETTINGS = Object.freeze({
  appearance: Object.freeze({ theme: 'light', startPage: 'overview' }),
  refresh: Object.freeze({ intervalSeconds: 5 }),
  server: Object.freeze({ port: 4200, open: true }),
});
const SETTINGS_FIELDS = Object.freeze({
  appearance: ['theme', 'startPage'],
  refresh: ['intervalSeconds'],
  server: ['port', 'open'],
});

function assertObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
}

function validateWebSettings(settings) {
  assertObject(settings, 'Web settings');
  for (const section of Object.keys(settings)) {
    if (!Object.hasOwn(SETTINGS_FIELDS, section)) {
      throw new TypeError(`Unknown web settings section: ${section}`);
    }
  }

  const normalized = {};
  for (const [sectionName, fields] of Object.entries(SETTINGS_FIELDS)) {
    if (!Object.hasOwn(settings, sectionName)) continue;
    const section = settings[sectionName];
    assertObject(section, `Web settings section "${sectionName}"`);
    for (const field of Object.keys(section)) {
      if (!fields.includes(field)) throw new TypeError(`Unknown web settings field: ${sectionName}.${field}`);
    }

    const valid = {};
    for (const field of fields) {
      if (!Object.hasOwn(section, field)) continue;
      const value = section[field];
      if (sectionName === 'appearance' && field === 'theme' && !['light', 'dark'].includes(value)) {
        throw new TypeError('Web setting appearance.theme must be "light" or "dark"');
      }
      if (sectionName === 'appearance' && field === 'startPage' && !START_PAGES.includes(value)) {
        throw new TypeError(`Web setting appearance.startPage must be one of: ${START_PAGES.join(', ')}`);
      }
      if (sectionName === 'refresh' && field === 'intervalSeconds' && ![5, 15, 30].includes(value)) {
        throw new TypeError('Web setting refresh.intervalSeconds must be 5, 15, or 30');
      }
      if (sectionName === 'server' && field === 'port'
        && (!Number.isInteger(value) || value < 1 || value > 65535)) {
        throw new TypeError('Web setting server.port must be an integer from 1 through 65535');
      }
      if (sectionName === 'server' && field === 'open' && typeof value !== 'boolean') {
        throw new TypeError('Web setting server.open must be a boolean');
      }
      valid[field] = value;
    }
    normalized[sectionName] = valid;
  }
  return normalized;
}

function webSettingsPaths({ directory = process.cwd(), env = process.env, home = os.homedir() } = {}) {
  const homeDirectory = env.HOME || home;
  const configHome = env.XDG_CONFIG_HOME || path.join(homeDirectory, '.config');
  return {
    project: path.join(directory, '.guarana', 'web.json'),
    global: path.join(configHome, 'guarana', 'web.json'),
  };
}

function readScope(file) {
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw new Error(`cannot read ${file}: ${error.message}`, { cause: error });
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`invalid JSON in ${file}: ${error.message}`, { cause: error });
  }
  try {
    return validateWebSettings(parsed);
  } catch (error) {
    throw new Error(`invalid web settings in ${file}: ${error.message}`, { cause: error });
  }
}

function mergeWebSettings(globalSettings, projectSettings) {
  const global = validateWebSettings(globalSettings);
  const project = validateWebSettings(projectSettings);
  const effective = {};
  const sources = {};

  for (const [section, fields] of Object.entries(SETTINGS_FIELDS)) {
    effective[section] = {};
    sources[section] = {};
    for (const field of fields) {
      if (Object.hasOwn(project[section] || {}, field)) {
        effective[section][field] = project[section][field];
        sources[section][field] = 'project';
      } else if (Object.hasOwn(global[section] || {}, field)) {
        effective[section][field] = global[section][field];
        sources[section][field] = 'global';
      } else {
        effective[section][field] = DEFAULT_WEB_SETTINGS[section][field];
        sources[section][field] = 'default';
      }
    }
  }

  return { global, project, effective, sources };
}

function readWebSettings(options = {}) {
  const files = webSettingsPaths(options);
  return mergeWebSettings(readScope(files.global), readScope(files.project));
}

function settingsFile(scope, options) {
  if (scope !== 'global' && scope !== 'project') {
    throw new TypeError('Web settings scope must be "global" or "project"');
  }
  return webSettingsPaths(options)[scope];
}

function atomicWriteJson(file, value) {
  const directory = path.dirname(file);
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
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

function writeWebSettings(scope, settings, options = {}) {
  const normalized = validateWebSettings(settings);
  const file = settingsFile(scope, options);
  // Refuse to overwrite malformed or inaccessible data in the selected scope.
  readScope(file);
  atomicWriteJson(file, normalized);
  return normalized;
}

module.exports = {
  DEFAULT_WEB_SETTINGS,
  START_PAGES,
  validateWebSettings,
  webSettingsPaths,
  mergeWebSettings,
  readWebSettings,
  writeWebSettings,
};
