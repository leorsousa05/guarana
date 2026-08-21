# Change — 2026-08-21 — guarana:plan cold-start v2 (no pre-seed + legacy recovery)

- **Feature:** guarana:plan
- **Change:** plan cold-start addendum v2 — extend the cold-start branch to forbid ADR pre-seeding and to recover a legacy spec tree as a migration rather than discarding it
- **What changed:**
  - `skills/guarana/skills/plan/SKILL.md` — cold-start branch (section 1): scaffolds `.specs/decisions/` as an EMPTY dir, explicitly forbids copying/pre-seeding ADRs from another project or template (ADRs generated only from this project's Rule-0 answers, numbered from 001); distinguishes two sub-cases — (i) legacy tree recoverable (working-tree `specs/` or `.specs/` in git HEAD) → recover as initial Core context, scaffold around it, treat as migration; (ii) genuinely no prior state → bare scaffold + Rule-0 ADRs only. Body stays ≤150 lines / ≤2k tokens.
  - `.specs/features/guarana/plan.md` — new acceptance criteria AC5 (no ADR pre-seed) and AC6 (legacy recovery/migration) after AC4; definition of done updated from four to six criteria.
  - `.specs/features/guarana/proofs/plan-proofs.md` — Task 3 proof appended mapping AC5 and AC6 to body-inspection/grep evidence.
- **Validated:** AC5 + AC6 added; proof written in plan-proofs.md Task 3; no-fabricate and "disk is truth only after `.specs/` exists" rules preserved in the rewritten branch. worker-verify PASS (fresh-context review, all criteria + falsifiability). CLI bundle synced and global install updated.
- **Failed:** none.
- **Re-opened:** none
- **Proof:** .specs/features/guarana/proofs/plan-proofs.md (Task 3)
- **Next action:** none (closed).