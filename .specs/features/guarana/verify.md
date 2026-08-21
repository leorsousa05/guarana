# Feature / guarana:verify

## Summary
Without a termination skill, runs end on vibes. `guarana:verify` is the termination skill: the 3 guards (hard caps, verifiable conditions, independent verifier), the validation gate, and the structural verification split.

## Reference links
- Depends on: [plan.md](plan.md) (dispatch); invoked by [build.md](build.md) (Verify stage).
- Guards: [code.md](code.md) (the work it judges — never its own).
- Knowledge: [docs/reference/outer-loop-triggers.md](../../../docs/reference/outer-loop-triggers.md), [docs/reference/failure-modes.md](../../../docs/reference/failure-modes.md)

## What it is / what it fills
**Problem:** "done" gets claimed by the implementer with no checkable predicate — the loop can't tell success from failure (hard truth 5).
**In scope:** the 3 guards; the gate procedure (re-check each acceptance criterion against evidence); verdict format (pass/fail + proof reference); refusal to verify one's own work.
**Out of scope:** fixing failures (routes to `guarana:code`, or `guarana:debug` on misbehavior); the human's final "done" gate.

## Acceptance criteria
1. **Three guards enumerated.** The body defines hard caps, verifiable conditions, and the independent verifier as the three termination guards, each with the failure it prevents. Proof: body inspection finds all three with rationales. Demo I/O: asked "when may a run stop?" the body answers only via the guards.
2. **Falsifiability test applied.** The gate procedure rejects any criterion whose failure would be undetectable (hard truth 5). Proof: body contains the reject rule. Demo I/O: criterion "output looks reasonable" → rejected as unfalsifiable.
3. **Split refusal.** The body instructs worker-verify to refuse verifying a diff produced in its own context. Proof: body inspection finds the refusal rule. Demo I/O: same-context verify request → refusal + reroute to fresh worker-verify.

## Demo criteria
Runbook: submit one passing diff and one diff failing a criterion; accept when verdicts are PASS and FAIL respectively, each citing the criterion and proof path.

## SKILL.md overview
Frontmatter: `name: guarana:verify`; description triggering on checking work, pass/fail, acceptance, termination, "is it done"; references the knowledge files above. Body: intake (diff + spec + claimed condition) → split check (refuse own work) → criterion-by-criterion gate against evidence → verdict: PASS/FAIL per criterion + proof path, overall verdict = AND of criteria. Never verdict without cited evidence.

## Edge cases & constraints
- Missing proof → criterion FAILs (absence of evidence is failure, not neutrality).
- Budget: 4k tokens per dispatch (ADR-005); body ≤ 150 lines.

## References
- External: Shinn et al., Reflexion (arXiv:2303.11366) — verbal feedback as the FAIL signal; Yao et al., ReAct (arXiv:2210.03629).
- Internal: `guarana:build`, `guarana:code`, `guarana:debug` (on FAIL with misbehavior).

## Definition of done
All three acceptance criteria proven in proofs/verify-proofs.md, worker-verify (fresh context) PASS, change recorded.
