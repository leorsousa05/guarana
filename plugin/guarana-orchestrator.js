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
import os from 'node:os';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const pluginDir = path.dirname(fileURLToPath(import.meta.url));
const ORCHESTRATOR_INJECTION_MARKER = '<!-- guarana orchestrator injection -->';
const ADVISOR_OPT_IN_MARKER = '<!-- guarana-advisor-opt-in -->';
const MEMORY_CONTEXT_GROUPS = [
  'global_preferences',
  'related_global_preferences',
  'superseded_global_preferences',
];
const WORKER_AGENT_NAMES = new Set(['worker-code', 'worker-verify', 'worker-debug', 'worker-specs', 'guarana-advisor']);
const INJECTION_CACHE_SYMBOL = Symbol.for('guarana.orchestrator.memory-injection-cache');
const injectedMemoryBySession = globalThis[INJECTION_CACHE_SYMBOL] || new Map();
globalThis[INJECTION_CACHE_SYMBOL] = injectedMemoryBySession;
const WORKFLOW_MESSAGE_CACHE_SYMBOL = Symbol.for('guarana.orchestrator.workflow-message-cache');
const processedWorkflowMessages = globalThis[WORKFLOW_MESSAGE_CACHE_SYMBOL] || new Map();
globalThis[WORKFLOW_MESSAGE_CACHE_SYMBOL] = processedWorkflowMessages;
const ADVISOR_DISPATCH_GUARD_SYMBOL = Symbol.for('guarana.orchestrator.advisor-dispatch-guard');
const advisorDispatchesBySession = globalThis[ADVISOR_DISPATCH_GUARD_SYMBOL] || new Map();
globalThis[ADVISOR_DISPATCH_GUARD_SYMBOL] = advisorDispatchesBySession;
const ADVISOR_DISPATCH_HOOK_INPUTS_SYMBOL = Symbol.for('guarana.orchestrator.advisor-dispatch-hook-inputs');
const advisorDispatchHookInputs = globalThis[ADVISOR_DISPATCH_HOOK_INPUTS_SYMBOL] || new WeakSet();
globalThis[ADVISOR_DISPATCH_HOOK_INPUTS_SYMBOL] = advisorDispatchHookInputs;
const ADVISOR_ARTIFACT_MARKER = '<!-- guarana-managed-advisor-artifact -->';
function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; }
}

function effectiveAdvisorSettings(directory) {
  const globalRoot = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  const globalSettings = readJson(path.join(globalRoot, 'guarana', 'advisor.json'));
  const projectSettings = readJson(path.join(directory, '.guarana', 'advisor.json'));
  const section = (name) => ({ ...(globalSettings[name] || {}), ...(projectSettings[name] || {}) });
  return { primary: section('primary'), advisor: section('advisor') };
}

function hasManagedPrimaryProfile(directory) {
  const globalRoot = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  const targets = [path.join(directory, '.opencode', 'agents', 'guarana.md'), path.join(globalRoot, 'opencode', 'agents', 'guarana.md')];
  return targets.some((file) => {
    try { return fs.readFileSync(file, 'utf8').includes(ADVISOR_ARTIFACT_MARKER); } catch { return false; }
  });
}

const memoryNodeKey = (node) => `${node.scope === 'global' ? 'global' : 'project'}:${node.id}`;

function claimWorkflowMessage(directory, sessionID, messageID) {
  if (!sessionID || !messageID) return true;
  const key = `${path.resolve(directory)}::${sessionID}::${messageID}`;
  if (processedWorkflowMessages.has(key)) return false;
  processedWorkflowMessages.set(key, Date.now());
  while (processedWorkflowMessages.size > 512) {
    processedWorkflowMessages.delete(processedWorkflowMessages.keys().next().value);
  }
  return true;
}

function advisorSessionKey(directory, sessionID) {
  return `${path.resolve(directory)}::${sessionID}`;
}

function advisorContextKey(args) {
  const description = typeof args?.description === 'string' ? args.description : '';
  const prompt = typeof args?.prompt === 'string' ? args.prompt : '';
  const normalized = (prompt || description).normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
  return createHash('sha256').update(normalized).digest('hex');
}

