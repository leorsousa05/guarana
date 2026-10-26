# Feature spec: Global preference context result groups

**Status: VALIDATED**

## Goal
Preserve selected global preferences as distinct groups in explicit task-context tool results without changing generic project-only behavior.

## Requirements
- For scope both and scope global, explicit memory_get_context_for_task results preserve selected direct global preferences, active related global preferences, and reached superseded global preferences in separate result groups.
- Keep related expansion one-hop, enforce the combined result limit, deduplicate with scope-qualified identity, and exclude unrelated global preferences.
- Leave generic project-only behavior unchanged.

## Assumptions and scope
- The exact staged changes in plugin/guarana-memory.js, cli/plugin/guarana-memory.js, and plugin/guarana-memory.tools.test.mjs.
- No Dashboard, project-selection/Drafts, global-preference UI, or TASKED Memory schema/prompt/type architecture changes.
- No actual memory vault data was accessed.

## Acceptance criteria
1. Focused memory tool tests prove the three separate global-preference result groups for both and global scopes, one-hop expansion, combined limiting, scope-qualified deduplication, no unrelated-global leakage, and unchanged generic project-only behavior.
2. The exact three staged code paths pass fresh independent worker-verify overall PASS; the verifier reruns the focused 16-test suite without claiming to rerun the full suite or build.

<!-- guarana:record:start -->
Status: VALIDATED
Proof: Primary: node --test plugin/guarana-memory.tools.test.mjs PASS (16/16); independent worker-verify reran the same focused suite PASS (16/16).; Primary: npm test PASS (634/634).; Primary: npm run build PASS (Vite build and CLI sync); npm run check-cli PASS.; Primary pre-record: npm run specs:validate PASS (232 Markdown, 90 feature specs, 40 ADRs, 251 local links).; Primary: npm run audit PASS (0 vulnerabilities); git diff --check PASS; canonical/CLI mirror parity PASS.; Fresh independent worker-verify overall PASS and confirms the exact three code paths; it did not rerun the full suite or build.; Status is VALIDATED, not SHIPPED; the 1.5.1 global preference injection budget commit c272eba4f703abad74211cec4f96c483146d4b7b is already on origin/main, while this follow-up remains unpublished and untagged.
Change: .specs/changes/2026-10-26-global-preference-context-tool-groups.md
<!-- guarana:record:end -->
