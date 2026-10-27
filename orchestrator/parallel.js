import path from 'node:path';

// Bounded, side-effect-free core for parallel subtask DAGs.
// Manifests contain identifiers, modes, path ownership, code-worktree identity,
// status, and bounded evidence references only—never prompts or worker outputs.

export const RUN_MANIFEST_VERSION = 1;
export const MAX_SUBTASKS = 32;
export const MAX_DEPENDENCIES = 16;
export const MAX_PARALLEL_SUBTASKS = 2;
export const MAX_EVIDENCE_REFERENCES = 8;
export const MAX_OWNED_PATHS = 16;
export const MAX_OWNED_PATH_LENGTH = 256;
export const MAX_TASK_ATTEMPTS = 3;
export const ACTIVE_TASK_STATUSES = Object.freeze(['running', 'cancel-requested', 'needs-reconciliation']);

const ID_PATTERN = /^[a-z][a-z0-9-]{0,47}$/;
const MODES = ['read-only', 'code'];
const TASK_STATUSES = [
  'pending', 'running', 'integration-pending', 'integrated', 'completed', 'failed', 'blocked',
  'cancel-requested', 'cancelled', 'needs-reconciliation',
];
const RUN_STATUSES = [
  'pending', 'running', 'integration-pending', 'needs-reconciliation', 'cancel-requested',
  'completed', 'failed', 'blocked', 'cancelled',
];
const ATTEMPT_STATUSES = [
  'running', 'integration-pending', 'completed', 'failed', 'cancel-requested',
  'needs-reconciliation', 'cancelled',
];
const GIT_COMMIT_PATTERN = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;

function assertRecord(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
}

function assertOnlyKeys(value, allowed, label) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) throw new TypeError(`Unknown ${label} field: ${key}`);
  }
}

export function isStableSubtaskId(value) {
  return typeof value === 'string' && ID_PATTERN.test(value);
}

function assertStableId(value, label) {
  if (!isStableSubtaskId(value)) {
    throw new TypeError(`${label} must be a stable lowercase kebab-case ID`);
  }
}

function assertTimestamp(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${label} must be a non-negative safe integer`);
  }
}

function validateOwnedPaths(ownedPaths, taskId) {
  if (!Array.isArray(ownedPaths) || ownedPaths.length > MAX_OWNED_PATHS) {
    throw new TypeError(`ownedPaths for ${taskId} must contain at most ${MAX_OWNED_PATHS} repo-relative paths`);
  }
  const unique = new Set();
  for (const ownedPath of ownedPaths) {
    if (typeof ownedPath !== 'string' || ownedPath.length < 1 || ownedPath.length > MAX_OWNED_PATH_LENGTH
      || /[\u0000-\u001f\u007f\\]/.test(ownedPath) || ownedPath.startsWith('/')
      || /^[a-zA-Z]:/.test(ownedPath)) {
      throw new TypeError(`Invalid repo-relative owned path for ${taskId}`);
    }
    const segments = ownedPath.split('/');
    if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
      throw new TypeError(`ownedPath for ${taskId} must not escape or alias the repository root`);
    }
    if (unique.has(ownedPath)) throw new TypeError(`Duplicate owned path for ${taskId}: ${ownedPath}`);
    unique.add(ownedPath);
  }
  return [...unique].sort();
}

function validateCodeWorktree(baseCommit, worktreePath, taskId) {
  if (typeof baseCommit !== 'string' || !GIT_COMMIT_PATTERN.test(baseCommit)) {
    throw new TypeError(`baseCommit for ${taskId} must be a full lowercase Git commit ID`);
  }
  if (typeof worktreePath !== 'string' || worktreePath.length > 1024
    || /[\u0000-\u001f\u007f]/.test(worktreePath) || !path.isAbsolute(worktreePath)
    || path.resolve(worktreePath) !== worktreePath || worktreePath === path.parse(worktreePath).root) {
    throw new TypeError(`worktreePath for ${taskId} must be a normalized absolute path`);
  }
}

function pathsOverlap(left, right) {
  return left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`);
}

export function isActiveTaskStatus(status) {
  return ACTIVE_TASK_STATUSES.includes(status);
}

function dependenciesSatisfied(task, tasksById) {
  return task.dependsOn.every((dependencyId) => taskSucceeded(tasksById.get(dependencyId)));
}

function taskSucceeded(task) {
  return task.mode === 'code' ? task.status === 'integrated' : task.status === 'completed';
}

