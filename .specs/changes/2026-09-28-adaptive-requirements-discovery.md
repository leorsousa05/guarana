# 2026-09-28 — Adaptive requirements discovery

- Added an evidence-first discovery gate to `guarana:plan` for substantial or ambiguous changes.
- Ask up to five high-impact questions per round only for unresolved consequential decisions; do not dispatch code while a critical unknown remains.
- Keep small, fully specified tasks moving without a questionnaire; persist answers and material assumptions in `.specs`.
- Reinforced the rule in the always-on orchestrator prompt and added regression tests for the injected policy.
- Verification: independent review, `npm test` 186/186, production build, CLI bundle check, specs validation, and `git diff --check` pass.
