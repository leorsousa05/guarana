# Feature / guarana:debug

## Summary
When runs misbehave, agents improvise fixes that treat symptoms. `guarana:debug` (OPTIONAL, trigger-only) is the failure-mode skill: a fixed failure matrix with a defusing procedure per mode.

## Reference links
- Invoked by: [build.md](build.md) / [verify.md](verify.md) on FAIL or misbehavior.
- Writes to: [known-issues.md](../../state/known-issues.md).
- Knowledge: [docs/reference/failure-modes.md](../../../docs/reference/failure-modes.md)

## What it is / what it fills
**Problem:** runaway iterations, oscillation, context loss, unbounded transient retries, and loop-as-terrier (repeating an action that already failed) each need a distinct defusal; ad-hoc debugging conflates them.
**In scope:** the 5-mode failure matrix (symptom → detection signal → defusal); root-cause + fix return contract; known-issues entry format.
**Out of scope:** firing by default — NEVER in a default load path; only when a test fails or a run misbehaves. Preventing failures (that is build/verify's job).

## Acceptance criteria
1. **Five modes, each with detection + defusal.** The body covers runaway, oscillation, context loss, unbounded transient retry, loop-as-terrier; each row names a detection signal and a defusal action. Proof: body inspection finds all five rows complete. Demo I/O: given "the agent re-applied the same failing patch 4 times" → classified loop-as-terrier with its defusal.
2. **Trigger-only loading stated.** Frontmatter description and body both state the skill loads ONLY on failure/misbehavior. Proof: inspection of both. Demo I/O: a green run never routes here (plan's routing table agrees).
3. **Return + record contract.** Every debug dispatch returns root cause + fix AND appends a known-issues entry (title, symptom, reproduction trigger, mitigation, status). Proof: body inspection finds both obligations. Demo I/O: a resolved oscillation produces a known-issues entry in the exact format.

## Demo criteria
Runbook: feed two of the five symptom descriptions; accept when both classify correctly and the second produces a conforming known-issues entry.

## SKILL.md overview
Frontmatter: `name: guarana:debug`; description triggering ONLY on test failure, run misbehavior, oscillation, runaway, repeated failing actions; references `docs/reference/failure-modes.md`. Body: classify symptom against the 5-mode matrix → confirm with the detection signal → apply the mode's defusal → return root cause + fix → append known-issues entry.

## Edge cases & constraints
- Symptom matches no mode → record as new issue with `status: unclassified`, escalate to human; do not invent a sixth mode silently.
- Budget: 6k tokens per dispatch (ADR-005); body ≤ 150 lines.

## References
- External: Shinn et al., Reflexion (arXiv:2303.11366) — failure feedback into memory; Madaan et al., "Self-Refine" (arXiv:2303.17651) — limits of unguided self-correction (motivates hard caps over retry).
- Internal: `guarana:build`, `guarana:verify`, `guarana:remember`.

## Definition of done
All three acceptance criteria proven in proofs/debug-proofs.md, worker-verify PASS, change recorded.
