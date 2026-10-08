---
name: guarana:build
description: Use when starting or executing a run, managing run lifecycle (Frame/Run/Verify/Record), run budgets, trigger types, or stop conditions. The inner + outer cycle as one procedure with mandatory stop-reason logging.
---

# guarana:build

The run skill. Four stages, always in order: **Frame → Run → Verify → Record**. Record is NEVER skipped — not on abort, not on error, not on cap.

## 0. Trigger classification (outer-loop entry)
- **Heartbeat** — run once per turn/invocation.
- **Cron / budget** — run on a schedule or when a budget threshold is reached.
- **Goal-driven** — run until a verifiable condition holds (checked by machinery, never by feel).

## 1. Frame
Restore state (guarana:remember order). Set: goal, the verifiable condition, the per-run budget (default 32k tokens / 15 min, ADR-005), trigger type.

## 2. Run (inner loop)
After `run_start` enters `coding`, call OpenCode's native **Task** tool with
`worker-code` as the subagent. Pass one verifiable condition, the 8k-token
worker budget, and the relevant state/spec pointers. Wait for its diff + stop
reason before advancing `code_complete`; the primary context does not implement
the delegated change. Each worker iteration: Perceive → Think → Act → Observe.
Iterations never decide stopping — the guards do (guarana:verify).

## 3. Verify
Call native Task with `worker-verify` in a SEPARATE context from worker-code,
always. Pass the condition, spec, diff, and proof pointers plus the 4k-token
verification budget. Wait for its criterion-level verdict and proof paths before
advancing `verify_pass`/`verify_fail`; the primary context does not verify its
own work. PASS → proceed to Record. FAIL → route to `worker-debug` only when the
failure is actionable; otherwise Record with `stop_reason: error` and stop.
On misbehavior, route to `worker-debug` through a separate Task context.

## 4. Record (mandatory)
Append to state: outcome, proofs touched, and exactly one stop reason:
- `condition-met` · `hard-cap` · `budget-exhausted` · `error` · `human-abort`

A run without a logged stop reason is a process violation — health cannot be diagnosed without it (hard truth 4).

The primary context owns `workflow_tick` transitions. Worker subagents return
their contract and never advance the parent's workflow. If native Task is
unavailable or denied, record the blocker and stop; same-context execution does
not satisfy the worker contract.

## Hard rules
- Hard cap hit mid-Run → stop immediately, Record `hard-cap`. Never silently continue.
- If a result can't fail the Verify gate, the run can't tell success from failure — fix the condition before running (hard truth 5).