function validateAttemptHistory(attempts, history, mode, taskId) {
  if (!Number.isSafeInteger(attempts) || attempts < 0 || attempts > MAX_TASK_ATTEMPTS
    || !Array.isArray(history) || history.length !== attempts) {
    throw new TypeError(`Attempt count/history for ${taskId} must be bounded and consistent`);
  }
  return history.map((attempt, index) => {
    assertRecord(attempt, `Attempt ${index + 1} for ${taskId}`);
    assertOnlyKeys(attempt, ['attempt', 'startedAt', 'endedAt', 'status', 'baseCommit', 'worktreePath'],
      `attempt ${index + 1} for ${taskId}`);
    if (attempt.attempt !== index + 1 || !ATTEMPT_STATUSES.includes(attempt.status)) {
      throw new TypeError(`Invalid attempt record for ${taskId}`);
    }
    assertTimestamp(attempt.startedAt, `Attempt ${index + 1} startedAt`);
    if (attempt.endedAt !== null) {
      assertTimestamp(attempt.endedAt, `Attempt ${index + 1} endedAt`);
      if (attempt.endedAt < attempt.startedAt) throw new TypeError(`Attempt ${index + 1} ended before it started`);
    }
    const active = ['running', 'cancel-requested', 'needs-reconciliation'].includes(attempt.status);
    if ((active && attempt.endedAt !== null) || (!active && attempt.endedAt === null)) {
      throw new TypeError(`Attempt ${index + 1} timestamps do not match its status`);
    }
    const hasBaseCommit = Object.hasOwn(attempt, 'baseCommit');
    const hasWorktreePath = Object.hasOwn(attempt, 'worktreePath');
    if (hasBaseCommit !== hasWorktreePath || (mode === 'read-only' && hasBaseCommit)) {
      throw new TypeError(`Invalid worktree identity in attempt ${index + 1} for ${taskId}`);
    }
    if (mode === 'code' && !hasBaseCommit) {
      throw new TypeError(`Code attempt ${index + 1} for ${taskId} must retain its worktree identity`);
    }
    if (hasBaseCommit) validateCodeWorktree(attempt.baseCommit, attempt.worktreePath, taskId);
    return {
      attempt: attempt.attempt,
      startedAt: attempt.startedAt,
      endedAt: attempt.endedAt,
      status: attempt.status,
      ...(hasBaseCommit ? { baseCommit: attempt.baseCommit, worktreePath: attempt.worktreePath } : {}),
    };
  });
}

function validateUniqueCodeWorktrees(tasks) {
  const assigned = new Map();
  const claim = (worktreePath, owner) => {
    const previous = assigned.get(worktreePath);
    if (previous) {
      throw new TypeError(`Code worktree ${worktreePath} is assigned to both ${previous} and ${owner}`);
    }
    assigned.set(worktreePath, owner);
  };

  for (const task of tasks) {
    if (task.mode !== 'code') continue;
    for (const attempt of task.attemptHistory) {
      claim(attempt.worktreePath, `subtask ${task.id} attempt ${attempt.attempt}`);
    }
  }
  for (const task of tasks) {
    if (task.mode !== 'code' || !Object.hasOwn(task, 'worktreePath')) continue;
    const latestAttempt = task.attemptHistory.at(-1);
    const currentPathIsLatestAttempt = latestAttempt?.worktreePath === task.worktreePath
      && task.status !== 'pending'
      && !(task.status === 'cancelled' && latestAttempt.status === 'failed');
    if (!currentPathIsLatestAttempt) claim(task.worktreePath, `subtask ${task.id} pending preflight`);
  }
}

function updateLatestAttempt(task, status, now, finished) {
  if (task.attemptHistory.length === 0) throw new TypeError(`Subtask ${task.id} has no active attempt`);
  const history = task.attemptHistory.map((attempt, index) => index === task.attemptHistory.length - 1
    ? { ...attempt, status, endedAt: finished ? now : null }
    : attempt);
  return { ...task, attemptHistory: history };
}

function propagateBlocked(inputTasks) {
  let tasks = inputTasks;
  let changed;
  do {
    changed = false;
    const byId = new Map(tasks.map((task) => [task.id, task]));
    tasks = tasks.map((task) => {
      if (task.status !== 'pending' && !(task.status === 'blocked' && Object.hasOwn(task, 'blockedBy'))) {
        return task;
      }
      const blockers = new Set();
      if (task.status === 'blocked') {
        for (const blockerId of task.blockedBy || []) {
          if (!taskSucceeded(byId.get(blockerId))) blockers.add(blockerId);
        }
      }
      for (const dependencyId of task.dependsOn) {
        const dependency = byId.get(dependencyId);
        if (dependency.status === 'failed' || dependency.status === 'cancelled') blockers.add(dependency.id);
        if (dependency.status === 'blocked') {
          for (const blocker of dependency.blockedBy || [dependency.id]) blockers.add(blocker);
        }
      }
      const blockedBy = [...blockers].sort();
      if (task.status === 'pending' && blockedBy.length) {
        changed = true;
        return { ...task, status: 'blocked', blockedBy };
      }
      if (task.status === 'blocked' && Object.hasOwn(task, 'blockedBy')) {
        if (!blockedBy.length) {
          changed = true;
          const { blockedBy: _discard, ...unblocked } = task;
          return { ...unblocked, status: 'pending' };
        }
        if (blockedBy.join('\0') !== task.blockedBy.join('\0')) {
          changed = true;
          return { ...task, blockedBy };
        }
      }
      return task;
    });
  } while (changed);
  return tasks;
}

