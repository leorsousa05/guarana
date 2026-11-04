import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createSkill, listSkills, readSkill, skillRoots, updateSkill } from './index.js';

const goodSkill = {
  name: 'release-checklist',
  description: 'Prepare and validate a release candidate.',
  content: '# Release checklist\n\nRun the project checks, inspect the artifact, and record the host version.',
};

function fixture(t) {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-skills-project-'));
  const homeDir = path.join(projectDir, 'home');
  fs.mkdirSync(homeDir, { recursive: true });
  t.after(() => fs.rmSync(projectDir, { recursive: true, force: true }));
  return { projectDir, homeDir };
}

test('creates OpenCode-discoverable project skills with Guarana metadata', (t) => {
  const dirs = fixture(t);
  const result = createSkill({ ...dirs, ...goodSkill, scope: 'project' });
  const file = path.join(dirs.projectDir, '.opencode', 'skills', goodSkill.name, 'SKILL.md');
  assert.deepEqual(result, {
    created: true,
    name: goodSkill.name,
    description: goodSkill.description,
    scope: 'project',
    category: 'general',
  });
  assert.match(fs.readFileSync(file, 'utf8'), /^---\nname: release-checklist/m);
  assert.match(fs.readFileSync(file, 'utf8'), /guarana-generated: "true"/);
  assert.match(fs.readFileSync(file, 'utf8'), /guarana-scope: project/);
  assert.match(fs.readFileSync(file, 'utf8'), /guarana-category: general/);
});

test('keeps topical category separate from scope and reads skill bodies on demand', (t) => {
  const dirs = fixture(t);
  const result = createSkill({ ...dirs, ...goodSkill, scope: 'project', category: 'automation' });
  assert.equal(result.category, 'automation');
  assert.equal(result.scope, 'project');

  const catalog = listSkills(dirs).project[0];
  assert.equal(catalog.category, 'automation');
  assert.equal(catalog.scope, 'project');
  assert.equal('content' in catalog, false);

  const loaded = readSkill({ ...dirs, name: goodSkill.name, scope: 'project' });
  assert.equal(loaded.category, 'automation');
  assert.equal(loaded.content, goodSkill.content);
  assert.match(loaded.revision, /^[a-f0-9]{64}$/);
  const withoutRevision = readSkill({ ...dirs, name: goodSkill.name, scope: 'project', includeRevision: false });
  assert.equal('revision' in withoutRevision, false);
});

test('never reads external skill contents when the path is replaced after validation', (t) => {
  const dirs = fixture(t);
  createSkill({ ...dirs, ...goodSkill, scope: 'project' });
  const file = path.join(skillRoots(dirs).project, goodSkill.name, 'SKILL.md');
  const outside = path.join(dirs.homeDir, 'outside-skill.md');
  fs.writeFileSync(outside, [
    '---',
    `name: ${goodSkill.name}`,
    'description: Prepare and validate a release candidate.',
    'metadata:',
    '  guarana-generated: "true"',
    '  guarana-scope: project',
    '  guarana-category: general',
    '---',
    'EXTERNAL_SECRET_CONTENT',
  ].join('\n'));

  const originalReadSync = fs.readSync;
  let swapped = false;
  fs.readSync = function (descriptor, ...args) {
    if (!swapped) {
      fs.unlinkSync(file);
      fs.symlinkSync(outside, file);
      swapped = true;
    }
    return originalReadSync.call(this, descriptor, ...args);
  };
  try {
    const loaded = readSkill({ ...dirs, name: goodSkill.name, scope: 'project' });
    assert.equal(swapped, true);
    assert.ok(loaded.error || loaded.content === goodSkill.content);
    assert.notEqual(loaded.content, 'EXTERNAL_SECRET_CONTENT');
  } finally {
    fs.readSync = originalReadSync;
  }
});

test('rejects a skill-root symlink swapped in after the initial path checks', (t) => {
  const dirs = fixture(t);
  createSkill({ ...dirs, ...goodSkill, scope: 'project' });
  const root = skillRoots(dirs).project;
  const file = path.join(root, goodSkill.name, 'SKILL.md');
  const outsideRoot = path.join(dirs.homeDir, 'outside-skills');
  const outsideDirectory = path.join(outsideRoot, goodSkill.name);
  const originalRoot = path.join(dirs.homeDir, 'original-skills');
  fs.mkdirSync(outsideDirectory, { recursive: true });
  fs.writeFileSync(path.join(outsideDirectory, 'SKILL.md'), [
    '---',
    `name: ${goodSkill.name}`,
    'description: Prepare and validate a release candidate.',
    'metadata:',
    '  guarana-generated: "true"',
    '  guarana-scope: project',
    '  guarana-category: general',
    '---',
    'EXTERNAL_ROOT_SECRET_CONTENT',
  ].join('\n'));

  const originalOpenSync = fs.openSync;
  fs.openSync = function (target, ...args) {
    if (target === file) {
      fs.renameSync(root, originalRoot);
      fs.symlinkSync(outsideRoot, root, 'dir');
    }
    return originalOpenSync.call(this, target, ...args);
  };
  try {
    const loaded = readSkill({ ...dirs, name: goodSkill.name, scope: 'project' });
    assert.ok(loaded.error);
    assert.notEqual(loaded.content, 'EXTERNAL_ROOT_SECRET_CONTENT');
  } finally {
    fs.openSync = originalOpenSync;
  }
});

