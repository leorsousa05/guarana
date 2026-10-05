import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { resolveSkillBody } from './prompt.js';

test('resolveSkillBody discovers project skills in the OpenCode directory', () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-project-skill-'));
  const skillPath = path.join(project, '.opencode', 'skills', 'guarana', 'skills', 'plan', 'SKILL.md');
  fs.mkdirSync(path.dirname(skillPath), { recursive: true });
  fs.writeFileSync(skillPath, '# Project plan skill\n', 'utf8');

  try {
    assert.equal(resolveSkillBody('plan', project), '# Project plan skill\n');
  } finally {
    fs.rmSync(project, { recursive: true, force: true });
  }
});