// Validates and canonicalizes a DAG. Sorting makes a persisted graph stable
// regardless of the order in which its declaration was assembled.
export function validateSubtaskDag(subtasks) {
  if (!Array.isArray(subtasks) || subtasks.length < 1 || subtasks.length > MAX_SUBTASKS) {
    throw new TypeError(`Subtask DAG must contain 1-${MAX_SUBTASKS} tasks`);
  }

  const tasksById = new Map();
  for (const [index, task] of subtasks.entries()) {
    assertRecord(task, `Subtask ${index}`);
    // Deliberately disallow descriptions/prompts here: the manifest stores no
    // worker instruction or response text, even if a caller passes one by mistake.
    assertOnlyKeys(task, ['id', 'dependsOn', 'mode', 'ownedPaths'], `subtask ${index}`);
    assertStableId(task.id, `Subtask ${index} ID`);
    if (tasksById.has(task.id)) throw new TypeError(`Duplicate subtask ID: ${task.id}`);
    if (!MODES.includes(task.mode)) throw new TypeError(`Subtask ${task.id} mode must be read-only or code`);
    const ownedPaths = validateOwnedPaths(task.ownedPaths, task.id);
    if (task.mode === 'code' && ownedPaths.length === 0) {
      throw new TypeError(`Code subtask ${task.id} must declare at least one ownedPath`);
    }

    const dependsOn = task.dependsOn === undefined ? [] : task.dependsOn;
    if (!Array.isArray(dependsOn) || dependsOn.length > MAX_DEPENDENCIES) {
      throw new TypeError(`Subtask ${task.id} dependencies must be an array of at most ${MAX_DEPENDENCIES} IDs`);
    }
    const uniqueDependencies = new Set();
    for (const dependency of dependsOn) {
      assertStableId(dependency, `Dependency of ${task.id}`);
      if (dependency === task.id) throw new TypeError(`Subtask ${task.id} cannot depend on itself`);
      if (uniqueDependencies.has(dependency)) {
        throw new TypeError(`Duplicate dependency ${dependency} for subtask ${task.id}`);
      }
      uniqueDependencies.add(dependency);
    }
    tasksById.set(task.id, {
      dependsOn: [...uniqueDependencies].sort(),
      mode: task.mode,
      ownedPaths,
    });
  }

  for (const [id, { dependsOn }] of tasksById) {
    for (const dependency of dependsOn) {
      if (!tasksById.has(dependency)) {
        throw new TypeError(`Unknown dependency ${dependency} for subtask ${id}`);
      }
    }
  }

  const indegree = new Map([...tasksById].map(([id, task]) => [id, task.dependsOn.length]));
  const dependents = new Map([...tasksById.keys()].map((id) => [id, []]));
  for (const [id, task] of tasksById) {
    for (const dependency of task.dependsOn) dependents.get(dependency).push(id);
  }
  const ready = [...indegree].filter(([, degree]) => degree === 0).map(([id]) => id).sort();
  let visited = 0;
  while (ready.length) {
    const id = ready.shift();
    visited += 1;
    for (const dependent of dependents.get(id)) {
      const degree = indegree.get(dependent) - 1;
      indegree.set(dependent, degree);
      if (degree === 0) {
        ready.push(dependent);
        ready.sort();
      }
    }
  }
  if (visited !== tasksById.size) throw new TypeError('Subtask dependencies contain a cycle');

  return [...tasksById]
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([id, task]) => ({ id, ...task }));
}

function validateEvidence(evidence, taskId) {
  if (!Array.isArray(evidence) || evidence.length > MAX_EVIDENCE_REFERENCES) {
    throw new TypeError(`Evidence for ${taskId} must contain at most ${MAX_EVIDENCE_REFERENCES} references`);
  }
  const seen = new Set();
  for (const reference of evidence) {
    assertStableId(reference, `Evidence reference for ${taskId}`);
    if (seen.has(reference)) throw new TypeError(`Duplicate evidence reference for ${taskId}: ${reference}`);
    seen.add(reference);
  }
  return [...seen].sort();
}

