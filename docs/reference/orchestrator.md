# Automatic Orchestration (always-on loop)

Since 2026-08-31 Guarana runs an automatic engineering loop. You no longer need
to invoke a skill to start work. Clear product/document/configuration changes
enter the loop automatically; informational and read-only questions remain idle
and do not create task-specific `.specs` records or tracker/project-state writes.
Explicit `guarana:<skill>` commands remain an escape hatch. Relevant confirmed
memory is supplied to the active skill.

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
- **Specs are scoped to work.** Missing `.specs/` scaffolding is bootstrapped for
  clear mutation requests and explicit workflow-skill commands, not for
  informational/read-only requests. `worker-specs` is dispatched only when a
  durable human-readable record will change; transient stage, budget, and
  current-step details remain in operational state. Validation follows an actual
  record write.
- **Memory is automatic.** Confirmed memory is retrieved on task start/resume;
  actual build runs retain stop-reason recording.

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

### Closing planning

After `guarana:plan` discovery is closed and any required `worker-specs` record
write is reported complete, call `workflow_tick(start_task)` once with explicit,
nonempty `goal` and `condition`. This does not bypass discovery or required
spec-record work. The action finishes in `coding` and preserves the three normal
history entries in order: `new_task`, `plan_complete`, then `run_start`. If
planning is still open, remain in `planning`; individual events, including
`plan_complete` and `run_start`, remain available for an intentionally staged
transition.

## How the loop runs

1. `chat.message` → restore persisted workflow → `decide` → apply transition → persist.
2. `experimental.chat.system.transform` injects the small always-on block,
   relevant confirmed memory, and the active primary-context skill body. Worker
   procedure bodies are loaded into their generated Task agent profiles instead.
3. The primary model dispatches `worker-code`, `worker-verify` in an independent
   context, or failure-only actionable `worker-debug` with the condition, budget,
   and state pointers. `worker-specs` receives only durable record changes.
4. The primary advances deterministically with `workflow_tick(action)` (e.g.
   `code_complete`, `verify_pass`, `verify_fail`); child workers never advance the
   parent's workflow.
5. `tool.execute.after` provides the automatic verify-fail nudge. ADRs are limited
   to durable architecture/contract/data/security/privacy/integration decisions
   with material alternatives; known issues require confirmed reproducible product
   failures and durable mitigations, not tool/verifier scope or transient
   permission/environment failures.

## Host integration

Only `plugin/guarana-orchestrator.js` touches opencode hooks
(`chat.message`, `experimental.chat.system.transform`, `tool.execute.after`, plus
the `workflow_get` / `workflow_tick` tools). All state-machine and decision logic
lives in the reusable, host-independent `orchestrator/` core.

## Dashboard

The Workflow panel shows the live state strip, current skill/task/goal, and
transition history, served by `GET /api/workflow/current`.
