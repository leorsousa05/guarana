# Feature spec: Dashboard Activity OpenCode running status

**Status: VALIDATED**

## Goal
Show the current running-subagent count in Dashboard Activity using the successful OpenCode public session projection, without broadening the Activity redesign.

## Requirements
- Add a same-origin Dashboard endpoint that invokes `opencode api get /api/session/active` and `opencode api get /api/session?limit=100&order=desc` from the Dashboard project root, without changing existing API response contracts.
- Count only distinct sessions with a nonempty explicit parentID, a nonempty agent identity, and matching active-map state busy or running.
- Return only availability and the aggregate running count; do not persist, log, or return session IDs, parent IDs, titles, prompts, event envelopes, raw output, or errors.
- In Activity, use the OpenCode count as authoritative whenever that query succeeds, including an authoritative zero; use the existing telemetry-derived count only when the OpenCode result is unavailable or invalid.
- When OpenCode reports active subagents but telemetry has no matching details, show an accurate safe notice instead of ‘No active subagents’; do not fabricate session rows or statuses.
- Preserve the existing telemetry tree, event detail, completed history, and APIs. Keep plugin/profile/install/reload/restart, raw event capture, and unrelated UI work out of scope.

## Assumptions and scope
- Reversible assumption: while the successful OpenCode public session projection is available and valid, its running-subagent count is authoritative; the telemetry-derived count is fallback only when the projection is unavailable or invalid.
- The additive same-origin Dashboard endpoint and server-side OpenCode session projector.
- The narrow Activity running-count source selection and safe notice when telemetry lacks details.
- Focused regression tests and the required root, build, CLI-sync, validator, narrow-layout, and accessibility checks.
- No broader Activity redesign, plugin/profile/install/reload/restart work, raw event capture, or unrelated UI work.

## Acceptance criteria
1. The server projector counts only distinct parent-linked agent sessions with nonempty explicit parentID and agent identity whose matching active-map state is busy or running; malformed or unavailable CLI responses produce an unavailable result without exposing raw data.
2. The new same-origin endpoint returns only availability and an aggregate running count, and existing API response contracts remain unchanged.
3. Activity uses the OpenCode count whenever the query succeeds, including zero, and falls back to the existing telemetry-derived count only for unavailable or invalid results; a positive OpenCode count is never rendered as ‘No active subagents’ even when telemetry has no matching details.
4. The existing telemetry tree, event detail, and completed history remain unchanged; no session rows or statuses are fabricated.
5. Focused tests, the root suite, Dashboard build and CLI sync, `npm run check-cli`, specs validation, and narrow-layout and accessibility proof pass.

<!-- guarana:record:start -->
Status: VALIDATED
Proof: Fresh independent worker-verify overall PASS for criteria 1–5; runtime integration returned only sanitized {available:true,runningCount:1} while its native Task was active.; node --test dashboard/server/routes/opencode.test.js dashboard/web/src/components/Activity.test.mjs PASS 13/13; npm test PASS 617/617; npm run build and npm run check-cli PASS; git diff --check PASS.; Browser report `guarana-activity-opencode-running-status-375.json` PASS at 375x812: accessible active notice, no fabricated rows, no overflow, and zero page errors. This report was temporary local synthetic-fixture evidence and is not included in the repository.; Pre-record npm run specs:validate PASS: 211 Markdown files, 81 features, 39 ADRs, 240 links, 0 issues.
Change: .specs/changes/2026-10-24-dashboard-activity-opencode-running-status.md
<!-- guarana:record:end -->
