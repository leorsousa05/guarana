# Automatic Orchestration (always-on loop)

Since 2026-08-31 Guarana runs an automatic engineering loop. You no longer need
to invoke a skill to start work.

## What changed

- **No manual entry.** A natural request like *"Implement OAuth authentication"*
  auto-enters the loop: `idle → planning → building → coding → verifying → completed`.
- **Skills are still the engine.** The orchestrator only decides *what* to run; the
  chosen skill's body (loaded via the `skill` tool) decides *how*. Skill bodies are
  not duplicated in the orchestrator and stay out of the always-on context
  (progressive disclosure).
- **Explicit commands still work.** `guarana:plan`, `guarana:code`, `guarana:verify`,
  … force that exact step from any state — an escape hatch that always wins.
- **Disk is the source of truth.** Workflow state lives at
  `.specs/state/workflow.json` and is resumed across turns/sessions.

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
2. `experimental.chat.system.transform` injects a small always-on block **plus the
   active skill's full SKILL.md body** (ponytail-style). The model follows the
   injected skill directly — no `skill` tool call needed.
3. The model advances deterministically with `workflow_tick(action)` (e.g.
   `code_complete`, `verify_pass`, `verify_fail`).
4. `tool.execute.after` provides the automatic verify-fail nudge.

## Host integration

Only `plugin/guarana-orchestrator.js` touches opencode hooks
(`chat.message`, `experimental.chat.system.transform`, `tool.execute.after`, plus
the `workflow_get` / `workflow_tick` tools). All state-machine and decision logic
lives in the reusable, host-independent `orchestrator/` core.

## Dashboard

The Workflow panel shows the live state strip, current skill/task/goal, and
transition history, served by `GET /api/workflow/current`.