import express from 'express';
import { createRequire } from 'node:module';
import { resolveSharedAdvisorModule } from './shared-advisor-modules.js';

const require = createRequire(import.meta.url);
const webSettings = require(resolveSharedAdvisorModule('web-settings.js', import.meta.url));

function settingsError(res, error, action) {
  res.status(500).json({ error: `Unable to ${action} web settings: ${error.message}` });
}

export function createWebSettingsRouter({ root }) {
  const router = express.Router();

  router.get('/settings', (req, res) => {
    try {
      res.json(webSettings.readWebSettings({ directory: req.projectRoot || root }));
    } catch (error) {
      settingsError(res, error, 'load');
    }
  });

  router.put('/settings', (req, res) => {
    const selectedRoot = req.projectRoot || root;
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)
      || Object.keys(body).length !== 2
      || Object.keys(body).some((key) => !['scope', 'settings'].includes(key))
      || !Object.hasOwn(body, 'scope') || !Object.hasOwn(body, 'settings')) {
      return res.status(400).json({ error: 'Request body must contain only scope and settings.' });
    }
    if (body.scope !== 'global' && body.scope !== 'project') {
      return res.status(400).json({ error: 'Web settings scope must be "global" or "project".' });
    }

    let settings;
    try {
      settings = webSettings.validateWebSettings(body.settings);
    } catch (error) {
      return res.status(400).json({ error: `Invalid web settings: ${error.message}` });
    }

    try {
      // Check both scopes first so corrupt config is never hidden by a write.
      webSettings.readWebSettings({ directory: selectedRoot });
      webSettings.writeWebSettings(body.scope, settings, { directory: selectedRoot });
      res.json(webSettings.readWebSettings({ directory: selectedRoot }));
    } catch (error) {
      settingsError(res, error, 'save');
    }
  });

  return router;
}
