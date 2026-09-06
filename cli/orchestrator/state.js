// guarana orchestrator — workflow state machine (host-independent core).
// Pure ESM, zero deps. Owns the engineering-loop state machine: states,
// legal transitions, persistence to .specs/state/workflow.json. This is the
// source of truth for the current guarana workflow (ADR-004 discipline).
// The opencode adapter (plugin/guarana-orchestrator.js) is a thin shell over
// these functions; it never duplicates transition logic.

import fs from 'node:fs';
import path from 'node:path';

export const STATES = [
  'idle',
  'planning',
  'building',
  'coding',
  'verifying',
  'debugging',
  'completed',
];

// Which skill body the model should load while in a given state. The full
// skill instructions stay in the skill tool (progressive disclosure); this
// only names the skill to select.
export const STATE_SKILL = {
  idle: null,
  planning: 'plan',
  building: 'build',
  coding: 'code',
  verifying: 'verify',
  debugging: 'debug',
  completed: null,
};

// Event -> { from, to }. 'force' is special: target state is derived from the
// requested skill (escape-hatch). '*' means any state.
const TRANSITIONS = {
  new_task: { from: ['idle', 'completed', 'planning', 'building', 'coding', 'verifying', 'debugging'], to: 'planning' },
  plan_complete: { from: ['planning'], to: 'building' },
  run_start: { from: ['building'], to: 'coding' },
  code_complete: { from: ['coding'], to: 'verifying' },
  fix_start: { from: ['debugging'], to: 'coding' },
  debug_complete: { from: ['debugging'], to: 'verifying' },
  verify_pass: { from: ['verifying'], to: 'completed' },
  verify_fail: { from: ['verifying'], to: 'debugging' },
  abort: { from: ['idle', 'planning', 'building', 'coding', 'verifying', 'debugging', 'completed'], to: 'idle' },
  force: { from: ['*'], to: null },
};

export const EVENTS = Object.keys(TRANSITIONS);

export function isState(s) {
  return STATES.includes(s);
}

export function isEvent(e) {
  return Object.prototype.hasOwnProperty.call(TRANSITIONS, e);
}

export function skillForState(state) {
  return STATE_SKILL[state] || null;
}

export function stateForSkill(skill) {
  if (!skill) return null;
  const name = String(skill).toLowerCase().replace(/^guarana[:_-]?/, '');
  for (const [state, s] of Object.entries(STATE_SKILL)) {
    if (s === name) return state;
  }
  return null;
}

// Does the event legally fire from the given state? 'force' and 'abort' are
// universal escapes.
export function canTransition(event, from) {
  const t = TRANSITIONS[event];
  if (!t) return false;
  if (t.from[0] === '*') return isState(from);
  return t.from.includes(from);
}

// Pure transition: returns a NEW workflow object or null if illegal.
export function apply(workflow, event, opts = {}) {
  const from = workflow.state;
  if (!canTransition(event, from)) return null;
  const to = event === 'force'
    ? stateForSkill(opts.skill) || from
    : TRANSITIONS[event].to;
  const now = opts.ts != null ? opts.ts : Date.now();
  const skill = opts.skill || skillForState(to) || null;
  const entry = {
    ts: now,
    event,
    from,
    to,
    note: opts.note || '',
  };
  return {
    ...workflow,
    state: to,
    skill,
    goal: opts.goal != null ? opts.goal : workflow.goal,
    condition: opts.condition != null ? opts.condition : workflow.condition,
    activeTask: opts.activeTask != null ? opts.activeTask : workflow.activeTask,
    updatedAt: now,
    history: [...(workflow.history || []), entry],
  };
}

// ---- Defaults / persistence ----

export function createWorkflow() {
  return {
    version: 1,
    state: 'idle',
    skill: null,
    activeTask: null,
    goal: null,
    condition: null,
    updatedAt: 0,
    history: [],
  };
}

export function workflowFile(dir) {
  return path.join(dir, '.specs', 'state', 'workflow.json');
}

// Never throws on IO: a missing/corrupt file returns a fresh idle workflow.
// Disk is the source of truth when present; otherwise defaults.
export function load(dir) {
  try {
    const raw = fs.readFileSync(workflowFile(dir), 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || !isState(parsed.state)) return createWorkflow();
    const history = Array.isArray(parsed.history) ? parsed.history : [];
    return {
      version: 1,
      state: parsed.state,
      skill: skillForState(parsed.state),
      activeTask: parsed.activeTask != null ? parsed.activeTask : null,
      goal: parsed.goal != null ? parsed.goal : null,
      condition: parsed.condition != null ? parsed.condition : null,
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0,
      history,
    };
  } catch {
    return createWorkflow();
  }
}

// Persist best-effort; never throws. Returns true on success.
export function save(dir, workflow) {
  try {
    const file = workflowFile(dir);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(workflow, null, 2) + '\n', 'utf8');
    return true;
  } catch {
    return false;
  }
}