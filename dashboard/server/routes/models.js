import express from 'express';
import { createRequire } from 'node:module';
import { resolveSharedAdvisorModule } from './shared-advisor-modules.js';
import path from 'node:path';
import { readJsonl } from '../lib/telemetry.js';
import { SPECS_DIR, TELEMETRY_DIR_SEGMENTS, EVENTS_FILE } from '../lib/constants.js';

const require = createRequire(import.meta.url);
const advisorSettings = require(resolveSharedAdvisorModule('advisor-settings.js', import.meta.url));
const advisorProfiles = require(resolveSharedAdvisorModule('advisor-profiles.js', import.meta.url));
const modelCatalog = require(resolveSharedAdvisorModule('opencode-model-catalog.js', import.meta.url));

function sources(project, global) {
  const result = {};
  for (const role of ['primary', 'advisor']) {
    result[role] = {};
    for (const field of ['provider', 'model', 'variant', ...(role === 'advisor' ? ['enabled'] : [])]) {
      result[role][field] = Object.hasOwn(project[role] || {}, field)
        ? 'project'
        : Object.hasOwn(global[role] || {}, field) ? 'global' : 'unset';
    }
  }
  return result;
}

function responseSettings(projectRoot) {
  const project = advisorSettings.readSettings(true, { projectRoot });
  const global = advisorSettings.readSettings(false, { projectRoot });
  const effective = advisorSettings.effectiveSettings(true, { projectRoot });
  effective.advisor = { ...(effective.advisor || {}), enabled: effective.advisor?.enabled === true };
  return {
    project,
    global,
    effective,
    sources: sources(project, global),
  };
}

export function createModelsRouter({ root }) {
  const router = express.Router();

  router.get('/runtime', (_req, res) => {
    const file = path.join(root, SPECS_DIR, ...TELEMETRY_DIR_SEGMENTS, EVENTS_FILE);
    const events = readJsonl(file);
    const event = events.filter((row) => row.type === 'advisor-execution').sort((a, b) => (b.ts || 0) - (a.ts || 0))[0];
    if (!event) return res.json({ execution: null });
    const execution = { ts: event.ts, status: event.status };
    for (const key of ['childSessionID', 'parentSessionID', 'providerID', 'modelID', 'variant']) {
      if (typeof event[key] === 'string') execution[key] = event[key];
    }
    res.json({ execution });
  });

  router.get('/catalog', async (req, res) => {
    const provider = req.query.provider;
    const result = await modelCatalog.discoverModels({
      cwd: root,
      ...(provider === undefined ? {} : { provider }),
    });
    res.json(result);
  });

  router.get('/variants', async (req, res) => {
    const result = await modelCatalog.discoverVariants({
      cwd: root,
      provider: req.query.provider,
      model: req.query.model,
    });
    res.json(result);
  });

  router.get('/', (_req, res) => {
    try {
      res.json(responseSettings(root));
    } catch (error) {
      res.status(500).json({ error: `Unable to load model settings: ${error.message}` });
    }
  });

  router.put('/', (req, res) => {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 1 || !Object.hasOwn(body, 'settings')) {
      return res.status(400).json({ error: 'Request body must contain only a settings object.' });
    }

    let project;
    try {
      project = advisorSettings.validateSettings(body.settings);
    } catch (error) {
      return res.status(400).json({ error: `Invalid model settings: ${error.message}` });
    }

    try {
      const global = advisorSettings.readSettings(false, { projectRoot: root });
      const effective = advisorSettings.mergeSettings(project, global);
        if (effective.advisor?.enabled === true && (!effective.advisor.provider || !effective.advisor.model)) {
          return res.status(400).json({ error: 'Advisor consultations require an effective Advisor provider and model.' });
        }
        if (advisorSettings.isConfigured(effective)) advisorProfiles.assertInstallable(true, { projectRoot: root });

      advisorSettings.writeSettings(true, project, { projectRoot: root });
      const artifacts = advisorProfiles.installAdvisorArtifacts(true, { projectRoot: root });
      res.json({ ...responseSettings(root), ok: true, artifacts });
    } catch (error) {
      const conflict = /exists and is not managed by Guarana/.test(error.message);
      res.status(conflict ? 409 : 500).json({
        error: conflict
          ? `Model settings conflict: ${error.message}`
          : `Unable to save model settings: ${error.message}`,
      });
    }
  });

  return router;
}
