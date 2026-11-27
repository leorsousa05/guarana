const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const agents = require('./agents.js');
const { workerAgentsTarget } = require('./paths.js');

function parseWorkerPermissions(content) {
  const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  assert.ok(frontmatter, 'worker profile must have valid frontmatter boundaries');
  const lines = frontmatter[1].split(/\r?\n/);
  assert.equal(lines.some((line) => /^permission\s*:/.test(line)), false, 'V2 profile must not use legacy permission');
  const policyIndex = lines.indexOf('permissions:');
  assert.notEqual(policyIndex, -1, 'worker profile must declare V2 permissions');
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

function resourceMatches(pattern, resource) {
  if (pattern === '*') return true;
  const glob = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*');
  return new RegExp(`^${glob}$`).test(resource);
}

function effectFor(permissions, action, resource = '*') {
  return permissions
    .filter((rule) => (rule.action === '*' || rule.action === action) && resourceMatches(rule.resource, resource))
    .at(-1)?.effect;
}

function assertReadOnlyResearchPermissions(content) {
  const permissions = parseWorkerPermissions(content);
  assert.deepEqual(permissions, [
    { action: '*', resource: '*', effect: 'deny' },
    { action: 'external_directory', resource: '*', effect: 'deny' },
    { action: 'read', resource: '*', effect: 'allow' },
    { action: 'glob', resource: '*', effect: 'allow' },
    { action: 'grep', resource: '*', effect: 'allow' },
  ]);
  for (const action of ['read', 'glob', 'grep']) {
    assert.equal(effectFor(permissions, action), 'allow', `${action} must be allowed`);
  }
  for (const action of [
    'external_directory', 'shell', 'edit', 'write', 'apply_patch', 'patch', 'subagent',
    'workflow_tick', 'execute', 'webfetch', 'websearch', 'list',
    'question', 'skill', 'todowrite', 'lsp', 'doom_loop',
  ]) {
    assert.equal(effectFor(permissions, action), 'deny', `${action} must be denied by default or explicitly`);
  }
}

function assertWorkerProfilePermissions(profiles) {
  for (const { name, content } of profiles) {
    const permissions = parseWorkerPermissions(content);
    assert.equal(permissions.some(({ action }) => ['task', 'bash'].includes(action)), false, `${name} must use V2 action names`);

    for (const action of ['subagent', 'workflow_tick']) {
      assert.equal(effectFor(permissions, action), 'deny', `${name} must deny ${action}`);
    }
    for (const action of ['read', 'grep', 'glob']) {
      assert.equal(effectFor(permissions, action), 'allow', `${name} must allow ${action}`);
    }

    if (name === 'worker-research') {
      assertReadOnlyResearchPermissions(content);
    } else {
      assert.equal(effectFor(permissions, 'shell', 'npm test'), name === 'worker-specs' ? 'deny' : 'allow');
    }
    if (name === 'worker-code') {
      assert.equal(effectFor(permissions, 'edit', 'src/index.js'), 'allow');
    } else if (name === 'worker-verify') {
      assert.equal(effectFor(permissions, 'edit', '.specs/README.md'), 'deny');
    } else if (name === 'worker-debug') {
      assert.equal(effectFor(permissions, 'edit', '.specs/state/known-issues.md'), 'allow');
      assert.equal(effectFor(permissions, 'edit', '.specs/README.md'), 'deny');
    } else if (name === 'worker-specs') {
      const allowedPaths = [
        '.specs/README.md',
        '.specs/state/project-state.md',
        '.specs/state/worker-specs-handoff.json',
        '.specs/features/orchestrator.md',
        '.specs/features/orchestrator/spec-update-isolation.md',
        '.specs/features/cli/learning-review-service-authentication.md',
        '.specs/changes/2026-10-09-worker-specs-permissions.md',
        '.specs/decisions/ADR-049-learning-review-service-authentication.md',
      ];
      const editAllows = permissions
        .filter(({ action, effect }) => action === 'edit' && effect === 'allow')
        .map(({ resource }) => resource);
      assert.deepEqual(editAllows, [
        '.specs/README.md',
        '.specs/state/*.md',
        '.specs/state/worker-specs-handoff.json',
        '.specs/features/*.md',
        '.specs/features/*/*.md',
        '.specs/changes/*.md',
        '.specs/decisions/ADR-*.md',
      ]);
      assert.deepEqual(permissions.find(({ action }) => action === 'edit'), {
        action: 'edit',
        resource: '*',
        effect: 'deny',
      });
      const shellAllows = permissions
        .filter(({ action, effect }) => action === 'shell' && effect === 'allow')
        .map(({ resource }) => resource);
      assert.deepEqual(shellAllows, [
        'guarana specs record --file .specs/state/worker-specs-handoff.json',
        'node bin/guarana.js specs record --file .specs/state/worker-specs-handoff.json',
      ]);
      for (const requestedPath of allowedPaths) {
        assert.equal(effectFor(permissions, 'edit', requestedPath), 'allow', `${requestedPath} must be allowed`);
      }
      for (const requestedPath of [
        'README.md',
        '.specs/architecture.md',
        '.specs/architecture.md.bak',
        '.specs/architecture/subsystem.md',
        '.specs/conventions.md',
        '.specs/conventions.md.bak',
        '.specs/conventions/naming.md',
        '.specs/decisions/decision.md',
        '.specs/decisions/ADR-049-learning-review-service-authentication.txt',
        '.specs/decisions/ADR-049-learning-review-service-authentication.md.bak',
        '.specs/decisions/nested/ADR-049-learning-review-service-authentication.md',
        '.specs/state/worker-specs-handoff.bak.json',
        '.specs/state/other.json',
        '.specs/state/nested/worker-specs-handoff.json',
        '.specs/features/unlisted.txt',
        '.specs/features/orchestrator/audits/spec-update-audit.md',
        '.specs/features/orchestrator/proofs/spec-update-proofs.md',
        '.specs/features/orchestrator/nested/spec-update-isolation.md',
        '.specs/changes/unlisted.txt',
        '.specs/unlisted.md',
        '.specs/../README.md',
        '../other-project/.specs/README.md',
        '/tmp/foreign-project/.specs/README.md',
        '/home/user/project/.specs/README.md',
        'other-project/.specs/README.md',
      ]) {
        assert.equal(effectFor(permissions, 'edit', requestedPath), 'deny', `${requestedPath} must be denied`);
      }
      assert.equal(effectFor(permissions, 'shell', 'guarana specs record --file .specs/state/worker-specs-handoff.json'), 'allow');
      assert.equal(effectFor(permissions, 'shell', 'node bin/guarana.js specs record --file .specs/state/worker-specs-handoff.json'), 'allow');
    }
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
  assertWorkerProfilePermissions(generated);
  assertWorkerProfilePermissions(agents.profiles(false));
  for (const { content } of generated) {
    assert.match(content, /mode: subagent/);
    assert.match(content, /^hidden: false$/m);
  }

  const code = generated[0].content;
  assert.match(code, /mode: subagent/);
  assert.match(code, /Read before edit/);
  assert.match(code, /diff \(or exact file list\)/);
  assert.match(code, /smallest ordinary checks mapped to changed acceptance criteria/i);
  assert.match(code, /Do not run smoke tests/i);

  const verify = generated[1].content;
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
  assert.match(debug, /Failure-mode matrix/);

  const specs = generated[4].content.replace(/\s+/g, ' ');
  assert.match(specs, /mode: subagent/);
  assert.match(specs, /Do not invent requirements, acceptance decisions/);
  assert.match(specs, /dispatched only when a durable human-readable `.specs` record will\s+change/i);
  assert.match(specs, /material\s+alternatives/i);
  assert.match(specs, /existing mutable `\.specs` record, use the available focused\s+`patch` or `edit`/);
  assert.match(specs, /specific semantic narrative passage/);
  assert.match(specs, /confirmed facts explicitly supersede; preserve unrelated and historical text/);
  assert.match(specs, /writes only its recorder-owned fields and does not\s+rewrite arbitrary narrative/);
  assert.match(specs, /Keep tracker, checkpoint, status, and receipt fields exclusively\s+in\s+`specs record`/);
  assert.match(specs, /project-root\s+`README\.md` is outside this worker's `.specs` authority and\s+permissions/);
  assert.match(specs, /Append a new ADR only when the supplied facts establish a durable[\s\S]*?with material\s+alternatives\. ADRs are append-only; never revise an existing ADR/);
  assert.match(specs, /Do\s+not rewrite historical change or verification evidence/);
  assert.match(specs, /Create or\s+update `.specs\/state\/worker-specs-handoff\.json` with an exposed file-writing\s+tool: prefer `patch`; otherwise use `write`, or `edit` if the file already\s+exists/);
  assert.match(specs, /OpenCode governs `patch`, `write`, and `edit` with the same `edit`\s+permission; every affected path must be authorized/);
  assert.match(specs, /If no file-writing tool\s+is exposed, stop and report tool unavailable, not permission denied/);
  assert.match(specs, /If an\s+actual write is denied, report the exact tool and path; do not broaden the\s+edit or bypass permissions/);
  assert.match(specs, /An OpenCode `patch`, `write`, or `edit` denial does not by itself establish\s+whether `specs record` ran/);
  assert.match(specs, /Report the exact denied tool and path/);
  assert.match(specs, /observed event\s+sequence: whether `specs record` ran/);
  assert.match(specs, /`yes`, `no` only when observed not to have\s+run, or `unknown`/);
  assert.match(specs, /exact JSON `ok` and `changed` values when available/);
  assert.match(specs, /If a recorder result with `ok: true` precedes a later file-write denial, report its\s+exact `changed` paths as committed and report the denial as a separate event/);
  assert.match(specs, /For a no-run\/unknown outcome or `ok: false`, report only observed facts/);
  assert.match(specs, /do not\s+infer that no paths committed, that rollback completed, or that zero changes\s+occurred without evidence/);
  assert.match(specs, /Do not invoke substitute writes\/commands or retry/);
  assert.doesNotMatch(specs, /An OpenCode `patch`, `write`, or `edit` denial means `specs record` did not run/);
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
    assertWorkerProfilePermissions(installed.map(({ name, target }) => ({
      name,
      content: fs.readFileSync(target, 'utf8'),
    })));
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
    assertWorkerProfilePermissions(installed.map(({ name, target }) => ({
      name,
      content: fs.readFileSync(target, 'utf8'),
    })));
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
