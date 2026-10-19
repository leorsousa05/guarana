'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const specs = require('./specs.js');
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

function captureOutput(callback) {
  let stdout = '';
  let stderr = '';
  const streams = {
    stdout: { write: (chunk) => { stdout += chunk.toString(); } },
    stderr: { write: (chunk) => { stderr += chunk.toString(); } },
  };
  const result = callback(streams);
  return { result, stdout, stderr };
}

function runDirect(root, args) {
  const cwd = process.cwd();
  const previousExitCode = process.exitCode;
  process.chdir(root);
  process.exitCode = 23;
  try {
    const output = captureOutput((streams) => specs.run(args, streams));
    assert.equal(process.exitCode, 23, `process.exitCode changed while running specs ${args.join(' ')}`);
    return output;
  } finally {
    process.chdir(cwd);
    process.exitCode = previousExitCode;
  }
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

  it('run returns numeric validation statuses without mutating process.exitCode and preserves output', () => {
    const validRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-specs-direct-valid-'));
    const invalidRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-specs-direct-invalid-'));
    try {
      validProject(validRoot);
      const valid = runDirect(validRoot, ['validate', validRoot, '--json']);
      assert.equal(valid.result, 0);
      assert.equal(valid.stdout, `${JSON.stringify(validateSpecs(validRoot), null, 2)}\n`);
      assert.equal(valid.stderr, '');

      const invalid = runDirect(invalidRoot, ['validate', invalidRoot, '--json']);
      assert.equal(invalid.result, 1);
      assert.equal(invalid.stdout, `${JSON.stringify(validateSpecs(invalidRoot), null, 2)}\n`);
      assert.equal(invalid.stderr, '');

      const noArgs = runDirect(validRoot, []);
      assert.equal(noArgs.result, 0);
      assert.equal(noArgs.stdout, specs.HELP);
      assert.equal(noArgs.stderr, '');

      const unknown = runDirect(validRoot, ['unknown']);
      assert.equal(unknown.result, 1);
      assert.equal(unknown.stdout, specs.HELP);
      assert.equal(unknown.stderr, 'unknown specs command: unknown\n');

      const extraArgs = runDirect(validRoot, ['validate', validRoot, 'extra']);
      assert.equal(extraArgs.result, 1);
      assert.equal(extraArgs.stdout, '');
      assert.equal(extraArgs.stderr, 'usage: guarana specs validate [project-root] [--json]\n');
    } finally {
      fs.rmSync(validRoot, { recursive: true, force: true });
      fs.rmSync(invalidRoot, { recursive: true, force: true });
    }
  });

});