test('rejects project skill roots redirected outside the project by a symlinked ancestor', (t) => {
  const dirs = fixture(t);
  const outsideOpenCode = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-outside-opencode-'));
  t.after(() => fs.rmSync(outsideOpenCode, { recursive: true, force: true }));
  const outsideSkill = path.join(outsideOpenCode, 'skills', goodSkill.name);
  fs.mkdirSync(outsideSkill, { recursive: true });
  fs.writeFileSync(path.join(outsideSkill, 'SKILL.md'), [
    '---',
    `name: ${goodSkill.name}`,
    `description: ${JSON.stringify(goodSkill.description)}`,
    'metadata:',
    '  guarana-generated: "true"',
    '  guarana-scope: project',
    '  guarana-category: general',
    '---',
    'OUTSIDE_PROJECT_SKILL_CONTENT',
  ].join('\n'));
  try {
    fs.symlinkSync(outsideOpenCode, path.join(dirs.projectDir, '.opencode'), 'dir');
  } catch (error) {
    if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) {
      t.skip('directory symlink creation is not permitted on this platform');
      return;
    }
    throw error;
  }

  const loaded = readSkill({ ...dirs, name: goodSkill.name, scope: 'project' });
  assert.ok(loaded.error);
  assert.equal(loaded.content, undefined);
  assert.deepEqual(listSkills(dirs).project, []);
});

test('does not update a project skill through a symlinked OpenCode ancestor', (t) => {
  const dirs = fixture(t);
  const outsideProject = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-update-outside-project-'));
  t.after(() => fs.rmSync(outsideProject, { recursive: true, force: true }));
  const created = createSkill({ ...dirs, projectDir: outsideProject, ...goodSkill, scope: 'project' });
  assert.equal(created.created, true);
  const outsideRoot = path.join(outsideProject, '.opencode');
  const outsideFile = path.join(outsideRoot, 'skills', goodSkill.name, 'SKILL.md');
  const before = fs.readFileSync(outsideFile);
  const expectedRevision = createHash('sha256').update(before).digest('hex');
  try {
    fs.symlinkSync(outsideRoot, path.join(dirs.projectDir, '.opencode'), 'dir');
  } catch (error) {
    if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) {
      t.skip('directory symlink creation is not permitted on this platform');
      return;
    }
    throw error;
  }

  const result = updateSkill({
    ...dirs,
    ...goodSkill,
    scope: 'project',
    expectedRevision,
    description: 'A maliciously redirected update.',
  });
  assert.ok(result.error);
  assert.deepEqual(fs.readFileSync(outsideFile), before);
});

test('does not create project skills through a symlinked OpenCode ancestor', (t) => {
  const dirs = fixture(t);
  const outsideRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-create-outside-opencode-'));
  t.after(() => fs.rmSync(outsideRoot, { recursive: true, force: true }));
  try {
    fs.symlinkSync(outsideRoot, path.join(dirs.projectDir, '.opencode'), 'dir');
  } catch (error) {
    if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) {
      t.skip('directory symlink creation is not permitted on this platform');
      return;
    }
    throw error;
  }

  const result = createSkill({ ...dirs, ...goodSkill, scope: 'project' });
  assert.ok(result.error);
  assert.equal(fs.existsSync(path.join(outsideRoot, 'skills', goodSkill.name, 'SKILL.md')), false);
});

test('does not write a project skill through a root symlink swapped at destination creation', (t) => {
  const dirs = fixture(t);
  const root = skillRoots(dirs).project;
  fs.mkdirSync(root, { recursive: true });
  const outsideRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-create-race-outside-'));
  const movedRoot = path.join(dirs.homeDir, 'moved-project-skills');
  const outsideFile = path.join(outsideRoot, goodSkill.name, 'SKILL.md');
  t.after(() => fs.rmSync(outsideRoot, { recursive: true, force: true }));

  const originalMkdirSync = fs.mkdirSync;
  let swapped = false;
  fs.mkdirSync = function (target, ...args) {
    if (!swapped && typeof target === 'string' && path.basename(target) === goodSkill.name) {
      fs.renameSync(root, movedRoot);
      fs.symlinkSync(outsideRoot, root, 'dir');
      swapped = true;
    }
    return originalMkdirSync.call(this, target, ...args);
  };
  let result;
  try {
    result = createSkill({ ...dirs, ...goodSkill, scope: 'project' });
  } finally {
    fs.mkdirSync = originalMkdirSync;
  }

  assert.equal(swapped, true);
  assert.ok(result.error);
  assert.equal(fs.existsSync(outsideFile), false);
});

