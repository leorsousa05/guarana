# 2026-09-28 — Dashboard layout refinement

- Replaced the desktop side rail with one horizontal section rail and gave every view the same single main content column; stacked Specs pages as a vertical reading flow.
- Organized Overview as a single-column, rule-separated ledger instead of a card grid. Kept the existing palette, typography, rules, and surfaces; mobile navigation scrolls within its own bounds.
- Verification: independent review confirmed a rule-separated single column with no repeated boxes/widgets; production build, `npm test` 181/181, CLI bundle check, specs validation, and `git diff --check` pass.
