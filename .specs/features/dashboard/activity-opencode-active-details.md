# Feature spec: Dashboard Activity OpenCode active worker details

**Status: VALIDATED**

## Goal
Expand Dashboard Activity so OpenCode-reported active subagents appear as selectable worker rows with safe session details, not only an aggregate count.

## Requirements
- Extend the existing same-origin OpenCode projection additively with a bounded list of currently active parent-linked worker rows alongside the existing availability and count fields.
- Include only distinct explicitly parent-linked sessions whose active-map state is observed busy or running and whose agent identity passes a conservative allowlist.
- Project only allowlisted agent identity, observed busy/running status, valid created/updated timestamps, an opaque stable selection key, and a bounded safe activity summary/timeline from matching existing telemetry events when available; event category, status, and tool name must follow existing safe allowlists.
- Keep any session-ID correlation internal and in memory only. Never return, persist, or log raw OpenCode session IDs, parent IDs, titles, prompts, messages, outputs, hidden reasoning, event payloads, credentials, raw errors, or unsanitized CLI data. Malformed or unavailable responses fail closed and remain privacy-safe.
- Render OpenCode active worker identity, state, and timing in Activity. Keyboard-operable selection opens the selected worker detail panel with safe metadata and allowlisted observed telemetry activity, or an explicit safe empty state when no matching activity is observed. Keep selection stable across polling where feasible; do not fabricate events or infer activity, status, or timestamps.
- Preserve the valid OpenCode count as authoritative including zero, telemetry count fallback when OpenCode is unavailable or invalid, the existing telemetry tree/details and completed history, Advisor behavior, unrelated APIs, ledger style, focus/accessibility, and no horizontal overflow at 375px.
- Use ADR-005 default budgets: main thread at most 8k steady-state tokens; worker-code 8k, worker-verify 4k, and worker-debug 6k tokens per dispatch; per-run hard cap 32k tokens and 15 minutes.

## Assumptions and scope
- The bounded public-projection inspection observed numeric session time.created/time.updated, parent-linked sessions with agent identity, and active-map state running; raw identifiers, titles, prompts, and API payloads were not persisted or returned.
- Existing matching telemetry events are the sole source for activity summaries/timelines; absence of matching observed activity must remain an explicit empty state.
- Additive server projection in the existing Dashboard same-origin OpenCode route and selectable active-worker rows/details in Activity.
- Focused route/UI tests, root npm test, Dashboard build and CLI sync, npm run check-cli, specs validation, and 375px browser/accessibility/keyboard proof.
- No plugin/profile/install/reload/restart work, raw capture, task titles/prompts, or unrelated UI work. This follow-up is not a deployment or shipping claim; create no dated Changes entry before validation.

## Acceptance criteria
1. The server list/detail projector includes only distinct explicitly parent-linked agent sessions whose matching active-map state is busy/running. Each row contains only allowlisted agent identity, observed busy/running state, valid created/updated timestamps, an opaque stable selection key, and a bounded safe summary/timeline derived only from matching allowlisted telemetry when present. Raw identifiers are not returned, persisted, or logged; private payload fields are excluded; malformed/unavailable responses fail closed and privacy-safe.
2. The same-origin endpoint preserves the existing availability and runningCount fields and count contract, including authoritative valid zero and unavailable/invalid fallback behavior, and adds only the safe bounded worker projection. Existing unrelated API contracts remain unchanged.
3. Activity renders OpenCode worker identity, observed status, and timing; keyboard selection opens the correct worker detail; the detail shows only allowlisted observed telemetry activity when available and a truthful safe empty state otherwise. No fabricated rows/events/statuses, inferred status/timestamps, task title, prompt, output, or reasoning appears.
4. Existing telemetry tree/details, completed history, count fallback, and Advisor behavior remain intact, and the new projection exposes no raw OpenCode session IDs.
5. Focused route/UI tests, root npm test, Dashboard build and CLI sync, npm run check-cli, specs validation, and 375px browser/accessibility/keyboard proof pass. No deployment or shipping is claimed.

<!-- guarana:record:start -->
Status: VALIDATED
Proof: Fresh final independent worker-verify overall PASS for criteria 1–5, including both completed-history browser scenarios.; node --test dashboard/server/routes/opencode.test.js dashboard/web/src/components/Activity.test.mjs PASS 17/17; npm test PASS 619/619 with nonfatal Vite WebSocket port-in-use and Node module-type warnings.; npm run build PASS with Dashboard bundle built and CLI synced; npm run check-cli PASS and independently rerun; git diff --check PASS.; Browser report `guarana-activity-opencode-active-details-375.json`, mode 0600 and aggregate-only synthetic-fixture evidence, PASS at 375x812: two active worker rows, keyboard selection and visible focus, safe activity rows and honest empty state, opaque keys/allowlisted API fields without raw IDs/private sentinels, no horizontal overflow or page errors. This report was temporary local synthetic-fixture evidence and is not included in the repository.; Browser proof also confirms completed detail opens with no active child and zero count, and at authoritative zero while stale active detail is suppressed before click; events and zero notice remain visible with no private payload, overflow, or page errors.; Pre-record npm run specs:validate PASS: 213 Markdown, 82 feature specs, 39 ADRs, 241 links, 0 issues.; Post-record npm run specs:validate PASS after all record writes: 214 Markdown files, 82 feature specs, 39 ADRs, 242 local links, 0 issues; git diff --check PASS.
Change: .specs/changes/2026-10-24-dashboard-activity-opencode-active-details.md
<!-- guarana:record:end -->