test('does not update a project skill through a root symlink swapped at final rename', (t) => {
  const dirs = fixture(t);
  const original = createSkill({ ...dirs, ...goodSkill, scope: 'project' });
  assert.equal(original.created, true);
  const root = skillRoots(dirs).project;
  const file = path.join(root, goodSkill.name, 'SKILL.md');
  const outsideRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-update-race-outside-'));
  const movedRoot = path.join(dirs.homeDir, 'moved-project-skills');
  const outsideFile = path.join(outsideRoot, goodSkill.name, 'SKILL.md');
  fs.mkdirSync(path.dirname(outsideFile), { recursive: true });
  fs.writeFileSync(outsideFile, 'OUTSIDE_SKILL_MUST_NOT_CHANGE');
  const before = fs.readFileSync(outsideFile);
  const expectedRevision = createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  t.after(() => fs.rmSync(outsideRoot, { recursive: true, force: true }));

  const originalRenameSync = fs.renameSync;
  let swapped = false;
  fs.renameSync = function (source, target) {
    if (!swapped && typeof target === 'string' && path.basename(target) === 'SKILL.md'
      && typeof source === 'string' && path.basename(source).startsWith('.SKILL.md.')) {
      const outsideTemp = path.join(outsideRoot, goodSkill.name, path.basename(source));
      fs.copyFileSync(source, outsideTemp);
      originalRenameSync(root, movedRoot);
      fs.symlinkSync(outsideRoot, root, 'dir');
      swapped = true;
    }
    return originalRenameSync.call(this, source, target);
  };
  let result;
  try {
    result = updateSkill({
      ...dirs,
      ...goodSkill,
      scope: 'project',
      expectedRevision,
      description: 'Updated without following a swapped root.',
    });
  } finally {
    fs.renameSync = originalRenameSync;
  }

  assert.equal(swapped, true);
  assert.ok(result.error);
  assert.deepEqual(fs.readFileSync(outsideFile), before);
});

test('does not report successful creation when the opened skill root is moved and replaced by a real directory', (t) => {
  const dirs = fixture(t);
  const root = skillRoots(dirs).project;
  fs.mkdirSync(root, { recursive: true });
  const movedRoot = path.join(dirs.homeDir, 'moved-project-skills-real-root');
  const originalMkdirSync = fs.mkdirSync;
  let swapped = false;
  fs.mkdirSync = function (target, ...args) {
    if (!swapped && typeof target === 'string' && path.basename(target) === goodSkill.name) {
      fs.renameSync(root, movedRoot);
      originalMkdirSync.call(this, root, { recursive: true });
      swapped = true;
    }
    return originalMkdirSync.call(this, target, ...args);
  };
  let result;
  try {
    result = createSkill({ ...dirs, ...goodSkill, scope: 'project' });
  } finally {
    fs.mkdirSync = originalMkdirSync;
  }

  assert.equal(swapped, true);
  assert.ok(result.error);
  assert.equal(fs.existsSync(path.join(root, goodSkill.name, 'SKILL.md')), false);
  assert.equal(fs.existsSync(path.join(movedRoot, goodSkill.name, 'SKILL.md')), false);
});

test('does not report successful update when the opened skill root is moved and replaced by a real directory', (t) => {
  const dirs = fixture(t);
  const original = createSkill({ ...dirs, ...goodSkill, scope: 'project' });
  assert.equal(original.created, true);
  const root = skillRoots(dirs).project;
  const file = path.join(root, goodSkill.name, 'SKILL.md');
  const before = fs.readFileSync(file);
  const expectedRevision = createHash('sha256').update(before).digest('hex');
  const movedRoot = path.join(dirs.homeDir, 'moved-project-skills-real-root');
  const originalRenameSync = fs.renameSync;
  let swapped = false;
  fs.renameSync = function (source, target) {
    if (!swapped && typeof target === 'string' && path.basename(target) === 'SKILL.md'
      && typeof source === 'string' && path.basename(source).startsWith('.SKILL.md.')) {
      originalRenameSync.call(this, root, movedRoot);
      fs.mkdirSync(root, { recursive: true });
      swapped = true;
    }
    return originalRenameSync.call(this, source, target);
  };
  let result;
  try {
    result = updateSkill({
      ...dirs,
      ...goodSkill,
      scope: 'project',
      expectedRevision,
      description: 'Updated after the root was relocated.',
    });
  } finally {
    fs.renameSync = originalRenameSync;
  }

  assert.equal(swapped, true);
  assert.ok(result.error);
  assert.equal(fs.existsSync(path.join(root, goodSkill.name, 'SKILL.md')), false);
  assert.deepEqual(fs.readFileSync(path.join(movedRoot, goodSkill.name, 'SKILL.md')), before);
});

