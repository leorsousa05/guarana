const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const agents = require('./agents.js');
const { workerAgentsTarget } = require('./paths.js');

function inProject(callback) {
  const cwd = process.cwd();
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-worker-agents-'));
  try {
    process.chdir(project);
    return callback(project);
  } finally {
    process.chdir(cwd);
    fs.rmSync(project, { recursive: true, force: true });
  }
}

test('worker profiles include canonical skill procedures and distinct permissions', () => {
  const generated = agents.profiles(true);
  assert.deepEqual(generated.map(({ name }) => name), ['worker-code', 'worker-verify', 'worker-debug', 'worker-specs']);
  for (const { content } of generated) {
    assert.match(content, /mode: subagent/);
    assert.match(content, /^hidden: false$/m);
  }

  const code = generated[0].content;
  assert.match(code, /mode: subagent/);
  assert.match(code, /task: deny/);
  assert.match(code, /workflow_tick: deny/);
  assert.match(code, /edit: allow/);
  assert.match(code, /Read before edit/);
  assert.match(code, /diff \(or exact file list\)/);
  assert.match(code, /smallest ordinary checks mapped to changed acceptance criteria/i);
  assert.match(code, /Do not run smoke tests/i);

  const verify = generated[1].content;
  assert.match(verify, /edit: deny/);
  assert.match(verify, /Independent verifier/);
  assert.match(verify, /per-criterion PASS\/FAIL \+ proof path/);
  assert.match(verify, /bounded searches of supported authoritative and alternative sources/i);
  assert.match(verify, /`not checked`, `unavailable in this context`, `contradictory`, or `absent`/);
  assert.match(verify, /Missing proof remains FAIL/i);

  const debug = generated[2].content;
  assert.match(debug, /"\*": deny/);
  assert.match(debug, /"\.specs\/state\/known-issues\.md": allow/);
  assert.doesNotMatch(debug, /\*\*\//);
  assert.match(debug, /Failure-mode matrix/);

  const specs = generated[3].content;
  assert.match(specs, /mode: subagent/);
  assert.match(specs, /task: deny/);
  assert.match(specs, /workflow_tick: deny/);
  assert.doesNotMatch(specs, /^  bash: allow$/m);
  const specsBashRules = specs.split('  bash:\n')[1].split('\n  edit:')[0];
  assert.deepEqual(specsBashRules.split('\n'), [
    '    "*": deny',
    '    "guarana specs record --file .specs/state/worker-specs-handoff.json": allow',
    '    "node bin/guarana.js specs record --file .specs/state/worker-specs-handoff.json": allow',
  ]);
  assert.match(specs, /"\*": deny/);
  const specsEditRules = specs.split('  edit:\n')[1].split('\n---')[0];
  assert.doesNotMatch(specsEditRules, /\*\*\//);
  const allowedSpecsPaths = [
    '.specs/README.md',
    '.specs/architecture.md',
    '.specs/conventions.md',
    '.specs/decisions/ADR-001-example.md',
    '.specs/state/project-state.md',
    '.specs/state/worker-specs-handoff.json',
    '.specs/features/orchestrator.md',
    '.specs/features/orchestrator/spec-update-isolation.md',
    '.specs/changes/2026-10-09-worker-specs-permissions.md',
  ];
  const isAllowedByRule = (requestedPath) => specsEditRules.split('\n').some((rule) => {
    const match = rule.match(/^\s+"(.+)": allow$/);
    if (!match) return false;
    const glob = match[1].replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    return new RegExp(`^${glob}$`).test(requestedPath);
  });
  for (const requestedPath of allowedSpecsPaths) {
    assert.equal(isAllowedByRule(requestedPath), true, `${requestedPath} must be allowed by a worker-specs edit rule`);
  }
  assert.match(specsEditRules, /"\.specs\/conventions\.md": allow/);
  const forbiddenSpecsVariants = [
    'README.md',
    '.specs/architecture.md.bak',
    '.specs/architecture/subsystem.md',
    '.specs/conventions.md.bak',
    '.specs/conventions/naming.md',
  ];
  for (const requestedPath of forbiddenSpecsVariants) {
    assert.equal(isAllowedByRule(requestedPath), false, `${requestedPath} must not be allowed by worker-specs`);
  }
  assert.match(specsEditRules, /"\*": deny/);
  assert.doesNotMatch(specsBashRules, /--stdin|<<|heredoc/i);
  assert.doesNotMatch(specs, /edit:\s*allow\s*$/m);
  assert.match(specs, /Do not invent requirements, acceptance decisions/);
  assert.match(specs, /dispatched only when a durable human-readable `.specs` record will\s+change/i);
  assert.match(specs, /material\s+alternatives/i);
  assert.match(specs, /For an existing mutable `\.specs` record, use Edit only to change the\s+specific semantic narrative passage that supplied, confirmed facts explicitly\s+supersede; preserve unrelated and historical text verbatim\./);
  assert.match(specs, /writes only its recorder-owned fields and does not rewrite arbitrary\s+narrative/);
  assert.match(specs, /Keep tracker, checkpoint, status, and receipt fields exclusively\s+in\s+`specs record`/);
  assert.match(specs, /project-root\s+`README\.md` is outside this worker's `.specs` authority and\s+permissions/);
  assert.match(specs, /Append a new ADR only when the supplied facts establish a durable[\s\S]*?with material\s+alternatives\. ADRs are append-only; never revise an existing ADR/);
  assert.match(specs, /Do\s+not rewrite historical change or verification evidence/);
  assert.match(specs, /If a request is out\s+of scope or Edit is denied, stop and report the exact path\s+and reason; do not\s+broaden the edit or bypass permissions/);
  assert.match(specs, /An OpenCode `edit` denial does not by itself establish whether `specs record`\s+ran/);
  assert.match(specs, /Report the exact denied operation and path/);
  assert.match(specs, /observed event\s+sequence: whether `specs record` ran/);
  assert.match(specs, /`yes`, `no` only when observed not to have\s+run, or `unknown`/);
  assert.match(specs, /exact JSON `ok` and `changed` values when available/);
  assert.match(specs, /If a recorder result with `ok: true` precedes a later Edit denial, report its\s+exact `changed` paths as committed and report the denial as a separate event/);
  assert.match(specs, /For a no-run\/unknown outcome or `ok: false`, report only observed facts/);
  assert.match(specs, /do not\s+infer that no paths committed, that rollback completed, or that zero changes\s+occurred without evidence/);
  assert.match(specs, /Do not invoke substitute writes\/commands or retry/);
  assert.doesNotMatch(specs, /An OpenCode `edit` denial means `specs record` did not run/);
  assert.doesNotMatch(specs, /`run: no`, `ok: unavailable`, and `changed: none`/);
  assert.doesNotMatch(specs, /claim no\s+paths committed/);
  assert.match(specs, /When `specs record` returns `ok: false` with a detailed `task\.\*` path and\s+expected form, report that exact blocker; do not rerun/);
  assert.match(specs, /Before selecting any record path, read `.specs\/conventions\.md`/);
  assert.match(specs, /reuse the existing feature record[\s\S]*instead of creating a\s+duplicate/);
  assert.match(specs, /features\/<domain>\/<stable-concise-kebab-case-scope-slug>\.md/);
  assert.match(specs, /Use the closest existing domain when it fits; when none fits, create exactly\s+one new direct lowercase-kebab domain for the bounded subsystem\. Do not\s+create arbitrary nested feature directories\./);
  assert.match(specs, /not arbitrary\s+task,\s*prompt, date, status, or ID text/);
  assert.match(specs, /decisions\/ADR-NNN-<decision-slug>/);
  assert.match(specs, /changes\/YYYY-MM-DD-<feature-slug>\[-<slice-slug>\]/);
  assert.match(specs, /features\/<domain>\/audits\/<subject>-audit\.md/);
  assert.match(specs, /features\/<domain>\/proofs\/<subject>-proofs\.md/);
  assert.match(specs, /Never\s+rename, migrate, or normalize ANY existing record or path, whether a single\s+file or many\. Preserve all existing and legacy names/);
  assert.match(specs, /unless the handoff explicitly requests a[\s\S]*naming-convention change/);
  assert.match(specs, /changed `.specs` paths/);
});

test('project install is idempotent, status detects profiles, and uninstall preserves unrelated agents', () => {
  inProject((project) => {
    const installed = agents.installWorkerAgents(true);
    assert.equal(installed.length, 4);
    for (const profile of agents.workerAgentStatus(true)) assert.equal(profile.status, 'ok (up to date)');
    agents.installWorkerAgents(true);

    const other = path.join(workerAgentsTarget(true), 'my-agent.md');
    fs.writeFileSync(other, 'user agent\n');
    const result = agents.uninstallWorkerAgents(true);
    assert.equal(result.removed.length, 4);
    assert.deepEqual(result.preserved, []);
    assert.equal(fs.readFileSync(other, 'utf8'), 'user agent\n');
    assert.equal(fs.existsSync(path.join(project, '.opencode', 'agents', 'worker-code.md')), false);
    assert.equal(fs.existsSync(path.join(project, '.opencode', 'agents', 'worker-specs.md')), false);
  });
});

test('project install refuses a foreign worker name without overwriting any profile', () => {
  inProject((project) => {
    const target = path.join(workerAgentsTarget(true), 'worker-code.md');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, 'foreign profile\n');
    assert.throws(() => agents.installWorkerAgents(true), /not managed by Guarana/);
    assert.equal(fs.readFileSync(target, 'utf8'), 'foreign profile\n');
    assert.equal(fs.existsSync(path.join(project, '.opencode', 'agents', 'worker-verify.md')), false);
  });
});

test('global worker profiles deploy below the OpenCode agents root', () => {
  const originalHome = process.env.HOME;
  const originalXdg = process.env.XDG_CONFIG_HOME;
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-worker-home-'));
  try {
    process.env.HOME = home;
    delete process.env.XDG_CONFIG_HOME;
    for (const { content } of agents.profiles(false)) {
      assert.match(content, /^hidden: false$/m);
    }
    const installed = agents.installWorkerAgents(false);
    assert.equal(path.dirname(installed[0].target), path.join(home, '.config', 'opencode', 'agents'));
    for (const { target } of installed) {
      assert.match(fs.readFileSync(target, 'utf8'), /^hidden: false$/m);
    }
    assert.equal(fs.existsSync(path.join(home, '.config', 'opencode', 'agents', 'worker-verify.md')), true);
    assert.equal(fs.existsSync(path.join(home, '.config', 'opencode', 'agents', 'worker-specs.md')), true);
    assert.equal(agents.workerAgentStatus(false).find(({ name }) => name === 'worker-specs').status, 'ok (up to date)');
    const result = agents.uninstallWorkerAgents(false);
    assert.equal(result.removed.length, 4);
  } finally {
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
    if (originalXdg === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = originalXdg;
    fs.rmSync(home, { recursive: true, force: true });
  }
});
