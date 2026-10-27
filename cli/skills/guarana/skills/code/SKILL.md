---
name: guarana:code
description: Use when implementing, editing, or writing code as a dispatched worker. Requires reading relevant code, fitting the existing design, using patterns only for concrete needs, focused refactoring, minimal diffs, one verifiable condition per dispatch, and a diff + stop-reason return contract.
---

# guarana:code

The implementation procedure loaded into the separate OpenCode Task subagent
`worker-code`. The primary context delegates; this worker never approves its own
work (ADR-003).

## Intake
From guarana:plan's dispatch: ONE verifiable condition, budget (default 8k tokens), state pointers. If the condition is missing or unfalsifiable, return `stop_reason: error` — do not start.

## Procedure
### Assigned code-worktree preflight (before any edits)

For a DAG code dispatch, the primary supplies exact `worktreePath`, `baseCommit`,
and `commonDir` values. Using that path as the repository root (safely quoted as a
path, never treated as shell code), check all of the following before any edit:

- `git -C <worktreePath> rev-parse --path-format=absolute --show-toplevel`
  equals the assigned `worktreePath` exactly;
- `git -C <worktreePath> rev-parse --path-format=absolute --git-common-dir`
  equals the assigned `commonDir` exactly;
- `git -C <worktreePath> rev-parse HEAD` equals the assigned `baseCommit`;
- `git -C <worktreePath> status --porcelain --untracked-files=all` is empty.

If a command fails, a value differs, the path is not the exact worktree root, or
the checkout is dirty, stop before editing and return `stop_reason: error` with
the mismatch. Do not clean, repair, switch checkouts, or fall back to the primary
tree. If no assigned code-worktree path is present, this gate does not apply.
Prompt-routed worktree paths are **not an OS sandbox**: keep all filesystem, Git,
and test operations in the assigned worktree, change only declared `ownedPaths`,
and never edit a sibling task's worktree.

1. **Read before edit.** Never edit a file you haven't read in this context.
2. **Read the design.** Inspect the relevant neighboring code, interfaces, tests, and project conventions. Identify the responsibilities and dependencies touched by the condition; follow established patterns when they fit.
3. **Choose patterns by purpose.** Use a design pattern only when it addresses a concrete need in the change, such as a real behavior variation, responsibility boundary, or dependency. Refactor only as needed to implement the condition clearly and safely. Prefer the simplest design that fits; if no pattern solves a real problem, add none. Keep unrelated behavior and structure intact.
4. **Smallest change.** Make the minimal diff satisfying the condition — because review and revert cost scale with diff size, and unrelated edits destroy both. Include only refactoring that directly supports this condition.
5. **Self-check, not self-approve.** Check the diff against the condition, relevant conventions, and affected edge cases. Run the smallest ordinary checks mapped to changed acceptance criteria first; use broader tests only when required by acceptance or change impact. Do not run smoke tests. Pass here means "ready for worker-verify", never "done".
6. **Return the contract:**
    - diff (or exact file list)
    - the verifiable condition addressed
    - stop reason: `condition-met` | `budget-exhausted` | `error`
    - consequential design or refactoring choices, with the problem each addresses; omit this item when no such choice was needed

## Gotchas
- Never widen scope. Out-of-scope observations go in the return as notes, not edits.
- A familiar pattern is not, by itself, a reason to introduce it; justify structural complexity by the concrete requirement it serves.
- Blocked? Return `stop_reason: error` with the blocker. Never silently work around it.
- Never commit/push without explicit human instruction.
- Condition unsatisfiable within budget → return partial diff marked PARTIAL with `stop_reason: budget-exhausted`.
