# Change — Context-driven design and refactoring guidance for guarana:code

**Status:** VALIDATED · 2026-10-08

Updated the code implementation skill to inspect relevant project design, use design patterns only for concrete needs, keep refactoring within the dispatched condition, preserve unrelated behavior, and report consequential design choices. The minimal-diff, read-before-edit, independent-verification, and return-contract rules remain in place.

## Files

- `skills/guarana/skills/code/SKILL.md` — canonical skill procedure.
- `cli/skills/guarana/skills/code/SKILL.md` — generated installer-bundle copy.
- `.specs/features/guarana/code.md` — five acceptance criteria.
- `.specs/features/guarana/proofs/code-proofs.md` — implementation and independent verification evidence.

## Validation

- `npm run check-cli` — PASS.
- `npm run specs:validate` — PASS (110 Markdown files, 17 feature specs, 20 ADRs, 164 local links).
- `git diff --check` — PASS.
- `cmp skills/guarana/skills/code/SKILL.md cli/skills/guarana/skills/code/SKILL.md` — PASS.
- Independent worker-verify session `ses_ee686c64cffes0rMMV21SVfPvD` — PASS (5/5 criteria).