test('does not report successful creation when its opened skill directory is moved and replaced', (t) => {
  const dirs = fixture(t);
  const root = skillRoots(dirs).project;
  fs.mkdirSync(root, { recursive: true });
  const destination = path.join(root, goodSkill.name);
  const movedDirectory = path.join(dirs.homeDir, 'moved-created-skill-directory');
  const originalOpenSync = fs.openSync;
  const originalRenameSync = fs.renameSync;
  const originalMkdirSync = fs.mkdirSync;
  let swapped = false;
  fs.openSync = function (target, ...args) {
    if (!swapped && typeof target === 'string' && path.basename(target) === 'SKILL.md'
      && (target.includes('/proc/self/fd/') || target.includes('/dev/fd/'))) {
      originalRenameSync.call(this, destination, movedDirectory);
      originalMkdirSync.call(this, destination);
      swapped = true;
    }
    return originalOpenSync.call(this, target, ...args);
  };
  let result;
  try {
    result = createSkill({ ...dirs, ...goodSkill, scope: 'project' });
  } finally {
    fs.openSync = originalOpenSync;
  }

  assert.equal(swapped, true);
  assert.ok(result.error);
  assert.equal(fs.existsSync(destination), true, 'cleanup must not remove the replacement directory');
  assert.equal(fs.existsSync(path.join(destination, 'SKILL.md')), false);
  assert.equal(fs.existsSync(path.join(movedDirectory, 'SKILL.md')), false);
});

test('preserves an unowned SKILL.md replacement during failed create cleanup', (t) => {
  const dirs = fixture(t);
  const root = skillRoots(dirs).project;
  fs.mkdirSync(root, { recursive: true });
  const destination = path.join(root, goodSkill.name);
  const movedDirectory = path.join(dirs.homeDir, 'moved-created-skill-with-file-replacement');
  const originalOpenSync = fs.openSync;
  const originalFsyncSync = fs.fsyncSync;
  const originalRenameSync = fs.renameSync;
  const originalMkdirSync = fs.mkdirSync;
  const originalUnlinkSync = fs.unlinkSync;
  const originalWriteFileSync = fs.writeFileSync;
  let createdFileDescriptor;
  let filePath;
  let replaced = false;
  fs.openSync = function (target, ...args) {
    const descriptor = originalOpenSync.call(this, target, ...args);
    if (!createdFileDescriptor && typeof target === 'string' && path.basename(target) === 'SKILL.md'
      && (target.includes('/proc/self/fd/') || target.includes('/dev/fd/'))) {
      createdFileDescriptor = descriptor;
      filePath = target;
    }
    return descriptor;
  };
  fs.fsyncSync = function (descriptor) {
    const result = originalFsyncSync.call(this, descriptor);
    if (!replaced && descriptor === createdFileDescriptor) {
      originalRenameSync.call(fs, destination, movedDirectory);
      originalMkdirSync.call(fs, destination);
      originalUnlinkSync.call(fs, filePath);
      originalWriteFileSync.call(fs, filePath, 'unowned replacement content');
      replaced = true;
    }
    return result;
  };
  let result;
  try {
    result = createSkill({ ...dirs, ...goodSkill, scope: 'project' });
  } finally {
    fs.openSync = originalOpenSync;
    fs.fsyncSync = originalFsyncSync;
  }

  assert.equal(replaced, true);
  assert.ok(result.error);
  assert.equal(fs.readFileSync(path.join(movedDirectory, 'SKILL.md'), 'utf8'), 'unowned replacement content');
  assert.equal(fs.existsSync(path.join(destination, 'SKILL.md')), false);
});

test('does not report successful update when its opened skill directory is moved and replaced', (t) => {
  const dirs = fixture(t);
  const original = createSkill({ ...dirs, ...goodSkill, scope: 'project' });
  assert.equal(original.created, true);
  const root = skillRoots(dirs).project;
  const destination = path.join(root, goodSkill.name);
  const file = path.join(destination, 'SKILL.md');
  const before = fs.readFileSync(file);
  const expectedRevision = createHash('sha256').update(before).digest('hex');
  const movedDirectory = path.join(dirs.homeDir, 'moved-updated-skill-directory');
  const originalRenameSync = fs.renameSync;
  const originalMkdirSync = fs.mkdirSync;
  let swapped = false;
  fs.renameSync = function (source, target, ...args) {
    if (!swapped && typeof target === 'string' && path.basename(target) === 'SKILL.md'
      && typeof source === 'string' && path.basename(source).startsWith('.SKILL.md.')) {
      originalRenameSync.call(this, destination, movedDirectory);
      originalMkdirSync.call(this, destination);
      swapped = true;
    }
    return originalRenameSync.call(this, source, target, ...args);
  };
  let result;
  try {
    result = updateSkill({
      ...dirs,
      ...goodSkill,
      scope: 'project',
      expectedRevision,
      description: 'Updated after the skill directory was relocated.',
    });
  } finally {
    fs.renameSync = originalRenameSync;
  }

  assert.equal(swapped, true);
  assert.ok(result.error);
  assert.equal(fs.existsSync(path.join(destination, 'SKILL.md')), false);
  assert.deepEqual(fs.readFileSync(path.join(movedDirectory, 'SKILL.md')), before);
});

