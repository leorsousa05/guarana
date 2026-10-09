// guarana telemetry plugin (Component A)
// Appends JSONL events to <project>/.specs/state/telemetry/events.jsonl.
// Constraints: no external deps, never throws.

import fs from "node:fs";
import path from "node:path";

const SESSION_STATUSES = {
  "session.created": "created",
  "session.idle": "idle",
  "session.error": "error",
  "session.compacted": "compacted",
};
const OBSERVED_SESSION_STATUSES = new Set(['busy', 'running', 'retry', 'idle', 'error', 'compacted', 'created']);

const advisorState = globalThis[Symbol.for('guarana.telemetry.advisor-executions')] ||
  (globalThis[Symbol.for('guarana.telemetry.advisor-executions')] = { parents: new Map(), seen: new Set(), dispatches: new Map() });
advisorState.dispatches ||= new Map();
function boundedSetAdd(set, value, limit = 500) {
  set.add(value);
  if (set.size > limit) set.delete(set.values().next().value);
}
function safeID(value) {
  return typeof value === 'string' && value.length <= 200 && !/[\u0000-\u001f]/.test(value) ? value : null;
}
function safeReason(value) {
  const reason = safeID(value);
  if (!reason || /\bsk-\S+|\bgh[pousr]_[A-Za-z0-9_]+\b|\b(?:api[_-]?key|token|password|secret)\s*[:=]\s*\S+|\bbearer\s+\S+/i.test(reason)) return null;
  return reason;
}

// Normalize a token payload (number, {total}, or {input,output,reasoning,cache})
// into a single numeric total. Returns null when nothing usable is present.
function tokenTotal(tokens) {
  if (typeof tokens === "number") return tokens;
  if (tokens && typeof tokens === "object") {
    if (typeof tokens.total === "number") return tokens.total;
    let total = 0;
    for (const k of ["input", "output", "reasoning", "cache"]) {
      if (typeof tokens[k] === "number") total += tokens[k];
    }
    if (total > 0) return total;
  }
  return null;
}

