// Durable project-local storage and application lifecycle for learning-review proposals.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { isSensitive, sanitize } from './security.js';
import { initVault } from './vault.js';
import { memorySaveNode } from './tools.js';

const QUEUE_VERSION = 1;
const QUEUE_DIRECTORY = ['.guarana', 'memory'];
const QUEUE_FILENAME = 'learning-review-queue.json';
const QUEUE_STATUSES = new Set(['pending', 'approved', 'applying', 'applied', 'rejected']);
const SKILL_CATEGORIES = new Set(['development', 'automation', 'research', 'integrations', 'memory', 'general']);
const MEMORY_TYPES = new Set(['decision', 'bug', 'solution', 'refactor']);

export class LearningReviewQueueError extends Error {
  constructor(message) {
    super(message);
    this.name = 'LearningReviewQueueError';
  }
}

function requireProjectDir(projectDir) {
  if (typeof projectDir !== 'string' || !path.isAbsolute(projectDir))
    throw new LearningReviewQueueError('projectDir must be an absolute path');
  let root;
  try {
    root = fs.realpathSync(projectDir);
  } catch (error) {
    throw new LearningReviewQueueError(`project directory is unavailable: ${error.message}`);
  }
  if (!fs.statSync(root).isDirectory())
    throw new LearningReviewQueueError('projectDir must be a directory');
  return root;
}

function queueLocation(projectDir, { createDirectory = false } = {}) {
  const root = requireProjectDir(projectDir);
  let directory = root;
  let missingDirectory = false;
  for (const component of QUEUE_DIRECTORY) {
    directory = path.join(directory, component);
    if (missingDirectory) {
      if (createDirectory) {
        fs.mkdirSync(directory);
        const stat = fs.lstatSync(directory);
        if (stat.isSymbolicLink() || !stat.isDirectory() || fs.realpathSync(directory) !== directory)
          throw new LearningReviewQueueError('learning-review queue directory contains a symlink or non-directory');
      }
      continue;
    }
    let stat;
    try {
      stat = fs.lstatSync(directory);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      if (!createDirectory) {
        missingDirectory = true;
        continue;
      }
      fs.mkdirSync(directory);
      stat = fs.lstatSync(directory);
    }
    if (stat.isSymbolicLink() || !stat.isDirectory())
      throw new LearningReviewQueueError('learning-review queue directory contains a symlink or non-directory');
    if (fs.realpathSync(directory) !== directory)
      throw new LearningReviewQueueError('learning-review queue directory escapes the project');
  }
  const file = path.join(directory, QUEUE_FILENAME);
  try {
    const stat = fs.lstatSync(file);
    if (stat.isSymbolicLink() || !stat.isFile())
      throw new LearningReviewQueueError('learning-review queue must be a regular file');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  return { file, directoryExists: !missingDirectory };
}

function safeText(value, label, maxLength) {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength)
    throw new LearningReviewQueueError(`${label} is invalid`);
  const normalized = sanitize(value.replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ')
    .trim()).replace(/\s+/g, ' ');
  if (!normalized || isSensitive(normalized))
    throw new LearningReviewQueueError(`${label} contains unsafe content`);
  return normalized;
}

function exactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).length !== keys.length
    || keys.some((key) => !Object.hasOwn(value, key)))
    throw new LearningReviewQueueError(`${label} has invalid fields`);
}

