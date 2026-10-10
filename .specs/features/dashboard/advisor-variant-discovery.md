# Feature spec: Advisor model variant discovery and loading feedback

**Status: VALIDATED**

## Goal
Make model-specific variant suggestions discover automatically for the project-configured Advisor model and provide clear, accessible loading and error feedback without losing manual variant entry.

## Requirements
- On initial settings load, discover variants for the project-configured Primary and Advisor models instead of waiting for catalog selection or explicit Load suggestions; current configured Advisor model discovery returns six variants for openai/gpt-6-sol.
- Keep suggestions associated with the correct model and do not overwrite persisted or manually entered variant values.
- Treat an API response containing an error as a lookup failure rather than a successful empty result; show safe, actionable error text and retain manual variant fallback.
- During lookup, show a visible spinner or icon together with clear role-specific loading text inside an accessible role=status message.
- Disable duplicate lookup while a request is in flight and honor prefers-reduced-motion for the spinner.

## Assumptions and scope
- Automatic initial discovery applies to project-configured Primary and Advisor models after settings load.
- Loading feedback is inferred to require both a visible icon or spinner and role-specific text, with status semantics and reduced-motion support.
- The existing variant API contract is sufficient unless implementation demonstrates otherwise; no credentials were inspected or exposed.
- Preserve manual variant entry and existing default behavior.
- Preserve model-specific results, keyboard and accessibility behavior, responsive ledger styling, and existing project configuration semantics.
- Exclude unrelated configuration, runtime, and API redesign.

## Acceptance criteria
1. The project-configured existing Advisor selection triggers variant discovery during initial settings load, not only after catalog selection or manual lookup.
2. Variants returned for a model appear under that model, while persisted and manually entered variant values are not overwritten.
3. An API error is not treated as successful empty suggestions; the user sees safe actionable error text and can still enter a variant manually.
4. Fetching is visually explicit with both a spinner or icon and role-specific text in role=status; duplicate lookup is disabled and spinner motion respects prefers-reduced-motion.
5. Focused tests, dashboard build, relevant full validation, and CLI bundle synchronization pass; independent verification records criterion-level results before validation is claimed.

<!-- guarana:record:start -->
Status: VALIDATED
Proof: Independent worker-verify overall PASS; all five acceptance criteria passed.; Models.jsx:89-94,290-322 automatically looks up configured project Primary and Advisor models; Models.test.mjs:110-115 checks both and skips unconfigured roles.; Models.jsx:181-184 restricts results to the matching model; Models.test.mjs:103-108 checks stale suggestions hidden; Models.jsx:117-129 does not overwrite the variant field; Models.test.mjs:100-102 checks the saved value.; Models.jsx:96-105,193-198 surfaces API {variants:[],error} as actionable manual/default fallback; Models.test.mjs:117-130; cli/lib/opencode-model-catalog.js:216-253 covers safe errors.; Models.jsx:190-192,107-117,244-248 shows spinner and role-specific accessible status, disables lookup, and guards duplicate in-flight requests; Models.test.mjs:79-84,132-145 checks loading and one request; style.css:1328-1330 supports reduced motion.; Existing manual/default/keyboard behavior: Models.test.mjs:48-58,86-102; mobile/source layout stacks below 600px and relevant fields/status wrap: style.css:1092-1100,1120,1317-1325.; node bin/guarana.js specs validate . --json PASS (ok:true, zero issues).; Focused Models test PASS; the verifier did not provide the exact command.; npm test PASS (293/293); npm run build PASS; npm run check-cli PASS (canonical/CLI sync); git diff --check PASS.; Limitation: no browser/viewport tooling was available, so no rendered 375px viewport is claimed; responsive source was inspected.
Change: .specs/changes/2026-10-09-advisor-variant-discovery.md
<!-- guarana:record:end -->
