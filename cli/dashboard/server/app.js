import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { createTelemetryRouter } from './routes/telemetry.js';
import { createSpecsRouter } from './routes/specs.js';
import { createDecisionsRouter } from './routes/decisions.js';
import { createMemoryRouter } from './routes/memory.js';
import { createWorkflowRouter } from './routes/workflow.js';
import { createSkillsRouter } from './routes/skills.js';
import { createModelsRouter } from './routes/models.js';
import { createWebSettingsRouter } from './routes/web-settings.js';
import { createOpenCodeRouter } from './routes/opencode.js';
import { createProjectsRouter } from './routes/projects.js';
import { createProjectRegistry } from './lib/projects.js';

export function createApp({ root, distDir, execFileImpl }) {
  const app = express();
  const projects = createProjectRegistry({ root });
  app.use(express.json());

  app.use('/api/projects', createProjectsRouter({ registry: projects }));
  app.use('/api', (req, res, next) => {
    const queryID = req.query.projectId;
    const headerID = req.get('x-guarana-project-id');
    if ((queryID !== undefined && typeof queryID !== 'string')
      || (queryID !== undefined && headerID !== undefined && queryID !== headerID)) {
      return res.status(400).json({ error: 'Invalid project selection.' });
    }
    const id = queryID === undefined ? headerID : queryID;
    let selected;
    try { selected = projects.resolve(id); }
    catch { return res.status(503).json({ error: 'Project selection is temporarily unavailable.' }); }
    if (!selected) return res.status(404).json({ error: 'Unknown project selection.' });
    req.projectRoot = selected;
    next();
  });

  app.use('/api/telemetry', createTelemetryRouter({ root }));
  app.use('/api/specs', createSpecsRouter({ root }));
  app.use('/api/decisions', createDecisionsRouter({ root }));
  app.use('/api/memory', createMemoryRouter({ root }));
  app.use('/api/workflow', createWorkflowRouter({ root }));
  app.use('/api/skills', createSkillsRouter({ root }));
  app.use('/api/models', createModelsRouter({ root }));
  app.use('/api/opencode', createOpenCodeRouter({ root, execFileImpl }));
  app.use('/api/web', createWebSettingsRouter({ root }));

  app.use((error, req, res, next) => {
    if (error?.type === 'entity.parse.failed' && /^\/api\/(?:workflow|web)\/settings\/?$/.test(req.path)) {
      return res.status(400).json({ error: 'Malformed JSON request body.' });
    }
    if (error?.type === 'entity.parse.failed' && /^\/api\/projects\/?$/.test(req.path)) {
      return res.status(400).json({ error: 'Malformed project request body.' });
    }
    next(error);
  });

  app.use(express.static(distDir));

  // Catch-all for SPA routing. Avoid Express 4 `app.get('*', ...)` which is
  // removed in Express 5. The regex matches any path.
  app.get(/.*/, (_req, res) => {
    const index = path.join(distDir, 'index.html');
    if (fs.existsSync(index)) return res.sendFile(index);
    res.status(503).send('Frontend not built. Run `npm run build` in dashboard/.');
  });

  return app;
}
