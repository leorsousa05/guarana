// guarana orchestrator plugin (Component C)
// Thin opencode adapter over the host-independent orchestrator core
// (orchestrator/state.js + decide.js + prompt.js). Decides which guarana skill
// should fire each turn, advances the persisted state machine, bootstraps the
// project record, retrieves relevant memory, and injects a small always-on
// orchestration prompt. Never throws. No external deps.
//
// Markers: '// guarana orchestrator plugin'.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const pluginDir = path.dirname(fileURLToPath(import.meta.url));
const ORCHESTRATOR_INJECTION_MARKER = '<!-- guarana orchestrator injection -->';
const MEMORY_CONTEXT_GROUPS = ['decisions', 'bugs', 'solutions', 'refactors', 'preferences', 'superseded', 'atoms'];
const INJECTION_CACHE_SYMBOL = Symbol.for('guarana.orchestrator.memory-injection-cache');
const injectedMemoryBySession = globalThis[INJECTION_CACHE_SYMBOL] || new Map();
globalThis[INJECTION_CACHE_SYMBOL] = injectedMemoryBySession;

const memoryNodeKey = (node) => `${node.scope === 'global' ? 'global' : 'project'}:${node.id}`;

function selectUnseenMemory(context, seen) {
  const selected = {};
  const memories = [];
  for (const group of MEMORY_CONTEXT_GROUPS) {
    selected[group] = [];
    for (const node of context?.[group] || []) {
      if (!node.id) continue;
      const key = memoryNodeKey(node);
      if (seen.has(key)) continue;
      seen.add(key);
      selected[group].push(node);
      memories.push({ id: node.id, type: node.type, scope: node.scope === 'global' ? 'global' : 'project' });
    }
  }
  selected.count = memories.length;
  return { context: memories.length ? selected : null, memories };
}

function sessionIdFrom(event) {
  const props = (event && event.properties) || event || {};
  const info = props.info || props.session || props;
  return (info && info.id) || props.sessionID || (event && event.sessionID) || null;
}

function storeSessionInjectionState(key, value) {
  injectedMemoryBySession.delete(key);
  injectedMemoryBySession.set(key, value);
  while (injectedMemoryBySession.size > 128) {
    injectedMemoryBySession.delete(injectedMemoryBySession.keys().next().value);
  }
}

// Load the core engine from repo (plugin/ -> ../orchestrator) or bundle
// (cli/plugin/ -> ../orchestrator). Same relative path covers both; ../../orchestrator
// is a fallback for running the bundle in-repo.
async function loadCore() {
  const candidates = [
    path.join(pluginDir, '..', 'orchestrator'),
    path.join(pluginDir, '..', '..', 'orchestrator'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'state.js'))) {
      const [state, decide, prompt, specs] = await Promise.all([
        import(pathToFileURL(path.join(dir, 'state.js')).href),
        import(pathToFileURL(path.join(dir, 'decide.js')).href),
        import(pathToFileURL(path.join(dir, 'prompt.js')).href),
        import(pathToFileURL(path.join(dir, 'specs.js')).href),
      ]);
      return { state, decide, prompt, specs };
    }
  }
  return null;
}

async function loadMemoryEngine() {
  const candidates = [
    path.join(pluginDir, '..', 'memory'),
    path.join(pluginDir, '..', '..', 'memory'),
  ];
  for (const dir of candidates) {
    if (!fs.existsSync(path.join(dir, 'vault.js')) || !fs.existsSync(path.join(dir, 'tools.js'))) continue;
    const [vault, tools] = await Promise.all([
      import(pathToFileURL(path.join(dir, 'vault.js')).href),
      import(pathToFileURL(path.join(dir, 'tools.js')).href),
    ]);
    return { vault, tools };
  }
  return null;
}

// Extract the user text from a chat.message event (parts carry text).
function userText(parts) {
  if (!Array.isArray(parts)) return '';
  return parts
    .map((p) => {
      if (p && typeof p.text === 'string') return p.text;
      if (p && typeof p.content === 'string') return p.content;
      return '';
    })
    .filter(Boolean)
    .join('\n');
}

