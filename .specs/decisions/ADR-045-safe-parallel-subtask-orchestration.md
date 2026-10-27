# ADR-045 — Safe parallel subtask orchestration

**Status:** Accepted (2026-10-26) · implementation pending · append-only

## Context

Guarana already dispatches workers through OpenCode's native Task tool, with
primary-owned workflow transitions. The accepted feature expands that model to
parallel read-only research and isolated code subtasks within one primary
workflow. Repository inspection found no Task directory-routing or cancellation
API contract; implementation must establish path-access and cancellation
behavior and fail closed where the host does not provide the required behavior.

## Decision

1. Keep native OpenCode Task dispatch. The primary owns decomposition, DAG
   fan-out/fan-in, workflow transitions, serial integration, and final
   verification gating. Model subtasks as a DAG with stable IDs, a goal and
   condition per task, read-only/code mode, dependencies, and owned paths.
   Schedule only ready independent tasks, with an initial concurrency limit of
   two. This feature has one primary workflow; multiple top-level workflows are
   out of scope. Workers do not dispatch nested Tasks or call `workflow_tick`.
2. Add a dedicated read-only research worker rather than repurposing
   `worker-verify`. Research workers cannot edit files, run shell commands,
   dispatch Tasks, or mutate workflow state.
3. Give every code worker its own Git worktree, based on a recorded base commit,
   and pass its explicit worktree path. If Task access to that path or preflight
   fails, do not dispatch code work in the shared checkout. Worktrees mitigate
   accidental file/index conflicts; they are not an OS sandbox or a malicious-
   worker security boundary.
4. Preserve the existing `.specs/state/workflow.json` v1 shape. Persist
   parallel-run/subtask state in a separate versioned sidecar, writable only by
   the primary, using locking and atomic replacement. Persist only bounded
   status/evidence; do not persist worker prompts or raw output.
5. A failed task blocks its dependents while independent tasks may complete.
   Retries require explicit primary review and are never automatic for uncertain
   dispatched work. A dispatched task without a confirmed result after restart
   requires reconciliation, not blind replay. Cancellation stops queued work;
   when the Task host cannot terminate in-flight work, record cancellation as
   requested and wait/reconcile rather than claiming a terminal state.
6. Integrate code-worker changes serially under primary ownership and surface
   conflicts. Start final independent verification only after all required
   subtasks are complete and code changes are integrated.
7. Use deterministic unit/integration fixtures. Do not add or run
   provider-backed or OpenCode-host smoke gates; ADR-036 prohibits them.

## Alternatives considered

- Plugin/private session spawning instead of primary native Task dispatch —
  rejected; retain the existing native Task mechanism and primary ownership.
- Extending `workflow.json` with parallel-run state — rejected; use a separate
  versioned sidecar to preserve the v1 shape.
- Running code subtasks in the shared checkout — rejected; each code worker gets
  an assigned worktree, with fail-closed behavior if its path cannot be used.
- Repurposing `worker-verify` for read-only research — rejected; create a
  separate research role and preserve the verifier role.
- Unbounded concurrency or multiple top-level workflows — not selected; the
  accepted scope uses an initial concurrency limit of two within one primary
  workflow.

## Consequences

The implementation must establish the actual Task path-access and cancellation
behavior before relying on it; no such host contract is claimed here. Unsupported
or failed worktree access fails closed, and cancellation that cannot terminate
in-flight work remains requested pending reconciliation. Worktree separation
reduces accidental file/index conflicts but does not create a security sandbox.
Implementation and deterministic proof remain pending in the [parallel subtask
orchestration feature spec](../features/orchestrator/parallel-subtask-orchestration.md).

## Implementation validation addendum — 2026-10-26

The implementation is now VALIDATED, not SHIPPED. Fresh independent `worker-verify` returned PASS for all eight acceptance criteria. The assigned native Task code worker accessed its explicit worktree path and read `orchestrator/prompt.js`; this proves path access for that assignment only, not an OS sandbox or general host-routing guarantee. Task-host cancellation remains unavailable/unverified and is request/reconcile-only. `.lock.coord` contention fails closed, with no automatic recovery for a marker left by process death; blind deletion is forbidden. The verifier lacked a historical source fingerprint for comparison; the primary confirmed no source edits occurred after the preceding PASS, only reads and a workflow transition. No commit, push, release, tag, or npm publication occurred. Detailed proof is in the [2026-10-26 change record](../changes/2026-10-26-parallel-subtask-orchestration.md).
