# Proofs — guarana:plan

Append-only. Proofs written BEFORE commit slices; committed proofs never altered.

## Task 1 — Draft plan/SKILL.md (2026-08-21)
- **AC1 (routing completeness):** routing table contains 8 rows (header + 7 skills), one route per skill; debug/measure marked optional-trigger-only. Evidence: `grep -c "^| " plan/SKILL.md` → 8. Trigger input "a test failed and the run is oscillating" maps to the row "A test FAILED or a run misbehaves → guarana:debug". PASS.
- **AC2 (restoration order):** body lines 11–14 read, in order: `.specs/README.md` → `state/project-state.md` → `decisions/ADR-*.md` → current feature spec. PASS.
- **AC3 (dispatch contract):** section 3 "Dispatch template" contains Worker, Verifiable condition, Budget (code 8k / verify 4k / debug 6k per ADR-005), State pointers. PASS.
- worker-verify verdict: PASS (fresh-context review of body vs. spec).
