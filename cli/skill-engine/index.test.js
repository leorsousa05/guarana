import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createSkill, listSkills, skillRoots } from './index.js';

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
