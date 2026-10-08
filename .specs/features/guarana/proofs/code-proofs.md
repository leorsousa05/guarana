# Proofs — guarana:code

Append-only. Proofs written BEFORE commit slices; committed proofs never altered.

## Task 1 — Draft code/SKILL.md (2026-08-21)
- **AC1 (return contract):** Procedure step 4 "Return the contract" lists diff (or file list), verifiable condition addressed, stop reason (condition-met | budget-exhausted | error). PASS.
- **AC2 (minimal-diff rule + rationale):** step 2 "Smallest change" with stated reason ("review and revert cost scale with diff size, and unrelated edits destroy both"). PASS.
- **AC3 (read-before-edit):** step 1 "Read before edit. Never edit a file you haven't read in this context." PASS.
- worker-verify verdict: PASS.

## Task 2 — Context-driven design and refactoring guidance (2026-10-08)
- **AC1 (return contract):** `skills/guarana/skills/code/SKILL.md:21–25` requires diff/file list, condition, stop reason, and consequential design/refactoring choices when applicable. PASS.
- **AC2 (minimal diff):** `skills/guarana/skills/code/SKILL.md:19` requires the minimal diff and states review/revert cost rationale. PASS.
- **AC3 (read before edit):** `skills/guarana/skills/code/SKILL.md:16` prohibits editing a file not read in this context. PASS.
- **AC4 (architecture-aware design):** `skills/guarana/skills/code/SKILL.md:17–18,29` requires inspection of relevant code/interfaces/tests/conventions; a pattern must address a concrete need, and none is added when unnecessary. PASS.
- **AC5 (bounded refactoring):** `skills/guarana/skills/code/SKILL.md:18–19,25` limits refactoring to the dispatched condition, preserves unrelated behavior/structure, and reports consequential decisions. PASS.
- **Bundle identity:** `cmp skills/guarana/skills/code/SKILL.md cli/skills/guarana/skills/code/SKILL.md` — PASS.
- **CLI bundle check:** `npm run check-cli` — PASS (`CLI bundle matches canonical sources`).
- **Specs check:** final `npm run specs:validate` — PASS (110 Markdown files, 17 feature specs, 20 ADRs, 164 local links).
- **Diff whitespace check:** `git diff --check` — PASS.
- **Independent worker-verify:** session `ses_ee686c64cffes0rMMV21SVfPvD`, overall PASS (5/5); confirmed all five criteria, bundle identity, and recorded checks.
