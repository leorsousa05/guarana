import { execFile as nodeExecFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import express from 'express';
import path from 'node:path';
import { readJsonl } from '../lib/telemetry.js';
import { EVENTS_FILE, SPECS_DIR, TELEMETRY_DIR_SEGMENTS } from '../lib/constants.js';

const COMMAND_TIMEOUT_MS = 2500;
const COMMAND_MAX_BUFFER = 4 * 1024 * 1024;
const MAX_PUBLIC_SESSIONS = 100;
const MAX_WORKER_ACTIVITY = 20;
const SAFE_AGENT = /^[A-Za-z0-9_-]{1,48}$/;
const SECRET_LIKE = /sk-[A-Za-z0-9]|gh[pousr]_[A-Za-z0-9]+|api[_-]?key|token|password|secret|bearer/i;
const SAFE_TOOL = /^[A-Za-z0-9_][A-Za-z0-9_.:-]*$/;
const SAFE_EVENT_TYPES = new Set([
  'tool', 'session', 'workflow', 'todo', 'advisor-dispatch', 'advisor-execution',
  'memory-injected', 'memory-session', 'tokens', 'telemetry-error', 'memory-error',
  'orchestrator-error', 'error',
]);
const SAFE_EVENT_STATUSES = new Set(['busy', 'running', 'idle', 'retry', 'error', 'completed', 'dispatched', 'ok', 'observed']);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function unwrapData(value) {
  return isRecord(value) && Object.hasOwn(value, 'data') ? value.data : value;
}

function parseOutput(output) {
  if (typeof output !== 'string') return null;
  try {
    return JSON.parse(output);
  } catch {
    return null;
  }
}

export function projectActiveSubagentCount(activePayload, sessionsPayload) {
  const active = unwrapData(activePayload);
  const sessions = unwrapData(sessionsPayload);
  if (!isRecord(active) || !Array.isArray(sessions)) return null;

  const activeIDs = new Set();
  for (const session of sessions) {
    if (!isRecord(session)) continue;
    const { id, parentID, agent } = session;
    if (typeof id !== 'string' || id.trim().length === 0
      || typeof parentID !== 'string' || parentID.trim().length === 0
      || typeof agent !== 'string' || agent.trim().length === 0) continue;

    const status = active[id];
    if (isRecord(status) && (status.type === 'busy' || status.type === 'running')) {
      activeIDs.add(id);
    }
  }
  return activeIDs.size;
}

function safeTimestamp(value) {
  return Number.isFinite(value) && Number.isFinite(new Date(value).getTime()) ? value : null;
}

function safeToolName(value) {
  return typeof value === 'string' && value.length <= 40 && SAFE_TOOL.test(value) && !SECRET_LIKE.test(value)
    ? value
    : null;
}

function projectWorkerActivity(events, sessionID) {
  return (Array.isArray(events) ? events : [])
    .filter((event) => isRecord(event)
      && event.sessionID === sessionID
      && SAFE_EVENT_TYPES.has(event.type)
      && safeTimestamp(event.ts) !== null)
    .map((event) => {
      const observedStatus = typeof event.status === 'string' && SAFE_EVENT_STATUSES.has(event.status)
        ? event.status
        : null;
      const row = {
        ts: event.ts,
        type: event.type,
        status: observedStatus || (event.type === 'tool' && typeof event.ok === 'boolean'
          ? (event.ok ? 'ok' : 'error')
          : 'observed'),
      };
      if (event.type === 'tool') {
        const tool = safeToolName(event.tool);
        if (tool) row.tool = tool;
      }
      if (typeof event.ok === 'boolean') row.ok = event.ok;
      return row;
    })
    .sort((a, b) => b.ts - a.ts)
    .slice(0, MAX_WORKER_ACTIVITY);
}

function projectActiveSubagentWorkers(activePayload, sessionsPayload, events, selectionKeys, keyFactory = randomUUID) {
  const active = unwrapData(activePayload);
  const sessions = unwrapData(sessionsPayload);
  if (!isRecord(active) || !Array.isArray(sessions)) return null;

  const workers = [];
  const projectedIDs = new Set();
  for (const session of sessions.slice(0, MAX_PUBLIC_SESSIONS)) {
    if (!isRecord(session)) continue;
    const { id, parentID, agent } = session;
    if (typeof id !== 'string' || id.trim().length === 0
      || typeof parentID !== 'string' || parentID.trim().length === 0
      || typeof agent !== 'string' || !SAFE_AGENT.test(agent) || SECRET_LIKE.test(agent)) continue;
    const activeEntry = active[id];
    if (!isRecord(activeEntry) || (activeEntry.type !== 'busy' && activeEntry.type !== 'running') || projectedIDs.has(id)) continue;

    projectedIDs.add(id);
    let key = selectionKeys.get(id);
    if (!key) {
      key = keyFactory();
      selectionKeys.set(id, key);
    }
    const time = isRecord(session.time) ? session.time : {};
    workers.push({
      key,
      agent,
      status: activeEntry.type,
      createdAt: safeTimestamp(time.created),
      updatedAt: safeTimestamp(time.updated),
      activity: projectWorkerActivity(events, id),
    });
  }

  for (const sessionID of selectionKeys.keys()) {
    if (!projectedIDs.has(sessionID)) selectionKeys.delete(sessionID);
  }
  return workers;
}

export function createOpenCodeRouter({ root, execFileImpl = nodeExecFile }) {
  const router = express.Router();
  const selectionKeys = new Map();
  const telemetryFile = path.join(root, SPECS_DIR, ...TELEMETRY_DIR_SEGMENTS, EVENTS_FILE);

  router.get('/active-subagents', async (_req, res) => {
    const executable = process.env.OPENCODE_BIN || 'opencode';
    const run = (args) => new Promise((resolve, reject) => {
      execFileImpl(executable, args, {
        cwd: root,
        shell: false,
        timeout: COMMAND_TIMEOUT_MS,
        maxBuffer: COMMAND_MAX_BUFFER,
        encoding: 'utf8',
      }, (error, stdout) => {
        if (error) reject(error);
        else resolve(stdout);
      });
    });

    try {
      const [activeOutput, sessionsOutput] = await Promise.all([
        run(['api', 'get', '/api/session/active']),
        run(['api', 'get', '/api/session?limit=100&order=desc']),
      ]);
      const active = parseOutput(activeOutput);
      const sessions = parseOutput(sessionsOutput);
      if (active === null || sessions === null) return res.json({ available: false, runningCount: 0 });

      const runningCount = projectActiveSubagentCount(active, sessions);
      if (runningCount === null) return res.json({ available: false, runningCount: 0 });
      const workers = projectActiveSubagentWorkers(active, sessions, readJsonl(telemetryFile), selectionKeys);
      if (workers === null) return res.json({ available: false, runningCount: 0 });
      return res.json({ available: true, runningCount, workers });
    } catch {
      return res.json({ available: false, runningCount: 0 });
    }
  });

  return router;
}
