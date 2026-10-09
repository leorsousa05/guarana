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

const safeText = (value) => typeof value === 'string' && value.length <= 200 && !/[\u0000-\u001f]/.test(value) ? value : null;
const safeReason = (value) => {
  const reason = safeText(value);
  return reason && !/\bsk-\S+|\bgh[pousr]_[A-Za-z0-9_]+\b|\b(?:api[_-]?key|token|password|secret)\s*[:=]\s*\S+|\bbearer\s+\S+/i.test(reason)
    ? reason
    : null;
};

// Advisor history is a bounded, allow-listed projection of telemetry. A child
// can emit several completed assistant turns; retain only its latest execution.
export function advisorHistory(events, limit = 25) {
  const rows = [];
  const byCall = new Map();
  const byChild = new Map();
  const sessionAgents = new Map();
  const sessionParents = new Map();
  const rowFor = (key, event) => {
    let row = key && byCall.get(key);
    if (!row) {
      row = { ts: typeof event.ts === 'number' ? event.ts : null, status: null };
      rows.push(row);
      if (key) byCall.set(key, row);
    }
    return row;
  };
  for (const event of events) {
    if (event.type === 'session') {
      const sessionID = safeText(event.sessionID);
      if (sessionID && safeText(event.agent)) sessionAgents.set(sessionID, event.agent);
      if (sessionID && safeText(event.parentSessionID)) sessionParents.set(sessionID, event.parentSessionID);
      if (!sessionID || !['busy', 'running'].includes(event.status) || (event.agent || sessionAgents.get(sessionID)) !== 'guarana-advisor') continue;
      const row = byChild.get(sessionID) || rowFor(`child:${sessionID}`, event);
      row.childSessionID = sessionID;
      const parentSessionID = safeText(event.parentSessionID) || sessionParents.get(sessionID);
      if (parentSessionID) row.parentSessionID = parentSessionID;
      row.status = 'running';
      byChild.set(sessionID, row);
    } else if (event.type === 'advisor-dispatch') {
      const callID = safeText(event.callID);
      const childSessionID = safeText(event.childSessionID);
      const key = callID || (childSessionID && `child:${childSessionID}`) || null;
      const callRow = callID && byCall.get(callID);
      const childRow = childSessionID && byChild.get(childSessionID);
      let row = callRow || childRow;
      if (callRow && childRow && callRow !== childRow) {
        if (childRow.observedAt !== undefined) {
          callRow.status = childRow.status;
          callRow.observedAt = childRow.observedAt;
          for (const field of ['providerID', 'modelID', 'variant']) {
            if (childRow[field]) callRow[field] = childRow[field];
            else delete callRow[field];
          }
        }
        if (!callRow.parentSessionID && childRow.parentSessionID) callRow.parentSessionID = childRow.parentSessionID;
        if (!safeReason(callRow.reason) && safeReason(childRow.reason)) callRow.reason = safeReason(childRow.reason);
        else if (!safeReason(callRow.reason)) delete callRow.reason;
        const duplicateIndex = rows.indexOf(childRow);
        if (duplicateIndex >= 0) rows.splice(duplicateIndex, 1);
        for (const [existingKey, existingRow] of byCall) if (existingRow === childRow) byCall.set(existingKey, callRow);
        if (childSessionID) byChild.set(childSessionID, callRow);
        row = callRow;
      }
      if (!row) row = rowFor(key, event);
      if (callID) byCall.set(callID, row);
      if ((row.ts === null || event.status === 'dispatched') && typeof event.ts === 'number') row.ts = event.ts;
      if (callID) row.callID = callID;
      if (safeText(event.parentSessionID)) row.parentSessionID = event.parentSessionID;
      const reason = safeReason(event.reason);
      if (reason) row.reason = reason;
      if (childSessionID) {
        row.childSessionID = childSessionID;
        byChild.set(childSessionID, row);
      }
      if (!Number.isFinite(row.observedAt) && ['dispatched', 'running', 'completed', 'error'].includes(event.status)) row.status = event.status;
    } else if (event.type === 'advisor-execution') {
      const childSessionID = safeText(event.childSessionID);
      const row = (childSessionID && byChild.get(childSessionID)) || rowFor(childSessionID ? `child:${childSessionID}` : null, event);
      if (childSessionID) {
        row.childSessionID = childSessionID;
        byChild.set(childSessionID, row);
      }
      if (safeText(event.parentSessionID)) row.parentSessionID = event.parentSessionID;
      row.status = event.status === 'error' ? 'error' : 'completed';
      // The latest observed assistant execution supplies the runtime metadata.
      for (const key of ['providerID', 'modelID', 'variant']) {
        const value = safeText(event[key]);
        if (value) row[key] = value;
        else delete row[key];
      }
      row.observedAt = typeof event.ts === 'number' ? event.ts : row.observedAt;
    }
  }
  const bounded = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 100) : 25;
  return rows
    .filter((row) => row.status)
    .sort((a, b) => (b.ts ?? b.observedAt ?? 0) - (a.ts ?? a.observedAt ?? 0))
    .slice(0, bounded)
    .map((row) => ({
      ts: row.ts ?? row.observedAt ?? null,
      status: row.status,
      ...(row.callID ? { callID: row.callID } : {}),
      ...(row.parentSessionID ? { parentSessionID: row.parentSessionID } : {}),
      ...(row.childSessionID ? { childSessionID: row.childSessionID } : {}),
      ...(row.providerID ? { providerID: row.providerID } : {}),
      ...(row.modelID ? { modelID: row.modelID } : {}),
      ...(row.variant ? { variant: row.variant } : {}),
      ...(safeReason(row.reason) ? { reason: safeReason(row.reason) } : {}),
     }));
}
