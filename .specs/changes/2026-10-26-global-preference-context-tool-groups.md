# 2026-10-26 — Global preference context tool groups

- Explicit `memory_get_context_for_task` results preserve selected direct global preferences, active related global preferences, and reached superseded global preferences as separate result groups for `scope: both` and `scope: global`.
- One-hop expansion, combined limiting, scope-qualified deduplication, exclusion of unrelated global preferences, and generic project-only behavior remain intact. Exact code paths: `plugin/guarana-memory.js`, `cli/plugin/guarana-memory.js`, and `plugin/guarana-memory.tools.test.mjs`.
- Primary checks: focused tests PASS (16/16); `npm test` PASS (634/634); `npm run build` PASS (Vite build and CLI sync); `npm run check-cli` PASS; pre-record `npm run specs:validate` PASS (232 Markdown, 90 feature specs, 40 ADRs, 251 local links); `npm run audit` PASS (0 vulnerabilities); `git diff --check` and canonical/CLI mirror parity PASS.
- Fresh independent worker-verify overall PASS confirms the exact three code paths and reran the focused tests PASS (16/16). The verifier did not rerun the full suite or build.
- No actual memory vault data was accessed. No Dashboard, project-selection/Drafts, global-preference UI, or TASKED Memory schema/prompt/type architecture changes are included.
- **Status: VALIDATED, not SHIPPED.** The 1.5.1 global preference injection budget commit `c272eba4f703abad74211cec4f96c483146d4b7b` is already on `origin/main`; push of this follow-up remains pending. No npm publication or tag is claimed.
