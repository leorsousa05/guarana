// Guarana-generated OpenCode skill storage and discovery. Zero dependencies.
import fs from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { isSensitive } from '../memory/security.js';

export const MAX_SKILL_CONTENT_BYTES = 32 * 1024;
export const MAX_SKILL_DESCRIPTION_LENGTH = 1024;
// Allow worst-case JSON escaping for descriptions plus bounded frontmatter overhead.
const MAX_SKILL_DOCUMENT_BYTES = MAX_SKILL_CONTENT_BYTES + MAX_SKILL_DESCRIPTION_LENGTH * 6 + 1024;
export const SKILL_CATEGORIES = Object.freeze([
  'development',
  'automation',
  'research',
  'integrations',
  'memory',
  'general',
]);

export function skillRoots({ projectDir, homeDir = os.homedir() }) {
  return {
    global: path.join(homeDir, '.agents', 'skills'),
    project: path.join(projectDir, '.opencode', 'skills'),
  };
}

function parseFrontmatter(document) {
  const match = document.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) return null;
  const frontmatter = match[1];
  const name = frontmatter.match(/^name:\s*(.+)$/m)?.[1]?.trim();
  const descriptionValue = frontmatter.match(/^description:\s*(.*)$/m)?.[1]?.trim();
  let description = descriptionValue || '';
  try {
    description = JSON.parse(description);
  } catch {
    description = description.replace(/^['"]|['"]$/g, '');
  }
  if (!/^metadata:\s*\r?\n(?:[ \t].*(?:\r?\n|$))*/m.test(frontmatter)) return null;
  if (!/^[ \t]+guarana-generated:\s*["']?true["']?\s*$/m.test(frontmatter)) return null;
  const scope = frontmatter.match(/^[ \t]+guarana-scope:\s*["']?(project|global)["']?\s*$/m)?.[1];
  const categoryValue = frontmatter.match(/^[ \t]+guarana-category:\s*["']?([a-z][a-z0-9-]*)["']?\s*$/m)?.[1];
  const category = SKILL_CATEGORIES.includes(categoryValue) ? categoryValue : 'general';
  return { name, description, scope, category, body: document.slice(match[0].length) };
}

function pathIsWithin(basePath, targetPath) {
  const relative = path.relative(basePath, targetPath);
  return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function skillRootIsWithinScope({ projectDir, homeDir, scope, root }) {
  try {
    const basePath = scope === 'project' ? projectDir : homeDir;
    const baseRealPath = fs.realpathSync(basePath);
    const rootRealPath = fs.realpathSync(root);
    return pathIsWithin(baseRealPath, rootRealPath);
  } catch {
    return false;
  }
}

// Node does not expose openat() directly; POSIX descriptor namespaces keep each
// subsequent path lookup anchored to the validated, still-open parent directory.
function directoryHandlePath(descriptor) {
  const namespace = process.platform === 'linux' ? '/proc/self/fd'
    : ['darwin', 'freebsd', 'openbsd', 'netbsd'].includes(process.platform) ? '/dev/fd'
      : null;
  if (!namespace) throw new Error('descriptor-relative skill writes are not supported on this platform');
  return path.join(namespace, String(descriptor));
}

function directoryOpenFlags() {
  const { O_RDONLY, O_DIRECTORY, O_NOFOLLOW } = fs.constants;
  if (!O_DIRECTORY || !O_NOFOLLOW) throw new Error('safe directory handles are not supported on this platform');
  return O_RDONLY | O_DIRECTORY | O_NOFOLLOW;
}

function openDirectoryDescriptor(directoryPath) {
  return fs.openSync(directoryPath, directoryOpenFlags());
}

function openAbsoluteDirectoryDescriptor(directoryPath) {
  const canonicalPath = fs.realpathSync(directoryPath);
  const filesystemRoot = path.parse(canonicalPath).root;
  let descriptor = openDirectoryDescriptor(filesystemRoot);
  try {
    const components = path.relative(filesystemRoot, canonicalPath).split(path.sep).filter(Boolean);
    for (const component of components) {
      const next = openDirectoryDescriptor(path.join(directoryHandlePath(descriptor), component));
      fs.closeSync(descriptor);
      descriptor = next;
    }
    return { descriptor, canonicalPath };
  } catch (error) {
    try { fs.closeSync(descriptor); } catch { /* preserve original error */ }
    throw error;
  }
}

function openWritableSkillRoot({ projectDir, homeDir, scope, create = false }) {
  const basePath = scope === 'project' ? projectDir : homeDir;
  const components = scope === 'project' ? ['.opencode', 'skills'] : ['.agents', 'skills'];
  let descriptor;
  try {
    const openedBase = openAbsoluteDirectoryDescriptor(basePath);
    descriptor = openedBase.descriptor;
    let rootPath = openedBase.canonicalPath;
    for (const component of components) {
      const componentPath = path.join(directoryHandlePath(descriptor), component);
      let next;
      try {
        next = openDirectoryDescriptor(componentPath);
      } catch (error) {
        if (error.code !== 'ENOENT' || !create) throw error;
        try { fs.mkdirSync(componentPath, { mode: 0o755 }); } catch (mkdirError) {
          if (mkdirError.code !== 'EEXIST') throw mkdirError;
        }
        next = openDirectoryDescriptor(componentPath);
      }
      fs.closeSync(descriptor);
      descriptor = next;
      rootPath = path.join(rootPath, component);
    }
    const rootStat = fs.fstatSync(descriptor);
    const result = {
      descriptor,
      rootPath,
      handlePath: directoryHandlePath(descriptor),
      identity: { dev: rootStat.dev, ino: rootStat.ino },
      exists: true,
    };
    descriptor = undefined;
    return result;
  } catch (error) {
    return { error: String(error.message || error) };
  } finally {
    if (descriptor !== undefined) {
      try { fs.closeSync(descriptor); } catch { /* preserve the original result */ }
    }
  }
}

function safeWritableSkillRoot({ projectDir, homeDir, scope, create = false }) {
  const basePath = scope === 'project' ? projectDir : homeDir;
  const components = scope === 'project' ? ['.opencode', 'skills'] : ['.agents', 'skills'];
  let current;
  try {
    current = fs.realpathSync(basePath);
    if (!fs.statSync(current).isDirectory()) return { error: 'skill scope base is not a directory' };
    for (const component of components) {
      current = path.join(current, component);
      let stat;
      try {
        stat = fs.lstatSync(current);
      } catch (error) {
        if (error.code !== 'ENOENT' || !create) {
          if (error.code === 'ENOENT') return { root: path.join(current, ...components.slice(components.indexOf(component) + 1)), exists: false };
          throw error;
        }
        try { fs.mkdirSync(current, { mode: 0o755 }); } catch (mkdirError) {
          if (mkdirError.code !== 'EEXIST') throw mkdirError;
        }
        stat = fs.lstatSync(current);
      }
      if (!stat.isDirectory() || stat.isSymbolicLink() || fs.realpathSync(current) !== current)
        return { error: 'skill root contains a symlink or non-directory path component' };
    }
    return { root: current, exists: true };
  } catch (error) {
    return { error: String(error.message || error) };
  }
}

function verifyOpenedSkillRoot(openedRoot, options) {
  const current = safeWritableSkillRoot(options);
  if (current.error || current.root !== openedRoot.rootPath || !current.exists)
    return { error: current.error || 'skill root changed during write' };
  try {
    const stat = fs.statSync(current.root);
    if (!stat.isDirectory() || stat.dev !== openedRoot.identity.dev || stat.ino !== openedRoot.identity.ino)
      return { error: 'skill root changed during write' };
    return current;
  } catch (error) {
    return { error: String(error.message || error) };
  }
}

function verifyOpenedSkillDirectory(openedRoot, skillDirectoryDescriptor, name, options) {
  const root = verifyOpenedSkillRoot(openedRoot, options);
  if (root.error) return root;
  let currentDescriptor;
  try {
    currentDescriptor = openDirectoryDescriptor(path.join(openedRoot.handlePath, name));
    const opened = fs.fstatSync(skillDirectoryDescriptor);
    const current = fs.fstatSync(currentDescriptor);
    if (!opened.isDirectory() || !current.isDirectory()
      || opened.dev !== current.dev || opened.ino !== current.ino)
      return { error: 'skill directory changed during write' };
    return root;
  } catch (error) {
    return { error: String(error.message || error) };
  } finally {
    if (currentDescriptor !== undefined) {
      try { fs.closeSync(currentDescriptor); } catch { /* preserve the verification result */ }
    }
  }
}

function removeCreatedSkillDirectory(rootHandlePath, name, identity) {
  if (!identity) return;
  const destination = path.join(rootHandlePath, name);
  try {
    const current = fs.lstatSync(destination);
    if (current.isDirectory() && !current.isSymbolicLink()
      && current.dev === identity.dev && current.ino === identity.ino)
      fs.rmdirSync(destination);
  } catch { /* cleanup is best-effort and must not remove a replacement */ }
}

function removeCreatedSkillFile(file, identity) {
  if (!identity) return;
  try {
    const current = fs.lstatSync(file);
    if (current.isFile() && !current.isSymbolicLink()
      && current.dev === identity.dev && current.ino === identity.ino)
      fs.unlinkSync(file);
  } catch { /* cleanup is best-effort and must not remove a replacement */ }
}

function sameFileIdentity(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

function removeLockFileIfIdentity(lockPath, identity) {
  try {
    const current = fs.lstatSync(lockPath);
    if (!current.isFile() || current.isSymbolicLink() || !sameFileIdentity(current, identity)) return false;
    fs.unlinkSync(lockPath);
    return true;
  } catch { return false; }
}

function releaseLockFile(lock) {
  if (!lock) return;
  try {
    const opened = fs.fstatSync(lock.descriptor);
    removeLockFileIfIdentity(lock.path, { dev: opened.dev, ino: opened.ino });
  } finally {
    try { fs.closeSync(lock.descriptor); } catch { /* preserve update result */ }
  }
}

function acquireSkillUpdateLock(skillDirectory) {
  const lockPath = path.join(skillDirectory, '.guarana-update.lock');
  let descriptor;
  try {
    const { O_WRONLY, O_CREAT, O_EXCL, O_NOFOLLOW } = fs.constants;
    if (!O_NOFOLLOW) return { error: 'safe skill update locks are not supported on this platform' };
    descriptor = fs.openSync(lockPath, O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW, 0o600);
    const opened = fs.fstatSync(descriptor);
    fs.writeFileSync(descriptor, JSON.stringify({ pid: process.pid, token: randomUUID() }), 'utf8');
    fs.fsyncSync(descriptor);
    return { descriptor, path: lockPath, identity: { dev: opened.dev, ino: opened.ino } };
  } catch (error) {
    if (descriptor !== undefined) {
      try {
        const opened = fs.fstatSync(descriptor);
        removeLockFileIfIdentity(lockPath, { dev: opened.dev, ino: opened.ino });
      } catch { /* preserve the acquisition error */ }
      try { fs.closeSync(descriptor); } catch { /* preserve the acquisition error */ }
    }
    if (error.code === 'EEXIST')
      return { error: 'skill update is already in progress; remove a stale .guarana-update.lock only when no update is running' };
    throw error;
  }
}

function restoreUpdatedSkill(file, originalDocument, updatedIdentity, mode) {
  let currentDescriptor;
  let restoreDescriptor;
  let restoreFile;
  try {
    const { O_RDONLY, O_WRONLY, O_CREAT, O_EXCL, O_NOFOLLOW, O_NONBLOCK } = fs.constants;
    if (!O_NOFOLLOW) return false;
    currentDescriptor = fs.openSync(file, O_RDONLY | O_NOFOLLOW | (O_NONBLOCK || 0));
    const currentStat = fs.fstatSync(currentDescriptor);
    fs.closeSync(currentDescriptor);
    currentDescriptor = undefined;
    if (currentStat.dev !== updatedIdentity.dev || currentStat.ino !== updatedIdentity.ino) return false;

    restoreFile = path.join(
      path.dirname(file),
      `.SKILL.md.rollback.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`,
    );
    restoreDescriptor = fs.openSync(restoreFile, O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW, mode & 0o777);
    fs.writeFileSync(restoreDescriptor, originalDocument);
    fs.fsyncSync(restoreDescriptor);
    fs.closeSync(restoreDescriptor);
    restoreDescriptor = undefined;
    fs.renameSync(restoreFile, file);
    restoreFile = undefined;
    return true;
  } catch {
    return false;
  } finally {
    if (currentDescriptor !== undefined) {
      try { fs.closeSync(currentDescriptor); } catch { /* preserve rollback result */ }
    }
    if (restoreDescriptor !== undefined) {
      try { fs.closeSync(restoreDescriptor); } catch { /* preserve rollback result */ }
    }
    if (restoreFile) {
      try { fs.rmSync(restoreFile, { force: true }); } catch { /* preserve rollback result */ }
    }
  }
}

function readBoundedSkillDocument(descriptor, openedStat) {
  if (openedStat.size > MAX_SKILL_DOCUMENT_BYTES) return null;
  const buffer = Buffer.alloc(MAX_SKILL_DOCUMENT_BYTES + 1);
  const bytesRead = fs.readSync(descriptor, buffer, 0, buffer.length, 0);
  const finalStat = fs.fstatSync(descriptor);
  if (bytesRead > MAX_SKILL_DOCUMENT_BYTES
    || bytesRead !== openedStat.size
    || finalStat.size !== openedStat.size
    || finalStat.mtimeMs !== openedStat.mtimeMs
    || finalStat.ctimeMs !== openedStat.ctimeMs)
    return null;
  return buffer.subarray(0, bytesRead);
}

function readSkills({ projectDir, homeDir, scope, includeRevision, includeContent }) {
  const root = skillRoots({ projectDir, homeDir })[scope];
  if (!skillRootIsWithinScope({ projectDir, homeDir, scope, root })) return [];

  let entries;
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return [];
    throw error;
  }

  const skills = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const loaded = readSkill({ projectDir, homeDir, name: entry.name, scope, includeRevision });
    if (loaded.error) continue;
    const { content, revision, ...metadata } = loaded;
    skills.push({
      ...metadata,
      ...(includeContent ? { content } : {}),
      ...(includeRevision ? { revision } : {}),
    });
  }
  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

export function listSkills({ projectDir, homeDir = os.homedir(), includeRevision = false, includeContent = false }) {
  return {
    global: readSkills({ projectDir, homeDir, scope: 'global', includeRevision, includeContent }),
    project: readSkills({ projectDir, homeDir, scope: 'project', includeRevision, includeContent }),
  };
}

export function readSkill({ projectDir, homeDir = os.homedir(), name, scope, includeRevision = true, includeIdentity = false }) {
  if (!['global', 'project'].includes(scope)) return { error: 'scope must be global or project' };
  if (typeof name !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name))
    return { error: 'name must be a lowercase OpenCode skill slug' };
  if (typeof projectDir !== 'string' || !path.isAbsolute(projectDir))
    return { error: 'projectDir must be an absolute path' };

  const root = skillRoots({ projectDir, homeDir })[scope];
  const scopeBasePath = scope === 'project' ? projectDir : homeDir;
  const directory = path.join(root, name);
  const file = path.join(directory, 'SKILL.md');
  let descriptor;
  try {
    const rootStat = fs.lstatSync(root);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) return { error: 'skill root is not a regular directory' };
    const scopeBaseRealPath = fs.realpathSync(scopeBasePath);
    const rootRealPath = fs.realpathSync(root);
    if (!pathIsWithin(scopeBaseRealPath, rootRealPath)) return { error: 'skill root escapes its configured scope' };

    const directoryStat = fs.lstatSync(directory);
    if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink()) return { error: `skill "${name}" is not a regular generated skill directory in ${scope} scope` };
    const fileStat = fs.lstatSync(file);
    if (!fileStat.isFile() || fileStat.isSymbolicLink()) return { error: `skill "${name}" SKILL.md must be a regular file` };

    descriptor = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0) | (fs.constants.O_NONBLOCK || 0));
    const openedStat = fs.fstatSync(descriptor);
    if (!openedStat.isFile()) return { error: `skill "${name}" SKILL.md must be a regular file` };
    if (openedStat.size > MAX_SKILL_DOCUMENT_BYTES) return { error: 'skill content exceeds the supported size' };

    const currentScopeBaseRealPath = fs.realpathSync(scopeBasePath);
    const currentRootRealPath = fs.realpathSync(root);
    const directoryRealPath = fs.realpathSync(directory);
    const fileRealPath = fs.realpathSync(file);
    const currentRootStat = fs.lstatSync(root);
    const resolvedRootStat = fs.statSync(currentRootRealPath);
    const currentDirectoryStat = fs.lstatSync(directory);
    const resolvedDirectoryStat = fs.statSync(directoryRealPath);
    const resolvedFileStat = fs.statSync(fileRealPath);
    if (currentScopeBaseRealPath !== scopeBaseRealPath
      || !pathIsWithin(currentScopeBaseRealPath, currentRootRealPath)
      || !currentRootStat.isDirectory() || currentRootStat.isSymbolicLink()
      || currentRootStat.dev !== resolvedRootStat.dev || currentRootStat.ino !== resolvedRootStat.ino
      || !currentDirectoryStat.isDirectory() || currentDirectoryStat.isSymbolicLink()
      || currentDirectoryStat.dev !== resolvedDirectoryStat.dev || currentDirectoryStat.ino !== resolvedDirectoryStat.ino
      || path.dirname(directoryRealPath) !== currentRootRealPath
      || fileRealPath !== path.join(directoryRealPath, 'SKILL.md')
      || resolvedFileStat.dev !== openedStat.dev
      || resolvedFileStat.ino !== openedStat.ino)
      return { error: `skill "${name}" changed while it was being read` };

    const documentBytes = readBoundedSkillDocument(descriptor, openedStat);
    if (!documentBytes) return { error: `skill "${name}" changed or exceeds the supported size` };
    const parsed = parseFrontmatter(documentBytes.toString('utf8'));
    if (!parsed) return { error: `skill "${name}" is not a Guarana-generated skill` };
    if (parsed.name !== name) return { error: `skill identity does not match "${name}"` };
    if (parsed.scope !== scope) return { error: `skill "${name}" scope does not match ${scope}` };
    if (!parsed.description) return { error: `skill "${name}" is missing a description` };
    const content = parsed.body.trim();
    const validationError = validateSkill({
      projectDir,
      name: parsed.name,
      description: parsed.description,
      content,
      scope,
      category: parsed.category,
    });
    if (validationError) return { error: validationError };
    return {
      name: parsed.name,
      description: parsed.description,
      category: parsed.category,
      scope,
      content,
      updatedAt: openedStat.mtimeMs,
      ...(includeRevision ? { revision: createHash('sha256').update(documentBytes).digest('hex') } : {}),
      ...(includeIdentity ? {
        identity: {
          dev: openedStat.dev,
          ino: openedStat.ino,
          mode: openedStat.mode & 0o777,
        },
      } : {}),
    };
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return { error: `skill "${name}" not found in ${scope} scope` };
    if (error.code === 'EACCES' || error.code === 'ELOOP') return { error: `skill "${name}" cannot be read safely` };
    return { error: String(error.message || error) };
  } finally {
    if (descriptor !== undefined) {
      try { fs.closeSync(descriptor); } catch { /* keep the read result */ }
    }
  }
}

function validateSkill({ name, description, content, scope, category, projectDir }) {
  if (!['global', 'project'].includes(scope)) return 'scope must be global or project';
  if (typeof projectDir !== 'string' || !path.isAbsolute(projectDir)) return 'projectDir must be an absolute path';
  if (typeof name !== 'string' || name.length > 64 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name))
    return 'name must be a lowercase OpenCode skill slug (letters, numbers, hyphens; max 64 characters)';
  if (name === 'guarana') return 'name is reserved by the Guarana skill suite';
  if (typeof description !== 'string' || !description.trim() || description.trim().length > MAX_SKILL_DESCRIPTION_LENGTH || /[\r\n]/.test(description))
    return `description must be one line with 1-${MAX_SKILL_DESCRIPTION_LENGTH} characters`;
  if (typeof content !== 'string' || !content.trim()) return 'content must contain Markdown instructions';
  if (Buffer.byteLength(content, 'utf8') > MAX_SKILL_CONTENT_BYTES)
    return `content exceeds ${MAX_SKILL_CONTENT_BYTES} bytes`;
  if (category !== undefined && !SKILL_CATEGORIES.includes(category))
    return `category must be one of ${SKILL_CATEGORIES.join('|')}`;
  if (content.trimStart().startsWith('---')) return 'content must not include a second SKILL.md frontmatter block';
  if (isSensitive(`${description}\n${content}`)) return 'content appears to contain a secret; remove it before creating the skill';
  return null;
}

function formatSkillDocument({ name, description, content, scope, category }) {
  return [
    '---',
    `name: ${name}`,
    `description: ${JSON.stringify(description.trim())}`,
    'metadata:',
    '  guarana-generated: "true"',
    `  guarana-scope: ${scope}`,
    `  guarana-category: ${category}`,
    '---',
    '',
    content.trim(),
    '',
  ].join('\n');
}

export function createSkill({ projectDir, homeDir = os.homedir(), name, description, content, scope, category = 'general' }) {
  const validationError = validateSkill({ projectDir, name, description, content, scope, category });
  if (validationError) return { error: validationError };

  for (const candidateScope of ['project', 'global']) {
    const safeRoot = safeWritableSkillRoot({ projectDir, homeDir, scope: candidateScope });
    if (safeRoot.error) return { error: safeRoot.error };
    const existing = path.join(safeRoot.root, name);
    if (safeRoot.exists && fs.existsSync(existing)) {
      return { error: `skill "${name}" already exists in ${candidateScope} scope; choose another name` };
    }
  }

  const selectedRoot = openWritableSkillRoot({ projectDir, homeDir, scope, create: true });
  if (selectedRoot.error) return { error: selectedRoot.error };
  const destination = path.join(selectedRoot.handlePath, name);
  const document = formatSkillDocument({ name, description, content, scope, category });
  let skillDirectoryDescriptor;
  let fileDescriptor;
  let file;
  let ownsDestination = false;
  let ownsFile = false;
  let createdDestinationIdentity;
  let createdFileIdentity;

  try {
    const verifiedRoot = verifyOpenedSkillRoot(selectedRoot, { projectDir, homeDir, scope });
    if (verifiedRoot.error)
      throw new Error(verifiedRoot.error || 'skill root changed during creation');

    fs.mkdirSync(destination);
    ownsDestination = true;
    const createdStat = fs.lstatSync(destination);
    if (!createdStat.isDirectory() || createdStat.isSymbolicLink())
      throw new Error('created skill directory changed during creation');
    createdDestinationIdentity = { dev: createdStat.dev, ino: createdStat.ino };
    skillDirectoryDescriptor = openDirectoryDescriptor(destination);
    const openedDirectoryStat = fs.fstatSync(skillDirectoryDescriptor);
    if (openedDirectoryStat.dev !== createdDestinationIdentity.dev
      || openedDirectoryStat.ino !== createdDestinationIdentity.ino)
      throw new Error('skill directory changed during creation');
    file = path.join(directoryHandlePath(skillDirectoryDescriptor), 'SKILL.md');
    const { O_WRONLY, O_CREAT, O_EXCL, O_NOFOLLOW } = fs.constants;
    if (!O_NOFOLLOW) throw new Error('safe skill-file creation is not supported on this platform');
    fileDescriptor = fs.openSync(file, O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW, 0o644);
    const createdFileStat = fs.fstatSync(fileDescriptor);
    createdFileIdentity = { dev: createdFileStat.dev, ino: createdFileStat.ino };
    ownsFile = true;
    fs.writeFileSync(fileDescriptor, document, 'utf8');
    fs.fsyncSync(fileDescriptor);
    fs.closeSync(fileDescriptor);
    fileDescriptor = undefined;

    const currentDirectory = verifyOpenedSkillDirectory(
      selectedRoot, skillDirectoryDescriptor, name, { projectDir, homeDir, scope },
    );
    if (currentDirectory.error)
      throw new Error(currentDirectory.error || 'skill directory changed during creation');
    return { created: true, name, description: description.trim(), scope, category };
  } catch (error) {
    try {
      if (fileDescriptor !== undefined) fs.closeSync(fileDescriptor);
      if (ownsFile) removeCreatedSkillFile(file, createdFileIdentity);
      if (skillDirectoryDescriptor !== undefined) fs.closeSync(skillDirectoryDescriptor);
      skillDirectoryDescriptor = undefined;
      if (ownsDestination) removeCreatedSkillDirectory(selectedRoot.handlePath, name, createdDestinationIdentity);
    } catch { /* keep the original error */ }
    return { error: error.code === 'EEXIST' ? `skill "${name}" already exists` : String(error.message || error) };
  } finally {
    if (fileDescriptor !== undefined) {
      try { fs.closeSync(fileDescriptor); } catch { /* preserve the create result */ }
    }
    if (skillDirectoryDescriptor !== undefined) {
      try { fs.closeSync(skillDirectoryDescriptor); } catch { /* preserve the create result */ }
    }
    try { fs.closeSync(selectedRoot.descriptor); } catch { /* preserve the create result */ }
  }
}

export function updateSkill({
  projectDir,
  homeDir = os.homedir(),
  name,
  description,
  content,
  scope,
  category,
  expectedRevision,
}) {
  const validationError = validateSkill({ projectDir, name, description, content, scope, category });
  if (validationError) return { error: validationError };
  if (typeof expectedRevision !== 'string' || !/^[a-f0-9]{64}$/.test(expectedRevision))
    return { error: 'expectedRevision must be the SHA-256 revision returned by skill_list' };

  const safeRoot = safeWritableSkillRoot({ projectDir, homeDir, scope });
  if (safeRoot.error) return { error: safeRoot.error };
  if (!safeRoot.exists) return { error: `skill "${name}" does not exist in ${scope} scope` };
  const openedRoot = openWritableSkillRoot({ projectDir, homeDir, scope });
  if (openedRoot.error) return { error: openedRoot.error };
  const openedRootCheck = verifyOpenedSkillRoot(openedRoot, { projectDir, homeDir, scope });
  if (openedRootCheck.error || openedRoot.rootPath !== safeRoot.root) {
    try { fs.closeSync(openedRoot.descriptor); } catch { /* preserve the validation result */ }
    return { error: openedRootCheck.error || 'skill root changed during update' };
  }

  const destination = path.join(openedRoot.handlePath, name);
  let skillDirectoryDescriptor;
  let updateLock;
  let tempFile;
  let descriptor;
  let updatedIdentity;

  try {
    skillDirectoryDescriptor = openDirectoryDescriptor(destination);
    const openedDirectoryCheck = verifyOpenedSkillDirectory(
      openedRoot, skillDirectoryDescriptor, name, { projectDir, homeDir, scope },
    );
    if (openedDirectoryCheck.error) return { error: openedDirectoryCheck.error };
    const skillDirectory = directoryHandlePath(skillDirectoryDescriptor);
    updateLock = acquireSkillUpdateLock(skillDirectory);
    if (updateLock.error) return { error: updateLock.error };
    const file = path.join(skillDirectory, 'SKILL.md');
    const current = readSkill({ projectDir, homeDir, name, scope, includeRevision: true, includeIdentity: true });
    if (current.error) return { error: current.error };
    if (current.revision !== expectedRevision)
      return { error: `skill "${name}" changed since skill_list; refresh the listing before updating` };

    const { O_RDONLY, O_NOFOLLOW, O_NONBLOCK } = fs.constants;
    if (!O_NOFOLLOW) return { error: 'safe skill-file updates are not supported on this platform' };
    const currentDescriptor = fs.openSync(file, O_RDONLY | O_NOFOLLOW | (O_NONBLOCK || 0));
    let currentStat;
    let originalDocument;
    try {
      currentStat = fs.fstatSync(currentDescriptor);
      originalDocument = readBoundedSkillDocument(currentDescriptor, currentStat);
    } finally { fs.closeSync(currentDescriptor); }
    if (!currentStat.isFile() || currentStat.dev !== current.identity.dev || currentStat.ino !== current.identity.ino)
      return { error: `skill "${name}" changed since skill_list; refresh the listing before updating` };
    if (!originalDocument || createHash('sha256').update(originalDocument).digest('hex') !== expectedRevision)
      return { error: `skill "${name}" changed since skill_list; refresh the listing before updating` };

    const updatedCategory = category ?? current.category;
    const document = formatSkillDocument({ name, description, content, scope, category: updatedCategory });
    tempFile = path.join(
      skillDirectory,
      `.SKILL.md.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`,
    );
    const { O_WRONLY, O_CREAT, O_EXCL } = fs.constants;
    descriptor = fs.openSync(tempFile, O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW, currentStat.mode & 0o777);
    const tempStat = fs.fstatSync(descriptor);
    updatedIdentity = { dev: tempStat.dev, ino: tempStat.ino };
    fs.writeFileSync(descriptor, document, 'utf8');
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;

    const currentDirectory = verifyOpenedSkillDirectory(
      openedRoot, skillDirectoryDescriptor, name, { projectDir, homeDir, scope },
    );
    const latest = readSkill({ projectDir, homeDir, name, scope, includeRevision: true, includeIdentity: true });
    if (currentDirectory.error || latest.error
      || latest.revision !== expectedRevision
      || latest.identity.dev !== current.identity.dev
      || latest.identity.ino !== current.identity.ino)
      return { error: `skill "${name}" changed since skill_list; refresh the listing before updating` };

    fs.renameSync(tempFile, file);
    tempFile = undefined;
    const committedDirectory = verifyOpenedSkillDirectory(
      openedRoot, skillDirectoryDescriptor, name, { projectDir, homeDir, scope },
    );
    if (committedDirectory.error) {
      const restored = restoreUpdatedSkill(file, originalDocument, updatedIdentity, currentStat.mode);
      return {
        error: restored
          ? committedDirectory.error
          : `${committedDirectory.error}; rollback could not be verified`,
      };
    }
    return { updated: true, name, description: description.trim(), scope, category: updatedCategory };
  } catch (error) {
    return {
      error: error.code === 'ENOENT'
        ? `skill "${name}" does not exist in ${scope} scope`
        : String(error.message || error),
    };
  } finally {
    if (descriptor !== undefined) {
      try { fs.closeSync(descriptor); } catch { /* preserve the update result */ }
    }
    if (tempFile) {
      try { fs.rmSync(tempFile, { force: true }); } catch { /* preserve the update result */ }
    }
    if (updateLock) {
      try { releaseLockFile(updateLock); } catch { /* preserve the update result */ }
    }
    if (skillDirectoryDescriptor !== undefined) {
      try { fs.closeSync(skillDirectoryDescriptor); } catch { /* preserve the update result */ }
    }
    try { fs.closeSync(openedRoot.descriptor); } catch { /* preserve the update result */ }
  }
}
