// guarana orchestrator — intent classification and skill selection.
// Pure, host-independent. Decides which guarana skill should fire and which
// state transition (if any) applies, given the user's request, the current
// workflow state, and the previous tool result. The orchestrator decides WHAT;
// the skills decide HOW (their bodies are not duplicated here).

import { canTransition, skillForState, stateForSkill } from './state.js';

// New-task / feature-intent signals: phrases that start a fresh planning pass.
const NEW_TASK_RE = /(?:\b(?:implement|implemente|build|create|add|make|write|fix|refactor|design|design the|develop|criar|adicionar|implementar|construir|corrigir|refatorar)\b)|(?:^|[\s,])(?:bug|feature|task|issue)(?:\b|[\s,])/i;
const FEATURE_NOUN_RE = /(?:implement|add|build|create|fix|refactor|write|support|authentication|auth|oauth|login|feature|api|endpoint|component|module|test|function|class|service|handler|route|schema|migration|integration|oAuth)/i;

// Explicit escape-hatch: `guarana:code`, `guarana:plan`, etc. force a step.
const FORCE_RE = /guarana[:_-]?(\w+)/i;

// Step-completion signals, keyed by the workflow state they advance.
const STEP_SIGNALS = {
  planning: { event: 'plan_complete', re: /(?:plan|spec|design|roadmap)\s*(?:is|done|ready|complete|complete)|\b(?:start|go|proceed|build it)\b|\b(?:ok|good|approved)\b/i },
  building: { event: 'run_start', re: /\b(?:start|run|begin|go|execute|dispatch)\b/i },
  coding: { event: 'code_complete', re: /\b(?:done|finished|implemented|complete|completed|code written|ready for review)\b/i },
  debugging: { event: 'debug_complete', re: /\b(?:fixed|patched|resolved|solved|works now|good now|debugged)\b/i },
  verifying: { event: 'verify_pass', re: /\b(?:passed|pass|green|success|works|all good|verified|done|accepted)\b/i },
};

const FAIL_SIGNALS = /\b(?:fail|failed|failing|broken|red|error|errors|not working|still broken)\b/i;

// Result of a previous tool call -> did it signal failure?
export function resultFailed(lastResult) {
  if (lastResult == null) return false;
  if (typeof lastResult === 'object') {
    // An explicit error field (any non-empty value) is a failure.
    if (lastResult.error != null && String(lastResult.error) !== '') return true;
    const text = lastResult.output || lastResult.result || '';
    return Boolean(text && /(?:error|failed|failure|exception|non-zero|exit code \d)/i.test(text));
  }
  return Boolean(lastResult && /(?:error|failed|failure|exception|non-zero|exit code \d)/i.test(String(lastResult)));
}

// The decision the orchestrator should act on.
// Returns { event, state, skill, note }.
//  - event: transition to apply (or null to stay put)
//  - state: resulting state
//  - skill: the guarana skill to load for that state
//  - note: human-readable rationale (for history / dashboard)
export function decide({ userText, workflow, lastResult }) {
  const from = workflow && workflow.state ? workflow.state : 'idle';
  const text = (userText || '').trim();

  // 1. Explicit escape hatch always wins.
  const force = text.match(FORCE_RE);
  if (force) {
    const state = stateForSkill(force[1]);
    if (state && canTransition('force', from)) {
      return {
        event: 'force',
        state,
        skill: skillForState(state),
        note: `explicit guarana:${force[1]}`,
      };
    }
  }

  // 2. Automatic verify-failure from the previous tool result.
  if (from === 'verifying' && resultFailed(lastResult)) {
    return {
      event: 'verify_fail',
      state: 'debugging',
      skill: 'debug',
      note: 'previous tool result indicated a failure during verification',
    };
  }

  // 3. Resume an active unfinished workflow (no re-plan) unless the user
  //    clearly starts a brand-new task.
  const active = from !== 'idle' && from !== 'completed';
  if (active) {
    const newTask = NEW_TASK_RE.test(text);
    if (newTask) {
      return {
        event: 'new_task',
        state: 'planning',
        skill: 'plan',
        note: 'new task detected while a workflow was active — re-plan',
      };
    }
    // Natural-language completion / failure signals for the current step.
    const step = STEP_SIGNALS[from];
    if (step && step.re.test(text)) {
      const event = step.event;
      if (canTransition(event, from)) {
        const to = event === 'verify_pass' ? 'completed' : skillForStateAfter(from, event);
        return {
          event,
          state: to,
          skill: to === 'completed' ? null : skillForState(to),
          note: `natural-language completion signal for ${from}`,
        };
      }
    }
    if (from === 'verifying' && FAIL_SIGNALS.test(text)) {
      return {
        event: 'verify_fail',
        state: 'debugging',
        skill: 'debug',
        note: 'user reported a verification failure',
      };
    }
    // Continuation: stay put, keep the current state's skill.
    return {
      event: null,
      state: from,
      skill: skillForState(from),
      note: `continue active ${from} workflow`,
    };
  }

  // 4. Idle/completed -> is this a new task?
  if (text && (NEW_TASK_RE.test(text) || FEATURE_NOUN_RE.test(text))) {
    return {
      event: 'new_task',
      state: 'planning',
      skill: 'plan',
      note: 'new task detected',
    };
  }

  // 5. Ambiguous / not a task. Stay idle, no skill.
  return {
    event: null,
    state: from,
    skill: skillForState(from),
    note: 'no actionable task — remain idle',
  };
}

// Map the target state for a non-force step-completion event. Reuse the
// transition table's semantics without importing internal structure.
function skillForStateAfter(from, event) {
  const nextState = {
    plan_complete: 'building',
    run_start: 'coding',
    code_complete: 'verifying',
    fix_start: 'coding',
    debug_complete: 'verifying',
  }[event];
  return nextState || skillForState(from);
}