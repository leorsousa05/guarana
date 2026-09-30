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
// A plugin-deployed layout may point at the project skills (../skills/guarana)
// or the globally installed skills (~/.agents/skills/guarana). All covered by
// an explicit candidate list so injection never depends on cwd.
function skillDirs(projectDir) {
  const candidates = [
    projectDir ? path.join(projectDir, 'skills', 'guarana') : null,
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

// Always-resident orchestration block: state overview + how the loop advances.
export function buildSystemBlock(workflow) {
  const skill = skillForState(workflow.state);
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
    '- Follow the active skill body appended below (it is injected every turn).',
    '- Before code dispatch, inspect project evidence and ask about consequential requirement gaps; do not silently assume scope or acceptance for substantial/ambiguous work.',
    '- Skip redundant questions for small, fully specified tasks; record material assumptions.',
    '- When the current step is done, call `workflow_tick` with the matching action',
    '  to advance the state machine (e.g. code_complete, verify_pass, verify_fail).',
    '- Use `workflow_get` to read the latest state.',
    '- A user typing `guarana:<skill>` forces that step (escape hatch).',
    '',
    skill
      ? `Active skill: \`guarana:${skill}\` — its full body follows.`
      : 'Idle: await a task, or a `guarana:<skill>` command.',
  ].join('\n');
}

// The completion action the model must call to advance from the current state.
export function completionAction(state) {
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
export function buildInjection(workflow, { memoryContext, directory } = {}) {
  const skill = skillForState(workflow.state);
  const block = buildSystemBlock(workflow);
  const memory = memoryContext && memoryContext.count > 0
    ? `\n\n<!-- guarana memory (automatic context) -->\n${JSON.stringify(memoryContext)}\n<!-- end guarana memory -->`
    : '';
  if (!skill) return block + memory;
  const body = resolveSkillBody(skill, directory);
  const action = completionAction(workflow.state);
  const close = action
    ? `\n\nWorkflow: when this step completes, call \`workflow_tick\` with action \`${action}\`.`
    : '';
  return [block + memory, body ? `\n\n<!-- guarana:${skill} (injected) -->\n${body}${close}` : '']
    .filter(Boolean)
    .join('\n');
}
