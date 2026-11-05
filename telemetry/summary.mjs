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
        parentSessionID: null,
        agent: null,
        status: null,
        statusTs: null,
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
    if (ev.type === 'session') {
      if (typeof ev.parentSessionID === 'string') s.parentSessionID = ev.parentSessionID;
      if (typeof ev.agent === 'string') s.agent = ev.agent;
      if (typeof ev.status === 'string' && (s.statusTs === null || (ev.ts ?? 0) >= s.statusTs)) {
        s.status = ev.status;
        s.statusTs = typeof ev.ts === 'number' ? ev.ts : s.statusTs;
      }
    }
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
