---
name: guarana:code
description: Use when implementing, editing, or writing code as a dispatched worker. Enforces read-before-edit, minimal diffs, one verifiable condition per dispatch, and a diff + stop-reason return contract.
---

# guarana:code

The implementation skill, loaded by worker-code. You never approve your own work (ADR-003).

## Intake
From guarana:plan's dispatch: ONE verifiable condition, budget (default 8k tokens), state pointers. If the condition is missing or unfalsifiable, return `stop_reason: error` — do not start.

## Procedure
1. **Read before edit.** Never edit a file you haven't read in this context.
2. **Smallest change.** Make the minimal diff satisfying the condition — because review and revert cost scale with diff size, and unrelated edits destroy both.
3. **Self-check, not self-approve.** Check the diff against the condition. Pass here means "ready for worker-verify", never "done".
4. **Return the contract:**
   - diff (or exact file list)
   - the verifiable condition addressed
   - stop reason: `condition-met` | `budget-exhausted` | `error`

## Gotchas
- Never widen scope. Out-of-scope observations go in the return as notes, not edits.
- Blocked? Return `stop_reason: error` with the blocker. Never silently work around it.
- Never commit/push without explicit human instruction.
- Condition unsatisfiable within budget → return partial diff marked PARTIAL with `stop_reason: budget-exhausted`.
