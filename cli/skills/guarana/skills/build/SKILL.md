---
name: guarana:build
description: Use when starting or executing a run, managing run lifecycle (Frame/Run/Verify/Record), run budgets, trigger types, or stop conditions. The inner + outer cycle as one procedure with mandatory stop-reason logging.
---

# guarana:build

The run skill. Four stages, always in order: **Frame → Run → Verify → Record**. Record is NEVER skipped — not on abort, not on error, not on cap.

## User-facing progress
In the primary chat, after every meaningful completed phase or subtask—including
planning, each `worker-code` result, and verification—send a concise update with
what completed, changed paths/behavior, the next action, and what remains or is
blocked. A completed phase is not a completed task; planning completion is not
task completion. After verification/final gates, the final update includes exact
changed paths and checks/results.

## 0. Trigger classification (outer-loop entry)
- **Heartbeat** — run once per turn/invocation.
- **Cron / budget** — run on a schedule or when a budget threshold is reached.
- **Goal-driven** — run until a verifiable condition holds (checked by machinery, never by feel).

## 1. Frame
Restore state (guarana:remember order). Set: goal, the verifiable condition, the per-run budget (default 32k tokens / 15 min, ADR-005), trigger type.

## 2. Run (inner loop)
### Choose the sequential path by default

For ordinary implementation work with one verifiable condition, keep the existing
path: after `run_start` enters `coding`, call native **Task** with `worker-code`,
one exact condition, the 8k-token budget, and relevant state/spec pointers. For a
single bounded read-only research condition, use one `worker-research` Task instead.
Wait for its diff + stop reason before advancing `code_complete`; the primary
context does not implement the delegated change. Inspect its result and stop
reason. Do not create a DAG for a single condition or merely because the tools are
available. Each worker iteration: Perceive → Think → Act → Observe.
Iterations never decide stopping — the guards do (guarana:verify).

### Use the primary-owned DAG only for separable work

Use the parallel DAG when one coding workflow has at least two independently
verifiable subtasks, explicit dependencies, and non-overlapping owned paths. It can
combine bounded read-only research (`mode: read-only` → `worker-research`) and
isolated implementation (`mode: code` → `worker-code`). The primary remains the
only DAG owner and retains all acceptance decisions, workflow transitions, review,
and integration. DAG tools mutate the sidecar manifest but never spawn native Tasks.
Manifest records contain IDs, dependencies, modes, ownership, status, and bounded
evidence IDs—not prompts, goals, conditions, worker outputs, or raw prose.

#### Parallel sidecar lock errors

If the error identifies a held `.lock.coord` coordination marker, stop and escalate
to the primary/user with the exact path from the diagnostic. The marker blocks run
reads, writes, and recovery; automatic recovery is unsupported. Do not retry, inspect
or recover the `.lock` as stale, or delete/steal the coordination marker.

For other sidecar lock errors, inspect first with `parallel_run_lock_inspect` and
review the returned lock identity. Never manually delete or steal an active or
unproven lock. Call `parallel_run_lock_recover` only after explicit primary review,
passing the exact inspected token and only when the inspection confirms a same-host
dead owner.
If same-host ownership or dead-process liveness cannot be proven, fail closed:
leave the lock untouched and report the blocker. Do not retry around, bypass, or
claim recovery of an active, foreign-host, changed, or uncertain lock.

1. Immediately after `run_start`, call `parallel_run_create` once with each task's
   stable ID, `dependsOn`, `mode`, exact repo-relative `ownedPaths`, nonempty goal,
   and falsifiable condition. Use an empty ownership list for read-only research.
   Then use `parallel_run_get` for the authoritative manifest and ready batch.
2. Dispatch only IDs in the latest returned `ready` list: readiness means every
   dependency has completed (and any code dependency has been integrated). The
   ready batch is deterministic and capped at **2 active tasks total**. Start a
   task with `parallel_task_start` and pass its returned dispatch contract to one
   native Task: `worker-research` for read-only research or `worker-code` for code.
   Tools do not spawn Tasks. After each result, inspect its condition/evidence and
   stop reason, record `parallel_task_outcome`, refresh the manifest, and dispatch
   only newly ready work. Never dispatch a pending, blocked, or stale-ready task.
3. Before every code task starts, prepare a distinct separate Git worktree and call
   `parallel_task_preflight` with its exact normalized absolute root. It must be a
   real worktree distinct from the primary checkout, share the primary repository's
   Git common directory, start at the primary HEAD, and have empty
   `git status --porcelain --untracked-files=all`. Do not reuse a worktree across
   tasks or attempts. The start contract includes `worktreePath`, `baseCommit`,
   `commonDir`, and a `beforeEdits` check; pass them unchanged to the code worker.
   The child must independently validate them before editing. Prompt-routed paths
   are not an OS sandbox; keep all child edits inside its assigned worktree and
   owned paths.