function claimAdvisorDispatch(sessionKey, contextKey, input) {
  let state = advisorDispatchesBySession.get(sessionKey);
  const callID = typeof input?.callID === 'string' ? input.callID : '';
  if ((callID && state?.callIDs.has(callID)) || (input && advisorDispatchHookInputs.has(input))) return true;
  if (state?.contexts.has(contextKey)) return false;
  if (state && state.contexts.size >= 64) return false;
  if (!state) {
    state = { contexts: new Set(), callIDs: new Set() };
    advisorDispatchesBySession.set(sessionKey, state);
  }
  state.contexts.add(contextKey);
  if (callID) state.callIDs.add(callID);
  if (input && typeof input === 'object') advisorDispatchHookInputs.add(input);
  while (advisorDispatchesBySession.size > 512) {
    advisorDispatchesBySession.delete(advisorDispatchesBySession.keys().next().value);
  }
  return true;
}

function selectUnseenMemory(context, seen) {
  const selected = {};
  const memories = [];
  for (const group of MEMORY_CONTEXT_GROUPS) {
    selected[group] = [];
    for (const node of context?.[group] || []) {
      if (!node || !node.id || node.scope !== 'global' || node.type !== 'preference') continue;
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
  const data = event?.data || {};
  const properties = event?.properties || {};
  const dataInfo = data.info || data.session;
  const info = dataInfo || properties.info || properties.session || event?.info || event?.session;
  return data.sessionID || info?.id || properties.id || properties.sessionID || event?.sessionID || null;
}

function sessionInfoFrom(event) {
  const data = event?.data;
  const props = event?.properties || event || {};
  const info = data?.info || data?.session || props.info || props.session;
  return info || (data && Object.keys(data).length ? data : props);
}

function storeSessionInjectionState(key, value) {
  injectedMemoryBySession.delete(key);
  injectedMemoryBySession.set(key, value);
  while (injectedMemoryBySession.size > 128) {
    injectedMemoryBySession.delete(injectedMemoryBySession.keys().next().value);
  }
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function withPersistentInjectionState(directory, update) {
  const telemetryDir = path.join(directory, '.specs', 'state', 'telemetry');
  const stateFile = path.join(telemetryDir, 'memory-injection-state.json');
  const lockFile = path.join(telemetryDir, 'memory-injection-state.lock');
  fs.mkdirSync(telemetryDir, { recursive: true });

  let lock;
  const deadline = Date.now() + 2000;
  while (lock == null && Date.now() < deadline) {
    try {
      lock = fs.openSync(lockFile, 'wx');
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
      try {
        if (Date.now() - fs.statSync(lockFile).mtimeMs > 10000) fs.unlinkSync(lockFile);
      } catch {
        // The owner may have released the lock between stat and unlink.
      }
      await wait(5);
    }
  }
  if (lock == null) return null;

  try {
    let state;
    try {
      state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    } catch {
      state = { sessions: {} };
    }
    if (!state.sessions || typeof state.sessions !== 'object') state.sessions = {};
    const result = update(state);
    const tempFile = `${stateFile}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(state), 'utf8');
    fs.renameSync(tempFile, stateFile);
    return result;
  } finally {
    try { fs.closeSync(lock); } catch {}
    try { fs.unlinkSync(lockFile); } catch {}
  }
}

async function claimMemoryReferences(directory, sessionID, references, fallbackReason) {
  return withPersistentInjectionState(directory, (state) => {
    const previous = state.sessions[sessionID] || { seen: [], nextReason: fallbackReason || 'session-start' };
    const seen = new Set(previous.seen || []);
    const memories = references.filter((ref) => {
      if (!ref || typeof ref.id !== 'string') return false;
      const key = `${ref.scope === 'global' ? 'global' : 'project'}:${ref.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const reason = previous.nextReason || fallbackReason || 'session-start';
    delete state.sessions[sessionID];
    state.sessions[sessionID] = {
      seen: [...seen],
      nextReason: memories.length ? 'new-memories' : reason,
      updatedAt: Date.now(),
    };
    while (Object.keys(state.sessions).length > 128) {
      delete state.sessions[Object.keys(state.sessions)[0]];
    }
    return { memories, reason };
  });
}

async function resetPersistentMemoryReferences(directory, sessionID, reason) {
  return withPersistentInjectionState(directory, (state) => {
    delete state.sessions[sessionID];
    state.sessions[sessionID] = { seen: [], nextReason: reason, updatedAt: Date.now() };
    while (Object.keys(state.sessions).length > 128) {
      delete state.sessions[Object.keys(state.sessions)[0]];
    }
    return true;
  });
}

function contextForReferences(context, references) {
  if (!context || !references.length) return null;
  const keys = new Set(references.map((ref) => `${ref.scope === 'global' ? 'global' : 'project'}:${ref.id}`));
  const selected = {};
  for (const group of MEMORY_CONTEXT_GROUPS) {
    selected[group] = (context[group] || []).filter((node) => keys.has(memoryNodeKey(node)));
  }
  selected.count = references.length;
  return selected;
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
      const [state, decide, prompt, specs, workflowSettings] = await Promise.all([
        import(pathToFileURL(path.join(dir, 'state.js')).href),
        import(pathToFileURL(path.join(dir, 'decide.js')).href),
        import(pathToFileURL(path.join(dir, 'prompt.js')).href),
        import(pathToFileURL(path.join(dir, 'specs.js')).href),
        import(pathToFileURL(path.join(dir, 'workflow-settings.js')).href),
      ]);
      return { state, decide, prompt, specs, workflowSettings };
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

export const GuaranaOrchestrator = async ({ directory, client, session, sdkVersion = 'v1' }) => {
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

  const appendWorkflowEvent = ({ source, sessionID, agent, event, from, to, skill }) => append({
    ts: Date.now(),
    type: 'workflow',
    source,
    sessionID: typeof sessionID === 'string' ? sessionID : null,
    agent: typeof agent === 'string' ? agent : null,
    event,
    from,
    to,
    skill,
  });

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

  let workflowSettingsErrorReported = false;
  const workflowPreferences = (c) => {
    try {
      const settings = c.workflowSettings.readWorkflowSettings({ directory });
      workflowSettingsErrorReported = false;
      return settings.effective;
    } catch (err) {
      if (!workflowSettingsErrorReported) {
        append({ ts: Date.now(), type: 'orchestrator-error', error: String(err && err.message ? err.message : err) });
        workflowSettingsErrorReported = true;
      }
      return { specs: { enabled: true }, verify: { enabled: true } };
    }
  };

  // Latest workflow, recomputed on chat.message / workflow_tick, used to build
  // the injection on the next system transform.
  let latest = null;
  let memoryContext = null;
  let memoryPromise = null;
  let activeSessionID = null;
  const childSessions = new Set();
  const sessionRoleCache = new Map();
  const markChildSession = (sessionID) => {
    if (!sessionID) return;
    childSessions.delete(sessionID);
    childSessions.add(sessionID);
    while (childSessions.size > 256) childSessions.delete(childSessions.values().next().value);
  };
  const isWorkerContext = (sessionID, agent) => childSessions.has(sessionID) || WORKER_AGENT_NAMES.has(agent);
  const isMetadataChildSession = async (sessionID) => {
    if (!sessionID) return false;
    if (sessionRoleCache.has(sessionID)) return sessionRoleCache.get(sessionID);
    try {
      let response;
      if (sdkVersion === 'v2') {
        if (typeof session?.get !== 'function') return false;
        response = await session.get({ sessionID, directory });
      } else {
        if (typeof client?.session?.get !== 'function') return false;
        response = await client.session.get({ path: { id: sessionID }, query: { directory } });
      }
      const directResponse = sdkVersion === 'v2' && response?.id === sessionID;
      const info = sdkVersion === 'v2'
        ? (directResponse ? response : response?.data)
        : response?.data;
      if (!info || typeof info !== 'object') return false;
      if (sdkVersion === 'v2' && info.id !== sessionID) return false;
      const isChild = Boolean(info.parentID) || WORKER_AGENT_NAMES.has(info.agent);
      sessionRoleCache.set(sessionID, isChild);
      while (sessionRoleCache.size > 256) sessionRoleCache.delete(sessionRoleCache.keys().next().value);
      if (isChild) markChildSession(sessionID);
      return isChild;
    } catch {
      // Session metadata is best-effort; never expose prompt or tool data on lookup failure.
      return false;
    }
  };
  const sessionCacheKey = (sessionID) => `${path.resolve(directory)}::${sessionID}`;

  const handleSessionCreated = async (event) => {
    const sessionID = sessionIdFrom(event);
    if (!sessionID) return;
    const info = sessionInfoFrom(event);
    if (info?.parentID || WORKER_AGENT_NAMES.has(info?.agent)) {
      markChildSession(sessionID);
      return;
    }
    storeSessionInjectionState(sessionCacheKey(sessionID), { seen: new Set(), nextReason: 'session-start' });
    try {
      await resetPersistentMemoryReferences(directory, sessionID, 'session-start');
    } catch (err) {
      append({ ts: Date.now(), type: 'orchestrator-error', error: String(err && err.message ? err.message : err) });
    }
  };

  const handleSessionCompacted = async (event) => {
    const sessionID = sessionIdFrom(event) || activeSessionID || 'unknown';
    if (childSessions.has(sessionID)) return;
    storeSessionInjectionState(sessionCacheKey(sessionID), { seen: new Set(), nextReason: 'compacted' });
    try {
      await resetPersistentMemoryReferences(directory, sessionID, 'compacted');
      const c = await core();
      if (!c) return;
      const wf = c.state.load(directory);
      memoryContext = await loadContext(wf.goal || wf.activeTask || '');
      latest = wf;
    } catch (err) {
      append({ ts: Date.now(), type: 'orchestrator-error', error: String(err && err.message ? err.message : err) });
    }
  };

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
      // Preserve the established task-start project-vault initialization, but
      // never read project nodes for automatic prompt context.
      if (task) e.vault.initVault(directory);
      const globalPreferences = await e.tools.memoryGetGlobalPreferences(e.vault.userVaultDir(), { complete: true });
      return {
        global_preferences: globalPreferences.preferences,
        related_global_preferences: globalPreferences.relatedPreferences || [],
        superseded_global_preferences: globalPreferences.relatedSuperseded || [],
        count: (globalPreferences.preferences || []).length
          + (globalPreferences.relatedPreferences || []).length
          + (globalPreferences.relatedSuperseded || []).length,
      };
    } catch (err) {
      append({ ts: Date.now(), type: 'orchestrator-error', error: String(err && err.message ? err.message : err) });
      return null;
    }
  };

  const syncDecision = async (userText, lastResult, sessionID, agent) => {
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
          if ((d.event === 'new_task' || d.event === 'force') && (d.goal || wf.goal || userText)) {
            if (workflowPreferences(c).specs.enabled) {
              try {
                c.specs.ensureSpecs(directory, d.goal || wf.goal || userText);
              } catch (err) {
                append({ ts: Date.now(), type: 'orchestrator-error', error: String(err && err.message ? err.message : err) });
              }
            }
          }
          c.state.save(directory, next);
          appendWorkflowEvent({
            source: 'chat.message',
            sessionID,
            agent,
            event: d.event,
            from: wf.state,
            to: next.state,
            skill: d.skill,
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
        'Advance the guarana workflow state machine. Actions: new_task (start/re-plan), plan_complete, run_start, start_task, code_complete, verify_pass, verify_fail, verify_skip, fix_start, debug_complete, abort, force (with skill). Use start_task only after guarana:plan discovery is closed and any required worker-specs record write is reported; provide explicit nonempty goal and condition. It atomically performs new_task -> plan_complete -> run_start. Do not skip planning or ask the user to accept a shortcut. Individual transitions remain available for genuinely open planning and other stage changes.',
      args: {
        action: {
          type: 'string',
          enum: [
            'new_task', 'plan_complete', 'run_start', 'start_task', 'code_complete',
            'verify_pass', 'verify_fail', 'verify_skip', 'fix_start', 'debug_complete',
            'abort', 'force',
          ],
          description: 'the transition to apply',
        },
        goal: { type: 'string', description: 'goal text (new_task / re-plan); required and nonempty for start_task' },
        condition: { type: 'string', description: 'verifiable condition for the task; required and nonempty for start_task' },
        skill: { type: 'string', description: 'skill name when action=force' },
        note: { type: 'string', description: 'optional human note' },
      },
      execute: async (args, context = {}) => {
        if (typeof context?.sessionID !== 'string' || !context.sessionID.trim()
          || typeof context?.agent !== 'string' || !context.agent.trim()) {
          return JSON.stringify({ ok: false, error: 'workflow_tick requires nonempty sessionID and agent caller identity.' });
        }
        if (isWorkerContext(context.sessionID, context.agent)) {
          return JSON.stringify({ ok: false, error: 'Task workers cannot advance the parent workflow; return the worker contract to the primary context.' });
        }
        return runTool(async (c, args) => {
          const action = args.action;
          if (!action || !c.state.isEvent(action)) {
            return { ok: false, error: `unknown action: ${action}`, state: c.state.load(directory).state };
          }
          const wf = c.state.load(directory);
          if (action === 'start_task'
            && (typeof args.goal !== 'string' || !args.goal.trim()
              || typeof args.condition !== 'string' || !args.condition.trim())) {
            return { ok: false, error: 'start_task requires explicit nonempty goal and condition', state: wf.state };
          }
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
          if (((action === 'new_task' || action === 'start_task') && args.goal) || action === 'force') {
            if (workflowPreferences(c).specs.enabled) {
              try {
                const skill = String(args.skill || applied.skill || 'plan').replace(/^guarana[:_-]?/i, '');
                c.specs.ensureSpecs(directory, args.goal || applied.goal || `guarana:${skill}`);
              } catch (err) {
                append({ ts: Date.now(), type: 'orchestrator-error', error: String(err && err.message ? err.message : err) });
              }
            }
          }
          latest = applied;
          memoryContext = await loadContext(applied.goal || applied.activeTask || '');
          const history = action === 'start_task' ? applied.history.slice(-3) : [applied.history.at(-1)];
          for (const entry of history) {
            appendWorkflowEvent({
              source: 'workflow_tick',
              sessionID: context.sessionID,
              agent: context.agent,
              event: entry.event,
              from: entry.from,
              to: entry.to,
              skill: c.state.skillForState(entry.to),
            });
          }
          return { ok: true, state: applied.state, skill: applied.skill, goal: applied.goal };
        })(args);
      },
    },
  };

  return {
    config: async (cfg) => {
      try {
        const settings = effectiveAdvisorSettings(directory);
        if (!settings.primary.provider || !settings.primary.model || !hasManagedPrimaryProfile(directory)) return;
        if (cfg.default_agent == null || cfg.default_agent === '' || cfg.default_agent === 'build') cfg.default_agent = 'guarana';
      } catch { /* Runtime configuration must remain non-fatal. */ }
    },
    tool: workflowTools,

    // Session lifecycle arrives through OpenCode's generic event hook.
    event: async ({ event } = {}) => {
      if (event?.type === 'session.created') await handleSessionCreated(event);
      if (event?.type === 'session.compacted') await handleSessionCompacted(event);
    },

    // Observe every user prompt: restore the persisted workflow, decide the
    // next skill/transition, persist, and stage the directive for injection.
    'chat.message': async (input, output) => {
      try {
        const sessionID = input?.sessionID || output?.sessionID;
        const agent = input?.agent || output?.message?.agent;
        if (WORKER_AGENT_NAMES.has(agent)) markChildSession(sessionID);
        if (isWorkerContext(sessionID, agent)) return;
        if (!agent && sessionID && await isMetadataChildSession(sessionID)) return;
        const messageID = input?.messageID || output?.message?.id;
        if (!claimWorkflowMessage(directory, sessionID, messageID)) return;
        const text = userText((output && output.parts) || (input && input.parts));
        if (sessionID && text.includes(ADVISOR_OPT_IN_MARKER)) {
          advisorDispatchesBySession.delete(advisorSessionKey(directory, sessionID));
        }
        await syncDecision(text, null, sessionID, agent);
      } catch (err) {
        append({ ts: Date.now(), type: 'orchestrator-error', error: String(err && err.message ? err.message : err) });
      }
    },

    // Inject the always-on orchestration prompt + the active skill's full body.
    'experimental.chat.system.transform': async (input, output) => {
      try {
        const sessionID = input?.sessionID || sessionIdFrom(input) || activeSessionID || 'unknown';
        if (isWorkerContext(sessionID, input?.agent)) return;
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
        const candidates = selectUnseenMemory(memoryContext, new Set(seen));
        const preferences = workflowPreferences(c);
        const serializedMemory = c.prompt.serializeMemoryPayload(candidates.context);
        const configuredBudget = preferences.memory?.preferenceInjectionBudgetTokens;
        const modelContext = input?.model?.limit?.context;
        const usableConfigured = Number.isSafeInteger(configuredBudget) && configuredBudget > 0 ? configuredBudget : null;
        const usableModelContext = Number.isSafeInteger(modelContext) && modelContext > 0 ? modelContext : null;
        const effectiveBudget = usableConfigured != null && usableModelContext != null
          ? Math.min(usableConfigured, usableModelContext)
          : usableConfigured ?? usableModelContext;
        const serializedBytes = serializedMemory
          ? Buffer.byteLength(serializedMemory.serialized, 'utf8')
          : 0;
        let memoryNotice;
        let claim = { memories: [], reason: sessionMemory.nextReason };
        let pendingMemoryContext = null;
        const preferenceBudgetRepair = 'Tell the user that no saved preference text was injected, and do not imply that saved preferences were applied. To enable injection, set or raise `memory.preferenceInjectionBudgetTokens` high enough for the complete payload (subject to the model context limit) in Dashboard Settings → Workflow preferences → Global preference injection budget (tokens), or run `guarana workflow set memory.preferenceInjectionBudgetTokens <positive-integer>`; add `--project` for a project override.';
        if (serializedMemory && effectiveBudget == null) {
          memoryNotice = `Global preferences were not injected because no usable configured token budget or model context limit is available. No preference text was included. ${preferenceBudgetRepair}`;
        } else if (serializedMemory && serializedBytes > effectiveBudget) {
          memoryNotice = `Global preferences were not injected because the complete payload is ${serializedBytes} UTF-8 bytes, over the ${effectiveBudget}-token estimated budget. UTF-8 bytes are only an estimate, not exact tokenization or remaining conversation capacity; no preference text was included. ${preferenceBudgetRepair}`;
        } else if (candidates.memories.length) {
          claim = await claimMemoryReferences(directory, sessionID, candidates.memories, sessionMemory.nextReason)
            || { memories: [], reason: sessionMemory.nextReason };
          pendingMemoryContext = contextForReferences(candidates.context, claim.memories);
        }
        const pendingMemory = { memories: claim.memories, context: pendingMemoryContext };
        const injection = `${ORCHESTRATOR_INJECTION_MARKER}\n${c.prompt.buildInjection(wf, { memoryContext: pendingMemory.context, memoryNotice, directory, preferences })}`;
        if (!Array.isArray(output.system)) output.system = [];
        if (output.system.length > 0) {
          output.system[output.system.length - 1] += '\n\n' + injection;
        } else {
          output.system.push(injection);
        }
        if (pendingMemory.memories.length) {
          for (const node of pendingMemory.memories) seen.add(memoryNodeKey(node));
          append({
            ts: Date.now(),
            type: 'memory-injected',
            sessionID,
            workflowState: wf.state,
            reason: claim.reason,
            memories: pendingMemory.memories,
          });
          sessionMemory.nextReason = 'new-memories';
        }
      } catch (err) {
        append({ ts: Date.now(), type: 'orchestrator-error', error: String(err && err.message ? err.message : err) });
      }
    },

    'session.created': async (event) => {
      await handleSessionCreated(event);
    },

    'session.compacted': async (event) => {
      await handleSessionCompacted(event);
    },

    // Enforce advisor consultation limits at native Task dispatch, not only in
    // the primary profile prompt. Other Task subagents and tools are untouched.
    'tool.execute.before': async (input, output) => {
      if (String(input?.tool || '').toLowerCase() !== 'task') return;
      const args = output?.args || input?.args || {};
      if (args.subagent_type !== 'guarana-advisor') return;
      const settings = effectiveAdvisorSettings(directory);
      if (settings.advisor.enabled !== true) throw new Error('Guarana Advisor consultation is disabled. Enable it with `guarana advisor set advisor.enabled true`.');
      if (!settings.advisor.provider || !settings.advisor.model) throw new Error('Guarana Advisor is not configured. Set advisor.provider and advisor.model before dispatching guarana-advisor.');
      const sessionID = input?.sessionID;
      const contextKey = advisorContextKey(args);
      if (!sessionID || !contextKey) return;
      const sessionKey = advisorSessionKey(directory, sessionID);
      if (!claimAdvisorDispatch(sessionKey, contextKey, input)) {
        throw new Error('Guarana advisor consultation refused: this unchanged blocker has already used its advisor consultation in this parent session. Add materially new evidence or invoke a fresh /guarana-advisor command to reset the consultation budget.');
      }
    },

    // Observe tool results: an error during verification automatically moves
    // the workflow toward debugging/correction (requirement: verify fail -> debug).
    'tool.execute.after': async (input, output) => {
      try {
        if (isWorkerContext(input?.sessionID, input?.agent)) return;
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
            appendWorkflowEvent({
              source: 'tool.execute.after',
              sessionID: input?.sessionID,
              agent: input?.agent,
              event: 'verify_fail',
              from: 'verifying',
              to: 'debugging',
              skill: 'debug',
            });
          }
        }
      } catch (err) {
        append({ ts: Date.now(), type: 'orchestrator-error', error: String(err && err.message ? err.message : err) });
      }
    },
  };
};

async function setupGuaranaOrchestrator(ctx) {
  const hooks = await GuaranaOrchestrator({ directory: ctx.location.directory, session: ctx.session, sdkVersion: 'v2' });
  const directory = ctx.location.directory;

  await ctx.agent.transform((editor) => {
    try {
      const settings = effectiveAdvisorSettings(directory);
      if (settings.primary.provider && settings.primary.model && hasManagedPrimaryProfile(directory)) {
        editor.default('guarana');
      }
    } catch {
      // Runtime configuration must remain non-fatal.
    }
  });

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

  await ctx.session.hook('prompt', async (event) => {
    await hooks['chat.message'](
      {
        sessionID: event.sessionID,
        messageID: event.messageID,
        agent: event.agent,
      },
      {
        message: { id: event.messageID, agent: event.agent },
        parts: [{ type: 'text', text: event.prompt?.text || '' }],
      },
    );
  });

  await ctx.session.hook('context', async (event) => {
    event.system ??= [];
    const textItems = event.system
      .map((item, index) => ({ item, index, text: typeof item === 'string' ? item : item?.text }))
      .filter(({ text }) => typeof text === 'string');
    const output = { system: textItems.map(({ text }) => text) };
    await hooks['experimental.chat.system.transform'](
      { sessionID: event.sessionID, agent: event.agent, model: event.model },
      output,
    );
    for (let i = 0; i < output.system.length; i++) {
      const existing = textItems[i];
      if (existing) {
        if (typeof existing.item === 'string') event.system[existing.index] = output.system[i];
        else existing.item.text = output.system[i];
      } else {
        event.system.push({ type: 'text', text: output.system[i] });
      }
    }
  });

  const toolInput = (event) => ({
    tool: event.tool,
    sessionID: event.sessionID,
    callID: event.callID,
    agent: event.agent,
    args: event.input,
  });
  await ctx.tool.hook('execute.before', async (event) => {
    await hooks['tool.execute.before'](toolInput(event), { args: event.input });
  });
  await ctx.tool.hook('execute.after', async (event) => {
    await hooks['tool.execute.after'](toolInput(event), event.output);
  });

  const controller = new AbortController();
  void (async () => {
    try {
      for await (const event of ctx.event.subscribe({ signal: controller.signal })) {
        await hooks.event({ event });
      }
    } catch {
      // Event observation is best-effort; core hooks remain non-fatal.
    }
  })();
  return () => controller.abort();
}

export default {
  id: 'guarana.orchestrator',
  setup: setupGuaranaOrchestrator,
  // V1 calls server(ctx); V2 calls setup(ctx).
  server: async (ctx = {}) => GuaranaOrchestrator({ directory: ctx.directory || process.cwd() }),
};
