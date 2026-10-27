const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const agents = require('./agents.js');
const { workerAgentsTarget } = require('./paths.js');

function parseResearchPermissions(content) {
  const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  assert.ok(frontmatter, 'worker-research must have valid frontmatter boundaries');
  const lines = frontmatter[1].split(/\r?\n/);
  assert.equal(lines.some((line) => /^permission\s*:/.test(line)), false, 'V2 profile must not use legacy permission');
  const policyIndex = lines.indexOf('permissions:');
  assert.notEqual(policyIndex, -1, 'worker-research must declare V2 permissions');
  assert.equal(lines.filter((line) => line === 'permissions:').length, 1);

  const scalar = (value) => {
    if (value.startsWith('"')) {
      assert.match(value, /^"(?:[^"\\]|\\.)*"$/, 'quoted YAML scalar must be complete');
      return JSON.parse(value);
    }
    assert.match(value, /^[A-Za-z_][A-Za-z0-9_-]*$/, 'plain YAML scalar must be valid');
    return value;
  };
  const permissions = [];
  for (let index = policyIndex + 1; index < lines.length; index += 3) {
    const action = lines[index].match(/^  - action: (.+)$/);
    const resource = lines[index + 1]?.match(/^    resource: (.+)$/);
    const effect = lines[index + 2]?.match(/^    effect: (allow|deny)$/);
    assert.ok(action && resource && effect, 'V2 permissions must be an ordered YAML list of action/resource/effect records');
    permissions.push({
      action: scalar(action[1]),
      resource: scalar(resource[1]),
      effect: effect[1],
    });
  }
  return permissions;
}

function assertReadOnlyResearchPermissions(content) {
  const permissions = parseResearchPermissions(content);
  assert.deepEqual(permissions, [
    { action: '*', resource: '*', effect: 'deny' },
    { action: 'external_directory', resource: '*', effect: 'deny' },
    { action: 'read', resource: '*', effect: 'allow' },
    { action: 'glob', resource: '*', effect: 'allow' },
    { action: 'grep', resource: '*', effect: 'allow' },
  ]);
  const effectForAction = (action) => permissions
    .filter((rule) => rule.action === '*' || rule.action === action)
    .at(-1)?.effect;
  for (const action of ['read', 'glob', 'grep']) {
    assert.equal(effectForAction(action), 'allow', `${action} must be allowed`);
  }
  for (const action of [
    'external_directory', 'bash', 'edit', 'write', 'apply_patch', 'patch', 'task',
    'subagent', 'workflow_tick', 'execute', 'webfetch', 'websearch', 'list',
    'question', 'skill', 'todowrite', 'lsp', 'doom_loop',
  ]) {
    assert.equal(effectForAction(action), 'deny', `${action} must be denied by default or explicitly`);
  }
}

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
  assert.deepEqual(generated.map(({ name }) => name), ['worker-code', 'worker-verify', 'worker-research', 'worker-debug', 'worker-specs']);
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

  const research = generated[2].content;
  assertReadOnlyResearchPermissions(research);
  assertReadOnlyResearchPermissions(agents.profiles(false).find(({ name }) => name === 'worker-research').content);
  assert.match(research, /Default dispatch budget: 4,000 tokens/);
  assert.match(research, /default budget is \*\*4k tokens per dispatch\*\*/i);
  assert.match(research, /Do not edit files, run bash\/shell commands, launch nested tasks, or call\s+`workflow_tick`/);
  assert.match(research, /cite exact paths and line references/i);
  const skillIndex = fs.readFileSync(path.join(__dirname, '..', 'skills', 'guarana', 'SKILL.md'), 'utf8');
  assert.match(skillIndex, /guarana:research.*read-only.*\[skills\/research\/SKILL\.md\]/i);

  const debug = generated[3].content;
  assert.match(debug, /"\*": deny/);
  assert.match(debug, /"\.specs\/state\/known-issues\.md": allow/);
  assert.doesNotMatch(debug, /\*\*\//);
  assert.match(debug, /Failure-mode matrix/);

  const specs = generated[4].content;
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
  assert.match(specs, /For repository context, rely on candidate worktree identity\/path and git status\s+and HEAD facts supplied by the primary\. If any are absent, or the target worktree\s+is ambiguous, ask the primary to inspect and supply the facts; do not inspect git\s+state yourself\. Git status\/rev-parse preflight belongs to the primary\./);
  assert.match(specs, /This recorder invocation \(or the documented node equivalent\) is the only\s+permitted shell use\. Do not run git status\/rev-parse preflight, stdin,\s+heredocs, or any other shell command\./);
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
    assert.equal(installed.length, 5);
    for (const profile of agents.workerAgentStatus(true)) assert.equal(profile.status, 'ok (up to date)');
    agents.installWorkerAgents(true);

    const research = fs.readFileSync(path.join(workerAgentsTarget(true), 'worker-research.md'), 'utf8');
    assertReadOnlyResearchPermissions(research);

    const other = path.join(workerAgentsTarget(true), 'my-agent.md');
    fs.writeFileSync(other, 'user agent\n');
    const result = agents.uninstallWorkerAgents(true);
    assert.equal(result.removed.length, 5);
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
    const research = fs.readFileSync(path.join(home, '.config', 'opencode', 'agents', 'worker-research.md'), 'utf8');
    assertReadOnlyResearchPermissions(research);
    assert.equal(fs.existsSync(path.join(home, '.config', 'opencode', 'agents', 'worker-specs.md')), true);
    assert.equal(agents.workerAgentStatus(false).find(({ name }) => name === 'worker-specs').status, 'ok (up to date)');
    const result = agents.uninstallWorkerAgents(false);
    assert.equal(result.removed.length, 5);
  } finally {
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
    if (originalXdg === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = originalXdg;
    fs.rmSync(home, { recursive: true, force: true });
  }
});
