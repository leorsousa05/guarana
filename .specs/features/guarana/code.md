# Feature / guarana:code

## Summary
Implementation work is where agents improvise most and prove least. `guarana:code` is the implementation skill: disciplined tool calls, minimal diffs, worktree isolation, and a mandatory diff + stop-reason return contract.

## Reference links
- Depends on: [plan.md](plan.md) (dispatch), [build.md](build.md) (Run stage host).
- Verified by: [verify.md](verify.md) (structurally separate — ADR-003).
- Knowledge: [docs/reference/reAct.md](../../../docs/reference/reAct.md), [docs/reference/memory.md](../../../docs/reference/memory.md)

## What it is / what it fills
**Problem:** code workers wander: they edit beyond the spec, skip reading existing code, and return summaries with no inspectable artifact.
**In scope:** read-before-edit discipline; minimal-diff rule; one verifiable condition per dispatch; return contract = diff + stop reason; worktree/scratch isolation for risky edits.
**Out of scope:** deciding pass/fail (never — ADR-003); committing or pushing (only on explicit human instruction).

## Acceptance criteria
1. **Return contract.** The body requires every worker-code return to contain (a) the diff or file list, (b) the verifiable condition addressed, (c) a stop reason. Proof: body inspection finds all three fields in the return template. Demo I/O: a dispatch returns exactly those three fields.
2. **Minimal-diff rule stated with a reason.** The body mandates the smallest change satisfying the condition and explains why (reviewability + revert cost). Proof: body inspection finds the rule and its rationale. Demo I/O: a spec asking for one function does not produce edits to unrelated files.
3. **Read-before-edit.** The body forbids editing a file that hasn't been read in the current context. Proof: body inspection finds the prohibition. Demo I/O: worker reads target file before first edit in its transcript.

## Demo criteria
Runbook: dispatch worker-code on a one-condition task; accept when the transcript shows read-before-edit, the diff touches only in-scope files, and the return matches the contract.

## SKILL.md overview
Frontmatter: `name: guarana:code`; description triggering on implementing, editing, writing code, applying diffs; references the knowledge files above. Body: intake (condition + budget from plan) → read targets → smallest change → self-check against condition (not approval) → return diff + stop reason. Gotchas: never self-approve; never widen scope; surface blockers as `stop_reason: error` instead of working around them silently.

## Edge cases & constraints
- Condition unsatisfiable within budget → stop, return `stop_reason: budget-exhausted` with partial diff marked partial.
- Budget: 8k tokens per dispatch (ADR-005); body ≤ 150 lines.

## References
- External: Yao et al., ReAct (arXiv:2210.03629).
- Internal: `guarana:plan`, `guarana:build`, `guarana:verify`.

## Definition of done
All three acceptance criteria proven in proofs/code-proofs.md, worker-verify PASS, change recorded.