function deriveRunStatus(tasks) {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const successful = (task) => task.mode === 'code'
    ? task.status === 'integrated'
    : task.status === 'completed';
  if (tasks.every(successful)) return 'completed';
  if (tasks.some((task) => task.status === 'cancel-requested')) return 'cancel-requested';
  if (tasks.some((task) => task.status === 'needs-reconciliation')) return 'needs-reconciliation';
  if (tasks.some((task) => task.status === 'running')) return 'running';

  const hasReadyWork = tasks.some((task) => task.status === 'pending' && dependenciesSatisfied(task, byId));
  if (hasReadyWork) {
    return tasks.some((task) => task.attempts > 0 || task.status === 'failed') ? 'running' : 'pending';
  }
  if (tasks.some((task) => task.status === 'integration-pending')) return 'integration-pending';
  if (tasks.some((task) => task.status === 'failed')) return 'failed';
  if (tasks.some((task) => task.status === 'cancelled')) return 'cancelled';
  if (tasks.some((task) => task.status === 'pending')) return 'running';
  return 'blocked';
}

function normalizeManifest(manifest) {
  assertRecord(manifest, 'Run manifest');
  assertOnlyKeys(manifest, ['version', 'runId', 'createdAt', 'updatedAt', 'status', 'tasks'], 'run manifest');
  if (manifest.version !== RUN_MANIFEST_VERSION) {
    throw new TypeError(`Unsupported run manifest version: ${manifest.version}`);
  }
  assertStableId(manifest.runId, 'Run ID');
  assertTimestamp(manifest.createdAt, 'Run manifest createdAt');
  assertTimestamp(manifest.updatedAt, 'Run manifest updatedAt');
  if (manifest.updatedAt < manifest.createdAt) throw new TypeError('Run manifest updatedAt precedes createdAt');
  if (!RUN_STATUSES.includes(manifest.status)) throw new TypeError('Invalid run manifest status');
  if (!Array.isArray(manifest.tasks)) throw new TypeError('Run manifest tasks must be an array');

  const graph = validateSubtaskDag(manifest.tasks.map((task) => {
    assertRecord(task, 'Run manifest task');
    assertOnlyKeys(task, [
      'id', 'dependsOn', 'mode', 'ownedPaths', 'status', 'evidence', 'baseCommit', 'worktreePath',
      'attempts', 'attemptHistory', 'blockedBy',
    ], `run task ${task.id ?? ''}`);
    return {
      id: task.id,
      dependsOn: task.dependsOn,
      mode: task.mode,
      ownedPaths: task.ownedPaths,
    };
  }));
  const sourceTasks = new Map(manifest.tasks.map((task) => [task.id, task]));
  const tasks = graph.map(({ id, dependsOn, mode, ownedPaths }) => {
    const source = sourceTasks.get(id);
    if (!TASK_STATUSES.includes(source.status)) throw new TypeError(`Invalid status for subtask ${id}`);
    const evidence = validateEvidence(source.evidence, id);
    const attemptHistory = validateAttemptHistory(source.attempts, source.attemptHistory, mode, id);
    const attempts = source.attempts;
    const hasBaseCommit = Object.hasOwn(source, 'baseCommit');
    const hasWorktreePath = Object.hasOwn(source, 'worktreePath');
    if (hasBaseCommit !== hasWorktreePath) {
      throw new TypeError(`Code worktree preflight for ${id} must record both baseCommit and worktreePath`);
    }
    if (mode === 'read-only' && hasBaseCommit) {
      throw new TypeError(`Read-only subtask ${id} cannot record a code worktree`);
    }
    if (hasBaseCommit) validateCodeWorktree(source.baseCommit, source.worktreePath, id);
    if (mode === 'code' && [
      'running', 'integration-pending', 'integrated', 'failed', 'cancel-requested', 'needs-reconciliation',
    ].includes(source.status) && !hasBaseCommit) {
      throw new TypeError(`Code subtask ${id} requires worktree preflight before it can run`);
    }
    if (source.status === 'completed' && mode !== 'read-only') {
      throw new TypeError(`Code subtask ${id} must be integrated instead of completed`);
    }
    if (['integration-pending', 'integrated'].includes(source.status) && mode !== 'code') {
      throw new TypeError(`Read-only subtask ${id} cannot enter code integration state`);
    }
    if (source.status === 'blocked' && attempts !== 0) {
      throw new TypeError(`Blocked subtask ${id} cannot have worker attempts`);
    }
    const latestAttemptStatus = attemptHistory.at(-1)?.status;
    const expectedAttemptStatus = {
      running: 'running',
      'cancel-requested': 'cancel-requested',
      'needs-reconciliation': 'needs-reconciliation',
      'integration-pending': 'integration-pending',
      completed: 'completed',
      failed: 'failed',
    }[source.status];
    if (expectedAttemptStatus && latestAttemptStatus !== expectedAttemptStatus) {
      throw new TypeError(`Attempt history for ${id} does not match its status`);
    }
    if (source.status === 'integrated' && latestAttemptStatus !== 'integration-pending') {
      throw new TypeError(`Integrated code subtask ${id} must have a completed worker attempt`);
    }
    if (source.status === 'pending' && attempts > 0 && latestAttemptStatus !== 'failed') {
      throw new TypeError(`Retried pending subtask ${id} must follow a failed attempt`);
    }
    if (source.status === 'cancelled' && attempts > 0
      && !['cancelled', 'integration-pending', 'failed'].includes(latestAttemptStatus)) {
      throw new TypeError(`Cancelled subtask ${id} has inconsistent attempt history`);
    }
    let blockedBy;
    if (Object.hasOwn(source, 'blockedBy')) {
      if (source.status !== 'blocked' || !Array.isArray(source.blockedBy)
        || source.blockedBy.length < 1 || source.blockedBy.length > MAX_SUBTASKS) {
        throw new TypeError(`Invalid blockedBy causes for ${id}`);
      }
      const uniqueBlockers = new Set();
      for (const blocker of source.blockedBy) {
        assertStableId(blocker, `Blocked-by cause for ${id}`);
        if (blocker === id || !sourceTasks.has(blocker) || uniqueBlockers.has(blocker)) {
          throw new TypeError(`Invalid blocked-by cause ${blocker} for ${id}`);
        }
        uniqueBlockers.add(blocker);
      }
      blockedBy = [...uniqueBlockers].sort();
    }
    return {
      id,
      dependsOn,
      mode,
      ownedPaths,
      status: source.status,
      evidence,
      attempts,
      attemptHistory,
      ...(hasBaseCommit ? { baseCommit: source.baseCommit, worktreePath: source.worktreePath } : {}),
      ...(blockedBy ? { blockedBy } : {}),
    };
  });
  validateUniqueCodeWorktrees(tasks);
  const activeTasks = tasks.filter((task) => isActiveTaskStatus(task.status));
  if (activeTasks.length > MAX_PARALLEL_SUBTASKS) {
    throw new TypeError(`Run manifest exceeds the ${MAX_PARALLEL_SUBTASKS}-task parallel limit`);
  }
  for (let left = 0; left < activeTasks.length; left += 1) {
    for (let right = left + 1; right < activeTasks.length; right += 1) {
      if (activeTasks[left].ownedPaths.some((leftPath) => activeTasks[right].ownedPaths
        .some((rightPath) => pathsOverlap(leftPath, rightPath)))) {
        throw new TypeError(`Active subtasks ${activeTasks[left].id} and ${activeTasks[right].id} overlap owned paths`);
      }
    }
  }
  const status = deriveRunStatus(tasks);
  if (manifest.status !== status) {
    throw new TypeError(`Run manifest status must match its tasks (${status})`);
  }
  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  for (const task of tasks) {
    if (['running', 'integration-pending', 'integrated', 'completed', 'failed', 'needs-reconciliation', 'cancel-requested'].includes(task.status)
      && !dependenciesSatisfied(task, tasksById)) {
      throw new TypeError(`Subtask ${task.id} has started before its dependencies completed`);
    }
  }
  if (JSON.stringify(propagateBlocked(tasks)) !== JSON.stringify(tasks)) {
    throw new TypeError('Manifest contains pending or stale blocked work behind failed dependencies');
  }
  return {
    version: RUN_MANIFEST_VERSION,
    runId: manifest.runId,
    createdAt: manifest.createdAt,
    updatedAt: manifest.updatedAt,
    status,
    tasks,
  };
}

