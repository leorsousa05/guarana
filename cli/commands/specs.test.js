'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { validateSpecs } = require('../lib/specs-validator.js');

const BIN = path.join(__dirname, '..', '..', 'bin', 'guarana.js');

function write(root, rel, content) {
  const file = path.join(root, '.specs', rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
}

function validProject(root) {
  write(root, 'README.md', `# Project specs

## Master tracker
| Name | Status | Proof | Change |
|---|---|---|---|
| api | VALIDATED | | |

**DONE:** done.
**NEXT:** next.
**BLOCKED:** nothing.
`);
  write(root, 'state/project-state.md', `# Project State

## Current step
Ready.

## Checkpoint
- Goal: Validate the API spec.
- Pending writes: none.
`);
  write(root, 'decisions/ADR-001-api-shape.md', `# ADR-001 — API shape

**Status:** Accepted

## Decision
Use a JSON API.
`);
  write(root, 'features/api/api.md', `# Feature spec: API

## Goal
Expose a JSON API.

## Acceptance criteria
1. GET /health returns 200.

See [ADR-001](../../decisions/ADR-001-api-shape.md).
`);
}

describe('guarana specs validate', () => {
  it('passes a consistent project and checks local references', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-specs-valid-'));
    try {
      validProject(root);
      const result = validateSpecs(root);
      assert.equal(result.ok, true, JSON.stringify(result.issues));
      assert.equal(result.featureSpecs, 1);
      assert.equal(result.adrs, 1);
      assert.equal(result.linksChecked, 1);
      assert.deepEqual(result.issues, []);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('reports missing structure, incomplete feature acceptance, malformed ADR, and broken links', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-specs-invalid-'));
    try {
      write(root, 'README.md', `# Project specs
## Master tracker
| Name | Status |
|---|---|
**DONE:** done.
**NEXT:** next.
**BLOCKED:** nothing.
`);
      write(root, 'state/project-state.md', '# Project State\n');
      write(root, 'decisions/ADR-001-bad.md', '# Wrong title\n');
      write(root, 'features/bad/bad.md', `# Feature spec: bad
## Goal
Do a thing.
## Acceptance criteria
No actual criterion here.
[missing](absent.md)
[outside](../../../../outside.md)
`);
      const result = validateSpecs(root);
      assert.equal(result.ok, false);
      const codes = new Set(result.issues.map((issue) => issue.code));
      assert.ok(codes.has('state-heading'));
      assert.ok(codes.has('state-goal'));
      assert.ok(codes.has('adr-heading'));
      assert.ok(codes.has('adr-status'));
      assert.ok(codes.has('adr-decision'));
      assert.ok(codes.has('feature-acceptance'));
      assert.ok(codes.has('broken-link'));
      assert.ok(codes.has('link-escapes-root'));
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('CLI emits machine-readable JSON and exits nonzero on invalid specs', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-specs-cli-'));
    try {
      const res = spawnSync(process.execPath, [BIN, 'specs', 'validate', root, '--json'], {
        encoding: 'utf8',
      });
      assert.equal(res.status, 1);
      const report = JSON.parse(res.stdout);
      assert.equal(report.ok, false);
      assert.ok(report.issues.some((issue) => issue.code === 'missing-specs-dir'));
      assert.equal(res.stderr, '');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

});
