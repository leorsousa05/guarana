// guarana orchestrator — intent classification and skill selection.
// Pure, host-independent. Decides which guarana skill should fire and which
// state transition (if any) applies, given the user's request, the current
// workflow state, and the previous tool result. The orchestrator decides WHAT;
// the skills decide HOW (their bodies are not duplicated here).

import { canTransition, skillForState, stateForSkill } from './state.js';

// Start/re-plan only for requested changes. Topic nouns and investigative,
// review, or problem-report language alone are not mutation intent.
const MUTATION_ACTION = String.raw`(?:implement|implemente|build|create|crie|add|make|fix|refactor|design|develop|update|modify|change|remove|delete|improve|document|edit|enable|disable|configure|criar|adicionar|adicione|implementar|construir|construa|corrigir|corrija|refatorar|refatore|atualizar|atualize|alterar|altere|modificar|modifique|remover|remova|excluir|exclua|apagar|apague|melhorar|melhore|documentar|documente|editar|edite|habilitar|habilite|desabilitar|desabilite|configurar|configure|faça|desenvolva|escreva|write\s+(?:(?:the|a|an)\s+)?(?:code|file|docs?|document(?:ation)?|readme|changelog|config(?:uration)?|adr|spec(?:ification)?s?|tests?))`;
const NEW_TASK_RE = new RegExp(`\\b${MUTATION_ACTION}\\b`, 'i');
const DIRECT_MUTATION_RE = new RegExp(`^\\s*(?:(?:please|kindly)\\s+)?(${MUTATION_ACTION})\\b`, 'i');
const POLITE_MUTATION_RE = new RegExp(`^\\s*(?:can|could|would)\\s+you\\s+(?:please\\s+)?(${MUTATION_ACTION})\\b`, 'i');
const POLITE_MUTATION_TARGET_RE = /^(?!(?:me|us|about|on|for|with|from|by|in|at|into|onto|over|under|whether|if|what|why|how|when|where|who|which)\b)(?:(?:the|a|an|this|that|these|those|my|our|your|their|its)\s+)?[\w./-]+\b/i;
const COMPOUND_MUTATION_RE = new RegExp(`\\b(?:and|then|also)\\s+(?:please\\s+)?(${MUTATION_ACTION})\\b`, 'i');
const READ_ONLY_PREFIX_RE = /^\s*(?:what|why|when|where|who|how|explain|describe|summari[sz]e|review|audit|inspect|investigate|report|analy[sz]e|check|tell me|show me|should|could|would|can|do|does|is|are|o\s+que|como|quando|onde|quem|qual|quais|explique|explica|descreva|descreve|resuma|revise|audite|inspecione|investigue|relate|analise|verifique|confira|me\s+(?:explique|explica|diga|conte|informe|mostre|descreva|ajude\s+a\s+entender|ajuda\s+a\s+entender)|(?:(?:voce|você)\s+)?(?:pode|poderia|consegue)\s+(?:me\s+)?(?:explicar|dizer|contar|informar|mostrar|descrever|detalhar|ajudar\s+a\s+entender)|(?:quero\s+saber|gostaria\s+de\s+saber)|devo|deveria|devemos)\b|^\s*por\s+qu[eê](?=\W|$)/i;

function hasMutationTarget(action, remainder) {
  if (/^write\b/i.test(action)) return true;
  const target = remainder.trimStart().replace(/^to\s+/i, '');
  return POLITE_MUTATION_TARGET_RE.test(target);
}

function hasMutationIntent(text) {
  if (!NEW_TASK_RE.test(text)) return false;
  const compoundMutation = text.match(COMPOUND_MUTATION_RE);
  if (compoundMutation) {
    if (!/^update$/i.test(compoundMutation[1])) return true;
    return hasMutationTarget(compoundMutation[1], text.slice(compoundMutation.index + compoundMutation[0].length));
  }
  const directMutation = text.match(DIRECT_MUTATION_RE);
  if (directMutation) {
    if (!/^update$/i.test(directMutation[1])) return true;
    return hasMutationTarget(directMutation[1], text.slice(directMutation[0].length));
  }
  const politeMutation = text.match(POLITE_MUTATION_RE);
  if (politeMutation) {
    return hasMutationTarget(politeMutation[1], text.slice(politeMutation[0].length));
  }
  const update = text.match(/\bupdate\b/i);
  if (update) {
    if (READ_ONLY_PREFIX_RE.test(text)) return false;
    // Also qualify noun-form requests such as "I need an update to the config";
    // a follow-up clause like "an update on task status" is informational.
    return hasMutationTarget(update[0], text.slice(update.index + update[0].length));
  }
  return !READ_ONLY_PREFIX_RE.test(text);
}

// Explicit escape-hatch: `guarana:code`, `guarana:plan`, etc. force a step.
const FORCE_RE = /^\s*\/?guarana[:_-]?(\w+)(?=\s|$)/i;

// Step-completion signals, keyed by the workflow state they advance.
const STEP_SIGNALS = {
  planning: { event: 'plan_complete', re: /(?:plan|spec|design|roadmap)\s*(?:is|done|ready|complete|complete)|\b(?:start|go|proceed|build it)\b|\b(?:ok|good|approved)\b/i },
  building: { event: 'run_start', re: /\b(?:start|run|begin|go|execute|dispatch)\b/i },
  coding: { event: 'code_complete', re: /\b(?:done|finished|implemented|complete|completed|code written|ready for review)\b/i },
  debugging: { event: 'debug_complete', re: /\b(?:fixed|patched|resolved|solved|works now|good now|debugged)\b/i },
  verifying: { event: 'verify_pass', re: /\b(?:passed|pass|green|success|works|all good|verified|done|accepted)\b/i },
};

const FAIL_SIGNALS = /\b(?:fail|failed|failing|broken|red|error|errors|not working|still broken)\b/i;
const FAILURE_OUTPUT_RE = /(?:^|\n)\s*(?:(?:\w*error)\b|fatal\b|exception\b|failed\b|failure\b|not ok\b|fail(?:ed|ure)?\b|npm err!\b|command failed\b|process exited with code [1-9]\b)|["']error["']\s*:/i;

function outputFailed(value) {
  return typeof value === 'string' && FAILURE_OUTPUT_RE.test(value);
}

// Result of a previous tool call -> did it signal failure?
export function resultFailed(lastResult) {
  if (lastResult == null) return false;
  if (typeof lastResult === 'object') {
    // An explicit error field (any non-empty value) is a failure.
    if (lastResult.error != null && String(lastResult.error) !== '') return true;
    const text = lastResult.output || lastResult.result || '';
    return outputFailed(text);
  }
  return outputFailed(String(lastResult));
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
        ...(text.slice(force[0].length).trim() ? { goal: text.slice(force[0].length).trim() } : {}),
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
    const newTask = hasMutationIntent(text);
    if (newTask) {
      return {
        event: 'new_task',
        state: 'planning',
        skill: 'plan',
        goal: text,
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

  // 4. Idle/completed -> is this an explicit mutation request?
  if (text && hasMutationIntent(text)) {
    return {
      event: 'new_task',
      state: 'planning',
      skill: 'plan',
      goal: text,
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
