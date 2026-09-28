// guarana memory plugin (Component B)
// Stores explicit memory decisions in the project vault
// (.guarana/memory/nodes.jsonl), delegating to the memory/ engine.
// Constraints: no external deps, never throws, and initializes the project
// vault automatically so memory works without a separate setup command.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const pluginDir = path.dirname(fileURLToPath(import.meta.url));

const MEMORY_POLICY = [
  '## Guarana automatic memory',
  'Before answering each human message, notice whether it establishes a durable preference or project decision.',
  '- Standing instructions about how the user wants the assistant to behave ("always", "never", response style) are global `preference` memories; save with `memory_save_node` and `scope: "global"`.',
  '- Decisions, requirements, bugs, solutions, and refactors for the current codebase are project memories; save with the correct type and `scope: "project"`.',
  '- Do this automatically when the intent is clear; do not wait for a memory command. Check for duplicates first and use `supersedes` when updating an existing preference.',
  '- Save a concise, reusable statement, link only real relationships, and do not save ordinary task requests, temporary instructions, inferred personal facts, or sensitive data.',
  '- Global preferences are injected at session start and after context compaction; project memories are task-relevant. Do not claim a save succeeded unless the memory tool succeeds.',
].join('\n');

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
      fs.existsSync(path.join(dir, "vault.js")) &&
      fs.existsSync(path.join(dir, "tools.js"))
    ) {
      const [vault, tools] = await Promise.all([
        import(pathToFileURL(path.join(dir, "vault.js")).href),
        fs.existsSync(path.join(dir, "tools.js"))
          ? import(pathToFileURL(path.join(dir, "tools.js")).href)
          : Promise.resolve(null),
      ]);
      return { vault, tools };
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

  // ---- Custom memory tools (ADR-008, Slice 3) ----
  // OpenCode custom-tool shape: a `tool` map on the hooks object, each entry
  // { description, args: {json-schema-ish}, async execute(args, ctx) }.
  // execute returns a JSON string (tool results are strings in OpenCode).
  // Boundary rule: NEVER throw — errors become { error: message } results.
  // Isolated in this section so an API-shape fix is a small local change.
  const vaultFor = (e, scope) =>
    scope === 'global' ? e.vault.initUserVault() : e.vault.initVault(directory);

  const mergeContexts = (projectContext, globalContext, globalPreferences, limit) => {
    const out = { decisions: [], bugs: [], solutions: [], refactors: [], preferences: [], superseded: [], atoms: [] };
    const keys = Object.keys(out);
    const candidates = [
      ...(globalPreferences.preferences || []).map((node) => ({ node, group: 'preferences' })),
      ...keys.flatMap((group) => (projectContext[group] || []).map((node) => ({ node, group }))),
      ...keys.flatMap((group) => (globalContext[group] || []).map((node) => ({ node, group }))),
    ];
    const seen = new Set();
    for (const { node, group } of candidates) {
      const key = `${node.scope || 'project'}:${node.id}`;
      if (seen.has(key) || out.count >= limit) continue;
      seen.add(key);
      out[group].push(node);
      out.count = (out.count || 0) + 1;
    }
    out.count ||= 0;
    return out;
  };

  const runTool = (handlerName) => async (args) => {
    try {
      const e = await engine();
      if (!e || !e.tools) return JSON.stringify({ error: "memory engine not available" });
      const options = args || {};
      const scopedRead = handlerName === 'memorySearch' || handlerName === 'memoryGetContextForTask';
      const scope = options.scope || (scopedRead ? 'both' : 'project');
      if (!['project', 'global', 'both'].includes(scope))
        return JSON.stringify({ error: 'scope must be project, global, or both' });

      if (scopedRead && scope === 'both') {
        const projectVault = e.vault.initVault(directory);
        const globalVault = e.vault.initUserVault();
        if (handlerName === 'memorySearch') {
          const limit = Number.isInteger(options.limit) && options.limit > 0 ? options.limit : 20;
          const [project, global] = await Promise.all([
            e.tools.memorySearch(projectVault, options),
            e.tools.memorySearch(globalVault, options),
          ]);
          const results = [
            ...(project.results || []).map((node) => ({ ...node, scope: 'project' })),
            ...(global.results || []).map((node) => ({ ...node, scope: 'global' })),
          ].sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, limit);
          return JSON.stringify({ results, count: results.length });
        }
        const limit = Number.isInteger(options.limit) && options.limit > 0 ? options.limit : 10;
        const [projectContext, globalContext, preferences] = await Promise.all([
          e.tools.memoryGetContextForTask(projectVault, { ...options, limit }),
          e.tools.memoryGetContextForTask(globalVault, { ...options, limit }),
          e.tools.memoryGetGlobalPreferences(globalVault, { limit: Math.min(5, limit) }),
        ]);
        for (const group of Object.keys(projectContext)) {
          if (Array.isArray(projectContext[group]))
            projectContext[group] = projectContext[group].map((node) => ({ ...node, scope: 'project' }));
        }
        for (const group of Object.keys(globalContext)) {
          if (Array.isArray(globalContext[group]))
            globalContext[group] = globalContext[group].map((node) => ({ ...node, scope: 'global' }));
        }
        return JSON.stringify(mergeContexts(projectContext, globalContext, preferences, limit));
      }

      const vaultDir = vaultFor(e, scope);
      const result = handlerName === 'memoryGetContextForTask'
        ? await e.tools[handlerName](vaultDir, options)
        : await e.tools[handlerName](vaultDir, options);
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
          enum: ["decision", "bug", "solution", "refactor", "preference", "atom", "supernode"],
        },
        scope: { type: "string", enum: ["project", "global", "both"], description: "search scope (default both)" },
        since: { type: "number", description: "minimum ts (epoch ms)" },
        until: { type: "number", description: "maximum ts (epoch ms)" },
        limit: { type: "number", description: "max results" },
      },
      execute: runTool("memorySearch"),
    },
    memory_save_decision: {
      description:
        "Record a decision as a confirmed memory node. Add relatedTo links when a real relationship exists.",
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
        scope: { type: "string", enum: ["project", "global"], description: "memory scope (default project)" },
        relatedTo: {
          type: "array",
          description: "optional explicit links to existing confirmed nodes",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              rel: { type: "string", enum: ["caused-by", "depends-on", "supersedes", "summarizes", "fixes", "relates-to"] },
            },
            required: ["id", "rel"],
          },
        },
      },
      execute: runTool("memorySaveDecision"),
    },
    memory_save_node: {
      description:
        "Save a confirmed decision, bug, solution, refactor, or standing user preference with its correct type and scope; include explicit relatedTo links when semantically connected.",
      args: {
        type: { type: "string", enum: ["decision", "bug", "solution", "refactor", "preference"] },
        scope: { type: "string", enum: ["project", "global"], description: "global for standing user preferences; project for current-project knowledge" },
        intent: { type: "string", description: "what was happening" },
        summary: { type: "string", description: "the bug, solution, refactor, or decision and why it matters" },
        rejectedAlternatives: { type: "array", items: { type: "string" } },
        tags: { type: "array", items: { type: "string" } },
        author: { type: "string", description: "defaults to 'agent'" },
        relatedTo: {
          type: "array",
          description: "links to existing confirmed nodes; do not invent relationships",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              rel: { type: "string", enum: ["caused-by", "depends-on", "supersedes", "summarizes", "fixes", "relates-to"] },
            },
            required: ["id", "rel"],
          },
        },
      },
      execute: runTool("memorySaveNode"),
    },
    memory_get_context_for_task: {
      description:
        "Get a bounded subgraph (decisions, rejected alternatives via supersedes, known bugs) relevant to a task.",
      args: {
        task: { type: "string", description: "task description to match" },
        limit: { type: "number", description: "max nodes returned (default 10)" },
        scope: { type: "string", enum: ["project", "global", "both"], description: "memory scope (default both)" },
      },
      execute: runTool("memoryGetContextForTask"),
    },
    memory_review_draft: {
      description:
        "Migrate or discard a legacy draft node: action 'confirm' flips it to confirmed (optional edits), 'discard' removes it.",
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
    'experimental.chat.system.transform': async (input, output) => {
      if (!Array.isArray(output.system)) output.system = [];
      if (!output.system.some((text) => String(text).includes('## Guarana automatic memory')))
        output.system.push(MEMORY_POLICY);
    },
    "session.created": async (event) => {
      recordLifecycle("created", event);
      try {
        const e = await engine();
        if (e) e.vault.initVault(directory);
      } catch (err) {
        recordError(err);
      }
    },
    "session.idle": async (event) => recordLifecycle("idle", event),
  };
};

export default GuaranaMemory;
