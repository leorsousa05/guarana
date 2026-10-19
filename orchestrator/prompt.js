// guarana orchestrator — prompt builders (host-independent).
// Builds the always-on orchestration block (state overview + how the loop
// advances) and resolves the full SKILL.md body of the current state's skill
// for direct injection into the system prompt — the "ponytail" mechanism:
// the skill instructions are appended every turn, so the model always has the
// active skill's body in context without calling the `skill` tool. Only the
// active skill is injected at a time; the rest stay out of context.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STATE_SKILL, skillForState } from './state.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Candidate skill-directory roots, in order. Repo layout is
//   orchestrator/prompt.js -> ../skills/guarana
// The cli bundle layout is
//   cli/orchestrator/prompt.js -> ../skills/guarana
// A plugin-deployed layout may point at the project skills
// (.opencode/skills/guarana) or the globally installed skills
// (~/.agents/skills/guarana). All covered by
// an explicit candidate list so injection never depends on cwd.
function skillDirs(projectDir) {
  const candidates = [
    projectDir ? path.join(projectDir, '.opencode', 'skills', 'guarana') : null,
    path.join(__dirname, '..', 'skills', 'guarana'),
    path.join(__dirname, '..', '..', 'skills', 'guarana'),
    path.join(__dirname, '..', '..', '..', 'skills', 'guarana'),
    path.join(os.homedir(), '.agents', 'skills', 'guarana'),
  ];
  return candidates.filter((dir) => {
    if (!dir) return false;
    try {
      return fs.statSync(dir).isDirectory();
    } catch {
      return false;
    }
  });
}

// Resolve the SKILL.md body for a skill name (e.g. 'plan' -> SKILL.md contents).
// Returns the file text, or '' when no body can be found.
export function resolveSkillBody(skill, projectDir) {
  if (!skill) return '';
  const rel = path.join('skills', `${skill}`, 'SKILL.md');
  for (const dir of skillDirs(projectDir)) {
    const file = path.join(dir, rel);
    try {
      return fs.readFileSync(file, 'utf8');
    } catch {
      /* try next candidate */
    }
  }
  return '';
}

const SKILL_LINES = Object.entries(STATE_SKILL)
  .filter(([, s]) => s)
  .map(([state, s]) => `- ${state} -> \`guarana:${s}\``)
  .join('\n');

const TASK_STATES = new Set(['coding', 'verifying', 'debugging']);

function preferenceEnabled(preferences, name) {
  return preferences?.[name]?.enabled !== false;
}

function verificationEnabled(preferences, taskOverride) {
  return preferenceEnabled(preferences, 'verify') || taskOverride === true;
}

function preferenceOverrides(preferences, taskOverride) {
  const policies = [];
  if (!preferenceEnabled(preferences, 'specs')) {
    policies.push(
      '### Specs automation preference (disabled)',
      '- Do not automatically create or update human-readable task records under `.specs`, and do not automatically dispatch `worker-specs`.',
      '- Preserve operational `.specs/state/workflow.json` and all existing human-readable `.specs` records unchanged.',
      '- An explicit user request for `.specs` work may override this preference for that task.',
    );
  }
  if (!preferenceEnabled(preferences, 'verify')) {
    policies.push(
      '### Independent verification preference (disabled)',
      taskOverride === true
        ? '- A task-scoped explicit verification override is active. Dispatch `worker-verify` when verifying, then advance with `verify_pass` or `verify_fail`; this does not change the saved preference.'
        : '- Do not automatically dispatch `worker-verify`. The primary may run proportionate direct checks, then record the skip with `workflow_tick` action `verify_skip`; never call or describe this as PASS/VALIDATED or claim independent verification.',
      ...(taskOverride === true ? [] : [
        '- If the user expressly asks for verification, first call `workflow_tick` with action `force` and skill `guarana:verify`, then follow the active task override; this does not change saved preferences.',
      ]),
    );
  }
  return policies.length ? `\n\n## Workflow preference overrides\n${policies.join('\n')}` : '';
}

