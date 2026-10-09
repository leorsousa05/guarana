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

  const code = generated[0].content;
  assert.match(code, /mode: subagent/);
  assert.match(code, /hidden: true/);
  assert.match(code, /task: deny/);
  assert.match(code, /workflow_tick: deny/);
  assert.match(code, /edit: allow/);
  assert.match(code, /Read before edit/);
  assert.match(code, /diff \(or exact file list\)/);

  const verify = generated[1].content;
  assert.match(verify, /edit: deny/);
  assert.match(verify, /Independent verifier/);
  assert.match(verify, /per-criterion PASS\/FAIL \+ proof path/);

  const debug = generated[2].content;
  assert.match(debug, /"\*": deny/);
  assert.match(debug, /"\.specs\/state\/known-issues\.md": allow/);
  assert.doesNotMatch(debug, /\*\*\//);
  assert.match(debug, /Failure-mode matrix/);

  const specs = generated[3].content;
  assert.match(specs, /mode: subagent/);
  assert.match(specs, /hidden: true/);
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
    '.specs/state/project-state.md',
    '.specs/state/worker-specs-handoff.json',
    '.specs/features/orchestrator.md',
    '.specs/features/orchestrator/spec-update-isolation.md',
    '.specs/changes/2026-10-09-worker-specs-permissions.md',
  ];
  for (const requestedPath of allowedSpecsPaths) {
    const allowedByRule = specsEditRules.split('\n').some((rule) => {
      const match = rule.match(/^\s+"(.+)": allow$/);
      if (!match) return false;
      const glob = match[1].replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
      return new RegExp(`^${glob}$`).test(requestedPath);
    });
    assert.equal(allowedByRule, true, `${requestedPath} must be allowed by a worker-specs edit rule`);
  }
  assert.match(specsEditRules, /"\*": deny/);
  assert.doesNotMatch(specsBashRules, /--stdin|<<|heredoc/i);
  assert.doesNotMatch(specs, /edit:\s*allow\s*$/m);
  assert.match(specs, /Do not invent requirements, acceptance decisions/);
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
    const installed = agents.installWorkerAgents(false);
    assert.equal(path.dirname(installed[0].target), path.join(home, '.config', 'opencode', 'agents'));
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
