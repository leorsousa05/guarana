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
  '- Automatically save only when user intent is unmistakably durable. If intent or durability is ambiguous, do not save; ask one clarifying question.',
  '- If the user asks to put guidance in a skill or document, honor that destination without also creating a duplicate memory unless they separately ask for memory.',
  '- Before every save, call `memory_search` in the intended scope and avoid duplicating an existing record. When a preference changes, link the new preference to the old one with `relatedTo: [{ id, rel: "supersedes" }]`.',
  '- Save a concise, reusable statement, link only real relationships, and do not save ordinary task requests, temporary instructions, inferred personal facts, or sensitive data.',
  '- Do not capture raw prompts, conversation transcripts, tool inputs, or tool outputs. Global preferences are injected at session start and after context compaction; project memories are task-relevant.',
  '- Report the saved memory type and scope only after the save tool returns success; never claim a failed or unconfirmed save.',
  '',
  '## Guarana automatic skills',
  'After completing task work and before the final response, assess whether what surfaced is likely to help with similar future work.',
  '- A skill is a durable domain or workflow playbook: reusable procedures, conventions, focused checks, or stable project context that helps with future work.',
  '- For every candidate skill, always call `skill_list` across both scopes and compare existing generated skills semantically before choosing an action.',
  '- Prefer enriching a semantically fitting existing macro skill with `skill_update`; use the exact `revision` value from that `skill_list` entry as `expectedRevision` so stale edits are rejected.',
  '- Use `skill_create` only for a genuinely distinct reusable domain or workflow, not merely a screen, route, or task-specific detail. Add narrow guidance to the broader fitting skill instead of creating a micro-skill.',
  '- A single task is sufficient only when it reveals a durable, broad procedure likely to guide similar future work; repeated requests are not required.',
  '- Do not create for one-off deliverables, temporary acceptance criteria, generic best practices, or a simple task. A request being long, technical, or complex is not itself a signal. Example: "Rewrite this paragraph as three bullets" is one-off.',
  '- If future reuse is ambiguous, do not create a skill. Durable preferences and decisions belong in memory; skills capture reusable procedures or project context. Do not duplicate the same content across both.',
  '- When no existing skill fits and the reusable domain or workflow is clear, call `skill_create` with concise, complete OpenCode skill instructions. Never overwrite a manual skill or claim success unless the skill tool succeeds.',
  '- Never update manual skills. `skill_update` only accepts an existing Guarana-generated skill with matching name and scope.',
  '- Never copy secrets, credentials, private data, or raw conversation transcripts into a skill.',
  '- Choose `project` for repository-specific conventions, tools, or architecture. Choose `global` for portable procedures that apply across projects or the user’s general workflow.',
  '- A new skill is saved in an OpenCode-discoverable directory and will be available through normal skill discovery on later turns/sessions.',
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
      const skillEngineDir = path.join(pluginDir, '..', 'skill-engine');
      const skills = fs.existsSync(path.join(skillEngineDir, 'index.js'))
        ? await import(pathToFileURL(path.join(skillEngineDir, 'index.js')).href)
        : null;
      return { vault, tools, skills };
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
      const data = event?.data || {};
      const props = event?.properties || {};
      const info = data.info || data.session || props.info || props.session || props;
      const sessionID = data.sessionID || info.id || props.sessionID || event?.sessionID;
      if (typeof sessionID !== 'string' || !sessionID || sessionID === 'unknown') return;
      append({
        ts: Date.now(),
        type: "memory-session",
        status,
        sessionID,
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
    const out = {
      decisions: [], bugs: [], solutions: [], refactors: [], preferences: [],
      relatedPreferences: [], relatedSuperseded: [], superseded: [], atoms: [],
    };
    const keys = Object.keys(out);
    const candidates = [
      ...(globalPreferences.preferences || []).map((node) => ({ node, group: 'preferences' })),
      ...(globalPreferences.relatedPreferences || []).map((node) => ({ node, group: 'relatedPreferences' })),
      ...(globalPreferences.relatedSuperseded || []).map((node) => ({ node, group: 'relatedSuperseded' })),
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
      const scopedDelete = handlerName === 'memoryDeleteNode';
      if (scopedDelete && options.scope == null)
        return JSON.stringify({ error: 'scope is required and must be project or global' });
      const scope = options.scope || (scopedRead ? 'both' : 'project');
      if (!['project', 'global', 'both'].includes(scope))
        return JSON.stringify({ error: 'scope must be project, global, or both' });
      if (scopedDelete && scope === 'both')
        return JSON.stringify({ error: 'scope must be project or global for deletion' });

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
          e.tools.memoryGetGlobalPreferences(globalVault, { limit }),
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

      if (handlerName === 'memoryGetContextForTask' && scope === 'global') {
        const globalVault = e.vault.initUserVault();
        const limit = Number.isInteger(options.limit) && options.limit > 0 ? options.limit : 10;
        const [globalContext, preferences] = await Promise.all([
          e.tools.memoryGetContextForTask(globalVault, { ...options, limit }),
          e.tools.memoryGetGlobalPreferences(globalVault, { limit }),
        ]);
        for (const group of Object.keys(globalContext)) {
          if (Array.isArray(globalContext[group]))
            globalContext[group] = globalContext[group].map((node) => ({ ...node, scope: 'global' }));
        }
        return JSON.stringify(mergeContexts({}, globalContext, preferences, limit));
      }

      const vaultDir = scopedDelete
        ? (scope === 'global' ? e.vault.userVaultDir() : e.vault.projectVaultDir(directory))
        : vaultFor(e, scope);
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

  const runSkillTool = (handlerName) => async (args) => {
    try {
      const e = await engine();
      if (!e || !e.skills) return JSON.stringify({ error: 'skill engine not available' });
      const options = args || {};
      if (handlerName === 'skillList') {
        const scope = options.scope || 'both';
        if (!['project', 'global', 'both'].includes(scope))
          return JSON.stringify({ error: 'scope must be project, global, or both' });
        const skills = e.skills.listSkills({ projectDir: directory, includeRevision: true });
        return JSON.stringify(scope === 'both' ? skills : { [scope]: skills[scope] });
      }
      if (handlerName === 'skillUpdate')
        return JSON.stringify(e.skills.updateSkill({ ...options, projectDir: directory }));
      return JSON.stringify(e.skills.createSkill({ ...options, projectDir: directory }));
    } catch (err) {
      try { recordError(err); } catch { /* swallow */ }
      return JSON.stringify({ error: String(err && err.message ? err.message : err) });
    }
  };

  const memoryTools = {
    skill_list: {
      description: 'List Guarana-generated OpenCode skills by scope before creating a new one; does not expose filesystem paths.',
      args: {
        scope: { type: 'string', enum: ['project', 'global', 'both'], description: 'scope filter (default both)' },
      },
      execute: runSkillTool('skillList'),
    },
    skill_create: {
      description: 'Create a skill only for a genuinely distinct reusable domain or workflow after inspecting skill_list; do not create screen-, route-, or task-specific duplicates.',
      args: {
        name: { type: 'string', description: 'lowercase kebab-case skill name' },
        description: { type: 'string', description: 'one-line OpenCode skill description' },
        scope: { type: 'string', enum: ['project', 'global'], description: 'project for repository-specific procedures; global for portable procedures' },
        content: { type: 'string', description: 'complete Markdown procedure for the SKILL.md body, without frontmatter' },
      },
      execute: runSkillTool('skillCreate'),
    },
    skill_update: {
      description: 'Enrich an existing Guarana-generated skill after inspecting skill_list; expectedRevision must be copied from that listed skill to reject stale updates. Manual skills are never overwritten.',
      args: {
        name: { type: 'string', description: 'lowercase kebab-case name of the existing skill' },
        description: { type: 'string', description: 'updated one-line OpenCode skill description' },
        scope: { type: 'string', enum: ['project', 'global'], description: 'must match the existing skill scope' },
        content: { type: 'string', description: 'complete replacement Markdown procedure, without frontmatter' },
        expectedRevision: { type: 'string', description: 'SHA-256 revision for this skill from skill_list; required optimistic-concurrency token' },
      },
      execute: runSkillTool('skillUpdate'),
    },
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
        priority: { type: "string", enum: ["essential", "normal"], description: "optional; valid only for global preference nodes" },
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
    memory_delete_node: {
      description: 'Hard-delete one confirmed memory by exact ID. Explicit matching scope and confirm: true are mandatory; drafts must use memory_review_draft.',
      args: {
        id: { type: 'string', description: 'exact confirmed node ID' },
        scope: { type: 'string', enum: ['project', 'global'], description: 'mandatory scope matching the node' },
        confirm: { type: 'boolean', description: 'must be true to confirm deletion' },
      },
      execute: runTool('memoryDeleteNode'),
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

async function setupGuaranaMemory(ctx) {
  const hooks = await GuaranaMemory({ directory: ctx.location.directory });
  await ctx.tool.transform((editor) => {
    for (const [name, definition] of Object.entries(hooks.tool)) {
      editor.add({
        name,
        description: definition.description,
        input: {
          type: 'object',
          properties: definition.args,
          additionalProperties: false,
        },
        execute: async (input, context) => ({
          content: await definition.execute(input, context),
        }),
      });
    }
  });

  await ctx.session.hook('context', async (event) => {
    const output = { system: [] };
    await hooks['experimental.chat.system.transform'](
      { sessionID: event.sessionID, agent: event.agent },
      output,
    );
    event.system ??= [];
    const existing = new Set((event.system || []).map((item) => item?.text || ''));
    for (const text of output.system) {
      if (![...existing].some((value) => value.includes(text))) {
        event.system.push({ type: 'text', text });
      }
    }
  });

  const controller = new AbortController();
  void (async () => {
    try {
      for await (const event of ctx.event.subscribe({ signal: controller.signal })) {
        const handler = hooks[event.type];
        if (handler) await handler(event);
      }
    } catch {
      // Memory lifecycle observation must not affect the host runtime.
    }
  })();
  return () => controller.abort();
}

export default {
  id: 'guarana.memory',
  setup: setupGuaranaMemory,
  // V1 calls server(ctx); V2 calls setup(ctx).
  server: async (ctx = {}) => GuaranaMemory({ directory: ctx.directory || process.cwd() }),
};
