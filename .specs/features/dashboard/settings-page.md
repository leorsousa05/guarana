# Feature spec: Unified dashboard Settings page

**Status: SHIPPED**

## Goal
Create one dashboard Settings page for existing Models and workflow preferences plus new dashboard web settings, while preserving the distinct Advisor, workflow, and web configuration contracts.

## Requirements
- Consolidate the existing Primary and Advisor Models UI, workflow preferences, and new dashboard web settings in Settings. Remove the separate Models navigation item. Workflow becomes a state monitor only; move Specs and worker-specs plus independent-verification controls from Workflow into Settings.
- Preserve Advisor and Models behavior and separate advisor.json storage. The current Models UI remains project-only for editing and continues to display global inheritance and sources. Do not change global Advisor profile installation.
- Preserve workflow preferences in separate workflow.json storage. Settings allows Global and Project editing with project-over-global per-field resolution, visible sources, and clear-to-inherit.
- Store web preferences in separate web.json files: global $XDG_CONFIG_HOME/guarana/web.json with ~/.config fallback, and project .guarana/web.json. Resolve project over global, display each source, and do not migrate existing files.
- Web fields and defaults are appearance.theme light (allowed values light or dark), appearance.startPage overview, refresh.intervalSeconds 5 (allowed choices 5, 15, or 30 seconds), server.port 4200 (integer 1 through 65535), and server.open true. Project partials inherit missing fields from global and built-in defaults.
- Theme and refresh changes apply immediately. Startup page applies on the next load only when there is no explicit URL hash; a deep link wins. Port and auto-open apply on the next guarana web invocation. Live data endpoints use the selected refresh period; existing slower settings/config endpoints remain at 15 seconds.
- guarana web reads effective web.json from the current working directory and global configuration. Per-run --port, --open, and --no-open override saved preferences. Invalid simultaneous --open and --no-open is rejected. Preserve existing unknown-argument behavior unless a focused test requires otherwise.
- Global and Project scope selectors are provided for workflow and web preferences; Global edits are clearly labeled and editors default to Project. The new web API derives paths only from server root and environment, strictly validates partial JSON and scope, writes only the selected scope atomically, and rejects malformed or invalid settings without destructive overwrite.
- Settings uses the established ledger palette, typography, and rule-separated surfaces; sections are compact and left-aligned without a generic card grid. At 375px controls remain responsive, have accessible names, and support keyboard operation with visible focus.
- No new product runtime dependencies are introduced. Canonical and bundled routes and distribution assets remain synchronized.

## Assumptions and scope
- The reversible internal web settings shape is { appearance: { theme, startPage }, refresh: { intervalSeconds }, server: { port, open } }; there is no external consumer yet.
- Simultaneous --open and --no-open is rejected.
- Startup selection may include all navigable dashboard pages, including Settings. An explicit URL hash takes precedence.
- Dashboard navigation and Settings UI; workflow and web settings APIs and storage; guarana web configuration and flag precedence; focused API, CLI, and UI tests.
- Preserve independent advisor.json, workflow.json, and web.json storage; no configuration migration, global Advisor installation changes, or runtime dependency additions.
- Validate canonical and bundled routes and dist assets, focused and root tests, build, pack smoke, check-cli, diff, and specs validation before overall verification.
- Use ADR-005 budgets: main thread at most 8k steady-state tokens; worker-code 8k, worker-verify 4k, and worker-debug 6k per dispatch; per-run hard cap 32k tokens and 15 minutes.
- No release, push, or commit is requested.

## Acceptance criteria
1. Settings navigation and page combine Models, workflow preference, and web settings controls; the separate Models navigation item is absent; Workflow contains state monitoring only and no Specs/worker-specs or independent-verification controls.
2. Models preserves Primary and Advisor behavior and advisor.json isolation; current Models editing remains project-only and global inheritance/source display remains available; global Advisor profile installation is unchanged.
3. Workflow preferences remain in workflow.json and are editable at Global or Project scope from Settings; effective sources are visible, project values override global values per field, and clearing a project value restores inheritance.
4. Web settings use the stated separate global and project web.json paths, defaults, allowed values, and project-over-global inheritance; UI reports the effective source and edits only the selected scope.
5. The web settings API strictly validates partial JSON and scope, derives paths only from server root/environment, atomically writes the selected scope, and leaves existing bytes unchanged for malformed or invalid input.
6. guarana web reads effective settings from cwd and global configuration; explicit --port, --open, and --no-open take precedence; simultaneous --open and --no-open is rejected; existing unknown-argument behavior is retained unless a focused test requires a change.
7. Theme and refresh apply immediately; the saved startup page applies on next load only without an explicit hash; explicit deep links win; live data polling uses the selected interval and slower settings/config polling remains 15 seconds; saved port/open apply on the next invocation.
8. Settings uses compact left-aligned ledger sections rather than a generic card grid; at 375px, accessible names, keyboard operation, visible focus, and responsive layout are verified.
9. API, CLI, and core tests cover defaults, inheritance, rejection, and no-write behavior; canonical/bundled routes and dist match; focused tests, root tests, build, pack smoke, check-cli, diff, and specs validation pass with no new runtime dependency.
10. Overall status remains TASKED until an independent browser-capable verifier renders Settings at 375px and exercises actual save and clear/inheritance interactions, followed by separate full verification; SSR/API/CSS-source checks do not replace this proof. No test-only browser tooling is added without separate user approval.

<!-- guarana:record:start -->
Status: SHIPPED
Proof: The existing feature proof records independent browser verification PASS (22/22 steps) for responsive Settings, accessibility, Global and Project saves/reloads, effective sources, clearing to inheritance, and startup behavior.; Fresh independent worker-verify on exact candidate returned overall PASS (6/6), reviewing Dashboard API/security, Settings/model catalog areas, canonical/CLI mirrors, and bundle parity.; npm test PASS (878/878); npm run build PASS (Vite 6.4.4 and CLI bundle sync); npm run check-cli PASS; npm run specs:validate -- --json PASS (276 scanned, 111 features, 51 ADRs, 307 links, 0 issues); git diff --check PASS.; Source commit ed4fabfe220028756dc71d779814d5201efdede7 was pushed normally (1d59f50..ed4fabf main -> main); git ls-remote origin refs/heads/main exactly matched the commit and the worktree was clean.; This is source shipment only. Package version bump, tag, npm publication, GitHub Release, and formal package release were not performed; no live model call occurred.
Change: none
<!-- guarana:record:end -->
