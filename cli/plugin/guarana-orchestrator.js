// guarana orchestrator plugin (Component C)
// Thin opencode adapter over the host-independent orchestrator core
// (orchestrator/state.js + decide.js + prompt.js). Decides which guarana skill
// should fire each turn, advances the persisted state machine, retrieves
// relevant memory, and injects a small always-on
// orchestration prompt. Never throws. No external deps.
//
// Markers: '// guarana orchestrator plugin'.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const pluginDir = path.dirname(fileURLToPath(import.meta.url));
const ORCHESTRATOR_INJECTION_MARKER = '<!-- guarana orchestrator injection -->';
const ADVISOR_OPT_IN_MARKER = '<!-- guarana-advisor-opt-in -->';
const MEMORY_CONTEXT_GROUPS = [
  'project_preferences',
  'global_preferences',
  'related_global_preferences',
  'superseded_global_preferences',
];
const PROJECT_PREFERENCE_CATEGORIES = new Set(['agent_behavior', 'workflow', 'communication']);
const WORKER_AGENT_NAMES = new Set(['worker-code', 'worker-verify', 'worker-debug', 'worker-specs', 'worker-research', 'guarana-advisor']);
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

function sessionFingerprint(sessionID) {
  return createHash('sha256').update(String(sessionID)).digest('hex').slice(0, 12);
}

function storeSessionInjectionState(key, value) {
  injectedMemoryBySession.delete(key);
  injectedMemoryBySession.set(key, value);
  while (injectedMemoryBySession.size > 128) {
    injectedMemoryBySession.delete(injectedMemoryBySession.keys().next().value);
  }
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const EVENT_RECONNECT_BASE_MS = 100;
const EVENT_RECONNECT_MAX_MS = 30_000;

function abortableWait(ms, signal) {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    let timer;
    const finish = () => {
      if (timer !== undefined) clearTimeout(timer);
      signal?.removeEventListener('abort', finish);
      resolve();
    };
    timer = setTimeout(finish, ms);
    signal?.addEventListener('abort', finish, { once: true });
    if (signal?.aborted) finish();
  });
}

function returnIterator(iterator) {
  try {
    Promise.resolve(iterator?.return?.()).catch(() => {});
  } catch {
    // Iterator cleanup is best-effort and must not prevent abort or reconnect.
  }
}

function valueOrAbort(value, signal) {
  const pending = Promise.resolve(value);
  if (!signal) return pending.then((resolved) => ({ value: resolved }));
  if (signal.aborted) {
    pending.catch(() => {});
    return Promise.resolve({ aborted: true });
  }
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback, result) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', onAbort);
      callback(result);
    };
    const onAbort = () => finish(resolve, { aborted: true });
    signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted) onAbort();
    pending.then(
      (resolved) => finish(resolve, { value: resolved }),
      (error) => finish(reject, error),
    );
  });
}

function nextOrAbort(iterator, signal) {
  if (signal?.aborted) {
    returnIterator(iterator);
    return Promise.resolve({ aborted: true });
  }
  const next = Promise.resolve().then(() => iterator.next());
  if (!signal) return next.then((value) => ({ value }));
  return new Promise((resolve, reject) => {
    let settled = false;
    const onAbort = () => {
      if (settled) return;
      settled = true;
      returnIterator(iterator);
      resolve({ aborted: true });
    };
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', onAbort);
      callback(value);
    };
    signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted) onAbort();
    next.then(
      (value) => finish(resolve, { value }),
      (error) => finish(reject, error),
    );
  });
}

export async function consumeEventStreamWithReconnect({
  subscribe,
  onEvent,
  signal,
  onFailure = () => {},
  sleep = abortableWait,
}) {
  let backoff = EVENT_RECONNECT_BASE_MS;
  let attempt = 0;
  while (!signal?.aborted) {
    let iterator;
    let failure = null;
    try {
      const subscribed = await valueOrAbort(subscribe({ signal }), signal);
      if (subscribed.aborted || signal?.aborted) break;
      const stream = subscribed.value;
      iterator = stream?.[Symbol.asyncIterator]?.();
      if (!iterator || typeof iterator.next !== 'function') throw new TypeError('Event stream is not async iterable');
      let ended = false;
      while (!signal?.aborted) {
        const next = await nextOrAbort(iterator, signal);
        if (next.aborted || signal?.aborted) break;
        if (next.value.done) {
          ended = true;
          break;
        }
        backoff = EVENT_RECONNECT_BASE_MS;
        attempt = 0;
        const handled = await valueOrAbort(onEvent(next.value.value), signal);
        if (handled.aborted || signal?.aborted) break;
      }
      if (signal?.aborted) break;
      if (ended) failure = 'terminated';
    } catch {
      if (signal?.aborted) break;
      failure = 'thrown';
      returnIterator(iterator);
    }
    if (signal?.aborted) break;
    const delayMs = backoff;
    if (failure) {
      attempt += 1;
      try { onFailure({ failure, attempt, delayMs, action: 'reconnect' }); } catch { /* diagnostics are best-effort */ }
    }
    await sleep(delayMs, signal);
    backoff = Math.min(EVENT_RECONNECT_MAX_MS, backoff * 2);
  }
}

function pendingMemoryResetFile(directory, sessionID, token = '') {
  const fingerprint = createHash('sha256').update(String(sessionID)).digest('hex');
  const prefix = `memory-injection-reset-${fingerprint}`;
  return {
    file: path.join(directory, '.specs', 'state', 'telemetry', `${prefix}${token ? `-${token}` : ''}.json`),
    prefix,
    fingerprint,
  };
}

