// guarana orchestrator plugin (Component C)
// Thin opencode adapter over the host-independent orchestrator core
// (orchestrator/state.js + decide.js + prompt.js). Decides which guarana skill
// should fire each turn, advances the persisted state machine, and injects a
// small always-on orchestration prompt (progressive disclosure: full skill
// bodies stay in the skill tool). Never throws. No external deps.
//
// Markers: '// guarana orchestrator plugin'.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const pluginDir = path.dirname(fileURLToPath(import.meta.url));

// Load the core engine from repo (plugin/ -> ../orchestrator) or bundle
// (cli/plugin/ -> ../orchestrator). Same relative path covers both; ../../orchestrator
// is a fallback for running the bundle in-repo.
async function loadCore() {
  const candidates = [
    path.join(pluginDir, '..', 'orchestrator'),
    path.join(pluginDir, '..', '..', 'orchestrator'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'state.js'))) {
      const [state, decide, prompt] = await Promise.all([
        import(pathToFileURL(path.join(dir, 'state.js')).href),
        import(pathToFileURL(path.join(dir, 'decide.js')).href),
        import(pathToFileURL(path.join(dir, 'prompt.js')).href),
      ]);
      return { state, decide, prompt };
    }
  }
  return null;
}

// Extract the user text from a chat.message event (parts carry text).
function userText(parts) {
  if (!Array.isArray(parts)) return '';
  return parts
    .map((p) => {
      if (p && typeof p.text === 'string') return p.text;
      if (p && typeof p.content === 'string') return p.content;
      return '';
    })
    .filter(Boolean)
    .join('\n');
}

// Minimal failure extraction from a tool result (string or object).
function resultText(output) {
  if (output == null) return '';
  if (typeof output === 'string') return output;
  if (typeof output === 'object') {
    if (output.error != null) return String(output.error);
    if (output.output != null) return resultText(output.output);
    if (output.result != null) return resultText(output.result);
    return '';
  }
  return '';
}

