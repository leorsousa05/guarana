import fs from 'node:fs';
import { EVENTS_FILE } from './constants.js';

/**
 * Read a newline-delimited JSON file into an array of objects.
 * Malformed lines are skipped; missing files return an empty array.
 */
export function readJsonl(file) {
  try {
    const text = fs.readFileSync(file, 'utf8');
    const events = [];
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        events.push(JSON.parse(trimmed));
      } catch {
        // skip malformed line
      }
    }
    return events;
  } catch {
    return [];
  }
}

/**
 * Aggregate raw telemetry events into per-session run summaries.
 * Pure function: no I/O, no side effects, fully testable.
 */
export function summarize(events) {
  const sessions = new Map();
  for (const ev of events) {
    const sid = ev.sessionID;
    if (!sid) continue;
    let s = sessions.get(sid);
    if (!s) {
      s = {
        sessionID: sid,
        project: ev.project || null,
        start: null,
        end: null,
        durationMs: null,
        toolCalls: 0,
        errors: 0,
        tokens: 0,
        eventCount: 0,
      };
      sessions.set(sid, s);
    }
    s.eventCount += 1;
    if (s.project == null && ev.project) s.project = ev.project;
    if (typeof ev.ts === 'number') {
      if (s.start === null || ev.ts < s.start) s.start = ev.ts;
      if (s.end === null || ev.ts > s.end) s.end = ev.ts;
    }
    if (ev.type === 'tool') {
      s.toolCalls += 1;
      if (ev.ok === false || ev.error) s.errors += 1;
    }
    if (ev.type === 'session' && ev.status === 'error') s.errors += 1;
    if (typeof ev.tokens === 'number') s.tokens += ev.tokens;
  }
  const runs = [...sessions.values()];
  for (const r of runs) {
    if (r.start !== null && r.end !== null) r.durationMs = r.end - r.start;
  }
  runs.sort((a, b) => (b.start ?? 0) - (a.start ?? 0));
  return runs;
}
