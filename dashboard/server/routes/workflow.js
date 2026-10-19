import express from 'express';
import { current } from '../lib/workflow.js';
import {
  readWorkflowSettings,
  validateWorkflowSettings,
  writeWorkflowSettings,
} from '../../../orchestrator/workflow-settings.js';

function settingsError(res, error, action) {
  res.status(500).json({ error: `Unable to ${action} workflow settings: ${error.message}` });
}

export function createWorkflowRouter({ root }) {
  const router = express.Router();

  router.get('/current', async (_req, res) => {
    res.json(await current(root));
  });

  router.get('/settings', (_req, res) => {
    try {
      res.json(readWorkflowSettings({ directory: root }));
    } catch (error) {
      settingsError(res, error, 'load');
    }
  });

  router.put('/settings', (req, res) => {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)
      || !Object.hasOwn(body, 'settings')
      || (Object.keys(body).length !== 1 && Object.keys(body).length !== 2)
      || Object.keys(body).some((key) => !['settings', 'scope'].includes(key))) {
      return res.status(400).json({ error: 'Request body must contain settings and optional scope only.' });
    }

    const scope = Object.hasOwn(body, 'scope') ? body.scope : 'project';
    if (scope !== 'global' && scope !== 'project') {
      return res.status(400).json({ error: 'Workflow settings scope must be "global" or "project".' });
    }

    let settings;
    try {
      settings = validateWorkflowSettings(body.settings);
    } catch (error) {
      return res.status(400).json({ error: `Invalid workflow settings: ${error.message}` });
    }

    try {
      // Validate both scopes before replacing the selected file so corrupt
      // settings cannot be silently overwritten or hidden by the update.
      readWorkflowSettings({ directory: root });
      writeWorkflowSettings(scope, settings, { directory: root });
      res.json({ ok: true, ...readWorkflowSettings({ directory: root }) });
    } catch (error) {
      settingsError(res, error, 'save');
    }
  });

  return router;
}
