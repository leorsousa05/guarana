import fs from 'node:fs';
import path from 'node:path';
import { EVENTS_FILE } from './constants.js';

const snapshots = new Map();
const MAX_SNAPSHOTS = 16;
const MAX_DERIVED_QUERIES = 32;
const TAIL_CHECK_BYTES = 256;

function remember(cache, key, value, max = MAX_DERIVED_QUERIES) {
  cache.delete(key);
  cache.set(key, value);
  if (cache.size > max) cache.delete(cache.keys().next().value);
  return value;
}

function parseLines(text, snapshot) {
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const event = JSON.parse(trimmed);
      const index = snapshot.events.length;
      snapshot.events.push(event);
      if (typeof event.sessionID === 'string') {
        let indexed = snapshot.sessionEvents.get(event.sessionID);
        if (!indexed) snapshot.sessionEvents.set(event.sessionID, indexed = []);
        indexed.push({ event, index });
      }
      addSummaryEvent(snapshot.runBySession, event);
      snapshot.summaryCache = null;
      snapshot.advisorHistoryCache.clear();
      snapshot.eventQueryCache.clear();
    } catch { /* skip malformed line */ }
  }
}

function readAt(file, position, length) {
  if (length === 0) return Buffer.alloc(0);
  const fd = fs.openSync(file, 'r');
  try {
    const bytes = Buffer.alloc(length);
    const read = fs.readSync(fd, bytes, 0, length, position);
    return bytes.subarray(0, read);
  } finally {
    fs.closeSync(fd);
  }
}

function tailMatches(file, snapshot) {
  if (!snapshot.offset || !snapshot.tail.length) return true;
  const existing = readAt(file, snapshot.offset - snapshot.tail.length, snapshot.tail.length);
  return existing.equals(snapshot.tail);
}

function emptySnapshot(stat) {
  return {
    events: [],
    sessionEvents: new Map(),
    runBySession: new Map(),
    summaryCache: null,
    advisorHistoryCache: new Map(),
    eventQueryCache: new Map(),
    offset: 0,
    pending: '',
    tail: Buffer.alloc(0),
    ino: stat.ino,
    dev: stat.dev,
    mtimeNs: stat.mtimeNs,
    ctimeNs: stat.ctimeNs,
  };
}

function snapshotFor(file) {
  const key = path.resolve(file);
  let stat;
  try { stat = fs.statSync(key, { bigint: true }); } catch { snapshots.delete(key); return null; }
  const old = snapshots.get(key);
  const metadataChanged = old && (old.mtimeNs !== stat.mtimeNs || old.ctimeNs !== stat.ctimeNs);
  const reload = !old
    || old.ino !== stat.ino
    || old.dev !== stat.dev
    || stat.size < BigInt(old.offset)
    || (old.offset > 0 && metadataChanged && stat.size === BigInt(old.offset))
    || (stat.size > BigInt(old.offset) && !tailMatches(key, old));
  const snap = reload ? emptySnapshot(stat) : old;
  if (stat.size > BigInt(snap.offset)) {
    const fd = fs.openSync(key, 'r');
    try {
      const length = Number(stat.size - BigInt(snap.offset));
      const bytes = Buffer.alloc(length);
      fs.readSync(fd, bytes, 0, length, snap.offset);
      snap.offset += length;
      const text = snap.pending + bytes.toString('utf8');
      const newline = text.lastIndexOf('\n');
      if (newline < 0) snap.pending = text;
      else { parseLines(text.slice(0, newline), snap); snap.pending = text.slice(newline + 1); }
      snap.tail = Buffer.concat([snap.tail, bytes]).subarray(-TAIL_CHECK_BYTES);
    } finally { fs.closeSync(fd); }
  }
  snap.ino = stat.ino; snap.dev = stat.dev; snap.mtimeNs = stat.mtimeNs; snap.ctimeNs = stat.ctimeNs;
  snapshots.delete(key); snapshots.set(key, snap);
  if (snapshots.size > MAX_SNAPSHOTS) snapshots.delete(snapshots.keys().next().value);
  return snap;
}

/**
 * Read a newline-delimited JSON file into an array of objects.
 * Malformed lines are skipped; missing files return an empty array.
 */
export function readJsonl(file) {
  try {
    const snapshot = snapshotFor(file);
    if (!snapshot) return [];
    if (snapshot.pending.trim()) {
      try { return [...snapshot.events, JSON.parse(snapshot.pending.trim())]; } catch { /* incomplete or malformed trailing line */ }
    }
    return snapshot.events;
  } catch {
    return [];
  }
}

function parsePending(snapshot) {
  if (!snapshot.pending.trim()) return null;
  try { return JSON.parse(snapshot.pending.trim()); } catch { return null; }
}

function summaryFromSnapshot(snapshot) {
  const pending = parsePending(snapshot);
  if (snapshot.summaryCache?.pending === snapshot.pending) return snapshot.summaryCache.runs;
  const sessions = pending ? new Map([...snapshot.runBySession].map(([id, run]) => [id, { ...run }])) : snapshot.runBySession;
  if (pending) addSummaryEvent(sessions, pending);
  const runs = finishSummary(sessions);
  snapshot.summaryCache = { pending: snapshot.pending, runs };
  return runs;
}

export function summaryForFile(file) {
  try {
    const snapshot = snapshotFor(file);
    return snapshot ? summaryFromSnapshot(snapshot) : [];
  } catch {
    return [];
  }
}

export function eventsForFile(file, sessions = [], limit = null) {
  try {
    const snapshot = snapshotFor(file);
    if (!snapshot) return [];
    const selected = [...new Set(sessions.filter((session) => typeof session === 'string'))].sort();
    const pending = parsePending(snapshot);
    const cacheKey = JSON.stringify([selected, limit, snapshot.pending]);
    const cached = snapshot.eventQueryCache.get(cacheKey);
    if (cached) {
      snapshot.eventQueryCache.delete(cacheKey);
      snapshot.eventQueryCache.set(cacheKey, cached);
      return cached;
    }

    let events;
    if (!selected.length) {
      events = pending ? [...snapshot.events, pending] : snapshot.events;
    } else {
      const indexed = selected.flatMap((session) => snapshot.sessionEvents.get(session) || []);
      if (pending && selected.includes(pending.sessionID)) indexed.push({ event: pending, index: snapshot.events.length });
      indexed.sort((a, b) => a.index - b.index);
      events = indexed.map(({ event }) => event);
    }
    if (limit) events = events.slice(-limit);
    return remember(snapshot.eventQueryCache, cacheKey, events);
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
  for (const ev of events) addSummaryEvent(sessions, ev);
  return finishSummary(sessions);
}

function addSummaryEvent(sessions, ev) {
  const sid = ev.sessionID;
  if (!sid) return;
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

function finishSummary(sessions) {
  const runs = [...sessions.values()].map((run) => ({
    ...run,
    durationMs: run.start !== null && run.end !== null ? run.end - run.start : null,
  }));
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

export function advisorHistoryForFile(file, limit = 25) {
  try {
    const snapshot = snapshotFor(file);
    if (!snapshot) return [];
    const key = JSON.stringify([limit, snapshot.pending]);
    const cached = snapshot.advisorHistoryCache.get(key);
    if (cached) {
      snapshot.advisorHistoryCache.delete(key);
      snapshot.advisorHistoryCache.set(key, cached);
      return cached;
    }
    const pending = parsePending(snapshot);
    const events = pending ? [...snapshot.events, pending] : snapshot.events;
    return remember(snapshot.advisorHistoryCache, key, advisorHistory(events, limit), 8);
  } catch {
    return [];
  }
}
