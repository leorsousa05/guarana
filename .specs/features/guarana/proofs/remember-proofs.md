# Proofs — guarana:remember

Append-only. Proofs written BEFORE commit slices; committed proofs never altered.

## Task 1 — Draft remember/SKILL.md (2026-08-21)
- **AC1 (restoration order):** "Restore sequence" lists README.md → project-state.md → ADR-*.md → current feature spec as the only order. PASS.
- **AC2 (four write triggers):** end of task, every stop (stop reason), every decision (ADR append), every discovered failure (known-issues). `grep -c "^[0-9]\. \*\*"` → 4. PASS.
- **AC3 (silent-truncation procedure):** checkpoint at stage boundaries; detect via checkpoint mismatch; recover by re-reading from disk, "NEVER reconstruct missing facts from memory". PASS.
- worker-verify verdict: PASS.
