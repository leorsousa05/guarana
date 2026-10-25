# Feature spec: Dashboard Settings connected provider/model catalog loading

**Status: VALIDATED**

## Goal
Make connected OpenCode providers and their models appear reliably in both Primary and Advisor provider/model selectors on Dashboard Settings, preserving exact IDs and the catalog privacy boundary.

## Requirements
- Parse the observed installed OpenCode auth list whitespace-aligned provider/auth/status columns as separate fields, while retaining the already supported bordered and glyph formats; do not use the entire spaced row as provider identity.
- Map the OpenCode Console display label to catalog provider ID opencode, while preserving other exact connected provider IDs.
- Make discoverModels and GET /api/models/catalog expose only connected provider/model metadata with response schema {models,error}; retain disconnected-provider filtering and expose neither credential fields nor raw command output. On the observed live host, model discovery should return models rather than the current zero-model error.
- Populate both Primary and Advisor provider/model selectors from a successful catalog response while preserving exact IDs and keeping existing loading, error, and empty announcements plus manual entry usable.
- Add sanitized regression fixtures/tests for the observed whitespace table, existing bordered/glyph formats, provider alias, exact connected-provider filtering, UI options/manual fallback, and privacy.
- Focused tests, npm test, npm run build, npm run check-cli, npm run specs:validate, git diff --check, and fresh independent worker-verify must pass before status becomes VALIDATED.

## Assumptions and scope
- Historical sanitized live baseline before implementation: discoverModels({cwd:repoRoot}) returned modelCount=0 and error ‘OpenCode returned no models for connected providers. Enter model IDs manually or check the OpenCode model catalog.’ Both OpenCode CLI commands succeeded.
- Sanitized diagnostics observed auth rows with aligned provider/auth/status fields and model provider IDs openai, opencode, openrouter, and ollama; raw command output and credentials were not retained.
- Source inspection confirms the parser treats whitespace-aligned rows as one PROVIDER_LABEL candidate and does not split columns. OpenCode documentation confirms opencode as the provider ID for the OpenCode Console display label.
- Connected-provider parsing, model discovery and catalog API metadata, and the Primary/Advisor provider and model selectors in Dashboard Settings, with sanitized regression coverage.
- Preserve exact provider/model IDs, connected-provider filtering, response privacy, current loading/error/empty announcements, and manual entry.
- Exclude unrelated Settings preferences and any release, publication, shipping, commit, or version action; none is requested.
- Use ADR-005 default budgets: main thread at most 8k steady-state tokens; worker-code 8k, worker-verify 4k, worker-debug 6k per dispatch; 32k tokens and 15 minutes per run.

## Acceptance criteria
1. Sanitized fixtures demonstrate that the observed whitespace-aligned auth list is parsed into provider/auth/status columns without using the entire spaced row as provider identity, and existing bordered and glyph fixtures continue to pass.
2. The OpenCode Console display label maps to provider ID opencode; other connected provider IDs remain exact, and disconnected providers are excluded.
3. discoverModels and GET /api/models/catalog return {models,error} containing only connected provider/model metadata; disconnected-provider filtering remains enforced, and neither credential fields nor raw command output are exposed. With the observed live host, discovery returns models instead of the current zero-model error.
4. After a successful catalog response, both Primary and Advisor provider/model selectors display catalog options with exact IDs; existing loading/error/empty announcements and manual entry remain usable.
5. Sanitized regression fixtures/tests cover the current whitespace table and old formats, provider alias, exact connected filtering, selector options/manual fallback, and privacy.
6. Focused tests, npm test, npm run build, npm run check-cli, npm run specs:validate, git diff --check, and fresh independent worker-verify all pass before VALIDATED is recorded. No release, publication, shipping, commit, or version action is requested or claimed.

<!-- guarana:record:start -->
Status: VALIDATED
Proof: Fresh independent worker-verify overall PASS for all six criteria.; node --test dashboard/server/app.test.js dashboard/web/src/components/Models.test.mjs cli/lib/opencode-model-catalog.test.js PASS 46/46.; npm test PASS 623/623; nonfatal Vite WebSocket port-in-use and Node module-type warnings.; npm run build PASS including Dashboard production build and CLI sync; npm run check-cli PASS with matching bundle.; npm run specs:validate PASS: 229 Markdown, 90 feature specs, 39 ADRs, 250 links, 0 issues; verifier ran it before implementation review.; git diff --check PASS.; Sanitized live discoverModels({cwd:repoRoot}) returned 473 models from openai, opencode, and openrouter with error:null; disconnected ollama excluded; no raw auth output or credentials retained.; Browser automation was unavailable; verifier independently reviewed component source, SSR, and selector/manual-fallback tests instead, with no browser interaction claim.
Change: .specs/changes/2026-10-24-settings-provider-model-catalog.md
<!-- guarana:record:end -->
