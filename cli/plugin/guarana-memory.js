// guarana memory plugin (Component B)
// Captures tool calls / file edits as draft atoms in the project vault
// (.guarana/memory/nodes.jsonl), delegating to the memory/ engine.
// Constraints: no external deps, never throws, lazy (never auto-creates a vault).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const MAX_TEXT = 2000;
const TRUNC = "\n…[truncated]";
const pluginDir = path.dirname(fileURLToPath(import.meta.url));

function cap(text, max = MAX_TEXT) {
  if (typeof text !== "string") return text;
  return text.length > max ? text.slice(0, max) + TRUNC : text;
}

function stringify(value, max = MAX_TEXT) {
  if (value == null) return "";
  if (typeof value === "string") return cap(value, max);
  try {
    return cap(JSON.stringify(value), max);
  } catch {
    return cap(String(value), max);
  }
}

// Engine lives at repo-root memory/ (repo layout: plugin/ -> ../memory/)
// or at cli/memory/ in the bundle (cli/plugin/ -> ../memory/). Same relative
// path covers both; ../../memory/ is a fallback for running the bundle in-repo.
async function loadEngine() {
  const candidates = [
    path.join(pluginDir, "..", "memory"),
    path.join(pluginDir, "..", "..", "memory"),
  ];
  for (const dir of candidates) {
    if (
      fs.existsSync(path.join(dir, "capture.js")) &&
      fs.existsSync(path.join(dir, "vault.js"))
    ) {
      const [capture, vault, tools, compact] = await Promise.all([
        import(pathToFileURL(path.join(dir, "capture.js")).href),
        import(pathToFileURL(path.join(dir, "vault.js")).href),
        fs.existsSync(path.join(dir, "tools.js"))
          ? import(pathToFileURL(path.join(dir, "tools.js")).href)
          : Promise.resolve(null),
        fs.existsSync(path.join(dir, "compact.js"))
          ? import(pathToFileURL(path.join(dir, "compact.js")).href)
          : Promise.resolve(null),
      ]);
      return { capture, vault, tools, compact };
    }
  }
  return null;
}