export function validateRunManifest(manifest) {
  return normalizeManifest(manifest);
}

export function createRunManifest(runId, subtasks, { now = Date.now() } = {}) {
  assertStableId(runId, 'Run ID');
  assertTimestamp(now, 'Run manifest timestamp');
  const tasks = validateSubtaskDag(subtasks).map((task) => ({
    ...task, status: 'pending', evidence: [], attempts: 0, attemptHistory: [],
  }));
  return { version: RUN_MANIFEST_VERSION, runId, createdAt: now, updatedAt: now, status: 'pending', tasks };
}

// Returns a bounded deterministic batch of ready IDs with disjoint owned paths.
export function readySubtasks(manifest, limit = MAX_PARALLEL_SUBTASKS) {
  const current = normalizeManifest(manifest);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_PARALLEL_SUBTASKS) {
    throw new TypeError(`Ready subtask limit must be 1-${MAX_PARALLEL_SUBTASKS}`);
  }
  const statuses = new Map(current.tasks.map((task) => [task.id, task]));
  const activeTasks = current.tasks.filter((task) => isActiveTaskStatus(task.status));
  const availableSlots = Math.max(0, Math.min(
    limit,
    MAX_PARALLEL_SUBTASKS - activeTasks.length,
  ));
  const candidates = current.tasks
    .filter((task) => task.status === 'pending'
      && dependenciesSatisfied(task, statuses));
  const batch = [];
  const occupiedPaths = activeTasks.flatMap((task) => task.ownedPaths);
  for (const task of candidates) {
    if (batch.length >= availableSlots) break;
    const conflicts = task.ownedPaths.some((taskPath) => (
      occupiedPaths.some((occupiedPath) => pathsOverlap(taskPath, occupiedPath))
      || batch.some((selected) => selected.ownedPaths.some((selectedPath) => pathsOverlap(taskPath, selectedPath)))
    ));
    if (!conflicts) batch.push(task);
  }
  return batch.map((task) => task.id);
}

