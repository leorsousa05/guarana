# Feature / guarana:code

## Summary
`guarana:code` directs a separate implementation worker to make a bounded, reviewable change that fits the existing project design. It requires evidence-based design and refactoring choices without mandating patterns where the simplest existing approach is sufficient.

## Status
Validated (2026-10-08).

## Reference links
- Depends on: [plan.md](plan.md) (dispatch), [build.md](build.md) (Run stage host).
- Verified by: [verify.md](verify.md) (structurally separate — ADR-003).
- Knowledge: [docs/reference/reAct.md](../../../docs/reference/reAct.md), [docs/reference/memory.md](../../../docs/reference/memory.md)

## What it is / what it fills
**Problem:** code workers can edit beyond the spec, ignore the existing design, overuse patterns, or return summaries with no inspectable artifact.
**In scope:** read-before-edit discipline; minimal-diff rule; one verifiable condition per dispatch; inspect relevant architecture/conventions; choose design and refactoring patterns only to address concrete needs; preserve unrelated behavior; return contract = diff + condition + stop reason, with consequential design choices noted.
**Out of scope:** deciding pass/fail (never — ADR-003); committing or pushing (only on explicit human instruction).

## Acceptance criteria
1. **Return contract.** The body requires every worker-code return to contain (a) the diff or file list, (b) the verifiable condition addressed, (c) a stop reason. Proof: body inspection finds all three fields in the return template. Demo I/O: a dispatch returns exactly those three fields.
2. **Minimal-diff rule stated with a reason.** The body mandates the smallest change satisfying the condition and explains why (reviewability + revert cost). Proof: body inspection finds the rule and its rationale. Demo I/O: a spec asking for one function does not produce edits to unrelated files.
3. **Read-before-edit.** The body forbids editing a file that hasn't been read in the current context. Proof: body inspection finds the prohibition. Demo I/O: worker reads target file before first edit in its transcript.
4. **Architecture-aware design.** Before editing, the body requires inspecting relevant neighboring code, interfaces, tests, and conventions; choosing a design pattern only for a concrete need; and preferring the simplest design when no pattern is warranted. Proof: body inspection finds these instructions. Demo I/O: a straightforward single-behavior change adds no unnecessary abstraction.
5. **Bounded refactoring.** The body limits refactoring to what directly supports the dispatched condition, requires preserving unrelated behavior, and includes consequential design/refactoring choices in the return. Proof: body inspection finds these constraints and return item. Demo I/O: a focused change causes no unrelated restructuring.

## Demo criteria
Runbook: dispatch worker-code on a one-condition task; accept when the transcript shows read-before-edit, the diff touches only in-scope files, and the return matches the contract.

## SKILL.md overview
Frontmatter: `name: guarana:code`; description triggering on implementing, editing, writing code, applying diffs. Body: intake (condition + budget from plan) → inspect relevant design/conventions → choose the simplest fitting design and scoped refactoring → make the smallest change → self-check against condition (not approval) → return diff + stop reason and consequential design notes. Gotchas: never self-approve; never widen scope; surface blockers as `stop_reason: error` instead of working around them silently.

## Edge cases & constraints
- Condition unsatisfiable within budget → stop, return `stop_reason: budget-exhausted` with partial diff marked partial.
- Budget: 8k tokens per dispatch (ADR-005); body ≤ 150 lines.

## References
- External: Yao et al., ReAct (arXiv:2210.03629).
- Internal: `guarana:plan`, `guarana:build`, `guarana:verify`.

## Definition of done
All five acceptance criteria proven in proofs/code-proofs.md, canonical and bundled skill copies match, worker-verify PASS, change recorded.