export const GuaranaMemory = async ({ directory }) => {
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
    } catch (_) {
      /* swallow: telemetry must never throw */
    }
  };

  const recordError = (err, sessionID) => {
    append({
      ts: Date.now(),
      type: "memory-error",
      sessionID: sessionID || "unknown",
      error: String(err && err.message ? err.message : err),
    });
  };

  let enginePromise = null;
  let engineFailed = false;
  const engine = async () => {
    if (engineFailed) return null;
    if (!enginePromise) {
      enginePromise = loadEngine().catch((err) => {
        engineFailed = true;
        recordError(err);
        return null;
      });
    }
    const e = await enginePromise;
    if (!e && !engineFailed) {
      engineFailed = true;
      recordError(new Error("memory engine not found"));
    }
    return e;
  };

  let skippedLogged = false;
  const skip = (reason, sessionID) => {
    if (skippedLogged) return; // at most once per session
    skippedLogged = true;
    append({
      ts: Date.now(),
      type: "memory-skipped",
      reason,
      sessionID: sessionID || "unknown",
    });
  };

  // Core capture path. Never throws.
  const tryCapture = async (eventData, meta = {}) => {
    try {
      const e = await engine();
      if (!e) return;
      const vaultDir = e.vault.projectVaultDir(directory);
      // Lazy: vault must exist (guarana memory init is the explicit opt-in).
      if (!fs.existsSync(e.vault.paths(vaultDir).nodes))
        return skip("vault-not-initialized", meta.sessionID);
      let cfg = null;
      try {
        cfg = e.vault.loadConfig(vaultDir); // malformed config -> defaults
      } catch (err) {
        recordError(err, meta.sessionID);
      }
      if (cfg && cfg.capture && cfg.capture.enabled === false)
        return skip("capture-disabled", meta.sessionID);
      const res = e.capture.captureAtom(vaultDir, eventData);
      if (res.captured) {
        append({
          ts: Date.now(),
          type: "memory-captured",
          sessionID: meta.sessionID || "unknown",
          tool: meta.tool || "unknown",
          id: res.node.id,
        });
        // Automatic compaction trigger: collapse oldest atoms when over
        // threshold. Errors -> memory-error telemetry; capture already
        // succeeded and is unaffected.
        if (e.compact) {
          try {
            const r = e.compact.compactVault(vaultDir, {
              threshold: cfg ? cfg.compactionThreshold : undefined,
            });
            if (r.compacted > 0) {
              append({
                ts: Date.now(),
                type: "memory-compacted",
                sessionID: meta.sessionID || "unknown",
                compacted: r.compacted,
                supernodeId: r.supernodeId,
                remaining: r.remaining,
              });
            }
          } catch (err) {
            recordError(err, meta.sessionID);
          }
        }
      } else {
        append({
          ts: Date.now(),
          type: "memory-filtered",
          sessionID: meta.sessionID || "unknown",
          tool: meta.tool || "unknown",
          reason: res.reason || "unknown",
        });
      }
    } catch (err) {
      recordError(err, meta.sessionID);
    }
  };

  const recordLifecycle = (status, event) => {
    try {
      const props = (event && event.properties) || event || {};
      const info = props.info || props.session || props;
      append({
        ts: Date.now(),
        type: "memory-session",
        status,
        sessionID:
          (info && info.id) || props.sessionID || (event && event.sessionID) || "unknown",
      });
    } catch (err) {
      recordError(err);
    }
  };

  // Stashed inputs from tool.execute.before, keyed by callID/sessionID.
  const pending = new Map();

  // ---- Custom memory tools (ADR-008, Slice 3) ----
  // OpenCode custom-tool shape: a `tool` map on the hooks object, each entry
  // { description, args: {json-schema-ish}, async execute(args, ctx) }.
  // execute returns a JSON string (tool results are strings in OpenCode).
  // Boundary rule: NEVER throw — errors become { error: message } results.
  // Isolated in this section so an API-shape fix is a small local change.
  const runTool = (handlerName) => async (args) => {
    try {
      const e = await engine();
      if (!e || !e.tools) return JSON.stringify({ error: "memory engine not available" });
      const vaultDir = e.vault.projectVaultDir(directory);
      if (!fs.existsSync(e.vault.paths(vaultDir).nodes))
        return JSON.stringify({ error: "memory vault not initialized (run: guarana memory init)" });
      const result = await e.tools[handlerName](vaultDir, args || {});
      return JSON.stringify(result);
    } catch (err) {
      try {
        recordError(err);
      } catch (_) {
        /* swallow */
      }
      return JSON.stringify({ error: String(err && err.message ? err.message : err) });
    }
  };

  const memoryTools = {
    memory_search: {
      description:
        "Search the guarana memory vault (confirmed nodes only). Structural filters first, then TF-IDF ranking.",
      args: {
        query: { type: "string", description: "free-text query" },
        type: {
          type: "string",
          description: "node type filter",
          enum: ["decision", "bug", "solution", "refactor", "atom", "supernode"],
        },
        since: { type: "number", description: "minimum ts (epoch ms)" },
        until: { type: "number", description: "maximum ts (epoch ms)" },
        limit: { type: "number", description: "max results" },
      },
      execute: runTool("memorySearch"),
    },
    memory_save_decision: {
      description:
        "Record a decision as a confirmed memory node, with rejected alternatives.",
      args: {
        intent: { type: "string", description: "what was being done" },
        decision: { type: "string", description: "what was decided and why" },
        rejectedAlternatives: {
          type: "array",
          items: { type: "string" },
          description: "alternatives considered and rejected",
        },
        tags: { type: "array", items: { type: "string" } },
        author: { type: "string", description: "defaults to 'agent'" },
      },
      execute: runTool("memorySaveDecision"),
    },
    memory_get_context_for_task: {
      description:
        "Get a bounded subgraph (decisions, rejected alternatives via supersedes, known bugs) relevant to a task.",
      args: {
        task: { type: "string", description: "task description to match" },
        limit: { type: "number", description: "max nodes returned (default 10)" },
      },
      execute: runTool("memoryGetContextForTask"),
    },
    memory_review_draft: {
      description:
        "Review a draft memory node: action 'confirm' flips it to confirmed (optional edits), 'discard' removes it.",
      args: {
        id: { type: "string", description: "draft node id" },
        action: { type: "string", enum: ["confirm", "discard"] },
        edits: { type: "object", description: "optional field edits applied on confirm" },
      },
      execute: runTool("memoryReviewDraft"),
    },
  };
  // ---- End custom memory tools ----

  return {
    tool: memoryTools,
    "tool.execute.before": async (input, output) => {
      try {
        const key = (input && (input.callID || input.sessionID)) || "last";
        pending.set(key, {
          tool: input && input.tool != null ? String(input.tool) : "unknown",
          sessionID: input && input.sessionID ? String(input.sessionID) : "unknown",
          input: stringify(
            output && output.args != null ? output.args : input && input.args,
            1000
          ),
        });
        if (pending.size > 100) pending.clear(); // bound memory
      } catch (_) {
        /* swallow */
      }
    },

    "tool.execute.after": async (input, output) => {
      try {
        const key = (input && (input.callID || input.sessionID)) || "last";
        const st = pending.get(key) || pending.get("last") || {};
        pending.delete(key);
        const tool =
          st.tool || (input && input.tool != null ? String(input.tool) : "unknown");
        const sessionID =
          st.sessionID ||
          (input && input.sessionID) ||
          (output && output.sessionID) ||
          "unknown";
        const inputText =
          st.input || stringify(input && input.args, 1000);
        const outputText = stringify(
          output && output.output != null
            ? output.output
            : output && output.result != null
              ? output.result
              : output
        );
        const intent = inputText
          ? `${tool}: ${inputText.slice(0, 120)}`
          : String(tool);
        await tryCapture(
          {
            intent,
            input: inputText,
            output: outputText,
            tags: [String(tool)],
          },
          { sessionID, tool }
        );
      } catch (err) {
        recordError(err, input && input.sessionID);
      }
    },

    "file.edited": async (event) => {
      try {
        const e = (event && event.event) || event || {};
        const props = e.properties || e;
        const info = props.info || props;
        const file =
          props.file ||
          props.path ||
          props.filePath ||
          info.path ||
          info.file ||
          "unknown";
        const sessionID = props.sessionID || e.sessionID || "unknown";
        await tryCapture(
          {
            intent: `file edited: ${file}`,
            input: String(file),
            output: "",
            tags: ["file.edited"],
          },
          { sessionID, tool: "file.edited" }
        );
      } catch (err) {
        recordError(err);
      }
    },

    "session.created": async (event) => recordLifecycle("created", event),
    "session.idle": async (event) => recordLifecycle("idle", event),
  };
};

export default GuaranaMemory;
