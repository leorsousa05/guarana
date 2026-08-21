---
name: guarana:debug
description: OPTIONAL — use ONLY when a test fails or a run misbehaves (runaway iterations, oscillation, context loss, repeated failing actions, unbounded retries). Classifies against the failure-mode matrix and defuses. Never load on green runs.
---

# guarana:debug

Trigger-only skill. If nothing failed, you should not be here.

## Failure-mode matrix
| Mode | Symptom | Detection signal | Defusal |
|---|---|---|---|
| Runaway | Iterations grow, no convergence | Iteration/token count approaching hard cap with condition unmet | Enforce hard cap; Record `hard-cap`; re-Frame with a sharper verifiable condition |
| Oscillation | State flips between A and B across steps | Same edit applied then reverted (diff ping-pong) | Freeze the oscillating decision; write both options + a decision criterion to disk; escalate to human if no criterion exists |
| Context loss | Agent contradicts its own earlier decisions | Checkpoint mismatch on restore (guarana:remember) | Stop; restore from disk; resume from checkpoint, never from recall |
| Unbounded transient retry | Same call retried on flaky errors | N retries of identical call with identical error | Cap retries (default 2); then `stop_reason: error` + known-issues entry |
| Loop-as-terrier | Re-applying an action that already failed | Same failing patch/command ≥ 2 times with same failure | Forbid the identical action; require a changed hypothesis before retry; if none exists, stop |

## Procedure
1. Classify the symptom against the matrix; confirm with the detection signal (not vibes).
2. Apply that mode's defusal — and only that defusal.
3. Return: root cause + fix.
4. Append to `.specs/state/known-issues.md`: title, symptom, reproduction trigger, effective/possible mitigation, status.

## Gotchas
- Symptom matches no mode → record with `status: unclassified` and escalate to the human. Do not silently invent a sixth mode.
- Fixing the code is worker-code's job; you return root cause + fix, you don't implement it.
