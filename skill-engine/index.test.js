import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createSkill, listSkills, skillRoots, updateSkill } from './index.js';

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
  });
  assert.match(fs.readFileSync(file, 'utf8'), /^---\nname: release-checklist/m);
  assert.match(fs.readFileSync(file, 'utf8'), /guarana-generated: "true"/);
  assert.match(fs.readFileSync(file, 'utf8'), /guarana-scope: project/);
});

test('creates global skills in the user OpenCode skill root', (t) => {
  const dirs = fixture(t);
  const result = createSkill({ ...dirs, ...goodSkill, scope: 'global' });
  assert.equal(result.scope, 'global');
  assert.ok(fs.existsSync(path.join(dirs.homeDir, '.agents', 'skills', goodSkill.name, 'SKILL.md')));
  assert.equal(fs.existsSync(path.join(dirs.projectDir, '.opencode', 'skills', goodSkill.name)), false);
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
  });
  assert.equal(listSkills(dirs).project[0].description, updatedSkill.description);
  assert.equal(listSkills(dirs).project[0].content, updatedSkill.content);
  assert.match(fs.readFileSync(file, 'utf8'), /guarana-generated: "true"/);
  assert.match(fs.readFileSync(file, 'utf8'), /guarana-scope: project/);
  assert.deepEqual(fs.readdirSync(path.dirname(file)), ['SKILL.md']);
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
