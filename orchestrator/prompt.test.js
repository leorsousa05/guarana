import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildInjection, buildSystemBlock, completionAction, resolveSkillBody } from './prompt.js';
import { apply, createWorkflow } from './state.js';

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

function toState(state) {
  let workflow = createWorkflow();
  for (const event of ['new_task', 'plan_complete', 'run_start']) workflow = apply(workflow, event);
  if (state === 'verifying') workflow = apply(workflow, 'code_complete');
  return workflow;
}

test('explicit default-on preferences preserve the existing injected guidance byte-for-byte', () => {
  for (const state of ['planning', 'coding', 'verifying']) {
    const workflow = state === 'planning' ? apply(createWorkflow(), 'new_task') : toState(state);
    assert.equal(buildInjection(workflow), buildInjection(workflow, {
      preferences: { specs: { enabled: true }, verify: { enabled: true } },
    }));
    assert.equal(buildSystemBlock(workflow), buildSystemBlock(workflow, {
      specs: { enabled: true }, verify: { enabled: true },
    }));
  }
});

test('disabled specs policy follows the injected skill body and states explicit-request override', () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'guarana-policy-skill-'));
  const skillPath = path.join(project, '.opencode', 'skills', 'guarana', 'skills', 'plan', 'SKILL.md');
  fs.mkdirSync(path.dirname(skillPath), { recursive: true });
  fs.writeFileSync(skillPath, '# Plan skill\nMandatory original instructions.\n', 'utf8');
  try {
    const injection = buildInjection(apply(createWorkflow(), 'new_task'), {
      directory: project,
      preferences: { specs: { enabled: false }, verify: { enabled: false } },
    });
    assert.ok(injection.indexOf('## Workflow preference overrides') > injection.indexOf('Mandatory original instructions.'));
    assert.ok(injection.indexOf('### Independent verification preference') > injection.indexOf('Mandatory original instructions.'));
    assert.match(injection, /Do not automatically create or update human-readable task records under `\.specs`/);
    assert.match(injection, /do not automatically dispatch `worker-specs`/);
    assert.match(injection, /Preserve operational `\.specs\/state\/workflow\.json` and all existing human-readable `\.specs` records unchanged/);
    assert.match(injection, /explicit user request[\s\S]*may override this preference for that task/i);
    assert.match(injection, /if the user expressly asks for verification, first call `workflow_tick` with action `force` and skill `guarana:verify`/i);
  } finally {
    fs.rmSync(project, { recursive: true, force: true });
  }
});

test('disabled verification suppresses automatic worker dispatch and authorizes only a distinct skip', () => {
  const preferences = { specs: { enabled: true }, verify: { enabled: false } };
  const coding = buildInjection(toState('coding'), { preferences });
  assert.match(coding, /then run proportionate direct checks if useful and advance from coding with `verify_skip`/);
  assert.match(coding, /Do not automatically dispatch `worker-verify`/);
  assert.doesNotMatch(coding, /Call the native Task tool with subagent `worker-verify`/);

  const verifying = buildInjection(toState('verifying'), { preferences });
  assert.match(verifying, /`verify_skip`/);
  assert.match(verifying, /never call or describe this as PASS\/VALIDATED/);
  assert.match(verifying, /if the user expressly asks for verification, first call `workflow_tick` with action `force` and skill `guarana:verify`/i);
  assert.match(verifying, /then follow the active task override/i);
  assert.match(verifying, /does not change saved preferences/);
  assert.doesNotMatch(verifying, /Call the native Task tool with subagent `worker-verify`/);
  assert.equal(completionAction('verifying', preferences), 'verify_skip');
});

test('forced verification overrides disabled preference through failure and debug re-verification', () => {
  const preferences = { specs: { enabled: true }, verify: { enabled: false } };
  let workflow = apply(toState('verifying'), 'force', { skill: 'guarana:verify' });
  assert.equal(workflow.verificationOverride, true);

  const verifying = buildInjection(workflow, { preferences });
  assert.match(verifying, /Call the native Task tool with subagent `worker-verify` in a fresh context/);
  assert.match(verifying, /task-scoped explicit verification override is active/i);
  assert.equal(completionAction(workflow.state, preferences, workflow.verificationOverride), 'verify_pass|verify_fail');
  assert.doesNotMatch(verifying, /advance with `verify_skip`/);

  workflow = apply(workflow, 'verify_fail');
  assert.equal(workflow.verificationOverride, true);
  const debugging = buildInjection(workflow, { preferences });
  assert.match(debugging, /native Task tool with subagent `worker-debug`/);

  workflow = apply(workflow, 'debug_complete');
  assert.equal(workflow.verificationOverride, true);
  const retry = buildInjection(workflow, { preferences });
  assert.match(retry, /Call the native Task tool with subagent `worker-verify` in a fresh context/);
  assert.equal(completionAction(workflow.state, preferences, workflow.verificationOverride), 'verify_pass|verify_fail');
});
