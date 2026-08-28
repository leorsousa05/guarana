import express from 'express';
import path from 'node:path';
import { readJsonl, summarize } from '../lib/telemetry.js';
import { SPECS_DIR, TELEMETRY_DIR_SEGMENTS, EVENTS_FILE } from '../lib/constants.js';

export function createTelemetryRouter({ root }) {
  const router = express.Router();
  const telemetryFile = path.join(root, SPECS_DIR, ...TELEMETRY_DIR_SEGMENTS, EVENTS_FILE);

  router.get('/summary', (_req, res) => {
    const events = readJsonl(telemetryFile);
    res.json({ runs: summarize(events) });
  });

  router.get('/events', (req, res) => {
    const session = req.query.session;
    const events = readJsonl(telemetryFile);
    const filtered = session ? events.filter((e) => e.sessionID === session) : events;
    res.json({ events: filtered });
  });

  return router;
}
