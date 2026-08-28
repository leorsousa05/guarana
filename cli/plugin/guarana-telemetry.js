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

export const GuaranaTelemetry = async ({ directory }) => {
  const telemetryDir = path.join(directory, ".specs", "state", "telemetry");
  const eventsFile = path.join(telemetryDir, "events.jsonl");

  const append = (obj) => {
    try {
      fs.mkdirSync(telemetryDir, { recursive: true });
      fs.appendFileSync(eventsFile, JSON.stringify(obj) + "\n", "utf8");
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

  const recordTool = (input, output) => {
    try {
      const ev = {
        ts: Date.now(),
        type: "tool",
        tool: input && input.tool != null ? String(input.tool) : "unknown",
        sessionID:
          (input && input.sessionID) ||
          (output && output.sessionID) ||
          "unknown",
        ok: !(output && output.error),
      };
      if (output && output.error != null) ev.error = String(output.error);
      append(ev);
    } catch (err) {
      append({ ts: Date.now(), type: "telemetry-error", error: String(err) });
    }
  };

  const recordTokens = (event) => {
    try {
      const props = (event && event.properties) || event || {};
      const part = props.part || props;
      const ev = { ts: Date.now(), type: "tokens", sessionID: "unknown" };
      const sid =
        part.sessionID || props.sessionID || (event && event.sessionID);
      if (sid) ev.sessionID = String(sid);
      // record only fields that actually exist; dashboard aggregates a numeric total
      if (part.tokens != null) {
        if (typeof part.tokens === "number") {
          ev.tokens = part.tokens;
        } else if (typeof part.tokens === "object") {
          if (typeof part.tokens.total === "number") {
            ev.tokens = part.tokens.total;
          } else {
            let total = 0;
            for (const k of ["input", "output", "reasoning", "cache"]) {
              if (typeof part.tokens[k] === "number") total += part.tokens[k];
            }
            if (total > 0) ev.tokens = total;
          }
        }
      }
      if (part.cost != null) ev.cost = part.cost;
      if (part.providerID != null) ev.providerID = part.providerID;
      if (part.modelID != null) ev.modelID = part.modelID;
      append(ev);
    } catch (err) {
      append({ ts: Date.now(), type: "telemetry-error", error: String(err) });
    }
  };

  const recordEvent = (event) => {
    try {
      const type = event && event.type;
      if (type && SESSION_STATUSES[type]) {
        const props = event.properties || {};
        const info = props.info || props.session || props;
        append({
          ts: Date.now(),
          type: "session",
          status: SESSION_STATUSES[type],
          sessionID:
            (info && info.id) || props.sessionID || event.sessionID || "unknown",
        });
      } else if (type === "todo.updated") {
        const props = event.properties || {};
        const todos = Array.isArray(props.todos) ? props.todos : [];
        append({
          ts: Date.now(),
          type: "todo",
          sessionID: props.sessionID || event.sessionID || "unknown",
          count: todos.length,
        });
      }
    } catch (err) {
      append({ ts: Date.now(), type: "telemetry-error", error: String(err) });
    }
  };

  return {
    "tool.execute.after": async (input, output) => {
      try {
        recordTool(input, output);
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