describe('guarana specs record --stdin', () => {
  function handoff(overrides = {}) {
    return { schema:'v1', task:{ slug:'api', title:'API', featurePath:'.specs/features/api/api.md', trackerName:'api', status:'IMPLEMENTED', goal:'Expose an API', requirements:[], assumptions:[], scope:[], acceptanceCriteria:['GET returns 200'], currentStep:'Implementing API', pendingWrites:[], next:'Validate API', proof:['npm test'], ...overrides } };
  }
  function invoke(root, payload) {
    return spawnSync(process.execPath,[BIN,'specs','record','--stdin'],{cwd:root,input:payload,encoding:'utf8'});
  }
  function invokeFile(root, payload, file = '.specs/state/worker-specs-handoff.json') {
    const handoffPath = path.join(root, '.specs/state/worker-specs-handoff.json');
    fs.mkdirSync(path.dirname(handoffPath), { recursive: true });
    fs.writeFileSync(handoffPath, payload);
    return spawnSync(process.execPath,[BIN,'specs','record','--file',file],{cwd:root,encoding:'utf8'});
  }
  const recordPaths = ['README.md', 'state/project-state.md', 'features/api/api.md'];
  function expectStructuralFailure(root, payload, expectedError) {
    const targets = recordPaths.map((relative) => path.join(root, '.specs', relative));
    const before = targets.map((file) => fs.readFileSync(file));
    const result = invoke(root, JSON.stringify(payload));
    assert.equal(result.status, 1, result.stdout);
    assert.equal(result.stderr, '');
    const report = JSON.parse(result.stdout);
    assert.deepEqual(report, { ok: false, changed: [], error: expectedError, validator: null });
    targets.forEach((file, index) => assert.deepEqual(fs.readFileSync(file), before[index], file));
    return report.error;
  }
  it('upserts deterministic records and is idempotent', () => {
    const root=fs.mkdtempSync(path.join(os.tmpdir(),'guarana-record-'));
    try {
      validProject(root);
      const first=invoke(root,JSON.stringify(handoff())); assert.equal(first.status,0,first.stdout);
       const report=JSON.parse(first.stdout); assert.equal(report.ok,true); assert.equal(report.validator.ok,true);
       const state=fs.readFileSync(path.join(root,'.specs/state/project-state.md'),'utf8');
       assert.ok(state.includes('- Goal: Validate the API spec.\n- Pending writes: none.'));
       assert.ok(state.includes('## Current step\nImplementing API'));
       assert.ok(report.changed.includes('.specs/state/project-state.md'));
       const tracker=fs.readFileSync(path.join(root,'.specs/README.md'),'utf8');
      assert.match(tracker,/\| api \| IMPLEMENTED \| npm test \|\s+\|/); assert.match(tracker,/\*\*NEXT:\*\* Validate API/);
      const second=JSON.parse(invoke(root,JSON.stringify(handoff())).stdout); assert.deepEqual(second.changed,[]);
    } finally { fs.rmSync(root,{recursive:true,force:true}); }
  });
  it('accepts an omitted currentStep and preserves that section while recording other fields', () => {
    const root=fs.mkdtempSync(path.join(os.tmpdir(),'guarana-record-no-current-step-'));
    try {
      validProject(root);
      const statePath=path.join(root,'.specs/state/project-state.md');
      const original='# Project State\r\n\r\n## Current step\r\n  Stable status: integration blocked.  \r\n\tPreserve this content exactly.\r\n\r\n## Checkpoint\r\n- Goal: Preserve this goal.\r\n- Pending writes: previous.\r\n';
      fs.writeFileSync(statePath,original);
      const payload=handoff({pendingWrites:['implementation']});
      delete payload.task.currentStep;

      const result=invoke(root,JSON.stringify(payload));
      assert.equal(result.status,0,result.stdout);
      const report=JSON.parse(result.stdout);
      assert.equal(report.ok,true);
      assert.ok(report.changed.includes('.specs/README.md'));
      assert.ok(report.changed.includes('.specs/state/project-state.md'));
      assert.ok(report.changed.includes('.specs/features/api/api.md'));
      assert.deepEqual(fs.readFileSync(statePath),Buffer.from(original.replace('- Pending writes: previous.\r\n','- Pending writes: implementation\r\n')));

      const repeated=invoke(root,JSON.stringify(payload));
      assert.equal(repeated.status,0,repeated.stdout);
      assert.deepEqual(JSON.parse(repeated.stdout).changed,[]);
    } finally { fs.rmSync(root,{recursive:true,force:true}); }
  });
  it('updates only the checkpoint pending-writes line and reports the state change', () => {
    for (const [pendingWrites, rendered] of [
      [['planning'], 'planning'],
      [['planning', 'implementation'], 'planning; implementation'],
      [[], 'none.'],
    ]) {
      const root=fs.mkdtempSync(path.join(os.tmpdir(),'guarana-record-pending-'));
      try {
        validProject(root);
        const statePath=path.join(root,'.specs/state/project-state.md');
        const original='# Project State\n\n## Current step\nImplementing API\n\n## Checkpoint\n- Goal: Preserve this goal.\n- Other checkpoint content: Keep this line.\n- Pending writes: previous.\n\n## Follow-up\nLeave this section alone.\n';
        fs.writeFileSync(statePath,original);

        const result=invoke(root,JSON.stringify(handoff({pendingWrites})));
        assert.equal(result.status,0,result.stdout);
        const report=JSON.parse(result.stdout);
        assert.ok(report.changed.includes('.specs/state/project-state.md'));
        assert.equal(fs.readFileSync(statePath,'utf8'),original.replace('- Pending writes: previous.',`- Pending writes: ${rendered}`));

        const repeated=invoke(root,JSON.stringify(handoff({pendingWrites})));
        assert.equal(repeated.status,0,repeated.stdout);
        assert.deepEqual(JSON.parse(repeated.stdout).changed,[]);
      } finally { fs.rmSync(root,{recursive:true,force:true}); }
    }
  });
  it('inserts pending writes inside the checkpoint when its line is absent', () => {
    const root=fs.mkdtempSync(path.join(os.tmpdir(),'guarana-record-pending-missing-'));
    try {
      validProject(root);
      const statePath=path.join(root,'.specs/state/project-state.md');
      const original='# Project State\n\n## Current step\nImplementing API\n\n## Checkpoint\n- Goal: Preserve this goal.\n- Other checkpoint content: Keep this line.\n\n## Follow-up\n- Pending writes: Do not change.\n';
      fs.writeFileSync(statePath,original);

      const result=invoke(root,JSON.stringify(handoff({pendingWrites:['planning']})));
      assert.equal(result.status,0,result.stdout);
      const report=JSON.parse(result.stdout);
      assert.ok(report.changed.includes('.specs/state/project-state.md'));
      assert.equal(fs.readFileSync(statePath,'utf8'),original.replace('- Other checkpoint content: Keep this line.\n\n## Follow-up',
        '- Other checkpoint content: Keep this line.\n- Pending writes: planning\n\n## Follow-up'));
    } finally { fs.rmSync(root,{recursive:true,force:true}); }
  });
  it('updates records from the fixed file handoff and removes it', () => {
    const root=fs.mkdtempSync(path.join(os.tmpdir(),'guarana-record-file-'));
    try {
      validProject(root);
      const res=invokeFile(root,JSON.stringify(handoff()));
      assert.equal(res.status,0,res.stdout);
      const report=JSON.parse(res.stdout);
      assert.equal(report.ok,true);
      assert.ok(report.changed.includes('.specs/README.md'));
      assert.equal(fs.existsSync(path.join(root,'.specs/state/worker-specs-handoff.json')),false);
    } finally { fs.rmSync(root,{recursive:true,force:true}); }
  });
  it('cleans malformed file handoff without partially writing records', () => {
    const root=fs.mkdtempSync(path.join(os.tmpdir(),'guarana-record-file-bad-'));
    try {
      validProject(root);
      const files=['README.md','state/project-state.md','features/api/api.md'].map((p)=>path.join(root,'.specs',p));
      const before=files.map((file)=>fs.readFileSync(file));
      const res=invokeFile(root,'{');
      assert.equal(res.status,1);
      assert.equal(JSON.parse(res.stdout).error,'invalid JSON');
      files.forEach((file,i)=>assert.deepEqual(fs.readFileSync(file),before[i]));
      assert.equal(fs.existsSync(path.join(root,'.specs/state/worker-specs-handoff.json')),false);
    } finally { fs.rmSync(root,{recursive:true,force:true}); }
  });
  it('reports deterministic JSON paths for all structural failures without echoing values or writing records', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-record-diagnostics-'));
    try {
      validProject(root);

      const missingSchema = handoff();
      delete missingSchema.schema;
      expectStructuralFailure(root, missingSchema, 'schema v1 validation failed: schema expected "v1"');
      expectStructuralFailure(root, { ...handoff(), schema: 'SCHEMA_SENTINEL' },
        'schema v1 validation failed: schema expected "v1"');
      const missingTask = { schema: 'SCHEMA_SENTINEL' };
      expectStructuralFailure(root, missingTask,
        'schema v1 validation failed: schema expected "v1"; task expected object');
      for (const task of [null, []]) {
        expectStructuralFailure(root, { schema: 'v1', task }, 'schema v1 validation failed: task expected object');
      }

      for (const field of ['slug', 'title', 'featurePath', 'trackerName', 'goal', 'next']) {
        const missing = handoff();
        delete missing.task[field];
        expectStructuralFailure(root, missing, `schema v1 validation failed: task.${field} expected non-empty string`);
        expectStructuralFailure(root, handoff({ [field]: null }), `schema v1 validation failed: task.${field} expected non-empty string`);
        expectStructuralFailure(root, handoff({ [field]: ' \t ' }), `schema v1 validation failed: task.${field} expected non-empty string`);
      }
      for (const currentStep of [null, ' \t ']) {
        expectStructuralFailure(root, handoff({ currentStep }),
          'schema v1 validation failed: task.currentStep expected non-empty string');
      }

      expectStructuralFailure(root, handoff({ status: 'STATUS_SENTINEL' }),
        'schema v1 validation failed: task.status expected one of SPECIFIED|TASKED|IMPLEMENTED|VALIDATED|SHIPPED');

      for (const field of ['requirements', 'assumptions', 'scope', 'acceptanceCriteria', 'pendingWrites', 'proof']) {
        const missing = handoff();
        delete missing.task[field];
        expectStructuralFailure(root, missing, `schema v1 validation failed: task.${field} expected array of strings`);
        expectStructuralFailure(root, handoff({ [field]: 'ARRAY_SENTINEL' }),
          `schema v1 validation failed: task.${field} expected array of strings`);
        expectStructuralFailure(root, handoff({ [field]: ['valid', { value: 'MEMBER_SENTINEL' }] }),
          `schema v1 validation failed: task.${field}[1] expected string`);
      }

      const aggregate = handoff({
        slug: ' ', trackerName: '', status: 'STATUS_SENTINEL', goal: 42,
        requirements: ['valid', { value: 'MEMBER_SENTINEL' }], assumptions: null,
        scope: [false], currentStep: '\t', pendingWrites: 'ARRAY_SENTINEL',
        next: false, proof: [null],
      });
      aggregate.schema = 'SCHEMA_SENTINEL';
      const expected = 'schema v1 validation failed: schema expected "v1"; task.slug expected non-empty string; ' +
        'task.trackerName expected non-empty string; task.status expected one of SPECIFIED|TASKED|IMPLEMENTED|VALIDATED|SHIPPED; ' +
        'task.goal expected non-empty string; task.requirements[1] expected string; task.assumptions expected array of strings; ' +
        'task.scope[0] expected string; task.currentStep expected non-empty string; task.pendingWrites expected array of strings; ' +
        'task.next expected non-empty string; task.proof[0] expected string';
      assert.equal(expectStructuralFailure(root, aggregate, expected), expected);
      assert.equal(expectStructuralFailure(root, aggregate, expected), expected);
      for (const sentinel of ['SCHEMA_SENTINEL', 'STATUS_SENTINEL', 'ARRAY_SENTINEL', 'MEMBER_SENTINEL']) {
        assert.ok(!expected.includes(sentinel));
      }
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
  it('records the copyable canonical skill handoff and keeps its CLI mirror byte-equal', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-record-skill-example-'));
    const canonicalPath = path.join(__dirname, '..', '..', 'skills', 'guarana', 'skills', 'specs', 'SKILL.md');
    const mirrorPath = path.join(__dirname, '..', '..', 'cli', 'skills', 'guarana', 'skills', 'specs', 'SKILL.md');
    try {
      validProject(root);
      const canonical = fs.readFileSync(canonicalPath, 'utf8');
      assert.deepEqual(fs.readFileSync(mirrorPath), fs.readFileSync(canonicalPath));
      const section = canonical.split('### Copyable schema-v1 handoff\n')[1];
      assert.ok(section, 'copyable schema-v1 handoff heading exists');
      const example = section.match(/```json\n([\s\S]*?)\n```/);
      assert.ok(example, 'copyable JSON example exists');
      const payload = JSON.parse(example[1]);
      const result = invoke(root, JSON.stringify(payload));
      assert.equal(result.status, 0, result.stdout);
      const report = JSON.parse(result.stdout);
      assert.equal(report.ok, true);
      assert.equal(report.validator.ok, true);
      assert.ok(report.changed.includes(payload.task.featurePath));
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
  it('run returns explicit record statuses without mutating process.exitCode or changing JSON', () => {
    const root=fs.mkdtempSync(path.join(os.tmpdir(),'guarana-record-direct-'));
    const handoffPath=path.join(root,'.specs/state/worker-specs-handoff.json');
    try {
      validProject(root);
      fs.mkdirSync(path.dirname(handoffPath),{recursive:true});
      fs.writeFileSync(handoffPath,JSON.stringify(handoff()));
      const success=runDirect(root,['record','--file','.specs/state/worker-specs-handoff.json']);
      assert.equal(success.result,0);
      const report=JSON.parse(success.stdout);
      assert.equal(report.ok,true);
      assert.equal(report.validator.ok,true);
      assert.equal(success.stdout,`${JSON.stringify(report)}\n`);
      assert.equal(success.stderr,'');

      fs.writeFileSync(handoffPath,'{');
      const failure=runDirect(root,['record','--file','.specs/state/worker-specs-handoff.json']);
      assert.equal(failure.result,1);
      assert.equal(failure.stdout,`${JSON.stringify({ok:false,changed:[],error:'invalid JSON',validator:null})}\n`);
      assert.equal(failure.stderr,'');

      const invalidUsage=runDirect(root,['record','--stdin','extra']);
      assert.equal(invalidUsage.result,1);
      assert.equal(invalidUsage.stdout,`${JSON.stringify({ok:false,changed:[],error:'usage: guarana specs record --stdin | --file .specs/state/worker-specs-handoff.json',validator:null})}\n`);
      assert.equal(invalidUsage.stderr,'');
    } finally { fs.rmSync(root,{recursive:true,force:true}); }
  });
  it('rejects alternate paths and symlinks without deleting their targets', () => {
    const root=fs.mkdtempSync(path.join(os.tmpdir(),'guarana-record-file-unsafe-'));
    try {
      validProject(root);
      const alternate=path.join(root,'.specs/state/worker-specs-handoff.json');
      fs.mkdirSync(path.dirname(alternate),{recursive:true});
      fs.writeFileSync(alternate,JSON.stringify(handoff()));
      const other=spawnSync(process.execPath,[BIN,'specs','record','--file','../worker-specs-handoff.json'],{cwd:root,encoding:'utf8'});
      assert.equal(other.status,1);
      assert.equal(fs.existsSync(alternate),true);
      fs.unlinkSync(alternate);
      const target=path.join(root,'target.json');
      fs.writeFileSync(target,JSON.stringify(handoff()));
      fs.symlinkSync(target,alternate);
      const linked=spawnSync(process.execPath,[BIN,'specs','record','--file','.specs/state/worker-specs-handoff.json'],{cwd:root,encoding:'utf8'});
      assert.equal(linked.status,1);
      assert.equal(fs.lstatSync(alternate).isSymbolicLink(),true);
      assert.equal(fs.existsSync(target),true);
    } finally { fs.rmSync(root,{recursive:true,force:true}); }
  });
  it('does not delete a handoff through a symlinked parent directory', () => {
    const root=fs.mkdtempSync(path.join(os.tmpdir(),'guarana-record-file-parent-link-'));
    const external=fs.mkdtempSync(path.join(os.tmpdir(),'guarana-record-file-external-'));
    try {
      validProject(root);
      const outside=path.join(external,'worker-specs-handoff.json');
      const before=Buffer.from(JSON.stringify(handoff()));
      fs.writeFileSync(outside,before);
      fs.rmSync(path.join(root,'.specs/state'),{recursive:true,force:true});
      fs.symlinkSync(external,path.join(root,'.specs/state'));
      const res=spawnSync(process.execPath,[BIN,'specs','record','--file','.specs/state/worker-specs-handoff.json'],{cwd:root,encoding:'utf8'});
      assert.equal(res.status,1);
      assert.match(JSON.parse(res.stdout).error,/symlink path is not allowed/);
      assert.deepEqual(fs.readFileSync(outside),before);
    } finally {
      fs.rmSync(root,{recursive:true,force:true});
      fs.rmSync(external,{recursive:true,force:true});
    }
  });
  it('preserves feature prose and acceptance while updating either status syntax', () => {
    const root=fs.mkdtempSync(path.join(os.tmpdir(),'guarana-record-status-'));
    try { validProject(root); const file=path.join(root,'.specs/features/api/api.md');
      for (const statusLine of ['**Status:** VALIDATED','**Status: VALIDATED**']) {
        const original=`# Feature spec: API\n\n${statusLine}\n\n## Goal\nOriginal goal.\n\n## Acceptance criteria\n1. Original acceptance.\n`;
        fs.writeFileSync(file,original); const payload=handoff({featurePath:'.specs/features/api/api.md',status:'IMPLEMENTED'});
        assert.equal(invoke(root,JSON.stringify(payload)).status,0);
        const updated=fs.readFileSync(file,'utf8'); assert.match(updated,/\*\*Status: IMPLEMENTED\*\*/);
        assert.match(updated,/Original goal\./); assert.match(updated,/1\. Original acceptance\./);
      }
    } finally { fs.rmSync(root,{recursive:true,force:true}); }
  });
  it('creates nested feature paths and rolls back all writes after validation failure', () => {
    const root=fs.mkdtempSync(path.join(os.tmpdir(),'guarana-record-rollback-'));
    try { validProject(root); const feature=path.join(root,'.specs/features/api/api.md');
      fs.writeFileSync(feature,fs.readFileSync(feature,'utf8').replace('../../decisions/ADR-001-api-shape.md','missing.md'));
      const before=['README.md','state/project-state.md','features/api/api.md'].map((p)=>fs.readFileSync(path.join(root,'.specs',p)));
      const res=invoke(root,JSON.stringify(handoff())); assert.equal(res.status,1);
      ['README.md','state/project-state.md','features/api/api.md'].forEach((p,i)=>assert.deepEqual(fs.readFileSync(path.join(root,'.specs',p)),before[i]));
      fs.writeFileSync(feature,`# Feature spec: API\n\n**Status:** SPECIFIED\n\n## Goal\nOriginal.\n\n## Acceptance criteria\n1. Original.\n`);
      const created=invoke(root,JSON.stringify(handoff({slug:'nested',featurePath:'.specs/features/new/deep/nested.md'})));
      assert.equal(created.status,0,created.stdout); assert.ok(fs.existsSync(path.join(root,'.specs/features/new/deep/nested.md')));
    } finally { fs.rmSync(root,{recursive:true,force:true}); }
  });
  it('restores exact original bytes after validation failure with invalid UTF-8 in the feature', () => {
    const root=fs.mkdtempSync(path.join(os.tmpdir(),'guarana-record-byte-rollback-'));
    try {
      validProject(root);
      const files=['README.md','state/project-state.md','features/api/api.md'].map((p)=>path.join(root,'.specs',p));
      const featureText=fs.readFileSync(files[2],'utf8').replace('../../decisions/ADR-001-api-shape.md','missing.md');
      fs.writeFileSync(files[2],Buffer.concat([Buffer.from(featureText,'utf8'),Buffer.from([0xff])]));
      const before=files.map((file)=>fs.readFileSync(file));
      const res=invoke(root,JSON.stringify(handoff()));
      assert.equal(res.status,1);
      files.forEach((file,i)=>assert.deepEqual(fs.readFileSync(file),before[i]));
    } finally { fs.rmSync(root,{recursive:true,force:true}); }
  });
  it('rejects bad schema, unsafe path and unmet status gates without writes', () => {
    const root=fs.mkdtempSync(path.join(os.tmpdir(),'guarana-record-invalid-'));
    try { validProject(root); const before=fs.readFileSync(path.join(root,'.specs/README.md'),'utf8');
      for (const input of ['{',JSON.stringify(handoff({featurePath:'../escape.md'})),JSON.stringify(handoff({featurePath:'.specs/features/api/other.md'})),JSON.stringify(handoff({changePath:'.specs/README.md'})),JSON.stringify(handoff({status:'VALIDATED'})),JSON.stringify(handoff({status:'SHIPPED'})),JSON.stringify(handoff({trackerName:'x|y'}))]) {
        const res=invoke(root,input); assert.equal(res.status,1); assert.equal(JSON.parse(res.stdout).ok,false);
        assert.equal(fs.readFileSync(path.join(root,'.specs/README.md'),'utf8'),before);
      }
    } finally { fs.rmSync(root,{recursive:true,force:true}); }
  });
  it('normalizes safe backslash change paths and rejects traversal and absolute paths without writes', () => {
    const root=fs.mkdtempSync(path.join(os.tmpdir(),'guarana-record-change-path-'));
    try {
      validProject(root);
      const files=['README.md','state/project-state.md','features/api/api.md'].map((p)=>path.join(root,'.specs',p));
      const accepted=invoke(root,JSON.stringify(handoff({changePath:'.specs\\changes\\example.md'})));
      assert.equal(accepted.status,0,accepted.stdout);
      const tracker=fs.readFileSync(files[0],'utf8');
      const feature=fs.readFileSync(files[2],'utf8');
      assert.match(tracker,/\| api \| IMPLEMENTED \| npm test \| \.specs\/changes\/example\.md \|/);
      assert.match(feature,/Change: \.specs\/changes\/example\.md\n/);

      const before=files.map((file)=>fs.readFileSync(file));
      for (const changePath of ['.specs/changes/../example.md','/tmp/example.md','C:\\outside\\example.md']) {
        const rejected=invoke(root,JSON.stringify(handoff({changePath})));
        assert.equal(rejected.status,1,rejected.stdout);
        assert.equal(JSON.parse(rejected.stdout).ok,false);
        files.forEach((file,i)=>assert.deepEqual(fs.readFileSync(file),before[i]));
      }
    } finally { fs.rmSync(root,{recursive:true,force:true}); }
  });
});