// Records the immutable commit/worktree identity produced by code-worktree
// preflight. A code task cannot enter running state until this succeeds.
export function recordCodeWorktree(manifest, taskId, options = {}) {
  assertRecord(options, 'Code worktree preflight');
  assertOnlyKeys(options, ['baseCommit', 'worktreePath', 'now'], 'code worktree preflight');
  const { baseCommit, worktreePath, now = Date.now() } = options;
  const current = normalizeManifest(manifest);
  assertStableId(taskId, 'Subtask ID');
  assertTimestamp(now, 'Preflight timestamp');
  if (now < current.updatedAt) throw new TypeError('Preflight timestamp precedes manifest updatedAt');
  const task = current.tasks.find((entry) => entry.id === taskId);
  if (!task) throw new TypeError(`Unknown subtask ID: ${taskId}`);
  if (task.mode !== 'code') throw new TypeError(`Subtask ${taskId} is not a code task`);
  if (task.status !== 'pending') throw new TypeError(`Worktree preflight must precede running subtask ${taskId}`);
  if (Object.hasOwn(task, 'baseCommit')) throw new TypeError(`Worktree preflight is already recorded for ${taskId}`);
  if (!readySubtasks(current).includes(taskId)) {
    throw new TypeError(`Subtask ${taskId} is not ready for code-worktree preflight`);
  }
  validateCodeWorktree(baseCommit, worktreePath, taskId);
  for (const other of current.tasks) {
    if (other.mode !== 'code') continue;
    if (other.id !== taskId && other.worktreePath === worktreePath) {
      throw new TypeError(`Code worktree ${worktreePath} is already assigned to subtask ${other.id}`);
    }
    if (other.attemptHistory.some((attempt) => attempt.worktreePath === worktreePath)) {
      throw new TypeError(`Code worktree ${worktreePath} was already used by subtask ${other.id}`);
    }
  }
  const tasks = current.tasks.map((entry) => entry.id === taskId
    ? { ...entry, baseCommit, worktreePath }
    : entry);
  return normalizeManifest({ ...current, updatedAt: now, tasks });
}

export function transitionSubtask(manifest, taskId, nextStatus, { evidence, now = Date.now() } = {}) {
  const current = normalizeManifest(manifest);
  assertStableId(taskId, 'Subtask ID');
  assertTimestamp(now, 'Transition timestamp');
  if (now < current.updatedAt) throw new TypeError('Transition timestamp precedes manifest updatedAt');

  const task = current.tasks.find((entry) => entry.id === taskId);
  if (!task) throw new TypeError(`Unknown subtask ID: ${taskId}`);
  const allowed = task.status === 'pending'
    ? ['running', 'blocked']
    : task.status === 'running'
      ? [task.mode === 'code' ? 'integration-pending' : 'completed', 'failed', 'cancel-requested']
      : [];
  if (!allowed.includes(nextStatus)) {
    throw new TypeError(`Illegal subtask status transition: ${task.status} -> ${nextStatus}`);
  }
  const currentById = new Map(current.tasks.map((entry) => [entry.id, entry]));
  if (nextStatus === 'running' && !dependenciesSatisfied(task, currentById)) {
    throw new TypeError(`Subtask ${taskId} is not ready; dependencies must complete first`);
  }
  if (nextStatus === 'running' && task.mode === 'code' && !Object.hasOwn(task, 'baseCommit')) {
    throw new TypeError(`Code subtask ${taskId} requires worktree preflight before it can run`);
  }
  if (nextStatus === 'running' && task.attempts >= MAX_TASK_ATTEMPTS) {
    throw new TypeError(`Subtask ${taskId} exceeded ${MAX_TASK_ATTEMPTS} attempts`);
  }
  if (nextStatus === 'running'
    && current.tasks.filter((entry) => isActiveTaskStatus(entry.status)).length >= MAX_PARALLEL_SUBTASKS) {
    throw new TypeError(`Run already has ${MAX_PARALLEL_SUBTASKS} active subtasks`);
  }
  if (nextStatus === 'running' && task.ownedPaths.some((taskPath) => current.tasks
    .filter((entry) => isActiveTaskStatus(entry.status))
    .some((active) => active.ownedPaths.some((activePath) => pathsOverlap(taskPath, activePath))))) {
    throw new TypeError(`Subtask ${taskId} overlaps owned paths with active work`);
  }
  if (nextStatus === 'running' && !readySubtasks(current).includes(taskId)) {
    throw new TypeError(`Subtask ${taskId} is not in the current ready dispatch batch`);
  }

  const addedEvidence = evidence === undefined ? [] : validateEvidence(evidence, taskId);
  const combinedEvidence = [...new Set([...task.evidence, ...addedEvidence])].sort();
  if (combinedEvidence.length > MAX_EVIDENCE_REFERENCES) {
    throw new TypeError(`Evidence for ${taskId} exceeds ${MAX_EVIDENCE_REFERENCES} references`);
  }
  let tasks = current.tasks.map((entry) => {
    if (entry.id !== taskId) return entry;
    if (nextStatus === 'running') {
      const attempt = {
        attempt: entry.attempts + 1,
        startedAt: now,
        endedAt: null,
        status: 'running',
        ...(entry.mode === 'code' ? { baseCommit: entry.baseCommit, worktreePath: entry.worktreePath } : {}),
      };
      return {
        ...entry,
        status: nextStatus,
        evidence: combinedEvidence,
        attempts: entry.attempts + 1,
        attemptHistory: [...entry.attemptHistory, attempt],
      };
    }
    const updated = { ...entry, status: nextStatus, evidence: combinedEvidence };
    if (entry.status === 'running') {
      return updateLatestAttempt(updated, nextStatus, now, nextStatus !== 'cancel-requested');
    }
    return updated;
  });
  tasks = propagateBlocked(tasks);
  return normalizeManifest({
    ...current,
    updatedAt: now,
    status: deriveRunStatus(tasks),
    tasks,
  });
}

