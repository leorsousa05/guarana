# Proofs — guarana:plan

Append-only. Proofs written BEFORE commit slices; committed proofs never altered.

## Task 1 — Draft plan/SKILL.md (2026-08-21)
- **AC1 (routing completeness):** routing table contains 8 rows (header + 7 skills), one route per skill; debug/measure marked optional-trigger-only. Evidence: `grep -c "^| " plan/SKILL.md` → 8. Trigger input "a test failed and the run is oscillating" maps to the row "A test FAILED or a run misbehaves → guarana:debug". PASS.
- **AC2 (restoration order):** body lines 11–14 read, in order: `.specs/README.md` → `state/project-state.md` → `decisions/ADR-*.md` → current feature spec. PASS.
- **AC3 (dispatch contract):** section 3 "Dispatch template" contains Worker, Verifiable condition, Budget (code 8k / verify 4k / debug 6k per ADR-005), State pointers. PASS.
- worker-verify verdict: PASS (fresh-context review of body vs. spec).
- worker-verify re-review: PASS after ordering fix — cold-start branch scaffolds `.specs/decisions/` (step 2) before writing ADRs (step 3); original AC4 condition preserved; body stays ≤150 lines / ≤2k tokens.

## Task 2 — Cold-start addendum to plan/SKILL.md (2026-08-21)
- **AC4 (cold-start bootstrap):** the restore step (section 1) gains a "Cold start (no `.specs/` on disk)" branch. It treats absent `.specs/` as a signal, states "Do NOT fabricate a current step", bootstraps via Rule 0 (ADR-006, records ADRs), scaffolds the initial tracker + project-state, and only then proceeds to routing. Evidence: body inspection of `skills/guarana/skills/plan/SKILL.md` — the cold-start branch text contains "Cold start (no `.specs/` on disk)", "Do NOT fabricate", "Rule 0", and "scaffold"; routing remains a separate section 2 reached after the branch. PASS.

## Task 3 — no ADR pre-seed + legacy recovery/migration (2026-08-21)
- **AC5 (no ADR pre-seed):** the cold-start branch scaffolds `.specs/decisions/` as an EMPTY dir and forbids pre-seeding ADRs from any other project or template; ADRs are generated only from this project's Rule-0 answers, numbered from 001. Evidence: grep of the cold-start branch in `skills/guarana/skills/plan/SKILL.md` finds "created EMPTY", "Do NOT copy or pre-seed", and "numbered organically from 001" (step 3). PASS.
- **AC6 (legacy recovery / migration):** when no `.specs/` but a legacy spec tree is recoverable (working-tree `specs/` dir, or `.specs/` content in git HEAD — deleted/renamed files), plan recovers it as the initial Core feature context, scaffolds the new `.specs/` around it, and treats it as migration; pure cold start (no legacy anywhere) is bare scaffold + Rule-0 ADRs only. Evidence: body inspection of the cold-start branch shows two sub-cases — "(i) Legacy tree recoverable (migration)" and "(ii) No prior state anywhere (pure cold start)" (step 2). PASS.
