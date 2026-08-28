import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseTracker, listSpecFiles } from './specs.js';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

describe('parseTracker', () => {
  const markdown = `
# Tracker

| Skill | Status | Proof | Change |
|---|---|---|---|
| guarana:plan | **SHIPPED** | [proof](features/guarana/proofs/plan-proofs.md) | [change](changes/2026-08-21-plan.md) |
| guarana:build | **TASKED** | [proof](features/guarana/proofs/build-proofs.md) |  |

**DONE:** skill specs.
**NEXT:** implementation.
**BLOCKED:** nothing.
**FOO:** other.
`;

  it('parses tracker rows and flags', () => {
    const tracker = parseTracker(markdown);
    assert.equal(tracker.rows.length, 2);
    assert.equal(tracker.rows[0].skill, 'guarana:plan');
    assert.equal(tracker.rows[1].status, '**TASKED**');
    assert.deepEqual(tracker.DONE, ['skill specs.']);
    assert.deepEqual(tracker.NEXT, ['implementation.']);
    assert.deepEqual(tracker.BLOCKED, ['nothing.']);
    assert.deepEqual(tracker.other, ['**FOO:** other.']);
  });
});

describe('listSpecFiles', () => {
  it('lists md files recursively and sorted', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-specs-'));
    fs.mkdirSync(path.join(dir, 'features', 'guarana'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'README.md'), '# root');
    fs.writeFileSync(path.join(dir, 'features', 'guarana', 'plan.md'), '# plan');
    fs.writeFileSync(path.join(dir, 'features', 'cli.md'), '# cli');
    const files = listSpecFiles(dir);
    assert.deepEqual(files, ['README.md', 'features/cli.md', 'features/guarana/plan.md']);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
