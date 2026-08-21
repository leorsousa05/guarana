# Feature / guarana:build

## Summary
Agents run without a defined run lifecycle: no framing, no budget, no recorded stop. `guarana:build` is the run skill — the inner + outer cycle as one procedure with the four stages Frame/Run/Verify/Record.

## Reference links
- Depends on: [plan.md](plan.md) (routing), [verify.md](verify.md) (the Verify stage's gate).
- Knowledge: [docs/reference/reAct.md](../../../docs/reference/reAct.md), [docs/reference/outer-loop-triggers.md](../../../docs/reference/outer-loop-triggers.md)

## What it is / what it fills
**Problem:** runs start ad hoc, iterate until the context gives out, and end with no stop reason — health can't be diagnosed (hard truth 4).
**In scope:** the Frame/Run/Verify/Record procedure; trigger types (heartbeat / cron / goal-driven); run budgets (per-run hard cap from ADR-005); mandatory stop-reason logging.
**Out of scope:** the edit mechanics inside Run (`guarana:code`); the pass/fail judgment inside Verify (`guarana:verify`).

## Acceptance criteria
1. **Four stages, in order.** The body defines Frame → Run → Verify → Record as an ordered procedure and forbids skipping Record. Proof: body inspection finds the four stage headings in order plus an explicit "Record is never skipped" rule. Demo I/O: any run, including an aborted one, ends with a Record entry.
2. **Trigger taxonomy.** The body defines all three trigger types with distinct start conditions: heartbeat (each turn), cron/budget (schedule or threshold), goal-driven (until verifiable condition). Proof: checklist of the three definitions present. Demo I/O: input "run every 30 min until tests pass" → classified cron + goal-driven.
3. **Stop reason is mandatory and enumerated.** The body lists the allowed stop reasons (condition-met, hard-cap, budget-exhausted, error, human-abort) and requires logging one on every run. Proof: body inspection finds the enumeration and the mandate. Demo I/O: a run killed at the token cap records `stop_reason: hard-cap`.

## Demo criteria
Runbook: execute one goal-driven run to completion and one run forced into the hard cap; accept when both produce a Record entry with a stop reason from the enumeration and the stages occurred in order.

## SKILL.md overview
Frontmatter: `name: guarana:build`; description triggering on starting/executing any run, run lifecycle, budgets, stop conditions; references the two knowledge files above. Body: trigger classification → Frame (restore state, set goal + budget) → Run (dispatch worker-code within budget) → Verify (dispatch worker-verify) → Record (append stop reason + outcome to state). Validation loop: if Verify fails, either re-Frame within budget or Record `stop_reason: error` and stop.

## Edge cases & constraints
- Hard cap hit mid-Run → Record with `stop_reason: hard-cap`; never silently continue.
- Budget: per-run cap 32k tokens / 15 min (ADR-005); body ≤ 180 lines.

## References
- External: Yao et al., ReAct (arXiv:2210.03629); Shinn et al., "Reflexion" (arXiv:2303.11366) for the reflect-and-retry pattern inside re-Frame.
- Internal: `guarana:plan`, `guarana:verify`, `guarana:remember`.

## Definition of done
All three acceptance criteria proven in proofs/build-proofs.md, worker-verify PASS, change recorded.
