# Feature spec: Dashboard telemetry refresh performance refactor

**Status: SHIPPED**

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
Status: SHIPPED
Proof: Commit 4b7a9a6c2814dffd18cbafe28d4af795617257a5 was pushed successfully to origin/main.; git rev-parse HEAD and origin/main both equal 4b7a9a6c2814dffd18cbafe28d4af795617257a5.; The 23-path commit includes the validated proactive Advisor guidance and telemetry refresh refactor plus stale managed-profile hash reconciliation.; Human explicitly authorized commit/push.
Change: none
<!-- guarana:record:end -->