test('rejects skill descriptions and bodies that exceed their field limits when reading', (t) => {
  const dirs = fixture(t);
  const root = skillRoots(dirs).project;
  const writeSkill = (name, description, content) => {
    const directory = path.join(root, name);
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, 'SKILL.md'), [
      '---', `name: ${name}`, `description: ${JSON.stringify(description)}`,
      'metadata:', '  guarana-generated: "true"', '  guarana-scope: project',
      '  guarana-category: general', '---', content,
    ].join('\n'));
  };
  writeSkill('oversized-body', goodSkill.description, 'x'.repeat(32 * 1024 + 1));
  writeSkill('oversized-description', 'd'.repeat(1025), 'Body within limits.');

  assert.match(readSkill({ ...dirs, name: 'oversized-body', scope: 'project' }).error, /content exceeds/);
  assert.match(readSkill({ ...dirs, name: 'oversized-description', scope: 'project' }).error, /description/);
});

test('opens a skill replaced with a FIFO nonblocking and rejects it before reading', (t) => {
  if (process.platform === 'win32' || !fs.constants.O_NONBLOCK) {
    t.skip('nonblocking FIFO open is not supported on this platform');
    return;
  }
  const dirs = fixture(t);
  createSkill({ ...dirs, ...goodSkill, scope: 'project' });
  const file = path.join(skillRoots(dirs).project, goodSkill.name, 'SKILL.md');
  const originalOpenSync = fs.openSync;
  let capturedFlags;
  fs.openSync = function (target, flags, ...args) {
    if (target === file && capturedFlags === undefined) {
      fs.unlinkSync(file);
      const fifo = spawnSync('mkfifo', [file], { encoding: 'utf8' });
      if (fifo.error || fifo.status !== 0) throw fifo.error || new Error(fifo.stderr || 'mkfifo failed');
      capturedFlags = flags;
      if (!(flags & fs.constants.O_NONBLOCK)) throw new Error('special-file open must be nonblocking');
    }
    return originalOpenSync.call(this, target, flags, ...args);
  };
  try {
    const loaded = readSkill({ ...dirs, name: goodSkill.name, scope: 'project' });
    assert.ok(loaded.error);
    assert.equal(capturedFlags & fs.constants.O_NONBLOCK, fs.constants.O_NONBLOCK);
  } finally {
    fs.openSync = originalOpenSync;
  }
});

test('lists skill contents from the validated descriptor if the path changes during listing', (t) => {
  const dirs = fixture(t);
  createSkill({ ...dirs, ...goodSkill, scope: 'project' });
  const file = path.join(skillRoots(dirs).project, goodSkill.name, 'SKILL.md');
  const outside = path.join(dirs.homeDir, 'outside-list-skill.md');
  fs.writeFileSync(outside, [
    '---',
    `name: ${goodSkill.name}`,
    `description: ${JSON.stringify(goodSkill.description)}`,
    'metadata:',
    '  guarana-generated: "true"',
    '  guarana-scope: project',
    '  guarana-category: general',
    '---',
    'EXTERNAL_LIST_SECRET_CONTENT',
  ].join('\n'));
  const originalOpenSync = fs.openSync;
  let swapped = false;
  fs.openSync = function (target, ...args) {
    if (target === file && !swapped) {
      fs.unlinkSync(file);
      fs.symlinkSync(outside, file);
      swapped = true;
    }
    return originalOpenSync.call(this, target, ...args);
  };
  try {
    const listed = listSkills({ ...dirs, includeContent: true }).project;
    assert.equal(swapped, true);
    assert.deepEqual(listed, []);
    assert.doesNotMatch(JSON.stringify(listed), /EXTERNAL_LIST_SECRET_CONTENT/);
  } finally {
    fs.openSync = originalOpenSync;
  }
});

test('rejects skill files that grow beyond the document limit after opening', (t) => {
  const dirs = fixture(t);
  createSkill({ ...dirs, ...goodSkill, scope: 'project' });
  const file = path.join(skillRoots(dirs).project, goodSkill.name, 'SKILL.md');
  const originalFstatSync = fs.fstatSync;
  let grew = false;
  fs.fstatSync = function (descriptor, ...args) {
    const stat = originalFstatSync.call(this, descriptor, ...args);
    if (!grew && typeof descriptor === 'number') {
      grew = true;
      fs.appendFileSync(file, 'X'.repeat(64 * 1024));
    }
    return stat;
  };
  try {
    const loaded = readSkill({ ...dirs, name: goodSkill.name, scope: 'project' });
    assert.ok(loaded.error);
    assert.equal(loaded.content, undefined);
  } finally {
    fs.fstatSync = originalFstatSync;
  }
});