function withTaskMutation(current, tasks, now) {
  return normalizeManifest({
    ...current,
    updatedAt: now,
    status: deriveRunStatus(tasks),
    tasks,
  });
}

function appendEvidence(task, evidence, taskId) {
  const additions = evidence === undefined ? [] : validateEvidence(evidence, taskId);
  const combined = [...new Set([...task.evidence, ...additions])].sort();
  if (combined.length > MAX_EVIDENCE_REFERENCES) {
    throw new TypeError(`Evidence for ${taskId} exceeds ${MAX_EVIDENCE_REFERENCES} references`);
  }
  return combined;
}

export function integrateCodeSubtask(manifest, taskId, options = {}) {
  assertRecord(options, 'Code integration');
  assertOnlyKeys(options, ['primaryReviewed', 'evidence', 'now'], 'code integration');
  const { primaryReviewed, evidence, now = Date.now() } = options;
  const current = normalizeManifest(manifest);
  assertStableId(taskId, 'Subtask ID');
  assertTimestamp(now, 'Integration timestamp');
  if (now < current.updatedAt) throw new TypeError('Integration timestamp precedes manifest updatedAt');
  if (primaryReviewed !== true) throw new TypeError('Primary review confirmation is required to integrate code');
  const task = current.tasks.find((entry) => entry.id === taskId);
  if (!task) throw new TypeError(`Unknown subtask ID: ${taskId}`);
  if (task.mode !== 'code' || task.status !== 'integration-pending') {
    throw new TypeError(`Code subtask ${taskId} is not awaiting primary integration`);
  }
  const tasks = current.tasks.map((entry) => entry.id === taskId
    ? { ...entry, status: 'integrated', evidence: appendEvidence(entry, evidence, taskId) }
    : entry);
  return withTaskMutation(current, tasks, now);
}

export function markNeedsReconciliation(manifest, taskId, { now = Date.now() } = {}) {
  const current = normalizeManifest(manifest);
  assertStableId(taskId, 'Subtask ID');
  assertTimestamp(now, 'Reconciliation timestamp');
  if (now < current.updatedAt) throw new TypeError('Reconciliation timestamp precedes manifest updatedAt');
  const task = current.tasks.find((entry) => entry.id === taskId);
  if (!task) throw new TypeError(`Unknown subtask ID: ${taskId}`);
  if (task.status !== 'running') throw new TypeError(`Only a persisted running task can need reconciliation`);
  const tasks = current.tasks.map((entry) => entry.id === taskId
    ? updateLatestAttempt({ ...entry, status: 'needs-reconciliation' }, 'needs-reconciliation', now, false)
    : entry);
  return withTaskMutation(current, tasks, now);
}