export const GuaranaOrchestrator = async ({ directory }) => {
  const telemetryDir = path.join(directory, '.specs', 'state', 'telemetry');
  const eventsFile = path.join(telemetryDir, 'events.jsonl');
  const project = path.basename(directory);

  const append = (obj) => {
    try {
      fs.mkdirSync(telemetryDir, { recursive: true });
      fs.appendFileSync(
        eventsFile,
        JSON.stringify({ project, ...obj }) + '\n',
        'utf8'
      );
    } catch (_) {
      /* swallow: telemetry must never throw */
    }
  };

  let corePromise = null;
  let coreFailed = false;
  const core = async () => {
    if (coreFailed) return null;
    if (!corePromise) {
      corePromise = loadCore().catch((err) => {
        coreFailed = true;
        append({ ts: Date.now(), type: 'orchestrator-error', error: String(err && err.message ? err.message : err) });
        return null;
      });
    }
    const c = await corePromise;
    if (!c && !coreFailed) {
      coreFailed = true;
      append({ ts: Date.now(), type: 'orchestrator-error', error: 'orchestrator core not found' });
    }
    return c;
  };

  // Latest workflow, recomputed on chat.message / workflow_tick, used to build
  // the injection on the next system transform.
  let latest = null;

  const syncDecision = async (userText, lastResult) => {
    const c = await core();
    if (!c) return;
    try {
      const wf = c.state.load(directory);
      const d = c.decide.decide({ userText, workflow: wf, lastResult });
      let next = wf;
      if (d.event) {
        const applied = c.state.apply(wf, d.event, {
          skill: d.skill,
          activeTask: d.goal && d.event === 'new_task' ? d.note : wf.activeTask,
          note: d.note,
        });
        if (applied) {
          next = applied;
          c.state.save(directory, next);
          append({
            ts: Date.now(),
            type: 'workflow',
            event: d.event,
            from: wf.state,
            to: next.state,
            skill: d.skill,
            note: d.note,
          });
        }
      }
      latest = next;
    } catch (err) {
      append({ ts: Date.now(), type: 'orchestrator-error', error: String(err && err.message ? err.message : err) });
    }
  };

  const readWorkflow = async () => {
    const c = await core();
    if (!c) return { state: 'idle' };
    return c.state.load(directory);
  };

  const runTool = (handler) => async (args) => {
    try {
      const c = await core();
      if (!c) return JSON.stringify({ error: 'orchestrator core not available' });
      return JSON.stringify(await handler(c, args || {}));
    } catch (err) {
      append({ ts: Date.now(), type: 'orchestrator-error', error: String(err && err.message ? err.message : err) });
      return JSON.stringify({ error: String(err && err.message ? err.message : err) });
    }
  };

  const workflowTools = {
    workflow_get: {
      description:
        'Read the current guarana workflow state (state machine: idle/planning/building/coding/verifying/debugging/completed), active task, goal, and recent history. Always available; use to confirm where the engineering loop is.',
      args: {},
      execute: runTool(async (c) => {
        const wf = c.state.load(directory);
        return {
          state: wf.state,
          skill: wf.skill,
          activeTask: wf.activeTask,
          goal: wf.goal,
          condition: wf.condition,
          updatedAt: wf.updatedAt,
          history: wf.history.slice(-10),
        };
      }),
    },
    workflow_tick: {
      description:
        'Advance the guarana workflow state machine. Actions: new_task (start/re-plan), plan_complete, run_start, code_complete, verify_pass, verify_fail, fix_start, debug_complete, abort, force (with skill). Call when a step completes so the loop continues automatically.',
      args: {
        action: {
          type: 'string',
          enum: [
            'new_task', 'plan_complete', 'run_start', 'code_complete',
            'verify_pass', 'verify_fail', 'fix_start', 'debug_complete',
            'abort', 'force',
          ],
          description: 'the transition to apply',
        },
        goal: { type: 'string', description: 'goal text (new_task / re-plan)' },
        condition: { type: 'string', description: 'verifiable condition for the task' },
        skill: { type: 'string', description: 'skill name when action=force' },
        note: { type: 'string', description: 'optional human note' },
      },
      execute: runTool(async (c, args) => {
        const action = args.action;
        if (!action || !c.state.isEvent(action)) {
          return { ok: false, error: `unknown action: ${action}`, state: c.state.load(directory).state };
        }
        const wf = c.state.load(directory);
        const applied = c.state.apply(wf, action, {
          skill: args.skill || undefined,
          goal: args.goal != null ? args.goal : wf.goal,
          condition: args.condition != null ? args.condition : wf.condition,
          activeTask: args.goal != null ? args.goal : wf.activeTask,
          note: args.note || '',
        });
        if (!applied) {
          return { ok: false, error: `illegal transition ${action} from ${wf.state}`, state: wf.state };
        }
        c.state.save(directory, applied);
        append({
          ts: Date.now(),
          type: 'workflow',
          event: action,
          from: wf.state,
          to: applied.state,
          skill: applied.skill,
          note: args.note || '',
        });
        return { ok: true, state: applied.state, skill: applied.skill, goal: applied.goal };
      }),
    },
  };

  return {
    tool: workflowTools,

    // Observe every user prompt: restore the persisted workflow, decide the
    // next skill/transition, persist, and stage the directive for injection.
    'chat.message': async (input, output) => {
      try {
        const text = userText(output && output.parts);
        await syncDecision(text, null);
      } catch (err) {
        append({ ts: Date.now(), type: 'orchestrator-error', error: String(err && err.message ? err.message : err) });
      }
    },

    // Inject the always-on orchestration prompt + the active skill's full body.
    'experimental.chat.system.transform': async (input, output) => {
      try {
        const c = await core();
        if (!c) return;
        const wf = latest ? latest : c.state.load(directory);
        const injection = c.prompt.buildInjection(wf);
        if (!Array.isArray(output.system)) output.system = [];
        if (output.system.length > 0) {
          output.system[output.system.length - 1] += '\n\n' + injection;
        } else {
          output.system.push(injection);
        }
      } catch (err) {
        append({ ts: Date.now(), type: 'orchestrator-error', error: String(err && err.message ? err.message : err) });
      }
    },

    // Observe tool results: an error during verification automatically moves
    // the workflow toward debugging/correction (requirement: verify fail -> debug).
    'tool.execute.after': async (input, output) => {
      try {
        const c = await core();
        if (!c) return;
        const wf = c.state.load(directory);
        if (wf.state !== 'verifying') return;
        const text = resultText(output && (output.output != null ? output.output : output));
        if (!text) return;
        if (c.decide.resultFailed(text)) {
          const applied = c.state.apply(wf, 'verify_fail', {
            skill: 'debug',
            note: 'tool result signaled failure during verification',
          });
          if (applied) {
            c.state.save(directory, applied);
            latest = applied;
            append({
              ts: Date.now(),
              type: 'workflow',
              event: 'verify_fail',
              from: 'verifying',
              to: 'debugging',
              skill: 'debug',
              note: 'auto: tool result failure',
            });
          }
        }
      } catch (err) {
        append({ ts: Date.now(), type: 'orchestrator-error', error: String(err && err.message ? err.message : err) });
      }
    },
  };
};

export default GuaranaOrchestrator;