test('rejects unsupported categories and preserves category when updating without a replacement', (t) => {
  const dirs = fixture(t);
  assert.match(createSkill({ ...dirs, ...goodSkill, scope: 'project', category: 'misc' }).error, /category/);
  createSkill({ ...dirs, ...goodSkill, scope: 'project', category: 'development' });
  const listed = listSkills({ ...dirs, includeRevision: true }).project[0];
  const updated = updateSkill({
    ...dirs, ...goodSkill, scope: 'project', expectedRevision: listed.revision,
    description: 'A better release procedure.',
  });
  assert.equal(updated.category, 'development');
  const catalog = listSkills(dirs).project[0];
  assert.equal(catalog.category, 'development');
  assert.equal('content' in catalog, false);
});

test('creates global skills in the user OpenCode skill root', (t) => {
  const dirs = fixture(t);
  const result = createSkill({ ...dirs, ...goodSkill, scope: 'global' });
  assert.equal(result.scope, 'global');
  assert.ok(fs.existsSync(path.join(dirs.homeDir, '.agents', 'skills', goodSkill.name, 'SKILL.md')));
  assert.equal(fs.existsSync(path.join(dirs.projectDir, '.opencode', 'skills', goodSkill.name)), false);
});

test('reads valid maximum-size skills with worst-case escaped descriptions', (t) => {
  const dirs = fixture(t);
  const description = '\0'.repeat(1024);
  const content = 'x'.repeat(32 * 1024);
  const created = createSkill({ ...dirs, ...goodSkill, description, content, scope: 'project' });
  assert.equal(created.created, true);
  assert.equal(listSkills(dirs).project.length, 1);
  const loaded = readSkill({ ...dirs, name: goodSkill.name, scope: 'project' });
  assert.equal(loaded.error, undefined);
  assert.equal(loaded.description, description);
  assert.equal(loaded.content, content);
});

test('lists only Guarana-generated skills in their storage scope without paths', (t) => {
  const dirs = fixture(t);
  createSkill({ ...dirs, ...goodSkill, scope: 'global' });
  const manualDir = path.join(skillRoots(dirs).project, 'manual-skill');
  fs.mkdirSync(manualDir, { recursive: true });
  fs.writeFileSync(path.join(manualDir, 'SKILL.md'), '---\nname: manual-skill\ndescription: Manual\n---\n# Manual\n');

  const result = listSkills(dirs);
  assert.deepEqual(result.project, []);
  assert.deepEqual(result.global.map(({ name, scope }) => ({ name, scope })), [
    { name: goodSkill.name, scope: 'global' },
  ]);
  assert.equal('revision' in result.global[0], false);
  assert.equal('content' in result.global[0], false);
  const withRevision = listSkills({ ...dirs, includeRevision: true });
  const globalFile = path.join(skillRoots(dirs).global, goodSkill.name, 'SKILL.md');
  assert.equal(withRevision.global[0].revision, createHash('sha256').update(fs.readFileSync(globalFile)).digest('hex'));
  assert.equal(JSON.stringify(result).includes(dirs.homeDir), false);
});

test('does not overwrite a skill with the same name in either scope', (t) => {
  const dirs = fixture(t);
  const existing = path.join(skillRoots(dirs).global, goodSkill.name);
  fs.mkdirSync(existing, { recursive: true });
  fs.writeFileSync(path.join(existing, 'SKILL.md'), 'user-owned');

  const result = createSkill({ ...dirs, ...goodSkill, scope: 'project' });
  assert.match(result.error, /already exists in global scope/);
  assert.equal(fs.readFileSync(path.join(existing, 'SKILL.md'), 'utf8'), 'user-owned');
});

test('rejects invalid names, scope, descriptions, frontmatter, size, and secret-shaped content', (t) => {
  const dirs = fixture(t);
  const create = (overrides = {}) => createSkill({ ...dirs, ...goodSkill, scope: 'project', ...overrides });
  assert.match(create({ name: '../escape' }).error, /slug/);
  assert.match(create({ scope: 'workspace' }).error, /scope/);
  assert.match(create({ description: 'two\nlines' }).error, /one line/);
  assert.match(create({ content: '---\nname: injected\n---\n# body' }).error, /frontmatter/);
  assert.match(create({ content: 'x'.repeat(32 * 1024 + 1) }).error, /exceeds/);
  assert.match(create({ content: '# Use this API key\n\ntoken: ghp_abcdefgh12345678' }).error, /secret/);
});

