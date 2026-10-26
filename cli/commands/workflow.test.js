'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const workflow = require('./workflow.js');
const { main } = require('../main.js');

function streams() {
  let stdout = '';
  let stderr = '';
  return {
    stdout: { write: (chunk) => { stdout += chunk.toString(); } },
    stderr: { write: (chunk) => { stderr += chunk.toString(); } },
    output: () => ({ stdout, stderr }),
  };
}

async function isolated(callback) {
  const originalCwd = process.cwd();
  const originalEnv = { HOME: process.env.HOME, XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME };
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-workflow-cli-'));
  const project = path.join(root, 'project');
  const xdg = path.join(root, 'xdg');
  fs.mkdirSync(project);
  process.env.HOME = path.join(root, 'home');
  process.env.XDG_CONFIG_HOME = xdg;
  process.chdir(project);
  try {
    await callback({ root, project, xdg });
  } finally {
    process.chdir(originalCwd);
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    fs.rmSync(root, { recursive: true, force: true });
  }
}

async function invoke(args) {
  const output = streams();
  const status = await main(args, output);
  return { status, ...output.output() };
}

function parsedOutput(result) {
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  return JSON.parse(result.stdout);
}

test('workflow read reports scoped partial settings, enabled defaults, and per-field sources', async () => {
  await isolated(async ({ project, xdg }) => {
    const projectAdvisor = path.join(project, '.guarana', 'advisor.json');
    const globalAdvisor = path.join(xdg, 'guarana', 'advisor.json');
    fs.mkdirSync(path.dirname(projectAdvisor), { recursive: true });
    fs.mkdirSync(path.dirname(globalAdvisor), { recursive: true });
    fs.writeFileSync(projectAdvisor, '{"project":"unchanged"}\n');
    fs.writeFileSync(globalAdvisor, '{"global":"unchanged"}\n');
    const advisorBefore = [fs.readFileSync(projectAdvisor), fs.readFileSync(globalAdvisor)];

    assert.deepEqual(parsedOutput(await invoke(['workflow', 'read'])), {
      scope: 'global',
      settings: {},
      effective: { specs: { enabled: true }, verify: { enabled: true }, memory: { preferenceInjectionBudgetTokens: null } },
      sources: { specs: 'default', verify: 'default', memory: { preferenceInjectionBudgetTokens: 'default' } },
    });

    assert.deepEqual(parsedOutput(await invoke(['workflow', 'read', '--project'])), {
      scope: 'project',
      settings: {},
      effective: { specs: { enabled: true }, verify: { enabled: true }, memory: { preferenceInjectionBudgetTokens: null } },
      sources: { specs: 'default', verify: 'default', memory: { preferenceInjectionBudgetTokens: 'default' } },
    });
    assert.deepEqual([fs.readFileSync(projectAdvisor), fs.readFileSync(globalAdvisor)], advisorBefore);
    assert.equal(fs.existsSync(path.join(project, '.guarana', 'workflow.json')), false);
  });
});