function normalizeProposal(proposal) {
  if (!proposal || typeof proposal !== 'object' || Array.isArray(proposal))
    throw new LearningReviewQueueError('invalid reviewer proposal');
  const reason = safeText(proposal.reason, 'reason', 300);

  if (proposal.action === 'create_skill' || proposal.action === 'update_skill') {
    exactKeys(proposal, ['action', 'reason', 'skill'], 'skill proposal');
    const update = proposal.action === 'update_skill';
    const skillKeys = update
      ? ['name', 'description', 'category', 'scope', 'expectedRevision', 'content']
      : ['name', 'description', 'category', 'scope', 'content'];
    exactKeys(proposal.skill, skillKeys, 'skill proposal');
    const skill = proposal.skill;
    if (typeof skill.name !== 'string' || skill.name.length > 64
      || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(skill.name))
      throw new LearningReviewQueueError('invalid skill name');
    if (skill.scope !== 'project' || !SKILL_CATEGORIES.has(skill.category))
      throw new LearningReviewQueueError('learning-review skills must use a supported category and project scope');
    if (update && (typeof skill.expectedRevision !== 'string' || !/^[a-f0-9]{64}$/.test(skill.expectedRevision)))
      throw new LearningReviewQueueError('invalid expected skill revision');
    const description = safeText(skill.description, 'skill description', 1024);
    const content = safeText(skill.content, 'skill content', 32 * 1024);
    if (Buffer.byteLength(content, 'utf8') > 32 * 1024)
      throw new LearningReviewQueueError('skill content exceeds the supported size');
    return {
      action: proposal.action,
      reason,
      skill: {
        name: skill.name,
        description,
        category: skill.category,
        scope: 'project',
        content,
        ...(update ? { expectedRevision: skill.expectedRevision } : {}),
      },
    };
  }

  if (proposal.action === 'save_memory') {
    exactKeys(proposal, ['action', 'reason', 'memory'], 'memory proposal');
    const memory = proposal.memory;
    if (!memory || typeof memory !== 'object' || Array.isArray(memory)
      || Object.keys(memory).some((key) => !['type', 'intent', 'summary', 'tags', 'scope'].includes(key))
      || !['type', 'intent', 'summary', 'tags'].every((key) => Object.hasOwn(memory, key))
      || (memory.scope !== undefined && memory.scope !== 'project'))
      throw new LearningReviewQueueError('invalid project-memory proposal fields');
    if (!MEMORY_TYPES.has(memory.type))
      throw new LearningReviewQueueError('invalid project-memory type');
    if (!Array.isArray(memory.tags) || memory.tags.length > 8)
      throw new LearningReviewQueueError('invalid memory tags');
    const tags = memory.tags.map((tag) => safeText(tag, 'memory tag', 40));
    return {
      action: 'save_memory',
      reason,
      memory: {
        type: memory.type,
        intent: safeText(memory.intent, 'memory intent', 180),
        summary: safeText(memory.summary, 'memory summary', 600),
        tags,
        scope: 'project',
      },
    };
  }

  throw new LearningReviewQueueError('unsupported reviewer action');
}

function emptyQueue() {
  return { version: QUEUE_VERSION, proposals: [] };
}

function readQueue(projectDir) {
  const { file, directoryExists } = queueLocation(projectDir);
  if (!directoryExists) return { file, queue: emptyQueue() };
  let descriptor;
  try {
    descriptor = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0) | (fs.constants.O_NONBLOCK || 0));
  } catch (error) {
    if (error.code === 'ENOENT') return { file, queue: emptyQueue() };
    throw error;
  }
  try {
    const stat = fs.fstatSync(descriptor);
    if (!stat.isFile()) throw new LearningReviewQueueError('learning-review queue must be a regular file');
    const data = JSON.parse(fs.readFileSync(descriptor, 'utf8'));
    if (!data || typeof data !== 'object' || Array.isArray(data)
      || data.version !== QUEUE_VERSION || !Array.isArray(data.proposals)
      || Object.keys(data).some((key) => !['version', 'proposals'].includes(key)))
      throw new LearningReviewQueueError('learning-review queue has an unsupported or malformed format');
    const ids = new Set();
    for (const entry of data.proposals) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)
        || Object.keys(entry).length !== 5
        || !['id', 'createdAt', 'updatedAt', 'status', 'proposal'].every((key) => Object.hasOwn(entry, key))
        || typeof entry.id !== 'string' || !entry.id
        || ids.has(entry.id)
        || !Number.isFinite(entry.createdAt) || !Number.isFinite(entry.updatedAt)
        || !QUEUE_STATUSES.has(entry.status))
        throw new LearningReviewQueueError('learning-review queue contains a malformed proposal entry');
      const normalized = normalizeProposal(entry.proposal);
      if (!isDeepEqual(normalized, entry.proposal))
        throw new LearningReviewQueueError('learning-review queue contains a non-normalized proposal');
      ids.add(entry.id);
    }
    return { file, queue: data };
  } catch (error) {
    if (error instanceof LearningReviewQueueError) throw error;
    throw new LearningReviewQueueError(`learning-review queue cannot be read: ${error.message}`);
  } finally {
    fs.closeSync(descriptor);
  }
}

function isDeepEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function writeQueue(projectDir, queue) {
  const { file, directoryExists } = queueLocation(projectDir, { createDirectory: true });
  if (!directoryExists) throw new LearningReviewQueueError('learning-review queue directory is unavailable');
  const temp = path.join(path.dirname(file),
    `.${QUEUE_FILENAME}.${process.pid}.${crypto.randomBytes(8).toString('hex')}.tmp`);
  let descriptor;
  try {
    descriptor = fs.openSync(temp, 'wx', 0o600);
    fs.writeFileSync(descriptor, `${JSON.stringify(queue, null, 2)}\n`, 'utf8');
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    queueLocation(projectDir);
    fs.renameSync(temp, file);
    try {
      const directoryDescriptor = fs.openSync(path.dirname(file), fs.constants.O_RDONLY | fs.constants.O_DIRECTORY);
      try { fs.fsyncSync(directoryDescriptor); } finally { fs.closeSync(directoryDescriptor); }
    } catch { /* directory fsync is not supported by every filesystem */ }
  } catch (error) {
    if (descriptor !== undefined) {
      try { fs.closeSync(descriptor); } catch { /* preserve the original failure */ }
    }
    try { fs.rmSync(temp, { force: true }); } catch { /* preserve the original failure */ }
    throw error;
  }
}