test('updates an existing Guarana skill using its listed revision', (t) => {
  const dirs = fixture(t);
  createSkill({ ...dirs, ...goodSkill, scope: 'project' });
  const listed = listSkills({ ...dirs, includeRevision: true }).project[0];
  const updatedSkill = {
    ...goodSkill,
    description: 'Prepare, validate, and document a release candidate.',
    content: '# Release checklist\n\nRun focused checks, inspect the artifact, and document the final result.',
  };

  const result = updateSkill({
    ...dirs,
    ...updatedSkill,
    scope: 'project',
    expectedRevision: listed.revision,
  });
  const file = path.join(dirs.projectDir, '.opencode', 'skills', goodSkill.name, 'SKILL.md');

  assert.deepEqual(result, {
    updated: true,
    name: goodSkill.name,
    description: updatedSkill.description,
    scope: 'project',
    category: 'general',
  });
  assert.equal(listSkills(dirs).project[0].description, updatedSkill.description);
  assert.equal(listSkills({ ...dirs, includeContent: true }).project[0].content, updatedSkill.content);
  assert.match(fs.readFileSync(file, 'utf8'), /guarana-generated: "true"/);
  assert.match(fs.readFileSync(file, 'utf8'), /guarana-scope: project/);
  assert.deepEqual(fs.readdirSync(path.dirname(file)), ['SKILL.md']);
});

test('serializes skill updates across processes so a stale concurrent writer cannot overwrite', (t) => {
  const dirs = fixture(t);
  assert.equal(createSkill({ ...dirs, ...goodSkill, scope: 'project' }).created, true);
  const current = readSkill({ ...dirs, name: goodSkill.name, scope: 'project', includeRevision: true });
  const childInput = {
    ...dirs,
    name: goodSkill.name,
    scope: 'project',
    expectedRevision: current.revision,
    description: 'Concurrent process update.',
    content: '# Concurrent process update\n\nThis is the concurrent process body.',
  };
  const engineUrl = new URL('./index.js', import.meta.url).href;
  const childCode = `import { updateSkill } from ${JSON.stringify(engineUrl)};\nconsole.log(JSON.stringify(updateSkill(${JSON.stringify(childInput)})));`;
  const originalRenameSync = fs.renameSync;
  let childResult;
  let childAttempted = false;
  fs.renameSync = function (source, target, ...args) {
    if (!childAttempted && typeof target === 'string' && path.basename(target) === 'SKILL.md'
      && typeof source === 'string' && path.basename(source).startsWith('.SKILL.md.')) {
      childAttempted = true;
      childResult = spawnSync(process.execPath, ['--input-type=module', '-e', childCode], { encoding: 'utf8' });
    }
    return originalRenameSync.call(this, source, target, ...args);
  };
  let parentResult;
  try {
    parentResult = updateSkill({
      ...dirs,
      ...goodSkill,
      scope: 'project',
      expectedRevision: current.revision,
      description: 'Parent process update.',
      content: '# Parent process update\n\nThis is the parent process body.',
    });
  } finally {
    fs.renameSync = originalRenameSync;
  }

  assert.equal(childAttempted, true);
  assert.equal(childResult.status, 0, childResult.stderr);
  const concurrentResult = JSON.parse(childResult.stdout.trim());
  assert.match(concurrentResult.error, /update is already in progress/);
  assert.equal(parentResult.updated, true);
  const saved = readSkill({ ...dirs, name: goodSkill.name, scope: 'project' });
  assert.equal(saved.description, 'Parent process update.');
  assert.match(saved.content, /parent process body/);
});

test('fails closed on a stale update lock instead of removing it automatically', (t) => {
  const dirs = fixture(t);
  assert.equal(createSkill({ ...dirs, ...goodSkill, scope: 'project' }).created, true);
  const listed = readSkill({ ...dirs, name: goodSkill.name, scope: 'project', includeRevision: true });
  const exited = spawnSync(process.execPath, ['-e', 'process.exit(0)'], { encoding: 'utf8' });
  assert.equal(exited.status, 0, exited.stderr);
  const lockPath = path.join(skillRoots(dirs).project, goodSkill.name, '.guarana-update.lock');
  fs.writeFileSync(lockPath, `${JSON.stringify({ pid: exited.pid, token: 'stale-fixture' })}\n`, { mode: 0o600 });

  const result = updateSkill({
    ...dirs,
    ...goodSkill,
    scope: 'project',
    expectedRevision: listed.revision,
    description: 'Must not overwrite under an ambiguous lock.',
  });

  assert.match(result.error, /remove a stale \.guarana-update\.lock only when no update is running/);
  assert.equal(fs.existsSync(lockPath), true);
  const unchanged = readSkill({ ...dirs, name: goodSkill.name, scope: 'project' });
  assert.equal(unchanged.description, goodSkill.description);
  assert.equal(unchanged.content, goodSkill.content);
});

