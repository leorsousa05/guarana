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

  const recordTool = (input, output) => {
    try {
      const error = resultError(output);
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
      if (error) ev.error = error;
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
      } else if (type === "message.updated" || type === "message.part.updated") {
        recordTokens(event);
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