export const GuaranaTelemetry = async ({ directory }) => {
  const telemetryDir = path.join(directory, ".specs", "state", "telemetry");
  const eventsFile = path.join(telemetryDir, "events.jsonl");
  const project = path.basename(directory);

  const append = (obj) => {
    try {
      fs.mkdirSync(telemetryDir, { recursive: true });
      fs.appendFileSync(
        eventsFile,
        JSON.stringify({ project, ...obj }) + "\n",
        "utf8"
      );
    } catch (err) {
      // best-effort error record; never rethrow
      try {
        fs.mkdirSync(telemetryDir, { recursive: true });
        fs.appendFileSync(
          eventsFile,
          JSON.stringify({
            ts: Date.now(),
            type: "telemetry-error",
            error: String(err && err.message ? err.message : err),
          }) + "\n",
          "utf8"
        );
      } catch (_) {
        /* swallow */
      }
    }
  };

  // Extract an error message from a tool result, whether the result is a plain
  // object {error} or a JSON-string result (custom tools return strings).
  // Returns null when the tool succeeded. Never throws.
  function resultError(output) {
    if (output == null) return null;
    if (typeof output === "object") {
      if (output.error != null) return String(output.error);
      // Custom tool results may nest the value under .output / .result.
      if (output.output != null) return resultError(output.output);
      if (output.result != null) return resultError(output.result);
      return null;
    }
    if (typeof output === "string") {
      const s = output.trim();
      if (s.startsWith("{")) {
        try {
          const o = JSON.parse(s);
          if (o && o.error != null) return String(o.error);
        } catch {
          /* not JSON — treat as success */
        }
      }
    }
    return null;
  }

  const recordTool = (input, output, safeAdvisorTask = false) => {
    try {
      const error = resultError(output);
      const advisorTask = safeAdvisorTask || (String(input?.tool || '').toLowerCase() === 'task' && input?.args?.subagent_type === 'guarana-advisor');
      const ev = {
        ts: Date.now(),
        type: "tool",
        tool: input && input.tool != null ? String(input.tool) : "unknown",
        sessionID:
          (input && input.sessionID) ||
          (output && output.sessionID) ||
          "unknown",
        ok: !error,
      };
      if (error && !advisorTask) ev.error = error;
      append(ev);
    } catch (err) {
      append({ ts: Date.now(), type: "telemetry-error", error: String(err) });
    }
  };

  // Tokens arrive on assistant messages (message.updated -> properties.info)
  // and on parts (message.part.updated -> properties.part). Normalize both.
  const recordTokens = (event) => {
    try {
      const props = (event && event.properties) || event || {};
      const source = props.info || props.part || props;
      const total = tokenTotal(source.tokens);
      if (total == null) return; // nothing worth recording
      const ev = { ts: Date.now(), type: "tokens", sessionID: "unknown" };
      const sid =
        source.sessionID || props.sessionID || (event && event.sessionID);
      if (sid) ev.sessionID = String(sid);
      ev.tokens = total;
      if (source.cost != null) ev.cost = source.cost;
      if (source.providerID != null) ev.providerID = source.providerID;
      if (source.modelID != null) ev.modelID = source.modelID;
      append(ev);
    } catch (err) {
      append({ ts: Date.now(), type: "telemetry-error", error: String(err) });
    }
  };

  const recordEvent = (event) => {
    try {
      const type = event && event.type;
      if (type === 'session.created') {
        const props = event.properties || {};
        const info = props.info || props.session || props;
        const childID = safeID(info.id || props.sessionID || event.sessionID);
        const parentID = safeID(info.parentID || props.parentID);
        if (childID && parentID) {
          advisorState.parents.set(childID, parentID);
          if (advisorState.parents.size > 500) advisorState.parents.delete(advisorState.parents.keys().next().value);
        }
      }
      if (type === 'message.updated') {
        const info = event.properties?.info;
        const sessionID = safeID(info?.sessionID || event.properties?.sessionID || event.sessionID);
        const completed = info?.time?.completed;
        if (info?.role === 'assistant' && (info?.agent || info?.mode) === 'guarana-advisor' && completed && sessionID) {
          const key = `${sessionID}:${completed}`;
          if (!advisorState.seen.has(key)) {
            boundedSetAdd(advisorState.seen, key);
            const ev = { ts: Date.now(), type: 'advisor-execution', childSessionID: sessionID, status: info.error ? 'error' : 'completed' };
            const parentID = safeID(advisorState.parents.get(sessionID));
            if (parentID) ev.parentSessionID = parentID;
            for (const field of ['providerID', 'modelID', 'variant']) {
              const value = safeID(info[field]);
              if (value) ev[field] = value;
            }
            append(ev);
          }
        }
      }
      if ((type && SESSION_STATUSES[type]) || type === 'session.status') {
        const props = event.properties || {};
        const info = props.info || props.session || props;
        const reportedStatus = type === 'session.status'
          ? (info.status?.type || info.status || props.status?.type || props.status)
          : SESSION_STATUSES[type];
        const status = typeof reportedStatus === 'string' && OBSERVED_SESSION_STATUSES.has(reportedStatus)
          ? reportedStatus
          : null;
        if (!status) return;
        const session = {
          ts: Date.now(),
          type: "session",
          status,
          sessionID:
            (info && info.id) || props.sessionID || event.sessionID || "unknown",
        };
        const parentID = safeID(info.parentID || props.parentID);
        if (parentID) session.parentSessionID = parentID;
        const agent = safeID(info.agent || props.agent);
        if (agent) session.agent = agent;
        append(session);
      } else if (type === "todo.updated") {
        const props = event.properties || {};
        const todos = Array.isArray(props.todos) ? props.todos : [];
        append({
          ts: Date.now(),
          type: "todo",
          sessionID: props.sessionID || event.sessionID || "unknown",
          count: todos.length,
        });
      } else if (type === "message.updated" || type === "message.part.updated") {
        recordTokens(event);
      }
    } catch (err) {
      append({ ts: Date.now(), type: "telemetry-error", error: String(err) });
    }
  };

  return {
    'tool.execute.before': async (input, output) => {
      try {
        if (String(input?.tool || '').toLowerCase() !== 'task') return;
        const args = output?.args || input?.args || {};
        if (args.subagent_type !== 'guarana-advisor') return;
        const parentSessionID = safeID(input?.sessionID);
        const callID = safeID(input?.callID);
        const reason = safeReason(output?.args?.description ?? input?.args?.description);
        const event = { ts: Date.now(), type: 'advisor-dispatch', status: 'dispatched' };
        if (parentSessionID) event.parentSessionID = parentSessionID;
        if (reason) event.reason = reason;
        if (callID) {
          event.callID = callID;
          advisorState.dispatches.set(callID, { parentSessionID, advisor: true, reason });
          if (advisorState.dispatches.size > 500) advisorState.dispatches.delete(advisorState.dispatches.keys().next().value);
        }
        append(event);
      } catch {
        /* telemetry must not affect Task dispatch */
      }
    },
    "tool.execute.after": async (input, output) => {
      try {
        const callID = safeID(input?.callID);
        const dispatch = callID && advisorState.dispatches.get(callID);
        const advisorTask = String(input?.tool || '').toLowerCase() === 'task' && (input?.args?.subagent_type === 'guarana-advisor' || dispatch?.advisor);
        if (advisorTask) {
          const parentSessionID = safeID(input?.sessionID) || dispatch?.parentSessionID;
          const reason = safeReason(dispatch?.reason) || safeReason(input?.args?.description);
          const metadata = output?.metadata || {};
          const childSessionID = safeID(metadata.sessionID || metadata.sessionId || metadata.childSessionID || output?.sessionID);
          const event = {
            ts: Date.now(),
            type: 'advisor-dispatch',
            status: output?.error != null || output?.isError === true ? 'error' : 'completed',
          };
          if (parentSessionID) event.parentSessionID = parentSessionID;
          if (reason) event.reason = reason;
          if (callID) event.callID = callID;
          if (childSessionID) event.childSessionID = childSessionID;
          append(event);
        }
        recordTool(input, output, advisorTask);
        if (advisorTask && callID) advisorState.dispatches.delete(callID);
      } catch (err) {
        append({ ts: Date.now(), type: "telemetry-error", error: String(err) });
      }
    },
    "message.part.updated": async (event) => {
      try {
        recordTokens(event);
      } catch (err) {
        append({ ts: Date.now(), type: "telemetry-error", error: String(err) });
      }
    },
    event: async (payload) => {
      const event = payload && payload.event;
      try {
        recordEvent(event);
      } catch (err) {
        append({ ts: Date.now(), type: "telemetry-error", error: String(err) });
      }
    },
  };
};

export default GuaranaTelemetry;