test('workflow set and clear target only the selected scope and project clear restores inheritance', async () => {
  await isolated(async ({ project, xdg }) => {
    const globalFile = path.join(xdg, 'guarana', 'workflow.json');
    const projectFile = path.join(project, '.guarana', 'workflow.json');
    assert.deepEqual(await invoke(['workflow', 'set', 'specs', 'false']), {
      status: 0, stdout: 'saved workflow preference specs.enabled=false (global)\n', stderr: '',
    });
    assert.deepEqual(await invoke(['workflow', 'set', 'verify', 'false']), {
      status: 0, stdout: 'saved workflow preference verify.enabled=false (global)\n', stderr: '',
    });
    assert.deepEqual(await invoke(['workflow', 'set', 'memory.preferenceInjectionBudgetTokens', '4096']), {
      status: 0, stdout: 'saved workflow preference memory.preferenceInjectionBudgetTokens=4096 (global)\n', stderr: '',
    });
    assert.deepEqual(parsedOutput(await invoke(['workflow', 'read'])), {
      scope: 'global',
      settings: { specs: { enabled: false }, verify: { enabled: false }, memory: { preferenceInjectionBudgetTokens: 4096 } },
      effective: { specs: { enabled: false }, verify: { enabled: false }, memory: { preferenceInjectionBudgetTokens: 4096 } },
      sources: { specs: 'global', verify: 'global', memory: { preferenceInjectionBudgetTokens: 'global' } },
    });
    assert.deepEqual(await invoke(['workflow', 'set', 'verify', 'true', '--project']), {
      status: 0, stdout: 'saved workflow preference verify.enabled=true (project)\n', stderr: '',
    });
    assert.deepEqual(await invoke(['workflow', 'set', 'memory.preferenceInjectionBudgetTokens', '1024', '--project']), {
      status: 0, stdout: 'saved workflow preference memory.preferenceInjectionBudgetTokens=1024 (project)\n', stderr: '',
    });

    assert.deepEqual(parsedOutput(await invoke(['workflow', 'read', '--project'])), {
      scope: 'project',
      settings: { verify: { enabled: true }, memory: { preferenceInjectionBudgetTokens: 1024 } },
      effective: { specs: { enabled: false }, verify: { enabled: true }, memory: { preferenceInjectionBudgetTokens: 1024 } },
      sources: { specs: 'global', verify: 'project', memory: { preferenceInjectionBudgetTokens: 'project' } },
    });

    assert.deepEqual(await invoke(['workflow', 'clear', 'verify', '--project']), {
      status: 0, stdout: 'cleared workflow preference verify.enabled (project)\n', stderr: '',
    });
    assert.deepEqual(await invoke(['workflow', 'clear', 'memory.preferenceInjectionBudgetTokens', '--project']), {
      status: 0, stdout: 'cleared workflow preference memory.preferenceInjectionBudgetTokens (project)\n', stderr: '',
    });
    assert.deepEqual(parsedOutput(await invoke(['workflow', 'read', '--project'])), {
      scope: 'project',
      settings: {},
      effective: { specs: { enabled: false }, verify: { enabled: false }, memory: { preferenceInjectionBudgetTokens: 4096 } },
      sources: { specs: 'global', verify: 'global', memory: { preferenceInjectionBudgetTokens: 'global' } },
    });

    await invoke(['workflow', 'set', 'specs', 'true', '--project']);
    assert.deepEqual(await invoke(['workflow', 'clear', '--project']), {
      status: 0, stdout: 'cleared workflow preferences (project)\n', stderr: '',
    });
    assert.deepEqual(JSON.parse(fs.readFileSync(globalFile, 'utf8')), {
      specs: { enabled: false }, verify: { enabled: false }, memory: { preferenceInjectionBudgetTokens: 4096 },
    });
    assert.deepEqual(JSON.parse(fs.readFileSync(projectFile, 'utf8')), {});
  });
});

test('workflow rejects malformed and invalid settings without overwriting them', async () => {
  await isolated(async ({ project }) => {
    const projectFile = path.join(project, '.guarana', 'workflow.json');
    fs.mkdirSync(path.dirname(projectFile), { recursive: true });

    for (const [bytes, args, diagnostic] of [
      ['{\n', ['workflow', 'set', 'specs', 'false', '--project'], 'workflow: malformed workflow settings JSON\n'],
      ['{"specs":{"enabled":"false"}}\n', ['workflow', 'clear', '--project'], 'workflow: Workflow setting specs.enabled must be a boolean\n'],
      ['{"advisor":{"enabled":false}}\n', ['workflow', 'read', '--project'], 'workflow: Unknown workflow settings section: advisor\n'],
      ['{"memory":{"preferenceInjectionBudgetTokens":0}}\n', ['workflow', 'read', '--project'], 'workflow: Workflow setting memory.preferenceInjectionBudgetTokens must be a positive integer token budget\n'],
    ]) {
      fs.writeFileSync(projectFile, bytes);
      const before = fs.readFileSync(projectFile);
      const result = await invoke(args);
      assert.equal(result.status, 1);
      assert.equal(result.stdout, '');
      assert.equal(result.stderr, diagnostic);
      assert.deepEqual(fs.readFileSync(projectFile), before);
    }
  });
});

test('workflow argument errors and detailed help have deterministic output and no writes', async () => {
  await isolated(async ({ project }) => {
    const bad = await invoke(['workflow', 'set', 'specs', 'False', '--project']);
    assert.deepEqual(bad, {
      status: 1,
      stdout: '',
      stderr: 'workflow: invalid boolean value for specs: False (expected true or false)\n',
    });
    assert.equal(fs.existsSync(path.join(project, '.guarana')), false);

    const unknown = await invoke(['workflow', 'unknown']);
    assert.equal(unknown.status, 1);
    assert.equal(unknown.stderr, 'workflow: unknown workflow command: unknown\n');
    assert.equal(unknown.stdout, workflow.HELP);

    const help = await invoke(['workflow', '--help']);
    assert.deepEqual(help, { status: 0, stdout: workflow.HELP, stderr: '' });
    assert.match(help.stdout, /guarana workflow clear \[specs\|verify\|memory\.preferenceInjectionBudgetTokens\] \[--project\]/);
  });
});

test('workflow handler returns numeric status and never mutates process exit state', async () => {
  await isolated(async () => {
    const previousExitCode = process.exitCode;
    process.exitCode = 19;
    try {
      assert.equal(await workflow.run(['read'], { useProject: true, ...streams() }), 0);
      assert.equal(process.exitCode, 19);
    } finally {
      process.exitCode = previousExitCode;
    }
  });
});
