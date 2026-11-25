import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const REGISTRY_NAME = 'dashboard-projects.json';
const ID_PREFIX = 'prj_';

function registryFile(env = process.env) {
  const configHome = env.XDG_CONFIG_HOME || path.join(env.HOME || os.homedir(), '.config');
  return path.join(configHome, 'guarana', REGISTRY_NAME);
}

function safeName(root) {
  const name = path.basename(root).normalize('NFKC').replace(/[\p{C}<>:"|?*]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 64);
  return name || 'Project';
}

function opaqueId(secret, root) {
  return ID_PREFIX + crypto.createHmac('sha256', secret).update(root).digest('base64url');
}

function readRegistry(file) {
  let value;
  try {
    value = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw new Error('Project registry is unavailable.');
    value = { version: 1, secret: crypto.randomBytes(32).toString('hex'), projects: [] };
    writeRegistry(file, value);
  }
  if (!value || value.version !== 1 || !/^[a-f0-9]{64}$/.test(value.secret) || !Array.isArray(value.projects)) {
    throw new Error('Project registry is unavailable.');
  }
  const projects = [];
  for (const entry of value.projects) {
    if (!entry || typeof entry.root !== 'string' || typeof entry.id !== 'string') continue;
    try {
      const canonical = fs.realpathSync(entry.root);
      if (canonical !== entry.root || entry.id !== opaqueId(value.secret, canonical)) continue;
      projects.push({ id: entry.id, root: canonical, name: safeName(canonical) });
    } catch { /* stale or inaccessible registrations are not selectable */ }
  }
  return { version: 1, secret: value.secret, projects };
}

function writeRegistry(file, value) {
  const directory = path.dirname(file);
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const temporary = path.join(directory, `.${REGISTRY_NAME}.${process.pid}.${crypto.randomBytes(8).toString('hex')}.tmp`);
  let fd;
  try {
    fd = fs.openSync(temporary, 'wx', 0o600);
    fs.writeFileSync(fd, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;
    fs.renameSync(temporary, file);
  } catch (error) {
    if (fd !== undefined) try { fs.closeSync(fd); } catch { /* preserve original error */ }
    try { fs.rmSync(temporary, { force: true }); } catch { /* preserve original error */ }
    throw error;
  }
}

export function createProjectRegistry({ root, env = process.env } = {}) {
  const currentRoot = fs.realpathSync(root);
  const file = registryFile(env);

  function load() { return readRegistry(file); }

  function list() {
    const registry = load();
    const projects = [...registry.projects];
    const registeredIds = new Set(registry.projects.map(({ id }) => id));
    const currentID = opaqueId(registry.secret, currentRoot);
    if (!projects.some((project) => project.root === currentRoot)) {
      projects.push({ id: currentID, root: currentRoot, name: safeName(currentRoot) });
    }
    return {
      projects: projects.map(({ id, name }) => ({ id, name, registered: registeredIds.has(id) })),
      currentProjectId: currentID,
    };
  }

  function registerCurrent() {
    const registry = load();
    const id = opaqueId(registry.secret, currentRoot);
    if (!registry.projects.some((project) => project.root === currentRoot)) {
      registry.projects.push({ id, root: currentRoot, name: safeName(currentRoot) });
      writeRegistry(file, registry);
    }
    return { id, name: safeName(currentRoot) };
  }

  function unregister(id) {
    const registry = load();
    const index = registry.projects.findIndex((project) => project.id === id);
    if (index < 0) return false;
    registry.projects.splice(index, 1);
    writeRegistry(file, registry);
    return true;
  }

  function resolve(id) {
    if (id === undefined) return currentRoot;
    if (typeof id !== 'string' || !new RegExp(`^${ID_PREFIX}[A-Za-z0-9_-]{43}$`).test(id)) return null;
    const registry = load();
    const match = registry.projects.find((project) => project.id === id);
    if (match) return match.root;
    return id === opaqueId(registry.secret, currentRoot) ? currentRoot : null;
  }

  return { list, registerCurrent, unregister, resolve, currentRoot };
}
