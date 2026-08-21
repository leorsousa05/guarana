# Proofs — guarana:code

Append-only. Proofs written BEFORE commit slices; committed proofs never altered.

## Task 1 — Draft code/SKILL.md (2026-08-21)
- **AC1 (return contract):** Procedure step 4 "Return the contract" lists diff (or file list), verifiable condition addressed, stop reason (condition-met | budget-exhausted | error). PASS.
- **AC2 (minimal-diff rule + rationale):** step 2 "Smallest change" with stated reason ("review and revert cost scale with diff size, and unrelated edits destroy both"). PASS.
- **AC3 (read-before-edit):** step 1 "Read before edit. Never edit a file you haven't read in this context." PASS.
- worker-verify verdict: PASS.
