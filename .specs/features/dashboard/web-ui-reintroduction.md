# Feature spec: Guarana local web dashboard reintroduction

**Status: SHIPPED**

## Goal
Record the accepted scope to reintroduce and modernize Guarana's historical web dashboard as a complete local-only UI, without implementing or editing source code in this handoff.

## Requirements
- Rebuild the historical Dashboard feature set for current Guarana 1.5.3 APIs and contracts, rather than exposing every CLI command as a generic web shell.
- Provide the eight product routes Overview, Activity, Runs, Specs, Workflow, Memory, Skills, and Settings. Specs includes curated documents and decision review. Settings consolidates Primary and Advisor model controls, scoped workflow preferences including memory.autoInject and preferenceInjectionBudgetTokens, and dashboard appearance, refresh, and server settings.
- Bind project switching and registration to ADR-041: server-side allowlisted project roots, opaque project IDs and safe names in the browser, no browser-provided filesystem paths, project switching across the approved project-scoped dashboard surfaces, and no change to global settings or global Memory.
- Follow ADR-033: keep web, workflow, and Advisor settings in their independent existing files and formats; preserve project-over-global field resolution, effective-source display, validated atomic writes, and deep-link precedence; do not migrate or overwrite existing settings formats.
- Keep serving loopback-only. Exclude LAN or remote exposure, an authentication system, arbitrary filesystem paths, a shell or CLI-command runner, and web controls for administrative or destructive CLI subcommands such as install, uninstall, and plugin operations. Existing dashboard-specific safe/write interactions retain their prior contracts.
- Preserve or update historical dashboard interactions and data displays using their prior feature records as the function inventory. The new reintroduction record is authoritative for this scope; preserve the archived removal history, the validated historical dashboard archive, and historical receipts.
- Prevent recurrence of the documented refresh incident: telemetry access is bounded or incremental, refresh does not create duplicated or unbounded request fan-out, and a large telemetry JSONL is not fully reparsed for every poll or SSE tick. Add focused regression tests for this behavior.
- Cover responsive layout and accessibility at small and desktop viewports, including keyboard operation, visible focus, and error, loading, and empty states.
- Cover server/API security, project scope, settings save and clear/inheritance, and dashboard pages with tests. Build, bundled CLI synchronization/check, npm tests, package inventory, Specs validation, and diff-check must pass. Add no core runtime dependency; dev-only build dependencies may be considered.
- Follow ADR-005 default budgets unless separately overridden: main thread at most 8k steady-state tokens; worker-code 8k, worker-verify 4k, and worker-debug 6k per dispatch; per-run hard cap 32k tokens and 15 minutes.

## Assumptions and scope
- The historical .specs/features/dashboard/dashboard.md and .specs/features/dashboard/settings-page.md records provide the dashboard and Settings function inventory; ADR-033 and ADR-041 provide accepted configuration and project-root constraints.
- The historical 28,347,021-byte telemetry refresh incident's prevention requirement is satisfied: focused regression coverage exercises the large fixture, cache reuse, append/rewrite recovery, and single-flight behavior; independent browser-capable verification passed the telemetry criterion with bounded telemetry and no SSE request. No real project/global data or external service was accessed.
- Loopback-only operation is an exposure boundary, not an authentication system.
- Reintroduce the Guarana web launcher, local server/API, and modernized UI for Overview, Activity, Runs, Specs, Workflow, Memory, Skills, and Settings.
- Implement project registration and switching under ADR-041 and preserve the existing independent settings contracts under ADR-033.
- Preserve dashboard-specific interactions and current data meanings from the historical Dashboard and Settings specs while updating to current Guarana APIs.
- Add focused regression coverage for bounded/incremental telemetry and refresh fan-out, security, settings, project scope, page behavior, responsive layout, and accessibility.
- This handoff records accepted scope only; it makes no implementation/source edits, release, commit, or push.

## Acceptance criteria
1. guarana web launches a complete usable UI on loopback only with Overview, Activity, Runs, Specs, Workflow, Memory, Skills, and Settings. Project switching uses server-side allowlisted roots. Settings includes the specified model controls and scoped workflow, web appearance, refresh, and server settings while preserving each independent file contract, inheritance behavior, source display, atomic validation, and deep-link precedence.
2. Historical dashboard page interactions and data displays are preserved or updated from the prior Dashboard and Settings specs for current Guarana APIs. Specs retains curated documents and decision review. The UI exposes no all-CLI command executor, browser-selected arbitrary path, LAN/remote endpoint, authentication system, or administrative/destructive CLI controls.
3. Telemetry access is bounded or incremental, refresh avoids duplicated or unbounded fetch fan-out, and a large log is not fully reparsed per poll or SSE tick. Focused regression tests cover the historical 28,347,021-byte telemetry-log incident class and the old refresh-triggered request-fan-out failure mode.
4. Responsive and accessibility checks cover small and desktop viewports, keyboard operation, visible focus, and error, loading, and empty states.
5. Tests cover server/API security, project scope, settings save and clear/inheritance, and dashboard pages. Build, bundled CLI synchronization/check, npm tests, package inventory, Specs validation, and diff-check pass, with no new core runtime dependency.
6. Independent browser-capable verification covers all eight routes, representative writes and Settings interactions, and the performance regression scenario; the feature is VALIDATED, not SHIPPED. No commit, push, or release is claimed; any such action requires separate authorization.

<!-- guarana:record:start -->
Status: SHIPPED
Proof: The existing feature proof records fresh independent worker-verify overall PASS for criteria 1–6, including all eight routes, browser behavior, project/settings boundaries, security, telemetry, and required gates.; Fresh independent worker-verify on exact candidate returned overall PASS (6/6), confirming Dashboard API/security and canonical/CLI mirrors among the reviewed areas.; npm test PASS (878/878); npm run build PASS (Vite 6.4.4 and CLI bundle sync); npm run check-cli PASS; npm run specs:validate -- --json PASS (276 scanned, 111 features, 51 ADRs, 307 links, 0 issues); git diff --check PASS.; Source commit ed4fabfe220028756dc71d779814d5201efdede7 was pushed normally (1d59f50..ed4fabf main -> main); git ls-remote origin refs/heads/main exactly matched the commit and the worktree was clean.; GitHub Actions Pages run 45874540342 completed successfully for push SHA ed4fabfe220028756dc71d779814d5201efdede7; this is not a claim that the local Dashboard was deployed as a live site.; This is source shipment only. Package version bump, tag, npm publication, GitHub Release, and formal package release were not performed.
Change: none
<!-- guarana:record:end -->
