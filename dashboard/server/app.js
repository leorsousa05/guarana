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

export function createApp({ root, distDir, execFileImpl }) {
  const app = express();
  app.use(express.json());

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