export function reconcileSubtask(manifest, taskId, options = {}) {
  assertRecord(options, 'Primary reconciliation');
  assertOnlyKeys(options, ['primaryReviewed', 'outcome', 'evidence', 'now'], 'primary reconciliation');
  const { primaryReviewed, outcome, evidence, now = Date.now() } = options;
  const current = normalizeManifest(manifest);
  assertStableId(taskId, 'Subtask ID');
  assertTimestamp(now, 'Reconciliation timestamp');
  if (now < current.updatedAt) throw new TypeError('Reconciliation timestamp precedes manifest updatedAt');
  if (primaryReviewed !== true) throw new TypeError('Primary reconciliation confirmation is required');
  const task = current.tasks.find((entry) => entry.id === taskId);
  if (!task) throw new TypeError(`Unknown subtask ID: ${taskId}`);
  if (!['needs-reconciliation', 'cancel-requested'].includes(task.status)) {
    throw new TypeError(`Subtask ${taskId} is not awaiting primary reconciliation`);
  }
  const allowedOutcomes = task.mode === 'code'
    ? ['integration-pending', 'failed', 'cancelled']
    : ['completed', 'failed', 'cancelled'];
  if (!allowedOutcomes.includes(outcome)) throw new TypeError(`Invalid reconciled outcome for ${task.mode} task`);
  const tasks = current.tasks.map((entry) => {
    if (entry.id !== taskId) return entry;
    const updated = updateLatestAttempt({
      ...entry,
      status: outcome,
      evidence: appendEvidence(entry, evidence, taskId),
    }, outcome, now, true);
    return updated;
  });
  return withTaskMutation(current, propagateBlocked(tasks), now);
}

export function confirmTaskTermination(manifest, taskId, options = {}) {
  assertRecord(options, 'Task termination confirmation');
  assertOnlyKeys(options, ['hostConfirmed', 'now'], 'task termination confirmation');
  const { hostConfirmed, now = Date.now() } = options;
  const current = normalizeManifest(manifest);
  assertStableId(taskId, 'Subtask ID');
  assertTimestamp(now, 'Termination timestamp');
  if (now < current.updatedAt) throw new TypeError('Termination timestamp precedes manifest updatedAt');
  if (hostConfirmed !== true) throw new TypeError('Host termination confirmation is required');
  const task = current.tasks.find((entry) => entry.id === taskId);
  if (!task) throw new TypeError(`Unknown subtask ID: ${taskId}`);
  if (task.status !== 'cancel-requested') throw new TypeError(`Subtask ${taskId} has no pending cancellation`);
  const tasks = current.tasks.map((entry) => entry.id === taskId
    ? updateLatestAttempt({ ...entry, status: 'cancelled' }, 'cancelled', now, true)
    : entry);
  return withTaskMutation(current, propagateBlocked(tasks), now);
}

export function cancelRun(manifest, { now = Date.now() } = {}) {
  const current = normalizeManifest(manifest);
  assertTimestamp(now, 'Cancellation timestamp');
  if (now < current.updatedAt) throw new TypeError('Cancellation timestamp precedes manifest updatedAt');
  const tasks = current.tasks.map((task) => {
    if (task.status === 'pending' || task.status === 'integration-pending') {
      return { ...task, status: 'cancelled' };
    }
    if (task.status === 'running' || task.status === 'needs-reconciliation') {
      return updateLatestAttempt({ ...task, status: 'cancel-requested' }, 'cancel-requested', now, false);
    }
    return task;
  });
  return withTaskMutation(current, propagateBlocked(tasks), now);
}

export function retrySubtask(manifest, taskId, options = {}) {
  assertRecord(options, 'Subtask retry');
  assertOnlyKeys(options, ['primaryReviewed', 'now'], 'subtask retry');
  const { primaryReviewed, now = Date.now() } = options;
  const current = normalizeManifest(manifest);
  assertStableId(taskId, 'Subtask ID');
  assertTimestamp(now, 'Retry timestamp');
  if (now < current.updatedAt) throw new TypeError('Retry timestamp precedes manifest updatedAt');
  if (primaryReviewed !== true) throw new TypeError('Primary review confirmation is required to retry a failed task');
  const task = current.tasks.find((entry) => entry.id === taskId);
  if (!task) throw new TypeError(`Unknown subtask ID: ${taskId}`);
  if (task.status !== 'failed' || task.attemptHistory.at(-1)?.status !== 'failed') {
    throw new TypeError(`Only a confirmed failed task can be retried`);
  }
  if (task.attempts >= MAX_TASK_ATTEMPTS) throw new TypeError(`Subtask ${taskId} reached the ${MAX_TASK_ATTEMPTS}-attempt limit`);
  const tasks = current.tasks.map((entry) => {
    if (entry.id !== taskId) return entry;
    const { baseCommit: _baseCommit, worktreePath: _worktreePath, ...retryable } = entry;
    return { ...retryable, status: 'pending' };
  });
  return withTaskMutation(current, propagateBlocked(tasks), now);
}
