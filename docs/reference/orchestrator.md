# Automatic Orchestration (always-on loop)

Since 2026-08-31 Guarana runs an automatic engineering loop. You no longer need
to invoke a skill to start work. On a new task it also bootstraps missing
`.specs/` files and the project memory vault, then supplies relevant confirmed
memory to the active skill.

## What changed

- **No manual entry.** A natural request like *"Implement OAuth authentication"*
  auto-enters the loop: `idle → planning → building → coding → verifying → completed`.
- **Skills are still the engine.** The plugin decides *what* to run and injects
  primary-context skills for planning/building. For code, verification, and
  failure diagnosis, the model calls OpenCode's native Task tool; installed
  worker profiles carry the canonical skill procedure into separate contexts.
- **Explicit commands still work.** `guarana:plan`, `guarana:code`, `guarana:verify`,
  … force that exact step from any state — an escape hatch that always wins.
- **Disk is the source of truth.** Workflow state lives at
  `.specs/state/workflow.json` and is resumed across turns/sessions.
- **Specs and memory are automatic.** Missing `.specs/` scaffolding and a
  task-specific feature spec are created idempotently; confirmed memory is
  retrieved on task start/resume and completed runs are recorded.

## State machine

States: `idle → planning → building → coding → verifying → debugging → completed`.

| Event | From | To | Meaning |
|---|---|---|---|
| `new_task` | any active / idle / completed | planning | start or re-plan |
| `plan_complete` | planning | building | plan accepted |
| `run_start` | building | coding | run begins |
| `code_complete` | coding | verifying | code ready |
| `verify_pass` | verifying | completed | accepted |
| `verify_fail` | verifying | debugging | reject |
| `fix_start` | debugging | coding | correct then re-verify |
| `debug_complete` | debugging | verifying | re-verify after fix |
| `abort` | any | idle | stop |
| `force` | any | skill-mapped | explicit `guarana:<skill>` |

Failure auto-routes: a `verify_fail` (via `workflow_tick(verify_fail)` or an
errored tool result while in `verifying`) moves to `debugging`; a fix goes back to
`coding`, then `verifying`, and a pass reaches `completed`. Illegal transitions are
rejected — the machine cannot wedge.

## How the loop runs

1. `chat.message` → restore persisted workflow → `decide` → apply transition → persist.
2. `experimental.chat.system.transform` injects the small always-on block,
   relevant confirmed memory, and the active primary-context skill body. Worker
   procedure bodies are loaded into their generated Task agent profiles instead.
3. The primary model dispatches `worker-code`, `worker-verify`, or failure-only
   `worker-debug` with the condition, budget, and state pointers, then waits for
   the worker contract.
4. The primary advances deterministically with `workflow_tick(action)` (e.g.
   `code_complete`, `verify_pass`, `verify_fail`); child workers never advance the
   parent's workflow.
5. `tool.execute.after` provides the automatic verify-fail nudge.

## Host integration

Only `plugin/guarana-orchestrator.js` touches opencode hooks
(`chat.message`, `experimental.chat.system.transform`, `tool.execute.after`, plus
the `workflow_get` / `workflow_tick` tools). All state-machine and decision logic
lives in the reusable, host-independent `orchestrator/` core.

## Dashboard

The Workflow panel shows the live state strip, current skill/task/goal, and
transition history, served by `GET /api/workflow/current`.