function readPendingMemoryResets(directory, sessionID) {
  const pending = pendingMemoryResetFile(directory, sessionID);
  let names;
  try {
    names = fs.readdirSync(path.dirname(pending.file))
      .filter((name) => name.startsWith(pending.prefix) && name.endsWith('.json'));
  } catch {
    return [];
  }
  const markers = [];
  for (const name of names) {
    const file = path.join(path.dirname(pending.file), name);
    let descriptor;
    try {
      descriptor = fs.openSync(file,
        fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0) | (fs.constants.O_NONBLOCK || 0));
      const openedStat = fs.fstatSync(descriptor);
      if (!openedStat.isFile() || openedStat.size > 1024) continue;
      const buffer = Buffer.alloc(1025);
      const bytesRead = fs.readSync(descriptor, buffer, 0, buffer.length, 0);
      const finalStat = fs.fstatSync(descriptor);
      if (bytesRead !== openedStat.size || bytesRead > 1024
        || finalStat.size !== openedStat.size || finalStat.mtimeMs !== openedStat.mtimeMs)
        continue;
      const marker = JSON.parse(buffer.subarray(0, bytesRead).toString('utf8'));
      if (marker.fingerprint === pending.fingerprint && ['session-start', 'compacted'].includes(marker.reason)) {
        markers.push({ file, reason: marker.reason, updatedAt: Number.isSafeInteger(marker.updatedAt) ? marker.updatedAt : 0 });
      }
    } catch { /* absent or invalid markers are ignored */ }
    finally {
      if (descriptor !== undefined) {
        try { fs.closeSync(descriptor); } catch { /* marker was only best-effort */ }
      }
    }
  }
  return markers;
}

function strongestMemoryResetReason(...reasons) {
  if (reasons.includes('compacted')) return 'compacted';
  if (reasons.includes('session-start')) return 'session-start';
  return null;
}

function writePendingMemoryReset(directory, sessionID, reason) {
  if (!['session-start', 'compacted'].includes(reason)) throw new TypeError('invalid pending memory reset reason');
  const token = `${String(Date.now()).padStart(16, '0')}-${process.pid}-${randomUUID()}`;
  const pending = pendingMemoryResetFile(directory, sessionID, token);
  fs.mkdirSync(path.dirname(pending.file), { recursive: true });
  const tempFile = `${pending.file}.${Math.random().toString(36).slice(2)}.tmp`;
  try {
    fs.writeFileSync(tempFile, JSON.stringify({ fingerprint: pending.fingerprint, reason, updatedAt: Date.now() }), {
      encoding: 'utf8', mode: 0o600, flag: 'wx',
    });
    fs.renameSync(tempFile, pending.file);
  } finally {
    try { fs.rmSync(tempFile, { force: true }); } catch { /* preserve marker result */ }
  }
  return pending.file;
}

