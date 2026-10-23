# ADR-037 — Atomic workflow task kickoff

**Status:** Accepted (2026-10-22) · append-only

## Context

Starting an approved task currently exposes the normal `new_task`,
`plan_complete`, and `run_start` transitions as separate workflow actions. The
accepted workflow tool/API contract reduces visible kickoff calls while
preserving the planning stage, state safety, and transition history.

## Decision

1. Add one public `workflow_tick` action named `start_task`. After discovery is
   closed and any required worker-specs record is reported, this action applies
   the existing `new_task -> planning -> plan_complete -> building -> run_start
   -> coding` sequence atomically and persists the three normal history events
   in order.
2. Require an explicit nonempty goal and verifiable condition. Reject missing
   requirements or an illegal state without partial persistence. A successful
   kickoff ends in `coding` with the supplied goal and condition preserved.
3. Keep the individual actions available for genuinely open planning and other
   stage transitions. Do not skip planning in the prompt, collapse or erase
   history, or change mandatory native Task isolation or task-worker call
   denials.
4. Reflect all three transitions in plugin bootstrap, telemetry, and system
   injection; keep canonical sources and `cli/` mirrors synchronized.

## Alternatives considered

- Keep the three existing public kickoff calls — rejected because the accepted
  goal is to reduce visible workflow kickoff calls after discovery is complete.
- Replace the sequence with one opaque transition and omit its intermediate
  history — rejected because it would erase the three normal transition-history
  entries and weaken auditability.
- Start directly in coding without preserving planning in the prompt — rejected
  because planning remains a required workflow stage.

## Consequences

- A valid `start_task` call is one public operation with an atomic final state
  and the same three ordered history events as the individual transitions.
- Invalid input or illegal state leaves persisted workflow state and history
  unchanged; existing individual transition actions remain compatible.
- The focused implementation and test gates are recorded in
  [the blocker-recovery and atomic-kickoff feature](../features/orchestrator/blocker-recovery-and-atomic-kickoff.md).
- ADR-036 remains in force: smoke tests are prohibited. This decision does not
  authorize a package version change, commit, push, tag, or npm publication.
