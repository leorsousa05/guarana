# Feature spec: Parallel subtask orchestration

**Status: VALIDATED**

## Goal
Implement safe parallel subtask orchestration for Guarana workers within one primary workflow, including parallel read-only and isolated code tasks.

## Requirements
- Implement the full feature, not an MVP: parallel read-only research and parallel code subtasks within one primary workflow; multiple top-level workflows are out of scope.
- Keep native OpenCode Task dispatch. The primary owns decomposition, fan-out/fan-in, workflow transitions, and integration. Workers never dispatch nested Tasks or call workflow_tick.
- Model subtasks as a DAG with stable IDs, a goal and condition per task, mode (read-only/code), dependencies, and owned paths. Schedule only ready independent tasks, with an initial concurrency limit of two.
- Add a dedicated genuinely read-only research worker/profile; do not repurpose worker-verify. Research workers must not edit, run shell commands, dispatch Tasks, or mutate workflow state.
- Every code worker must have its own Git worktree based on a recorded base commit and an explicit worktree path. If Task path access or preflight fails, fail closed and do not run code workers in the shared checkout. Worktrees mitigate accidental file/index conflicts; they are not an OS sandbox or malicious-worker security boundary.
- Keep the existing workflow.json v1 shape compatible. Persist parallel-run/subtask state in a separate versioned sidecar; the primary is its only writer. State writes require locking and atomic replacement; persist only bounded status/evidence, never worker prompts or raw output.
- A failed task blocks dependent subtasks while independent tasks may complete. Retries require explicit primary review and are never automatic for uncertain dispatched work. After restart, a dispatched task without a confirmed result requires reconciliation and must not be blindly replayed. Cancellation stops queued work; if the Task host cannot terminate in-flight work, mark cancellation requested and wait/reconcile rather than falsely marking terminal.
- Integrate code-worker changes serially under primary ownership, surface conflicts, and advance to final independent verification only after all required subtasks are complete and code changes are integrated.
- Use deterministic unit/integration fixtures. Do not add or run provider-backed or OpenCode-host smoke gates; ADR-036 prohibits them.
- The assigned Task worktree path was accessible for the recorded assignment; this is not a general host-routing guarantee or an OS sandbox. Native Task-host cancellation remains unavailable/unverified and is request/reconcile-only; do not claim host cancellation support. See ADR-045.

## Assumptions and scope
- One primary workflow with a DAG of parallel read-only research and isolated code subtasks; no multiple top-level workflows.
- Dedicated read-only research profile, native Task dispatch, primary-owned orchestration/integration, per-code-worker worktrees, and a separate versioned parallel-run sidecar while retaining workflow.json v1 compatibility.
- Worker budgets per dispatch: worker-code 8k tokens, worker-verify 4k tokens, worker-debug 6k tokens, and worker-research 4k tokens. Aggregate per-run cap: 32k tokens / 15 minutes per outer-loop rotation, per ADR-005.
- Deterministic unit/integration fixtures only; no provider-backed or OpenCode-host smoke gates, per ADR-036.
- Access to one exact assigned Task worktree was established; broader host-routing behavior remains unverified. Native cancellation remains unavailable/unverified and in-flight cancellation is request/reconcile-only.

## Acceptance criteria
1. Deterministic DAG fixtures assert stable task IDs, per-task goal and condition, mode, dependencies, and owned paths; scheduler fixtures start only ready independent tasks and enforce an initial concurrency limit of two within one primary workflow.
2. Task/profile fixtures show native Task dispatch and primary ownership of decomposition, fan-out/fan-in, workflow transitions, and integration; no worker dispatches a nested Task or calls workflow_tick. A distinct worker-research profile is read-only and cannot edit, run shell commands, dispatch Tasks, or mutate workflow state; worker-verify is not repurposed.
3. Worktree fixtures show each code Task receives its own explicit path and recorded base commit. Missing/inaccessible assigned paths or failed preflight prevent code dispatch in the shared checkout.
4. State fixtures preserve the existing workflow.json v1 shape and exercise separate versioned sidecar writes by the primary only, locking, atomic replacement, bounded status/evidence, and exclusion of worker prompts/raw output.
5. Lifecycle fixtures show a failed task blocks dependents while independent tasks can complete; retries occur only after explicit primary review; uncertain dispatched work is not retried automatically; and restart reconciliation is required for dispatched tasks without confirmed results.
6. Cancellation fixtures show queued tasks stop, and in-flight work that the Task host cannot terminate remains cancellation-requested until wait/reconciliation rather than being reported terminal.
7. Integration fixtures show code-worker changes are integrated serially by the primary, conflicts are surfaced, and final independent verification starts only after all required subtasks complete and code changes are integrated.
8. Before relying on Task directory-routing or cancellation behavior, implementation evidence establishes the actual behavior; absent or failed capability evidence produces fail-closed behavior. Deterministic unit/integration fixtures are used, with no provider-backed or OpenCode-host smoke gate.

## Validation and residual limitations

Fresh independent `worker-verify` returned PASS for all eight acceptance criteria. A native Task code worker accessed its exact assigned worktree path and read `orchestrator/prompt.js`; this establishes access for that assignment only, not a host-wide guarantee or OS sandbox. Task-host cancellation remains unavailable/unverified, so in-flight cancellation is request/reconcile-only. `.lock.coord` contention fails closed; a marker left by process death has no automatic recovery, its exact path is surfaced, and blind deletion is forbidden. The feature is VALIDATED, not SHIPPED; no commit, push, release, tag, or npm publication occurred. See the dated change record for proof details.

<!-- guarana:record:start -->
Status: VALIDATED
Proof: Fresh independent worker-verify overall PASS for criteria 1–8; npm test PASS 700/700; focused deterministic parallel/prompt/workflow/plugin/CLI suite PASS 198/198; npm run build and npm run check-cli PASS; pre-record node bin/guarana.js specs validate . --json PASS (249 files, 98 feature specs, 45 ADRs, 282 links, zero issues); git diff --check clean; deterministic conflict, multi-process lock, and assigned native Task worktree-path-access proofs; see dated change record.
Change: .specs/changes/2026-10-26-parallel-subtask-orchestration.md
<!-- guarana:record:end -->
