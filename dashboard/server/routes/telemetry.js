import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { readJsonl, summarize, advisorHistory } from '../lib/telemetry.js';
import { SPECS_DIR, TELEMETRY_DIR_SEGMENTS, EVENTS_FILE } from '../lib/constants.js';

export function createTelemetryRouter({ root }) {
  const router = express.Router();
  const telemetryFile = path.join(root, SPECS_DIR, ...TELEMETRY_DIR_SEGMENTS, EVENTS_FILE);

  router.get('/summary', (_req, res) => {
    const events = readJsonl(telemetryFile);
    res.json({ runs: summarize(events) });
  });

  router.get('/advisor-history', (req, res) => {
    const rawLimit = Number(req.query.limit);
    const limit = Number.isInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 25;
    res.json({ history: advisorHistory(readJsonl(telemetryFile), limit) });
  });

  router.get('/events', (req, res) => {
    const session = req.query.session;
    const events = readJsonl(telemetryFile);
    const filtered = typeof session === 'string' ? events.filter((e) => e.sessionID === session) : events;
    res.json({ events: filtered });
  });

  // Server-Sent Events: push a message the moment the telemetry file changes
  // so the dashboard updates live without a manual reload. The file is watched
  // by mtime polling (robust even when the file does not exist yet), with a
  // heartbeat to keep the connection alive through proxies.
  router.get('/stream', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write(': connected\n\n');

    let lastMtime = -1;
    const check = () => {
      let mtime = 0;
      try {
        mtime = fs.statSync(telemetryFile).mtimeMs;
      } catch {
        /* file absent */
      }
      if (mtime !== lastMtime) {
        lastMtime = mtime;
        res.write(`data: ${JSON.stringify({ ts: Date.now() })}\n\n`);
      }
    };
    check(); // emit immediately so clients refetch on (re)connect

    const watcher = setInterval(check, 1000);
    const heartbeat = setInterval(() => res.write(': hb\n\n'), 15000);
    req.on('close', () => {
      clearInterval(watcher);
      clearInterval(heartbeat);
    });
  });

  return router;
}
