# Change — Dashboard Activity V2 setup-boundary regression

**Current status:** VALIDATED — local synthetic setup-boundary tests only. Live runtime event delivery and rendered Activity visibility remain blocked/unverified. Not SHIPPED.

## Outcome

The V2 telemetry setup-boundary regression exercises public `ctx.event.subscribe({ signal })` with synthetic full V2 Session records and event `properties` shapes. It covers created/status-busy/late-updated parent and agent metadata plus a separate created/idle case. Persisted telemetry excludes synthetic event IDs and title, prompt, output, or reasoning sentinels; `summarize()` returns the expected parent-linked busy and idle summaries. The exact local test change is `plugin/plugin-v2-compat.test.mjs`. The installed plugin's V2 Event type imports `@opencode-ai/sdk/v2/types`, and complete shapes were validated against `@opencode-ai/sdk/dist/v2/gen/types.gen.d.ts`.

No production Activity/API behavior changed, no new production defect was demonstrated, and no production change was made by this follow-up.

## Independent verification and checks

- Fresh independent `worker-verify` overall PASS for setup-boundary follow-up criteria 1–4.
- `node --test plugin/plugin-v2-compat.test.mjs plugin/guarana-telemetry.test.mjs dashboard/server/lib/telemetry.test.js cli/dashboard/server/lib/telemetry.test.js dashboard/web/src/components/Activity.test.mjs` — PASS 66/66.
- `npm test` — PASS 612/612; non-fatal WebSocket port-in-use warnings.
- `npm run build` — PASS, including dashboard build and CLI sync; `npm run check-cli` — PASS, bundle matches canonical sources; `git diff --check` — PASS.
- `guarana specs validate . --json` — PASS before and after independent review: 209 files, 80 features, 39 ADRs, 239 links, 0 issues.

## Runtime and deployment boundary

This is local synthetic fixture/setup proof only; it does not establish runtime event delivery or rendered live Activity visibility. No live reproduction Task, raw event/SSE capture, global install, reload, profile change, commit, or push occurred as part of this follow-up. The older source/fixture proof remains intact. The separate global deployment/live proof remains blocked and unverified. No shipping confirmation is made.
