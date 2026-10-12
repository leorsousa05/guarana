// Guarana-generated OpenCode skill storage and discovery. Zero dependencies.
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { isSensitive } from '../memory/security.js';

export const MAX_SKILL_CONTENT_BYTES = 32 * 1024;
export const MAX_SKILL_DESCRIPTION_LENGTH = 1024;

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
  return { name, description, scope, body: document.slice(match[0].length) };
}

function readSkills(root, scope, includeRevision) {
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
    const directory = path.join(root, entry.name);
    const file = path.join(directory, 'SKILL.md');
    try {
      if (!fs.lstatSync(file).isFile()) continue;
      const stat = fs.statSync(file);
      if (stat.size > MAX_SKILL_CONTENT_BYTES + 4096) continue;
      const documentBytes = fs.readFileSync(file);
      const parsed = parseFrontmatter(documentBytes.toString('utf8'));
      if (!parsed || parsed.name !== entry.name || !parsed.description) continue;
      skills.push({
        name: parsed.name,
        description: parsed.description,
        content: parsed.body.trim(),
        scope,
        updatedAt: stat.mtimeMs,
        ...(includeRevision ? { revision: createHash('sha256').update(documentBytes).digest('hex') } : {}),
      });
    } catch (error) {
      if (error.code !== 'ENOENT' && error.code !== 'EACCES' && error.code !== 'ELOOP') throw error;
    }
  }
  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

export function listSkills({ projectDir, homeDir = os.homedir(), includeRevision = false }) {
  const roots = skillRoots({ projectDir, homeDir });
  return {
    global: readSkills(roots.global, 'global', includeRevision),
    project: readSkills(roots.project, 'project', includeRevision),
  };
}

function validateSkill({ name, description, content, scope, projectDir }) {
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
  if (content.trimStart().startsWith('---')) return 'content must not include a second SKILL.md frontmatter block';
  if (isSensitive(`${description}\n${content}`)) return 'content appears to contain a secret; remove it before creating the skill';
  return null;
}

function formatSkillDocument({ name, description, content, scope }) {
  return [
    '---',
    `name: ${name}`,
    `description: ${JSON.stringify(description.trim())}`,
    'metadata:',
    '  guarana-generated: "true"',
    `  guarana-scope: ${scope}`,
    '---',
    '',
    content.trim(),
    '',
  ].join('\n');
}

export function createSkill({ projectDir, homeDir = os.homedir(), name, description, content, scope }) {
  const validationError = validateSkill({ projectDir, name, description, content, scope });
  if (validationError) return { error: validationError };

  const roots = skillRoots({ projectDir, homeDir });
  for (const candidateScope of ['project', 'global']) {
    const existing = path.join(roots[candidateScope], name);
    if (fs.existsSync(existing)) {
      return { error: `skill "${name}" already exists in ${candidateScope} scope; choose another name` };
    }
  }

  const root = roots[scope];
  const destination = path.resolve(root, name);
  if (path.dirname(destination) !== path.resolve(root)) return { error: 'invalid skill destination' };
  const file = path.join(destination, 'SKILL.md');
  const document = formatSkillDocument({ name, description, content, scope });

  let ownsDestination = false;
  let ownsFile = false;
  let descriptor;
  try {
    fs.mkdirSync(root, { recursive: true });
    fs.mkdirSync(destination);
    ownsDestination = true;
    descriptor = fs.openSync(file, 'wx', 0o644);
    ownsFile = true;
    fs.writeFileSync(descriptor, document, 'utf8');
    fs.closeSync(descriptor);
    descriptor = undefined;
    return { created: true, name, description: description.trim(), scope };
  } catch (error) {
    try {
      if (descriptor !== undefined) fs.closeSync(descriptor);
      if (ownsFile) fs.rmSync(file, { force: true });
      if (ownsDestination) fs.rmdirSync(destination);
    } catch { /* keep the original error */ }
    return { error: error.code === 'EEXIST' ? `skill "${name}" already exists` : String(error.message || error) };
  }
}

export function updateSkill({
  projectDir,
  homeDir = os.homedir(),
  name,
  description,
  content,
  scope,
  expectedRevision,
}) {
  const validationError = validateSkill({ projectDir, name, description, content, scope });
  if (validationError) return { error: validationError };
  if (typeof expectedRevision !== 'string' || !/^[a-f0-9]{64}$/.test(expectedRevision))
    return { error: 'expectedRevision must be the SHA-256 revision returned by skill_list' };

  const root = skillRoots({ projectDir, homeDir })[scope];
  const destination = path.resolve(root, name);
  if (path.dirname(destination) !== path.resolve(root)) return { error: 'invalid skill destination' };
  const file = path.join(destination, 'SKILL.md');
  let tempFile;
  let descriptor;

  try {
    if (!fs.lstatSync(destination).isDirectory())
      return { error: `skill "${name}" is not a regular skill directory in ${scope} scope` };
    const stat = fs.lstatSync(file);
    if (!stat.isFile()) return { error: `skill "${name}" SKILL.md must be a regular file` };
    const documentBytes = fs.readFileSync(file);
    const revision = createHash('sha256').update(documentBytes).digest('hex');
    const parsed = parseFrontmatter(documentBytes.toString('utf8'));
    if (!parsed) return { error: `skill "${name}" is not a Guarana-generated skill` };
    if (parsed.name !== name) return { error: `skill identity does not match "${name}"` };
    if (parsed.scope !== scope) return { error: `skill "${name}" scope does not match ${scope}` };
    if (revision !== expectedRevision)
      return { error: `skill "${name}" changed since skill_list; refresh the listing before updating` };

    const document = formatSkillDocument({ name, description, content, scope });
    tempFile = path.join(
      destination,
      `.SKILL.md.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`,
    );
    descriptor = fs.openSync(tempFile, 'wx', stat.mode & 0o777);
    fs.writeFileSync(descriptor, document, 'utf8');
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;

    const currentStat = fs.lstatSync(file);
    if (
      !currentStat.isFile() ||
      currentStat.dev !== stat.dev ||
      currentStat.ino !== stat.ino ||
      createHash('sha256').update(fs.readFileSync(file)).digest('hex') !== expectedRevision
    )
      return { error: `skill "${name}" changed since skill_list; refresh the listing before updating` };
    fs.renameSync(tempFile, file);
    tempFile = undefined;
    return { updated: true, name, description: description.trim(), scope };
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
  }
}
