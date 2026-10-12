# Feature spec: Dashboard telemetry refresh performance refactor

**Status: VALIDATED**

## Goal
Stop dashboard refresh stalls by avoiding repeated full-history telemetry parsing and redundant SSE-triggered requests.

## Requirements
- Preserve existing GET routes/payloads and single session query behavior; add multi-session support for bundled UI.
- Repeated unchanged reads reuse parsed snapshot and appends read only new bytes; truncation/replacement/same-size rewrite/missing-file recovery reload correctly; malformed lines and incomplete trailing lines remain safely handled.
- Summary/history results remain equivalent.
- Existing single-session endpoint is preserved and a batched request supports multiple sessions; App uses one request rather than up to five.
- Irrelevant app-wide poll refetches no longer amplify on every telemetry tick, without removing regular polling/live activity.

## Assumptions and scope
- Telemetry producers append newline-delimited records.
- Dashboard web and server telemetry path, plus generated CLI mirror only.
- No visual redesign, telemetry schema or retention change, or service restart.

## Acceptance criteria
1. Repeated unchanged reads reuse parsed snapshot and appends read only new bytes; truncation/replacement/same-size rewrite/missing-file recovery reload correctly; malformed lines and incomplete trailing lines remain safely handled.
2. Summary/history results remain equivalent.
3. Existing single-session endpoint is preserved and a batched request supports multiple sessions; App uses one request rather than up to five.
4. Irrelevant app-wide poll refetches no longer amplify on every telemetry tick, without removing regular polling/live activity.
5. Telemetry tests, app/API tests, npm test, npm run build, npm run check-cli, and npm run specs:validate pass.

<!-- guarana:record:start -->
Status: VALIDATED
Proof: Independent native worker-verify, separate from worker-code: overall PASS.; Cache PASS: unchanged readJsonl requests invoke fs.readSync for zero bytes; append, partial-line completion, malformed lines, truncation, replacement, same-size rewrite (8-byte-to-8-byte direct runtime check), missing and recreation tested. Paths: dashboard/server/lib/telemetry.test.js:24-58, dashboard/server/lib/telemetry.js:13-35.; API PASS: legacy single-session GET returns {events:[...]}; repeated session params return union. Paths: dashboard/server/app.test.js:89-95, dashboard/server/routes/telemetry.js:22-26.; UI PASS: App uses one multi-session request, effect deps exclude liveTick, initial and 5-second polling remain; Activity still gets liveTick. Path: dashboard/web/src/App.jsx:51-77,92-94.; Payload/cache aggregation PASS: summary/history tests at dashboard/server/lib/telemetry.test.js:62-149.; Bundle PASS: npm run check-cli says canonical sources match.; Focused node --test dashboard/server/lib/telemetry.test.js dashboard/server/app.test.js: 34 passed, 0 failed; npm test: 443 passed, 0 failed (one WebSocket port-in-use warning, exit 0); npm run build, npm run check-cli, npm run specs:validate, git diff --check all passed; guarana specs validate . --json: ok true, 160 files, 0 issues.; No live service restart. The intermediate verification failure is superseded by the independent overall PASS.
Change: none
<!-- guarana:record:end -->
