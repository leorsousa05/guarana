# Change — Advisor model variant discovery via model.list

**Status: VALIDATED, not SHIPPED.**

## Outcome

Advisor model-variant discovery now uses the bounded, read-only,
project-scoped `opencode api model.list` contract. It matches the exact
`providerID` and model `id`, and returns only valid enabled variant identifiers.
The connected-provider authorization gate, safe fail-closed parsing, and secret
exclusion remain in place. The `/api/models/variants` response and Primary and
Advisor role association, automatic lookup, manual entry, and blank/model-default
fallback remain unchanged. The separately validated connected-provider/model
catalog is unchanged.

The initial live call returned malformed metadata before the adapter was
corrected to the observed array response shape. Subsequent sanitized primary
and independent live lookups each returned `none`, `low`, `medium`, `high`,
`xhigh`, and `max` with `error:null`. Raw API output, authentication listings,
and variant settings were not printed or retained.

## Criterion-level proof

1. **PASS — exact matching and safe identifiers.**
   `cli/lib/opencode-model-catalog.js:241-256` requires exact `providerID` and
   model `id`, validates variant IDs/settings and filters disabled or duplicate
   entries. `cli/lib/opencode-model-catalog.test.js:233-274` covers same model ID
   under another provider, a different model, six expected identifiers, and
   invalid/disabled entries.
2. **PASS — authorization, bounds, and safe parsing.**
   `cli/lib/opencode-model-catalog.js:219-260` gates on connected auth and
   performs project-cwd `model.list` with bounded invocation/output and
   fail-closed parsing. `cli/lib/opencode-model-catalog.test.js:233-309` asserts
   project location, 10s timeout, 2 MiB cap, connected-provider gating, malformed
   and oversized responses, unsafe metadata, and secret-safe failures.
3. **PASS — API and role-specific discovery preserved.**
   `dashboard/server/routes/models.js:65-72` preserves the variants route;
   `dashboard/server/app.test.js:599-615` asserts its response and exact
   provider/model arguments. `dashboard/web/src/components/Models.jsx:167-212`
   keys loading by role and selected model; `dashboard/web/src/components/Models.test.mjs:269-274`
   verifies automatic requests for Primary and Advisor.
4. **PASS — manual and model-default behavior preserved.**
   `dashboard/web/src/components/Models.jsx:303-323,360-378` keeps values tied
   to the exact role/model, retains typed variant entry, and leaves blank as the
   model default. `dashboard/web/src/components/Models.test.mjs:163-201,259-289`
   covers manual model entry, existing saved values, blank omission, and
   non-blocking failure feedback.
5. **PASS — fresh independent verification and required gates.**
   Fresh independent `worker-verify` returned overall PASS 5/5. Focused tests,
   full suite, build/CLI sync, CLI consistency, specs validation, and diff check
   all passed as listed below.

## Verification

- `node --test cli/lib/opencode-model-catalog.test.js dashboard/server/app.test.js dashboard/web/src/components/Models.test.mjs` — PASS 46/46.
- `npm test` — PASS 623/623; benign WebSocket port-in-use warnings.
- `npm run build` — PASS, including CLI synchronization.
- `npm run check-cli` — PASS.
- Pre-record `npm run specs:validate -- --json` — PASS: 230 Markdown files, 90 feature specs, 39 ADRs, 251 links, 0 issues. The final post-record validator result is reported by `specs record`.
- `git diff --check` — PASS.
- Fresh sanitized `discoverVariants` and independent verifier lookups each returned exactly six IDs (`none`, `low`, `medium`, `high`, `xhigh`, `max`) with `error:null`; no raw API/auth data or variant settings were printed or retained.

## Boundary

`model.list` is experimental and verified only on installed OpenCode v2.1.3.
ADR-018 remains controlling; no compatibility range, release promise, publication,
or shipping is claimed.