4. Read-only research may complete with evidence. A successful code worker outcome
   is only `integration-pending`, never integrated. Review and integrate one code
   diff at a time; do not assume a Task result or worktree is auto-merged. Any
   non-zero apply/merge or any unmerged path is a hard stop: report the exact paths
   and command output to the primary/user, do not call `parallel_task_integrate`, and
   leave the task `integration-pending` so dependents and `code_complete` stay
   blocked. Call `parallel_task_integrate` with `primaryReviewed: true` only after
   conflict-free integration and all applicable checks pass.
5. A confirmed task failure blocks all descendants, but independent ready tasks
   may continue. Do not dispatch blocked descendants. Retry only a failed task after
   explicit primary review with `parallel_task_retry`; the run permits at most
   three attempts per task. A code retry requires a fresh worktree and a new
   preflight before its next start. Re-check ready work after retry and outcome.
6. On resume/restart, call `parallel_run_get` before dispatch. Persisted `running`
   tasks are uncertain, not failed: call `parallel_run_reconcile` with primary
   confirmation, inspect actual worker/task state, then resolve each
   `needs-reconciliation` task via `parallel_task_reconcile` with reviewed evidence
   and its observed outcome. Never blindly restart or retry uncertain work. Review
   persisted `integration-pending` code tasks in the primary before integration.
7. `parallel_run_cancel` is a cancellation request, not a host cancellation
   handle: queued work is cancelled, while running work remains
   `cancel-requested` and reserves capacity. Do not claim it stopped or reuse its
   slot until the host confirms termination with `parallel_task_confirm_termination`
   or the primary reconciles the actual outcome. Never fabricate termination.
8. Always cross `code_complete` after the manifest is `completed`: all read-only
   tasks completed and every code task was primary-integrated. Even when independent
   verification is disabled, do not use coding-state `verify_skip` to bypass this
   hard barrier; proceed to verifying state, then follow its `verify_skip` preference.
   This is not a substitute for outcome review or independent verification.

If evidence for one criterion is blocked, continue independent safe work that does
not depend on that evidence. Do not repeat an identical denied request. Ask only
for a material decision or actual privileged permission; do not replace a denied
native Task dispatch with same-context work or bypass tool permissions.

Select the smallest ordinary checks that map to the changed acceptance criteria.
Broader tests are justified only by the acceptance condition or change impact; no
smoke tests or elaborate/full E2E by default.

### Serial primary integration
Integrate one code-worker worktree diff at a time and review the actual diff before
applying it. On a non-zero apply/merge or any unmerged paths, stop; show the conflict
paths and command output to the primary/user, do not call `parallel_task_integrate`,
and leave the run/task `integration-pending` with dependents and final `code_complete`
blocked. Only after the primary resolves every conflict and the applicable checks
pass, call `parallel_task_integrate` for that diff.

## 3. Verify
Call native Task with `worker-verify` in a SEPARATE context from worker-code,
always. Pass the condition, spec, diff, and proof pointers plus the 4k-token
verification budget. Wait for its criterion-level verdict and proof paths before
advancing `verify_pass`/`verify_fail`; the primary context does not verify its
own work. PASS → proceed to Record. FAIL → route to `worker-debug` only when the
failure is actionable; otherwise Record with `stop_reason: error` and stop.
On misbehavior, route to `worker-debug` through a separate Task context.

## 4. Record (mandatory for an actual run)
For each actual build run, append to operational run state: outcome, proofs
touched, and exactly one stop reason:
- `condition-met` · `hard-cap` · `budget-exhausted` · `error` · `human-abort`

A build run without a logged stop reason is a process violation — health cannot be
diagnosed without it (hard truth 4). Informational/read-only requests that do not
start a run do not create stop-reason entries.

The primary context owns `workflow_tick` transitions. Worker subagents return
their contract and never advance the parent's workflow. If native Task is
unavailable or denied, record the blocker and stop; same-context execution does
not satisfy the worker contract.

## Hard rules
- Hard cap hit mid-Run → stop immediately, Record `hard-cap`. Never silently continue.
- If a result can't fail the Verify gate, the run can't tell success from failure — fix the condition before running (hard truth 5).
- Continue independent safe work around evidence blockers, but keep the hard caps,
  native Task isolation, actual permission denials, and honest stop reason intact.
