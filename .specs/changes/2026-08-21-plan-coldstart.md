# Change — 2026-08-21 — guarana:plan cold-start addendum

- **Feature:** guarana:plan
- **Change:** plan cold-start addendum — runtime branch for a project with no `.specs/` on disk
- **What changed:**
  - `skills/guarana/skills/plan/SKILL.md` — restore step (section 1) gains a "Cold start (no `.specs/` on disk)" branch: detect absent `.specs/` as a signal, do not fabricate a current step, bootstrap via Rule 0 (record ADRs), scaffold the initial tracker + project-state, then route.
  - `.specs/features/guarana/plan.md` — new acceptance criterion AC4 (cold-start bootstrap) after AC3; definition of done updated to four criteria.
  - `.specs/features/guarana/proofs/plan-proofs.md` — Task 2 proof appended mapping AC4 to body inspection evidence.
- **Validated:** AC4 added; proof written in plan-proofs.md Task 2; worker-verify PASS (fresh-context review of the AC4 diff).
- **Failed:** none. One sequencing defect found during Record and fixed before ship: the cold-start branch originally wrote ADRs into `.specs/decisions/` (step 2) before scaffolding that directory (step 3); corrected to scaffold-before-write and re-verified PASS in a fresh context.
- **Re-opened:** none
- **Proof:** .specs/features/guarana/proofs/plan-proofs.md (Task 2)
- **Next action:** none (closed).