async function withPersistentInjectionState(directory, update, shouldPersist = () => true, afterPersist = () => {}, onLockTimeout = () => {}) {
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
  if (lock == null) {
    onLockTimeout();
    return null;
  }

  try {
    let state;
    try {
      state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    } catch {
      state = { sessions: {} };
    }
    if (!state.sessions || typeof state.sessions !== 'object') state.sessions = {};
    const result = update(state);
    if (shouldPersist(result)) {
      const tempFile = `${stateFile}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
      fs.writeFileSync(tempFile, JSON.stringify(state), 'utf8');
      fs.renameSync(tempFile, stateFile);
      afterPersist(result);
    }
    return result;
  } finally {
    try { fs.closeSync(lock); } catch {}
    try { fs.unlinkSync(lockFile); } catch {}
  }
}

async function claimMemoryReferences(directory, sessionID, references, fallbackReason, selectEligible = (eligible) => eligible, knownSeen = []) {
  let clearPendingResets = [];
  return withPersistentInjectionState(directory, (state) => {
    const pendingResets = readPendingMemoryResets(directory, sessionID);
    const pendingReason = strongestMemoryResetReason(...pendingResets.map((marker) => marker.reason));
    const previous = state.sessions[sessionID] || { seen: [], nextReason: fallbackReason || 'session-start' };
    const hadPersistentSession = Object.hasOwn(state.sessions, sessionID);
    const refreshRecency = !hadPersistentSession || Object.keys(state.sessions).at(-1) !== sessionID;
    const persistedBoundary = strongestMemoryResetReason(previous.nextReason);
    const boundaryReason = strongestMemoryResetReason(pendingReason, persistedBoundary);
    clearPendingResets = pendingResets;
    const persistedSeen = new Set(boundaryReason ? [] : previous.seen || []);
    const seen = new Set(boundaryReason ? [] : [...persistedSeen, ...knownSeen]);
    const seenChanged = seen.size !== persistedSeen.size;
    const eligible = references.filter((ref) => {
      if (!ref || typeof ref.id !== 'string') return false;
      const key = `${ref.scope === 'global' ? 'global' : 'project'}:${ref.id}`;
      if (seen.has(key)) return false;
      return true;
    });
    const selectedKeys = new Set(selectEligible(eligible).map((ref) =>
      `${ref.scope === 'global' ? 'global' : 'project'}:${ref.id}`));
    const memories = eligible.filter((ref) => {
      const key = `${ref.scope === 'global' ? 'global' : 'project'}:${ref.id}`;
      if (!selectedKeys.has(key)) return false;
      seen.add(key);
      return true;
    });
    const reason = boundaryReason || previous.nextReason || fallbackReason || 'session-start';
    delete state.sessions[sessionID];
    state.sessions[sessionID] = {
      seen: [...seen],
      nextReason: memories.length ? 'new-memories' : reason,
      updatedAt: Date.now(),
    };
    while (Object.keys(state.sessions).length > 128) {
      delete state.sessions[Object.keys(state.sessions)[0]];
    }
    return { memories, eligible, reason, refreshRecency, seenChanged };
  }, ({ memories, reason, refreshRecency, seenChanged }) => memories.length > 0
    || reason === 'compacted' || reason === 'session-start' || refreshRecency || seenChanged,
  () => {
    for (const marker of clearPendingResets) fs.rmSync(marker.file, { force: true });
  });
}

async function resetPersistentMemoryReferences(directory, sessionID, reason) {
  const ownMarker = writePendingMemoryReset(directory, sessionID, reason);
  let clearPendingResets = [];
  const result = await withPersistentInjectionState(directory, (state) => {
    const pendingResets = readPendingMemoryResets(directory, sessionID);
    if (!pendingResets.some((marker) => marker.file === ownMarker)) return { applied: false };
    clearPendingResets = pendingResets;
    const previous = state.sessions[sessionID];
    const effectiveReason = strongestMemoryResetReason(
      reason,
      previous?.nextReason,
      ...pendingResets.map((marker) => marker.reason),
    ) || reason;
    delete state.sessions[sessionID];
    state.sessions[sessionID] = { seen: [], nextReason: effectiveReason, updatedAt: Date.now() };
    while (Object.keys(state.sessions).length > 128) {
      delete state.sessions[Object.keys(state.sessions)[0]];
    }
    return { applied: true, reason: effectiveReason };
  }, (update) => update.applied,
  () => {
    for (const marker of clearPendingResets) fs.rmSync(marker.file, { force: true });
  });
  return result !== null;
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

function referencesForContext(context) {
  return MEMORY_CONTEXT_GROUPS.flatMap((group) => (context?.[group] || []).map((node) => ({
    id: node.id,
    type: node.type,
    scope: node.scope,
  })));
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
      const [state, decide, prompt, workflowSettings] = await Promise.all([
        import(pathToFileURL(path.join(dir, 'state.js')).href),
        import(pathToFileURL(path.join(dir, 'decide.js')).href),
        import(pathToFileURL(path.join(dir, 'prompt.js')).href),
        import(pathToFileURL(path.join(dir, 'workflow-settings.js')).href),
      ]);
      return { state, decide, prompt, workflowSettings };
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

async function loadParallelEngine() {
  const candidates = [
    path.join(pluginDir, '..', 'orchestrator'),
    path.join(pluginDir, '..', '..', 'orchestrator'),
  ];
  for (const dir of candidates) {
    const coreFile = path.join(dir, 'parallel.js');
    const storeFile = path.join(dir, 'parallel-store.js');
    if (!fs.existsSync(coreFile) || !fs.existsSync(storeFile)) continue;
    const [parallel, store] = await Promise.all([
      import(pathToFileURL(coreFile).href),
      import(pathToFileURL(storeFile).href),
    ]);
    return { parallel, store };
  }
  return null;
}

function gitOutput(directory, ...args) {
  return execFileSync('git', ['-C', directory, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 1024 * 1024,
  }).trim();
}

function gitIdentity(directory) {
  const projectRoot = path.resolve(directory);
  const topLevel = gitOutput(projectRoot, 'rev-parse', '--path-format=absolute', '--show-toplevel');
  if (path.resolve(topLevel) !== projectRoot) {
    throw new TypeError('Orchestrator directory must be the exact Git top-level before code worktree preflight');
  }
  return {
    topLevel: path.resolve(topLevel),
    commonDir: path.resolve(gitOutput(projectRoot, 'rev-parse', '--path-format=absolute', '--git-common-dir')),
    head: gitOutput(projectRoot, 'rev-parse', 'HEAD'),
  };
}

function verifyCodeWorktree(directory, worktreePath, expectedBaseCommit) {
  if (typeof worktreePath !== 'string' || !path.isAbsolute(worktreePath)
    || path.resolve(worktreePath) !== worktreePath || worktreePath === path.parse(worktreePath).root) {
    throw new TypeError('Code worktree path must be a normalized absolute path');
  }
  const primary = gitIdentity(directory);
  const realWorktreePath = fs.realpathSync(worktreePath);
  if (realWorktreePath !== worktreePath) throw new TypeError('Code worktree path must identify its exact Git top-level without symlink aliases');
  const topLevel = path.resolve(gitOutput(worktreePath, 'rev-parse', '--path-format=absolute', '--show-toplevel'));
  if (topLevel !== worktreePath) throw new TypeError('Assigned code worktree path is not its exact Git top-level');
  if (topLevel === primary.topLevel) throw new TypeError('Code task worktree must be separate from the primary checkout');
  const commonDir = path.resolve(gitOutput(worktreePath, 'rev-parse', '--path-format=absolute', '--git-common-dir'));
  if (commonDir !== primary.commonDir) throw new TypeError('Code task worktree must share the primary repository Git common directory');
  const head = gitOutput(worktreePath, 'rev-parse', 'HEAD');
  if (head !== expectedBaseCommit) throw new TypeError('Code task worktree HEAD does not match its recorded base commit');
  if (gitOutput(worktreePath, 'status', '--porcelain', '--untracked-files=all')) {
    throw new TypeError('Code task worktree must be clean before dispatch');
  }
  return { topLevel, commonDir, baseCommit: head };
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function workflowRunId(workflow, { includeCompleted = false } = {}) {
  const history = Array.isArray(workflow?.history) ? workflow.history : [];
  let runStartIndex = -1;
  let boundaryIndex = -1;
  for (let index = 0; index < history.length; index += 1) {
    const event = history[index]?.event;
    if (event === 'run_start' && history[index]?.to === 'coding') runStartIndex = index;
    if (['new_task', 'abort'].includes(event)) boundaryIndex = index;
  }
  if (runStartIndex < 0 || boundaryIndex > runStartIndex
    || !(includeCompleted
      ? ['coding', 'verifying', 'debugging', 'completed']
      : ['coding', 'verifying', 'debugging']).includes(workflow?.state)) return null;
  const timestamp = history[runStartIndex]?.ts;
  if (!Number.isSafeInteger(timestamp) || timestamp < 0) return null;
  return `workflow-${timestamp}`;
}

function creatableWorkflowRunId(workflow) {
  const history = Array.isArray(workflow?.history) ? workflow.history : [];
  const latest = history.at(-1);
  if (workflow?.state !== 'coding' || latest?.event !== 'run_start' || latest?.to !== 'coding'
    || !Number.isSafeInteger(latest.ts) || latest.ts < 0) return null;
  return `workflow-${latest.ts}`;
}

function parallelRunBindingFiles(directory, runId) {
  const runDirectory = path.join(directory, '.specs', 'state', 'parallel-runs');
  return {
    manifest: path.join(runDirectory, `${runId}.json`),
    binding: path.join(runDirectory, `${runId}.bound`),
  };
}

function recordParallelRunBinding(directory, runId) {
  const { binding } = parallelRunBindingFiles(directory, runId);
  fs.mkdirSync(path.dirname(binding), { recursive: true });
  let fd;
  try {
    fd = fs.openSync(binding, 'wx', 0o600);
    fs.writeFileSync(fd, `${JSON.stringify({ version: 1, runId })}\n`, 'utf8');
    fs.fsyncSync(fd);
  } catch (err) {
    if (err.code === 'EEXIST') return false;
    throw err;
  } finally {
    if (fd !== undefined) {
      try { fs.closeSync(fd); } catch { /* preserve the original result */ }
    }
  }
  return true;
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
      return { specs: { enabled: true }, verify: { enabled: true }, memory: { autoInject: true } };
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
  let parallelPromise = null;
  const parallelEngine = async () => {
    if (!parallelPromise) parallelPromise = loadParallelEngine();
    return parallelPromise;
  };
  const parallelTransitionRejection = async (workflow, nextWorkflow) => {
    if (!['verifying', 'completed'].includes(nextWorkflow?.state)) return null;
    // Use the pre-transition workflow so verify_pass retains its run binding.
    // An imported/legacy completed workflow can also be forced back to verify;
    // derive that run only for this transition, without widening normal
    // parallel_run_* active-run access after completion.
    const completedForceVerify = workflow?.state === 'completed'
      && nextWorkflow?.state === 'verifying'
      && nextWorkflow.history?.at(-1)?.event === 'force';
    const runId = workflowRunId(workflow, { includeCompleted: completedForceVerify });
    if (!runId) return null;

    const { manifest: manifestPath, binding: bindingPath } = parallelRunBindingFiles(directory, runId);
    const isBound = (file) => {
      try {
        fs.lstatSync(file);
        return true;
      } catch (err) {
        // Only a definite absence means no DAG. Permission and filesystem
        // errors are uncertainty and therefore fail closed for this run.
        return err.code !== 'ENOENT';
      }
    };
    if (!isBound(manifestPath) && !isBound(bindingPath)) return null;

    let engine;
    try { engine = await parallelEngine(); } catch { /* handled as unavailable below */ }
    if (!engine) {
      return {
        ok: false,
        error: `Parallel DAG ${runId} is unavailable; cannot enter ${nextWorkflow.state}`,
        state: workflow.state,
        runStatus: 'unavailable',
      };
    }

    let manifest;
    try { manifest = engine.store.loadRunManifest(directory, runId); } catch {
      return {
        ok: false,
        error: `Parallel DAG ${runId} is unavailable or unreadable; cannot enter ${nextWorkflow.state}`,
        state: workflow.state,
        runStatus: 'unavailable',
      };
    }
    if (!manifest) {
      return {
        ok: false,
        error: `Parallel DAG ${runId} is missing; cannot enter ${nextWorkflow.state}`,
        state: workflow.state,
        runStatus: 'missing',
      };
    }
    if (manifest.status !== 'completed') {
      return {
        ok: false,
        error: `Parallel DAG ${runId} must be completed and integrated before entering ${nextWorkflow.state}`,
        state: workflow.state,
        runStatus: manifest.status,
      };
    }
    return null;
  };
  const parallelTool = (handler, { create = false } = {}) => async (args, context = {}) => {
    if (typeof context?.sessionID !== 'string' || !context.sessionID.trim()
      || typeof context?.agent !== 'string' || !context.agent.trim()) {
      return JSON.stringify({ ok: false, error: 'Parallel run tools require nonempty primary sessionID and agent caller identity.' });
    }
    if (isWorkerContext(context.sessionID, context.agent)
      || await isMetadataChildSession(context.sessionID)) {
      return JSON.stringify({ ok: false, error: 'Task workers cannot inspect or mutate primary-owned parallel runs.' });
    }
    try {
      const allowedArgs = new Set([
        'runId', 'subtasks', 'taskId', 'worktreePath', 'baseCommit', 'goal', 'condition',
        'outcome', 'evidence', 'primaryReviewed', 'hostConfirmed', 'expectedToken',
      ]);
      for (const key of Object.keys(args || {})) {
        if (!allowedArgs.has(key)) throw new TypeError(`Unknown parallel tool argument: ${key}`);
      }
      const workflowCore = await core();
      if (!workflowCore) throw new Error('orchestrator core not available');
      const workflow = workflowCore.state.load(directory);
      const runId = create ? creatableWorkflowRunId(workflow) : workflowRunId(workflow);
      if (create) {
        if (!runId) throw new TypeError('parallel_run_create requires a coding workflow whose latest event is run_start');
        if (Object.hasOwn(args || {}, 'runId')) throw new TypeError('Parallel run ID is derived from the current workflow and cannot be supplied');
      } else {
        if (!runId) throw new TypeError('There is no active workflow run bound to a parallel DAG');
        if (args?.runId !== runId) throw new TypeError(`Parallel run ID is not bound to the current workflow (expected ${runId})`);
      }
      const engine = await parallelEngine();
      if (!engine) throw new Error('parallel DAG core not available');
      return JSON.stringify(await handler(engine, args || {}, runId, workflow, workflowCore));
    } catch (err) {
      return JSON.stringify({ ok: false, error: String(err && err.message ? err.message : err) });
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
    const eventSessionID = sessionIdFrom(event);
    const sessionID = eventSessionID || activeSessionID || 'unknown';
    const sessionIDSource = eventSessionID ? 'event' : 'fallback';
    const compactedDiagnostic = (outcome) => append({
      ts: Date.now(),
      type: 'session-compacted',
      outcome,
      sessionFingerprint: sessionFingerprint(sessionID),
      sessionIDSource,
    });
    compactedDiagnostic('received');
    if (childSessions.has(sessionID)) {
      compactedDiagnostic('skipped-child');
      return;
    }
    storeSessionInjectionState(sessionCacheKey(sessionID), { seen: new Set(), nextReason: 'compacted' });
    let reset;
    try {
      reset = await resetPersistentMemoryReferences(directory, sessionID, 'compacted');
    } catch {
      compactedDiagnostic('reset-error');
      return;
    }
    compactedDiagnostic(reset ? 'reset-success' : 'reset-timeout');
    try {
      const c = await core();
      if (!c) return;
      const wf = c.state.load(directory);
      memoryContext = await loadContext(wf.goal || wf.activeTask || '');
      latest = wf;
    } catch {
      append({ ts: Date.now(), type: 'orchestrator-error', operation: 'session-compacted-refresh', failure: 'thrown' });
    }
  };

  const loadContext = async (task) => {
    const settingsCore = await core();
    if (settingsCore && workflowPreferences(settingsCore).memory?.autoInject === false) {
      return {
        project_preferences: [], global_preferences: [], related_global_preferences: [],
        superseded_global_preferences: [], count: 0,
      };
    }
    if (!memoryPromise) {
      memoryPromise = loadMemoryEngine().catch((err) => {
        append({ ts: Date.now(), type: 'orchestrator-error', error: String(err && err.message ? err.message : err) });
        return null;
      });
    }
    const e = await memoryPromise;
    if (!e) return null;
    try {
      // Preserve task-start initialization while avoiding writes for read-only
      // turns; automatic project preferences come only from this directory's vault.
      const projectVault = task ? e.vault.initVault(directory) : e.vault.projectVaultDir(directory);
      const [projectPreferences, globalPreferences] = await Promise.all([
        e.tools.memoryGetProjectPreferences(projectVault),
        e.tools.memoryGetGlobalPreferences(e.vault.userVaultDir(), { complete: true }),
      ]);
      return {
        project_preferences: projectPreferences.preferences || [],
        global_preferences: globalPreferences.preferences,
        related_global_preferences: globalPreferences.relatedPreferences || [],
        superseded_global_preferences: globalPreferences.relatedSuperseded || [],
        count: (projectPreferences.preferences || []).length
          + (globalPreferences.preferences || []).length
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
          const rejected = await parallelTransitionRejection(wf, applied);
          if (rejected) return;
          next = applied;
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
          const rejected = await parallelTransitionRejection(wf, applied);
          if (rejected) return rejected;
          c.state.save(directory, applied);
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

  const parallelTools = {
    parallel_run_create: {
      description: 'Create the one deterministic primary-owned subtask DAG for the current coding workflow, immediately after run_start. Its run ID is derived from workflow history; callers cannot choose one. Supply a nonempty goal and verifiable condition for each task; these are returned only to the caller and are never persisted. This does not spawn Tasks.',
      args: {
        subtasks: {
          type: 'array',
          description: 'DAG task declarations; every task needs an ephemeral goal and condition',
          items: { type: 'object', properties: {
            id: { type: 'string' }, dependsOn: { type: 'array', items: { type: 'string' } },
            mode: { type: 'string', enum: ['read-only', 'code'] },
            ownedPaths: { type: 'array', items: { type: 'string' } },
            goal: { type: 'string' }, condition: { type: 'string' },
          }, required: ['id', 'mode', 'ownedPaths', 'goal', 'condition'], additionalProperties: false },
        },
      },
      execute: parallelTool(async ({ parallel, store }, args, runId) => {
        if (!Array.isArray(args.subtasks) || !args.subtasks.length) throw new TypeError('subtasks must be a nonempty array');
        const ephemeral = [];
        const declarations = args.subtasks.map((task, index) => {
          if (!task || typeof task !== 'object' || Array.isArray(task)) throw new TypeError(`Subtask ${index} must be an object`);
          const allowed = ['id', 'dependsOn', 'mode', 'ownedPaths', 'goal', 'condition'];
          for (const key of Object.keys(task)) if (!allowed.includes(key)) throw new TypeError(`Unknown subtask ${index} field: ${key}`);
          if (typeof task.goal !== 'string' || !task.goal.trim()
            || typeof task.condition !== 'string' || !task.condition.trim()) {
            throw new TypeError(`Subtask ${task.id ?? index} requires nonempty goal and condition`);
          }
          ephemeral.push({ id: task.id, goal: task.goal, condition: task.condition });
          return {
            id: task.id,
            dependsOn: task.dependsOn,
            mode: task.mode,
            ownedPaths: task.ownedPaths,
          };
        });
        const manifest = parallel.createRunManifest(runId, declarations);
        // Keep a durable, tiny binding record so deletion of the run manifest
        // cannot make an already-bound workflow indistinguishable from an
        // ordinary no-DAG workflow after plugin restart.
        const createdBinding = recordParallelRunBinding(directory, runId);
        try {
          store.createRunManifestExclusive(directory, manifest);
        } catch (err) {
          if (createdBinding) {
            const { manifest: manifestPath, binding: bindingPath } = parallelRunBindingFiles(directory, runId);
            try {
              fs.lstatSync(manifestPath);
            } catch (missing) {
              if (missing.code === 'ENOENT') {
                try { fs.rmSync(bindingPath); } catch { /* preserve the create error */ }
              }
            }
          }
          throw err;
        }
        return { ok: true, runId, run: manifest, ready: parallel.readySubtasks(manifest), taskRequirements: ephemeral };
      }, { create: true }),
    },
    parallel_run_get: {
      description: 'Inspect one persisted DAG manifest and its currently ready deterministic dispatch batch. Primary context only.',
      args: { runId: { type: 'string' } },
      execute: parallelTool(async ({ parallel, store }, args) => {
        const run = store.loadRunManifest(directory, args.runId);
        if (!run) throw new TypeError(`Parallel run not found: ${args.runId}`);
        return { ok: true, run, ready: parallel.readySubtasks(run) };
      }),
    },
    parallel_run_lock_inspect: {
      description: 'Inspect the bounded lock marker for the current workflow-bound parallel run. Inspection never modifies or steals a lock. Primary context only.',
      args: { runId: { type: 'string' } },
      execute: parallelTool(async ({ store }, args) => ({
        ok: true,
        marker: store.inspectRunManifestLock(directory, args.runId),
      })),
    },
    parallel_run_lock_recover: {
      description: 'Explicitly recover a stale same-host lock only after primary review and supplying the exact token returned by lock inspection. The store refuses live, changed, or unprovably stale owners. Primary context only.',
      args: {
        runId: { type: 'string' },
        primaryReviewed: { type: 'boolean' },
        expectedToken: { type: 'string', description: 'exact token from parallel_run_lock_inspect' },
      },
      execute: parallelTool(async ({ store }, args) => {
        if (args.primaryReviewed !== true) {
          throw new TypeError('Primary review confirmation is required to recover a stale run lock');
        }
        if (typeof args.expectedToken !== 'string') {
          throw new TypeError('Expected lock token from inspection is required for recovery');
        }
        return {
          ok: true,
          ...store.recoverRunManifestLock(directory, args.runId, {
            primaryConfirmed: true,
            expectedToken: args.expectedToken,
          }),
        };
      }),
    },
    parallel_task_preflight: {
      description: 'Verify and persist the exact separate, clean Git worktree for a ready code task. It must share the project Git common directory and start at the project HEAD; a shared checkout is rejected.',
      args: {
        runId: { type: 'string' }, taskId: { type: 'string' },
        worktreePath: { type: 'string', description: 'exact normalized absolute Git worktree top-level' },
        baseCommit: { type: 'string', description: 'optional expected project HEAD; when supplied it must match exactly' },
      },
      execute: parallelTool(async ({ parallel, store }, args) => {
        const before = store.loadRunManifest(directory, args.runId);
        if (!before) throw new TypeError(`Parallel run not found: ${args.runId}`);
        const primary = gitIdentity(directory);
        if (args.baseCommit != null && args.baseCommit !== primary.head) {
          throw new TypeError('Requested base commit does not match the primary checkout HEAD');
        }
        const identity = verifyCodeWorktree(directory, args.worktreePath, primary.head);
        const run = store.updateRunManifest(directory, args.runId, (current) => parallel.recordCodeWorktree(
          current, args.taskId, { baseCommit: identity.baseCommit, worktreePath: identity.topLevel },
        ));
        return { ok: true, run, taskId: args.taskId, worktree: identity };
      }),
    },
    parallel_task_start: {
      description: 'Start a ready DAG task. Read-only tasks may start directly. Code tasks must first pass worktree preflight and are rechecked against their recorded base immediately before start. Returns a dispatch contract for the primary to use with native Task; this tool never spawns a Task.',
      args: {
        runId: { type: 'string' }, taskId: { type: 'string' },
        goal: { type: 'string', description: 'required nonempty task goal; not persisted' },
        condition: { type: 'string', description: 'required nonempty verifiable condition; not persisted' },
      },
      execute: parallelTool(async ({ parallel, store }, args) => {
        if (typeof args.goal !== 'string' || !args.goal.trim()
          || typeof args.condition !== 'string' || !args.condition.trim()) {
          throw new TypeError('Task start requires nonempty goal and condition');
        }
        const before = store.loadRunManifest(directory, args.runId);
        if (!before) throw new TypeError(`Parallel run not found: ${args.runId}`);
        const task = before.tasks.find((entry) => entry.id === args.taskId);
        if (!task) throw new TypeError(`Unknown subtask ID: ${args.taskId}`);
        if (task.mode === 'code' && (!task.baseCommit || !task.worktreePath)) {
          throw new TypeError(`Code subtask ${task.id} requires worktree preflight before dispatch`);
        }
        const worktree = task.mode === 'code'
          ? verifyCodeWorktree(directory, task.worktreePath, task.baseCommit)
          : null;
        const run = store.updateRunManifest(directory, args.runId, (current) => parallel.transitionSubtask(
          current, args.taskId, 'running',
        ));
        return {
          ok: true,
          run,
          dispatchContract: {
            runId: args.runId,
            taskId: args.taskId,
            mode: task.mode,
            goal: args.goal,
            condition: args.condition,
            ownedPaths: task.ownedPaths,
            ...(worktree ? {
              worktreePath: worktree.topLevel,
              baseCommit: worktree.baseCommit,
              commonDir: worktree.commonDir,
              beforeEdits: `Before any edits, verify git -C ${shellQuote(worktree.topLevel)} rev-parse --show-toplevel equals ${worktree.topLevel}, git -C ${shellQuote(worktree.topLevel)} rev-parse --path-format=absolute --git-common-dir equals ${worktree.commonDir}, git -C ${shellQuote(worktree.topLevel)} rev-parse HEAD equals ${worktree.baseCommit}, and git -C ${shellQuote(worktree.topLevel)} status --porcelain --untracked-files=all is empty. Stop without editing if any check differs.`,
            } : {
              beforeEdits: 'This task is read-only. Do not edit files.',
            }),
          },
        };
      }),
    },
    parallel_task_outcome: {
      description: 'Record a worker outcome using bounded evidence IDs only. Code success becomes integration-pending, never integrated; only primary review can integrate it.',
      args: {
        runId: { type: 'string' }, taskId: { type: 'string' },
        outcome: { type: 'string', enum: ['completed', 'integration-pending', 'failed', 'cancel-requested'] },
        evidence: { type: 'array', items: { type: 'string' } },
      },
      execute: parallelTool(async ({ parallel, store }, args) => {
        const run = store.updateRunManifest(directory, args.runId, (current) => parallel.transitionSubtask(
          current, args.taskId, args.outcome, { evidence: args.evidence },
        ));
        return { ok: true, run, ready: parallel.readySubtasks(run) };
      }),
    },
    parallel_task_integrate: {
      description: 'Primary-owned integration gate for code tasks. Requires an explicit primaryReviewed=true confirmation after reviewing the isolated worktree.',
      args: {
        runId: { type: 'string' }, taskId: { type: 'string' }, primaryReviewed: { type: 'boolean' },
        evidence: { type: 'array', items: { type: 'string' } },
      },
      execute: parallelTool(async ({ parallel, store }, args) => {
        if (args.primaryReviewed !== true) throw new TypeError('Primary review confirmation is required to integrate code');
        const run = store.updateRunManifest(directory, args.runId, (current) => parallel.integrateCodeSubtask(
          current, args.taskId, { primaryReviewed: true, evidence: args.evidence },
        ));
        return { ok: true, run, ready: parallel.readySubtasks(run) };
      }),
    },
    parallel_run_cancel: {
      description: 'Request cancellation of a run. No host cancellation handle is available here: running tasks remain cancel-requested and reserve capacity until host termination is confirmed or a primary reconciles the outcome.',
      args: { runId: { type: 'string' } },
      execute: parallelTool(async ({ parallel, store }, args) => {
        const run = store.updateRunManifest(directory, args.runId, (current) => parallel.cancelRun(current));
        return { ok: true, run, ready: parallel.readySubtasks(run) };
      }),
    },
    parallel_task_confirm_termination: {
      description: 'Release a cancel-requested task only after explicit host-confirmed termination. This plugin has no host cancellation handle and cannot itself assert termination.',
      args: { runId: { type: 'string' }, taskId: { type: 'string' }, hostConfirmed: { type: 'boolean' } },
      execute: parallelTool(async ({ parallel, store }, args) => {
        if (args.hostConfirmed !== true) throw new TypeError('Host termination confirmation is required');
        const run = store.updateRunManifest(directory, args.runId, (current) => parallel.confirmTaskTermination(
          current, args.taskId, { hostConfirmed: true },
        ));
        return { ok: true, run, ready: parallel.readySubtasks(run) };
      }),
    },
    parallel_run_reconcile: {
      description: 'After restart, mark persisted running tasks needs-reconciliation. This does not claim worker termination; those tasks continue reserving parallel capacity until individually reconciled.',
      args: { runId: { type: 'string' }, primaryReviewed: { type: 'boolean' } },
      execute: parallelTool(async ({ parallel, store }, args) => {
        if (args.primaryReviewed !== true) throw new TypeError('Primary confirmation is required to reconcile a run after restart');
        const run = store.updateRunManifest(directory, args.runId, (current) => current.tasks
          .filter((task) => task.status === 'running')
          .reduce((next, task) => parallel.markNeedsReconciliation(next, task.id, {
            now: Math.max(Date.now(), next.updatedAt),
          }), current));
        return { ok: true, run, ready: parallel.readySubtasks(run) };
      }),
    },
    parallel_task_reconcile: {
      description: 'Resolve a cancel-requested or needs-reconciliation task after primary review of its actual outcome. This records a reviewed outcome, not host cancellation.',
      args: {
        runId: { type: 'string' }, taskId: { type: 'string' }, primaryReviewed: { type: 'boolean' },
        outcome: { type: 'string', enum: ['completed', 'integration-pending', 'failed', 'cancelled'] },
        evidence: { type: 'array', items: { type: 'string' } },
      },
      execute: parallelTool(async ({ parallel, store }, args) => {
        if (args.primaryReviewed !== true) throw new TypeError('Primary reconciliation confirmation is required');
        const run = store.updateRunManifest(directory, args.runId, (current) => parallel.reconcileSubtask(
          current, args.taskId, {
            primaryReviewed: true, outcome: args.outcome, evidence: args.evidence,
          },
        ));
        return { ok: true, run, ready: parallel.readySubtasks(run) };
      }),
    },
    parallel_task_retry: {
      description: 'Retry only a confirmed failed task after explicit primary review. Code tasks must pass a fresh worktree preflight before their next start.',
      args: { runId: { type: 'string' }, taskId: { type: 'string' }, primaryReviewed: { type: 'boolean' } },
      execute: parallelTool(async ({ parallel, store }, args) => {
        if (args.primaryReviewed !== true) throw new TypeError('Primary review confirmation is required to retry a failed task');
        const run = store.updateRunManifest(directory, args.runId, (current) => parallel.retrySubtask(
          current, args.taskId, { primaryReviewed: true },
        ));
        return { ok: true, run, ready: parallel.readySubtasks(run) };
      }),
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
    tool: { ...workflowTools, ...parallelTools },

    // Session lifecycle arrives through OpenCode's generic event hook.
    event: async ({ event } = {}) => {
      if (event?.type === 'session.created') await handleSessionCreated(event);
      if (event?.type === 'session.compacted') await handleSessionCompacted(event);
      if (event?.type === 'session.compaction.ended') await handleSessionCompacted(event);
    },

    eventStreamFailure: ({ failure, attempt, delayMs }) => {
      if ((failure !== 'thrown' && failure !== 'terminated')
        || !Number.isSafeInteger(attempt) || attempt < 1
        || !Number.isSafeInteger(delayMs) || delayMs < 0) return;
      append({ ts: Date.now(), type: 'orchestrator-error', operation: 'event-stream', failure, action: 'reconnect', attempt, delayMs });
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
        const memoryReferences = referencesForContext(memoryContext);
        const preferences = workflowPreferences(c);
        const configuredBudget = preferences.memory?.preferenceInjectionBudgetTokens;
        const modelContext = input?.model?.limit?.context;
        const usableConfigured = Number.isSafeInteger(configuredBudget) && configuredBudget > 0 ? configuredBudget : null;
        const usableModelContext = Number.isSafeInteger(modelContext) && modelContext > 0 ? modelContext : null;
        const effectiveBudget = usableConfigured != null && usableModelContext != null
          ? Math.min(usableConfigured, usableModelContext)
          : usableConfigured ?? usableModelContext;
        let memoryNotice;
        let claim = { memories: [], eligible: [], reason: sessionMemory.nextReason };
        let pendingMemoryContext = null;
        const noInjectionRepair = 'Tell the user that no saved preference text was injected, and do not imply that saved preferences were applied. To enable injection, set or raise `memory.preferenceInjectionBudgetTokens` with `guarana workflow set memory.preferenceInjectionBudgetTokens <positive-integer>`; add `--project` for a project override.';
        const raiseBudgetAdvice = 'To include more complete records, raise `memory.preferenceInjectionBudgetTokens` with `guarana workflow set memory.preferenceInjectionBudgetTokens <positive-integer>`; add `--project` for a project override.';
        if (preferences.memory?.autoInject === false) {
          memoryNotice = 'Automatic memory preference injection is disabled for this scope. No saved preference text was included. On-demand memory search remains available.';
        } else if (memoryReferences.length) {
          let fittedMemoryContext = null;
          claim = await claimMemoryReferences(
            directory,
            sessionID,
            memoryReferences,
            sessionMemory.nextReason,
            (eligible) => {
              if (effectiveBudget == null) return [];
              const fit = c.prompt.fitMemoryPayload(
                contextForReferences(memoryContext, eligible), effectiveBudget,
              );
              fittedMemoryContext = fit.context;
              return referencesForContext(fit.context);
            },
            [...seen],
          ) || { memories: [], eligible: [], reason: sessionMemory.nextReason };
          pendingMemoryContext = contextForReferences(fittedMemoryContext || memoryContext, claim.memories);
          const injectedCount = claim.memories.length;
          const eligibleCount = claim.eligible.length;
          const omittedCount = eligibleCount - injectedCount;
          if (eligibleCount && effectiveBudget == null) {
            memoryNotice = `Project and Global preferences were not injected because no usable configured token budget or model context limit is available. Injected: 0; omitted: ${eligibleCount} eligible unseen records. No preference text was included. ${noInjectionRepair}`;
          } else if (eligibleCount && injectedCount === 0) {
            memoryNotice = `No preferences were injected: none of the ${eligibleCount} eligible unseen records fit the ${effectiveBudget}-token estimated budget. Injected: 0; omitted: ${omittedCount}. UTF-8 serialized bytes are only an estimate, not exact tokenization or remaining conversation capacity. No preference text was included. ${noInjectionRepair}`;
          } else if (eligibleCount) {
            memoryNotice = `Project and Global preference injection counts: injected ${injectedCount}; omitted ${omittedCount} of ${eligibleCount} eligible unseen records. Complete records that do not fit are skipped without truncation. UTF-8 serialized bytes are only an estimate, not exact tokenization or remaining conversation capacity.${omittedCount ? ` ${raiseBudgetAdvice}` : ''}`;
          }
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

    'session.compaction.ended': async (event) => {
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
  void consumeEventStreamWithReconnect({
    subscribe: ({ signal }) => ctx.event.subscribe({ signal }),
    onEvent: (event) => hooks.event({ event }),
    signal: controller.signal,
    onFailure: (diagnostic) => hooks.eventStreamFailure(diagnostic),
  });
  return () => controller.abort();
}

export default {
  id: 'guarana.orchestrator',
  setup: setupGuaranaOrchestrator,
  // V1 calls server(ctx); V2 calls setup(ctx).
  server: async (ctx = {}) => GuaranaOrchestrator({ directory: ctx.directory || process.cwd() }),
};
