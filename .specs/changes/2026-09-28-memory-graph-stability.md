# 2026-09-28 — Memory Graph stability and legibility

- Replaced the overlapping circular/force layout with deterministic project/global scope lanes.
- Preserve user-arranged positions across identical polls, tab changes, and app-view remounts; added an explicit reset action.
- Reduced label clutter, reveal connected relationship labels on selection, and support keyboard selection plus captured pointer dragging.
- Added graph-signature/layout regression tests to the root test suite.
- Verification: independent review, `npm test` 185/185, production build, CLI bundle check, specs validation, and `git diff --check` pass.