test('rejects stale revisions after body changes even when the original mtime is restored', (t) => {
  const dirs = fixture(t);
  createSkill({ ...dirs, ...goodSkill, scope: 'project' });
  const file = path.join(dirs.projectDir, '.opencode', 'skills', goodSkill.name, 'SKILL.md');
  const knownMtime = new Date('2025-01-01T00:00:00.000Z');
  fs.utimesSync(file, knownMtime, knownMtime);
  const originalStat = fs.statSync(file);
  const listed = listSkills({ ...dirs, includeRevision: true }).project[0];
  const altered = Buffer.from(fs.readFileSync(file, 'utf8').replace(
    'Run the project checks, inspect the artifact, and record the host version.',
    'Inspect the artifact, record the host version, and preserve this newer body.',
  ));
  fs.writeFileSync(file, altered);
  fs.utimesSync(file, originalStat.atime, originalStat.mtime);
  assert.equal(fs.statSync(file).mtimeMs, originalStat.mtimeMs);

  const result = updateSkill({
    ...dirs,
    ...goodSkill,
    description: 'A changed description.',
    scope: 'project',
    expectedRevision: listed.revision,
  });

  assert.match(result.error, /changed since skill_list/);
  assert.deepEqual(fs.readFileSync(file), altered);

  const current = listSkills({ ...dirs, includeRevision: true }).project[0];
  const updated = updateSkill({
    ...dirs,
    ...goodSkill,
    description: 'An updated release procedure.',
    content: '# Release checklist\n\nUse the current revision to update the generated instructions.',
    scope: 'project',
    expectedRevision: current.revision,
  });
  assert.equal(updated.updated, true);
});

test('refuses manual, non-generated, identity-mismatched, and scope-mismatched skills', (t) => {
  const dirs = fixture(t);
  const projectRoot = skillRoots(dirs).project;
  const entries = [
    ['manual-skill', 'user-authored skill', /not a Guarana-generated/],
    ['unmarked-skill', '---\nname: unmarked-skill\ndescription: Manual\nmetadata:\n  guarana-scope: project\n---\n# Manual\n', /not a Guarana-generated/],
    ['wrong-name', '---\nname: another-name\ndescription: Generated\nmetadata:\n  guarana-generated: "true"\n  guarana-scope: project\n---\n# Existing\n', /identity does not match/],
    ['wrong-scope', '---\nname: wrong-scope\ndescription: Generated\nmetadata:\n  guarana-generated: "true"\n  guarana-scope: global\n---\n# Existing\n', /scope does not match/],
  ];

  for (const [name, document, expectedError] of entries) {
    const file = path.join(projectRoot, name, 'SKILL.md');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, document);
    const original = fs.readFileSync(file, 'utf8');
    const result = updateSkill({
      ...dirs,
      name,
      description: 'A safe description.',
      content: '# Safe update\n\nKeep the reusable procedure.',
      scope: 'project',
      expectedRevision: '0'.repeat(64),
    });
    assert.match(result.error, expectedError);
    assert.equal(fs.readFileSync(file, 'utf8'), original);
  }

  createSkill({ ...dirs, ...goodSkill, scope: 'project' });
  const listed = listSkills({ ...dirs, includeRevision: true }).project[0];
  const projectFile = path.join(projectRoot, goodSkill.name, 'SKILL.md');
  const originalProjectSkill = fs.readFileSync(projectFile, 'utf8');
  const wrongScope = updateSkill({
    ...dirs,
    ...goodSkill,
    scope: 'global',
    expectedRevision: listed.revision,
  });
  assert.match(wrongScope.error, /does not exist in global scope/);
  assert.equal(fs.readFileSync(projectFile, 'utf8'), originalProjectSkill);
});

test('applies create validations to updates and rejects missing concurrency tokens', (t) => {
  const dirs = fixture(t);
  createSkill({ ...dirs, ...goodSkill, scope: 'project' });
  const expectedRevision = listSkills({ ...dirs, includeRevision: true }).project[0].revision;
  const update = (overrides = {}) => updateSkill({
    ...dirs,
    ...goodSkill,
    scope: 'project',
    expectedRevision,
    ...overrides,
  });

  assert.match(update({ expectedRevision: undefined }).error, /expectedRevision/);
  assert.match(update({ projectDir: 'relative' }).error, /absolute path/);
  assert.match(update({ name: '../escape' }).error, /slug/);
  assert.match(update({ scope: 'workspace' }).error, /scope/);
  assert.match(update({ description: 'two\nlines' }).error, /one line/);
  assert.match(update({ content: '---\nname: injected\n---\n# body' }).error, /frontmatter/);
  assert.match(update({ content: 'x'.repeat(32 * 1024 + 1) }).error, /exceeds/);
  assert.match(update({ content: '# Use this API key\n\ntoken: ghp_abcdefgh12345678' }).error, /secret/);
});
