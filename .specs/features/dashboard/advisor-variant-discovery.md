# Feature spec: Advisor model variant discovery and loading feedback

**Status: VALIDATED**

## Goal
Repair Dashboard Settings model-variant discovery against the installed OpenCode v2.1.3 contract, matching exact provider and model IDs while preserving the existing Settings API and UI behavior.

## Requirements
- Leave the separately validated connected-provider/model catalog behavior unchanged.
- Replace the unsupported `opencode models <provider> --verbose` discovery assumption: installed OpenCode v2.1.3 lacks that command contract. Invoke read-only `opencode api model.list --param location[directory]=<repoRoot>` at the project cwd; consume `data` model entries with exact `providerID`, `id`, and per-model `variants`. `provider.list` has no model entries. Sanitized processing found six variants for `openai/gpt-6-luna`.
- Match provider and model identifiers exactly and expose only valid, enabled variant identifiers.
- Preserve connected-provider authorization filtering, bounded invocation and output, fail-closed safe parsing, and secret exclusion.
- Preserve existing `/api/models/variants` behavior, Primary and Advisor automatic discovery, manual variant entry, and blank/model-default fallback.

## Assumptions and scope
- `model.list` is the observed read-only model catalog contract for installed OpenCode v2.1.3; this does not establish a fixed supported-version range or a release-support claim. ADR-018 states latest stable is the supported target and earlier versions are not promised without validation.
- The six-variant observation is sanitized and does not include credentials or raw authorization output.
- Scope is the model-variant discovery adapter and its regression coverage; the separately validated connected-provider/model catalog remains unchanged.
- Preserve existing API/UI behavior, role-model association, Primary and Advisor automatic discovery, manual entry, and blank/model-default fallback.
- Exclude unrelated configuration, runtime, release, and API redesign.

## Acceptance criteria
1. Adapter tests prove exact `providerID` plus model `id` matching, including an identical model ID under another provider, and a fixture with six distinct variant identifiers for `openai/gpt-6-luna`; only valid enabled identifiers are exposed, while invalid and disabled variants are filtered.
2. Tests prove project-cwd `model.list` invocation, connected-provider authorization gating, bounded invocation/output, fail-closed safe errors for missing, malformed, oversized, and unsafe responses, and exclusion of secret material; no `provider.list` model data is assumed.
3. API/UI tests preserve `/api/models/variants` behavior and associate suggestions with the exact Primary or Advisor role-model pair; automatic discovery for both roles remains intact.
4. API/UI tests preserve manual variant entry and blank/model-default fallback without overwriting persisted or manually entered values.
5. Focused tests, full `npm test`, build and CLI bundle synchronization, `npm run check-cli`, `guarana specs validate . --json`, and `git diff --check` pass; a fresh independent `worker-verify` returns PASS for every criterion before status becomes VALIDATED. No release, publication, or shipping is claimed.

<!-- guarana:record:start -->
Status: VALIDATED
Proof: Criterion 1 PASS: cli/lib/opencode-model-catalog.js:241-256 performs exact providerID/model id matching and validates enabled identifiers; cli/lib/opencode-model-catalog.test.js:233-274 verifies distractor models/providers, six IDs, and invalid/disabled filtering.; Criterion 2 PASS: cli/lib/opencode-model-catalog.js:219-260 gates on connected auth and runs bounded project-scoped model.list; cli/lib/opencode-model-catalog.test.js:233-309 asserts project cwd, 10s timeout, 2 MiB output, fail-closed parsing, and secret-safe errors.; Criterion 3 PASS: dashboard/server/routes/models.js:65-72 preserves the variants API; dashboard/server/app.test.js:599-615 asserts response and exact provider/model arguments; dashboard/web/src/components/Models.jsx:167-212 and dashboard/web/src/components/Models.test.mjs:269-274 preserve role-specific automatic lookup.; Criterion 4 PASS: dashboard/web/src/components/Models.jsx:303-323,360-378 preserves exact role/model association, manual entry, and blank default; dashboard/web/src/components/Models.test.mjs:163-201,259-289 verifies manual values, saved-value retention, blank omission, and non-blocking errors.; Criterion 5 PASS: fresh independent worker-verify returned overall PASS 5/5. Focused node --test cli/lib/opencode-model-catalog.test.js dashboard/server/app.test.js dashboard/web/src/components/Models.test.mjs passed 46/46; npm test passed 623/623 with benign WebSocket port-in-use warnings; npm run build and CLI sync passed; npm run check-cli passed; pre-record npm run specs:validate -- --json passed with 230 Markdown files, 90 features, 39 ADRs, 251 links, and 0 issues; git diff --check passed.; Fresh sanitized primary discoverVariants and independent verifier lookups each returned none, low, medium, high, xhigh, and max with error:null; raw API output, auth listings, and variant settings were not printed or retained. An initial malformed-metadata live response was superseded after correcting the adapter to the observed array response shape.; ADR-040 records bounded read-only project-scoped model.list, exact ID matching, ID-only output, retained authorization/privacy/manual/default constraints, and verification only on installed OpenCode v2.1.3; ADR-018 remains the version policy and no release, publication, or shipping is claimed.
Change: .specs/changes/2026-10-25-advisor-variant-discovery-model-list.md
<!-- guarana:record:end -->
