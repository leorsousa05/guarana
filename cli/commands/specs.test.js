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
  it('upserts deterministic records and is idempotent', () => {
    const root=fs.mkdtempSync(path.join(os.tmpdir(),'guarana-record-'));
    try {
      validProject(root);
      const first=invoke(root,JSON.stringify(handoff())); assert.equal(first.status,0,first.stdout);
       const report=JSON.parse(first.stdout); assert.equal(report.ok,true); assert.equal(report.validator.ok,true);
       const state=fs.readFileSync(path.join(root,'.specs/state/project-state.md'),'utf8');
       assert.ok(state.includes('- Goal: Validate the API spec.\n- Pending writes: none.'));
       const tracker=fs.readFileSync(path.join(root,'.specs/README.md'),'utf8');
      assert.match(tracker,/\| api \| IMPLEMENTED \| npm test \|\s+\|/); assert.match(tracker,/\*\*NEXT:\*\* Validate API/);
      const second=JSON.parse(invoke(root,JSON.stringify(handoff())).stdout); assert.deepEqual(second.changed,[]);
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
});