// Always-resident orchestration block: state overview + how the loop advances.
export function buildSystemBlock(workflow, preferences) {
  const skill = skillForState(workflow.state);
  const delegated = TASK_STATES.has(workflow.state);
  const verifyEnabled = verificationEnabled(preferences, workflow.verificationOverride);
  const delegationRule = workflow.state === 'coding'
    ? verifyEnabled
      ? '- Call the native Task tool with subagent `worker-code`; pass the exact condition, budget, and state pointers, wait for its diff/stop-reason return, then advance with `code_complete`.'
      : '- Call the native Task tool with subagent `worker-code`; pass the exact condition, budget, and state pointers, wait for its diff/stop-reason return, then run proportionate direct checks if useful and advance from coding with `verify_skip` (do not dispatch worker-verify).'
    : workflow.state === 'verifying'
      ? verifyEnabled
        ? '- Call the native Task tool with subagent `worker-verify` in a fresh context; pass the condition, evidence, and state pointers, wait for criterion-level verdict/proofs, then advance with `verify_pass` or `verify_fail`.'
        : '- Do not automatically dispatch `worker-verify`; the primary may run proportionate direct checks, then advance with `verify_skip` (not `verify_pass`).'
      : workflow.state === 'debugging'
        ? '- After a confirmed failure, call the native Task tool with subagent `worker-debug`; pass the failure and state pointers, wait for root cause/mitigation, then decide whether to start a code fix or re-verify.'
        : '';
  return [
    '## Guarana workflow (automatic engineering loop)',
    '',
    'You are inside the guarana loop. It decides the next step for you based on',
    'the persisted workflow state; you execute it. State is the source of truth',
    'on disk at `.specs/state/workflow.json`.',
    '',
    `Current state: **${workflow.state}**`,
    `Active task: ${workflow.activeTask || '(none)'}`,
    `Goal: ${workflow.goal || '(none)'}`,
    '',
    'State → skill:',
    SKILL_LINES,
    '',
    'Rules:',
    delegated
      ? '- Delegate worker procedures to separate native Task subagents; the installed agent profile contains the active skill procedure.'
      : '- Follow the active skill body appended below (it is injected every turn).',
    ...(delegationRule ? [delegationRule] : []),
    ...(delegated ? [
      '- The primary context owns workflow transitions and advances only after inspecting the Task result; worker subagents never call workflow_tick.',
      '- If Task is unavailable or denied, report the blocker and stop without doing the worker procedure in this context.',
    ] : []),
    '- Only explicit `guarana:<skill>` commands or clear product/document/configuration changes start planning; informational and read-only requests create no task spec or tracker/project-state writes.',
    '- The primary owns requirements, acceptance, workflow transitions, and independent verification. Keep worker-code and worker-verify in separate native Task contexts; use worker-debug only for actionable confirmed failures.',
    '- `worker-specs` is dispatched only for a durable human-readable record change; transient stage, budget, and current-step data belongs in operational workflow JSON. Validate only after an actual record write.',
    '- Follow `guarana:plan` for requirements discovery, worker ownership, record cadence, ADR, and known-issue policy.',
    '- When the current step is done, call `workflow_tick` with the matching action',
    '  to advance the state machine (e.g. code_complete, verify_pass, verify_fail).',
    '- Use `workflow_get` to read the latest state.',
    '- A user typing `guarana:<skill>` forces that step (escape hatch).',
    '',
    skill
      ? delegated
        ? `Active skill: \`guarana:${skill}\` — execute it through the designated Task subagent; its profile carries the full procedure.`
        : `Active skill: \`guarana:${skill}\` — its full body follows.`
      : 'Idle: await a task, or a `guarana:<skill>` command.',
  ].join('\n');
}

// The completion action the model must call to advance from the current state.
export function completionAction(state, preferences, taskOverride = false) {
  if (state === 'verifying' && !verificationEnabled(preferences, taskOverride)) return 'verify_skip';
  return {
    planning: 'plan_complete',
    building: 'run_start',
    coding: 'code_complete',
    verifying: 'verify_pass|verify_fail',
    debugging: 'debug_complete',
  }[state] || null;
}

// The injected context for the current state: orchestration block + the active
// skill's full SKILL.md body + a closing line naming the completion action.
export function buildInjection(workflow, { memoryContext, directory, preferences } = {}) {
  const skill = skillForState(workflow.state);
  const block = buildSystemBlock(workflow, preferences);
  const policy = preferenceOverrides(preferences, workflow.verificationOverride);
  const memory = memoryContext && memoryContext.count > 0
    ? `\n\n<!-- guarana memory (automatic context) -->\n${JSON.stringify(memoryContext)}\n<!-- end guarana memory -->`
    : '';
  if (!skill || TASK_STATES.has(workflow.state)) return block + memory + policy;
  const body = resolveSkillBody(skill, directory);
  const action = completionAction(workflow.state, preferences, workflow.verificationOverride);
  const close = action
    ? `\n\nWorkflow: when this step completes, call \`workflow_tick\` with action \`${action}\`.`
    : '';
  return [block + memory, body ? `\n\n<!-- guarana:${skill} (injected) -->\n${body}${close}` : '', policy]
    .filter(Boolean)
    .join('\n');
}