function updateEntry(projectDir, id, allowedStatuses, update) {
  const { queue } = readQueue(projectDir);
  const entry = queue.proposals.find((candidate) => candidate.id === id);
  if (!entry) throw new LearningReviewQueueError(`unknown learning-review proposal: ${id}`);
  if (!allowedStatuses.includes(entry.status))
    throw new LearningReviewQueueError(`learning-review proposal ${id} is ${entry.status}; expected ${allowedStatuses.join(' or ')}`);
  const changed = update(structuredClone(entry));
  queue.proposals[queue.proposals.findIndex((candidate) => candidate.id === id)] = changed;
  writeQueue(projectDir, queue);
  return structuredClone(changed);
}

export function learningReviewQueuePath(projectDir) {
  return queueLocation(projectDir).file;
}

export function listLearningReviewProposals(projectDir) {
  return structuredClone(readQueue(projectDir).queue.proposals);
}

export function getLearningReviewProposal(projectDir, id) {
  const entry = readQueue(projectDir).queue.proposals.find((candidate) => candidate.id === id);
  return entry ? structuredClone(entry) : null;
}

export function enqueueLearningReviewProposal(projectDir, proposal) {
  const normalized = normalizeProposal(proposal);
  const { queue } = readQueue(projectDir);
  const now = Date.now();
  const entry = {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    status: 'pending',
    proposal: normalized,
  };
  queue.proposals.push(entry);
  writeQueue(projectDir, queue);
  return structuredClone(entry);
}

export function approveLearningReviewProposal(projectDir, id) {
  return updateEntry(projectDir, id, ['pending'], (entry) => ({
    ...entry, status: 'approved', updatedAt: Date.now(),
  }));
}

export function rejectLearningReviewProposal(projectDir, id) {
  return updateEntry(projectDir, id, ['pending', 'approved'], (entry) => ({
    ...entry, status: 'rejected', updatedAt: Date.now(),
  }));
}

export function beginApprovedLearningReviewApplication(projectDir, id) {
  return updateEntry(projectDir, id, ['approved'], (entry) => ({
    ...entry, status: 'applying', updatedAt: Date.now(),
  }));
}

export function finishLearningReviewApplication(projectDir, id, applied) {
  if (typeof applied !== 'boolean') throw new TypeError('applied must be a boolean');
  return updateEntry(projectDir, id, ['applying'], (entry) => ({
    ...entry, status: applied ? 'applied' : 'approved', updatedAt: Date.now(),
  }));
}

async function applyProposal(projectDir, proposal, options = {}) {
  if (typeof options.applyProposal === 'function')
    return options.applyProposal(structuredClone(proposal));
  if (proposal.action === 'save_memory') {
    const vaultDir = options.vaultDir || initVault(projectDir);
    const save = options.memorySaveNode || memorySaveNode;
    return save(vaultDir, { ...proposal.memory, scope: 'project' });
  }
  if (proposal.action === 'create_skill') {
    const create = options.createSkill || (await import('../skill-engine/index.js')).createSkill;
    return create({ projectDir, ...proposal.skill, scope: 'project' });
  }
  if (proposal.action === 'update_skill') {
    const update = options.updateSkill || (await import('../skill-engine/index.js')).updateSkill;
    return update({ projectDir, ...proposal.skill, scope: 'project' });
  }
  throw new LearningReviewQueueError('unsupported reviewer action');
}

// Direct API for user-authorized CLI/Dashboard callers and the opt-in plugin
// auto-accept path. A failed application returns the durable entry to pending.
export async function acceptLearningReviewProposal(projectDir, id, options = {}) {
  const entry = updateEntry(projectDir, id, ['pending'], (current) => ({
    ...current, status: 'applying', updatedAt: Date.now(),
  }));
  let result;
  try {
    result = await applyProposal(projectDir, entry.proposal, options);
  } catch (error) {
    updateEntry(projectDir, id, ['applying'], (current) => ({
      ...current, status: 'pending', updatedAt: Date.now(),
    }));
    throw error;
  }
  if (!result || typeof result !== 'object' || Object.hasOwn(result, 'error')) {
    updateEntry(projectDir, id, ['applying'], (current) => ({
      ...current, status: 'pending', updatedAt: Date.now(),
    }));
    throw new LearningReviewQueueError(result?.error || 'learning-review proposal application failed');
  }
  const applied = updateEntry(projectDir, id, ['applying'], (current) => ({
    ...current, status: 'applied', updatedAt: Date.now(),
  }));
  return { id, status: applied.status, result };
}
