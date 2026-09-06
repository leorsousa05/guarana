import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { createTelemetryRouter } from './routes/telemetry.js';
import { createSpecsRouter } from './routes/specs.js';
import { createDecisionsRouter } from './routes/decisions.js';
import { createMemoryRouter } from './routes/memory.js';
import { createWorkflowRouter } from './routes/workflow.js';

export function createApp({ root, distDir }) {
  const app = express();
  app.use(express.json());

  app.use('/api/telemetry', createTelemetryRouter({ root }));
  app.use('/api/specs', createSpecsRouter({ root }));
  app.use('/api/decisions', createDecisionsRouter({ root }));
  app.use('/api/memory', createMemoryRouter({ root }));
  app.use('/api/workflow', createWorkflowRouter({ root }));

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