// Minimal failure extraction from a tool result (string or object).
function resultText(output) {
  if (output == null) return '';
  if (typeof output === 'string') return output;
  if (typeof output === 'object') {
    if (output.error != null) return String(output.error);
    if (output.output != null) return resultText(output.output);
    if (output.result != null) return resultText(output.result);
    return '';
  }
  return '';
}

export const GuaranaOrchestrator = async ({ directory }) => {
  const telemetryDir = path.join(directory, '.specs', 'state', 'telemetry');
  const eventsFile = path.join(telemetryDir, 'events.jsonl');
  const project = path.basename(directory);

  const append = (obj) => {
    try {
      fs.mkdirSync(telemetryDir, { recursive: true });
      fs.appendFileSync(
        eventsFile,
        JSON.stringify({ project, ...obj }) + '\n',
        'utf8'
      );
    } catch (_) {
      /* swallow: telemetry must never throw */
    }
  };

  let corePromise = null;
  let coreFailed = false;
  const core = async () => {
    if (coreFailed) return null;
    if (!corePromise) {
      corePromise = loadCore().catch((err) => {
        coreFailed = true;
        append({ ts: Date.now(), type: 'orchestrator-error', error: String(err && err.message ? err.message : err) });
        return null;
      });
    }
    const c = await corePromise;
    if (!c && !coreFailed) {
      coreFailed = true;
      append({ ts: Date.now(), type: 'orchestrator-error', error: 'orchestrator core not found' });
    }
    return c;
  };

  // Latest workflow, recomputed on chat.message / workflow_tick, used to build
  // the injection on the next system transform.
  let latest = null;
  let memoryContext = null;
  let memoryPromise = null;
  let activeSessionID = null;
  const sessionCacheKey = (sessionID) => `${path.resolve(directory)}::${sessionID}`;

  const loadContext = async (task) => {
    if (!memoryPromise) {
      memoryPromise = loadMemoryEngine().catch((err) => {
        append({ ts: Date.now(), type: 'orchestrator-error', error: String(err && err.message ? err.message : err) });
        return null;
      });
    }
    const e = await memoryPromise;
    if (!e) return null;
    try {
      const userVaultDir = e.vault.initUserVault();
      const [projectContext, globalPreferences] = await Promise.all([
        task
          ? e.tools.memoryGetContextForTask(e.vault.initVault(directory), { task, limit: 7 })
          : Promise.resolve({ decisions: [], bugs: [], solutions: [], refactors: [], preferences: [], superseded: [], atoms: [], count: 0 }),
        e.tools.memoryGetGlobalPreferences(userVaultDir, { limit: 3 }),
      ]);
      const preferences = [
        ...(projectContext.preferences || []),
        ...globalPreferences.preferences,
      ];
      return {
        ...projectContext,
        preferences,
        count: projectContext.count + globalPreferences.count,
      };
    } catch (err) {
      append({ ts: Date.now(), type: 'orchestrator-error', error: String(err && err.message ? err.message : err) });
      return null;
    }
  };

  const syncDecision = async (userText, lastResult, sessionID) => {
    if (sessionID) activeSessionID = sessionID;
    const c = await core();
    if (!c) return;
    try {
      const wf = c.state.load(directory);
      const d = c.decide.decide({ userText, workflow: wf, lastResult });
      let next = wf;
      if (d.event) {
        const applied = c.state.apply(wf, d.event, {
          skill: d.skill,
          goal: d.goal != null ? d.goal : wf.goal,
          activeTask: d.goal != null ? d.goal : wf.activeTask,
          note: d.note,
        });
        if (applied) {
          next = applied;
          if (d.event === 'new_task' && d.goal) {
            try {
              c.specs.ensureSpecs(directory, d.goal);
            } catch (err) {
              append({ ts: Date.now(), type: 'orchestrator-error', error: String(err && err.message ? err.message : err) });
            }
          }
          c.state.save(directory, next);
          append({
            ts: Date.now(),
            type: 'workflow',
            event: d.event,
            from: wf.state,
            to: next.state,
            skill: d.skill,
            note: d.note,
          });
        }
      }
      const contextTask = next.goal || next.activeTask || (next.state !== 'idle' && next.state !== 'completed' ? userText.trim() : '');
      memoryContext = await loadContext(contextTask);
      latest = next;
    } catch (err) {
      append({ ts: Date.now(), type: 'orchestrator-error', error: String(err && err.message ? err.message : err) });
    }
  };

  const readWorkflow = async () => {
    const c = await core();
    if (!c) return { state: 'idle' };
    return c.state.load(directory);
  };

  const runTool = (handler) => async (args) => {
    try {
      const c = await core();
      if (!c) return JSON.stringify({ error: 'orchestrator core not available' });
      return JSON.stringify(await handler(c, args || {}));
    } catch (err) {
      append({ ts: Date.now(), type: 'orchestrator-error', error: String(err && err.message ? err.message : err) });
      return JSON.stringify({ error: String(err && err.message ? err.message : err) });
    }
  };

  const workflowTools = {
    workflow_get: {
      description:
        'Read the current guarana workflow state (state machine: idle/planning/building/coding/verifying/debugging/completed), active task, goal, and recent history. Always available; use to confirm where the engineering loop is.',
      args: {},
      execute: runTool(async (c) => {
        const wf = c.state.load(directory);
        return {
          state: wf.state,
          skill: wf.skill,
          activeTask: wf.activeTask,
          goal: wf.goal,
          condition: wf.condition,
          updatedAt: wf.updatedAt,
          history: wf.history.slice(-10),
        };
      }),
    },
    workflow_tick: {
      description:
        'Advance the guarana workflow state machine. Actions: new_task (start/re-plan), plan_complete, run_start, code_complete, verify_pass, verify_fail, fix_start, debug_complete, abort, force (with skill). Call when a step completes so the loop continues automatically.',
      args: {
        action: {
          type: 'string',
          enum: [
            'new_task', 'plan_complete', 'run_start', 'code_complete',
            'verify_pass', 'verify_fail', 'fix_start', 'debug_complete',
            'abort', 'force',
          ],
          description: 'the transition to apply',
        },
        goal: { type: 'string', description: 'goal text (new_task / re-plan)' },
        condition: { type: 'string', description: 'verifiable condition for the task' },
        skill: { type: 'string', description: 'skill name when action=force' },
        note: { type: 'string', description: 'optional human note' },
      },
      execute: runTool(async (c, args) => {
        const action = args.action;
        if (!action || !c.state.isEvent(action)) {
          return { ok: false, error: `unknown action: ${action}`, state: c.state.load(directory).state };
        }
        const wf = c.state.load(directory);
        const applied = c.state.apply(wf, action, {
          skill: args.skill || undefined,
          goal: args.goal != null ? args.goal : wf.goal,
          condition: args.condition != null ? args.condition : wf.condition,
          activeTask: args.goal != null ? args.goal : wf.activeTask,
          note: args.note || '',
        });
        if (!applied) {
          return { ok: false, error: `illegal transition ${action} from ${wf.state}`, state: wf.state };
        }
        c.state.save(directory, applied);
        if (action === 'new_task' && args.goal) {
          try {
            c.specs.ensureSpecs(directory, args.goal);
          } catch (err) {
            append({ ts: Date.now(), type: 'orchestrator-error', error: String(err && err.message ? err.message : err) });
          }
        }
        latest = applied;
        memoryContext = await loadContext(applied.goal || applied.activeTask || '');
        append({
          ts: Date.now(),
          type: 'workflow',
          event: action,
          from: wf.state,
          to: applied.state,
          skill: applied.skill,
          note: args.note || '',
        });
        return { ok: true, state: applied.state, skill: applied.skill, goal: applied.goal };
      }),
    },
  };

  return {
    tool: workflowTools,

    // Observe every user prompt: restore the persisted workflow, decide the
    // next skill/transition, persist, and stage the directive for injection.
    'chat.message': async (input, output) => {
      try {
        const text = userText((output && output.parts) || (input && input.parts));
        await syncDecision(text, null, input?.sessionID || output?.sessionID);
      } catch (err) {
        append({ ts: Date.now(), type: 'orchestrator-error', error: String(err && err.message ? err.message : err) });
      }
    },

    // Inject the always-on orchestration prompt + the active skill's full body.
    'experimental.chat.system.transform': async (input, output) => {
      try {
        const sessionID = input?.sessionID || sessionIdFrom(input) || activeSessionID || 'unknown';
        const cacheKey = sessionCacheKey(sessionID);
        let sessionMemory = injectedMemoryBySession.get(cacheKey);
        if (!sessionMemory) {
          sessionMemory = { seen: new Set(), nextReason: 'session-start' };
          storeSessionInjectionState(cacheKey, sessionMemory);
        }
        const seen = sessionMemory.seen;
        if (Array.isArray(output.system) && output.system.some((item) => String(item).includes(ORCHESTRATOR_INJECTION_MARKER))) {
          return;
        }
        const c = await core();
        if (!c) return;
        const wf = latest ? latest : c.state.load(directory);
        const pendingMemory = selectUnseenMemory(memoryContext, new Set(seen));
        const injection = `${ORCHESTRATOR_INJECTION_MARKER}\n${c.prompt.buildInjection(wf, { memoryContext: pendingMemory.context, directory })}`;
        if (!Array.isArray(output.system)) output.system = [];
        if (output.system.length > 0) {
          output.system[output.system.length - 1] += '\n\n' + injection;
        } else {
          output.system.push(injection);
        }
        if (pendingMemory.memories.length) {
          for (const node of pendingMemory.memories) seen.add(`${node.scope}:${node.id}`);
          append({
            ts: Date.now(),
            type: 'memory-injected',
            sessionID,
            workflowState: wf.state,
            reason: sessionMemory.nextReason,
            memories: pendingMemory.memories,
          });
          sessionMemory.nextReason = 'new-memories';
        }
      } catch (err) {
        append({ ts: Date.now(), type: 'orchestrator-error', error: String(err && err.message ? err.message : err) });
      }
    },

    'session.created': async (event) => {
      const sessionID = sessionIdFrom(event);
      if (sessionID) storeSessionInjectionState(sessionCacheKey(sessionID), { seen: new Set(), nextReason: 'session-start' });
    },

    'session.compacted': async (event) => {
      const sessionID = sessionIdFrom(event) || activeSessionID || 'unknown';
      storeSessionInjectionState(sessionCacheKey(sessionID), { seen: new Set(), nextReason: 'compacted' });
      try {
        const c = await core();
        if (!c) return;
        const wf = c.state.load(directory);
        memoryContext = await loadContext(wf.goal || wf.activeTask || '');
        latest = wf;
      } catch (err) {
        append({ ts: Date.now(), type: 'orchestrator-error', error: String(err && err.message ? err.message : err) });
      }
    },

    // Observe tool results: an error during verification automatically moves
    // the workflow toward debugging/correction (requirement: verify fail -> debug).
    'tool.execute.after': async (input, output) => {
      try {
        const c = await core();
        if (!c) return;
        const wf = c.state.load(directory);
        if (wf.state !== 'verifying') return;
        const text = resultText(output && (output.output != null ? output.output : output));
        if (!text) return;
        if (c.decide.resultFailed(text)) {
          const applied = c.state.apply(wf, 'verify_fail', {
            skill: 'debug',
            note: 'tool result signaled failure during verification',
          });
          if (applied) {
            c.state.save(directory, applied);
            latest = applied;
            append({
              ts: Date.now(),
              type: 'workflow',
              event: 'verify_fail',
              from: 'verifying',
              to: 'debugging',
              skill: 'debug',
              note: 'auto: tool result failure',
            });
          }
        }
      } catch (err) {
        append({ ts: Date.now(), type: 'orchestrator-error', error: String(err && err.message ? err.message : err) });
      }
    },
  };
};

export default GuaranaOrchestrator;
