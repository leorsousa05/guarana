# Feature spec: Dashboard Fieldstation visual identity

**Status: VALIDATED**

## Goal
Give the local Guarana dashboard a distinctive, modern visual identity following the selected Fieldstation Guarana direction while preserving existing behavior and contracts.

## Requirements
- Use the selected Fieldstation Guarana direction without copying reference UI: a deep canopy-green desktop side rail with Guarana identity and all eight route destinations, a mineral/cool light workspace, seed-red active/focus accent, and stronger operational hierarchy separating navigation, project/status header, and page content.
- At mobile width, use horizontally navigable navigation while retaining all eight named destinations.
- Preserve light and dark appearance modes, all existing behavior, the eight routes and labels, hash deep links, saved-start-page behavior, active aria-current state, existing page content, visible keyboard focus, and reduced-motion behavior.
- Make no API, payload, schema, route, settings, project-security, telemetry, external/core dependency, or deployment contract changes.

## Assumptions and scope
- The selected design is Fieldstation Guarana; exact colors and other reversible styling details are implementation discretion, and no questions remain.
- The existing UI uses React/Vite; the shared shell is in dashboard/web/src/App.jsx, dashboard/web/src/components/Header.jsx, and dashboard/web/src/components/Sidebar.jsx; styles are in dashboard/web/src/style.css; shell assertions are in dashboard/web/src/components/Sidebar.test.mjs.
- Implementation budgets follow ADR-005 defaults: main thread at most 8k steady-state tokens; worker-code 8k, worker-verify 4k, worker-debug 6k per dispatch; per-run hard cap 32k tokens and 15 minutes.
- One visual-identity slice across the shared shell and styles, with corresponding shell assertions only.
- Implementation source candidates: dashboard/web/src/App.jsx, dashboard/web/src/components/Header.jsx, dashboard/web/src/components/Sidebar.jsx, dashboard/web/src/components/Sidebar.test.mjs, and dashboard/web/src/style.css.
- Do not include CLI-generated bundle paths in feature ownership; the primary builds and synchronizes them.
- Preserve all historical dashboard records, the validated 2026-11-24 dashboard reintroduction record, and the historical 2026-11-05 removal record.
- No API/backend or screen-behavior refactor, data mutation, release, commit, or push.

## Acceptance criteria
1. At 1440x900 the shell renders a distinct dark-green vertical brand/navigation rail and a light mineral workspace with seed-red active/focus accent; navigation, project/status header, and page content are visibly distinguished.
2. All eight existing labels and routes remain in navigation; existing hash deep-link and saved-start-page behavior, active aria-current state, and page content remain unchanged.
3. At 375x812 the sidebar is horizontally navigable, all eight named links are reachable by touch and keyboard, and no page-level horizontal overflow is introduced.
4. Light and dark appearance settings remain legible; keyboard focus is visible and reduced-motion behavior remains present.
5. No API/payload/schema, route, settings, project-security, telemetry, or dependency contract changes occur. Focused shell tests and full independent browser checks distinguish the approved design from a CSS-only color swap by checking shell geometry, brand/rail/workspace separation, active navigation, mobile reachability, all eight routes, light/dark appearance, and zero overflow.

<!-- guarana:record:start -->
Status: VALIDATED
Proof: Fresh native worker-verify returned overall PASS on all five feature criteria; exact report: /tmp/opencode/dashboard-fieldstation-visual-identity-verify.json.; Firefox 157.0.1, geckodriver 0.37.1, Linux/headless; synthetic in-memory APIs on loopback only; built CLI JS/CSS served byte-identically; external font links prevented; no real project/Global data or external services accessed.; All eight routes exercised at 1440x900 and 375x812. Firefox headless top-level viewport minimum is 500px, so the 375x812 mobile proof used a same-origin iframe with directly measured CSS viewport; actual frame screenshot is 375x812. Screenshots: /tmp/opencode/dashboard-fieldstation-1440x900.png and /tmp/opencode/dashboard-fieldstation-375x812.png.; All mobile named links reachable by native Tab/Enter and touch; no page overflow; exactly one active aria route. Hash deep links override synthetic saved start page; saved Settings loads without a hash. Populated Runs and Specs Documents tab work. Light/dark contrast and 2px focus pass; reduced-motion scroll behavior is auto; 84 local API requests, no runtime/console errors, no missing assets.; node --test dashboard/web/src/components/Sidebar.test.mjs PASS; node --test dashboard/web/src/components/Settings.test.mjs PASS 12/12; npm test PASS 854/854. The earlier first-suite failure was a corrected stale test expectation, not product behavior.; npm run build PASS (Vite 6.4.4, 59 modules) with canonical dashboard assets synchronized to CLI; npm run check-cli PASS; candidate pre-record npm run specs:validate PASS (267 Markdown, 106 features, 48 ADRs, 303 links, 0 issues); git diff --check emitted no issues and source/test trailing-whitespace scan passed. Full suite had only nonfatal existing Vite port-in-use and Node MODULE_TYPELESS_PACKAGE_JSON warnings.
Change: .specs/changes/2026-11-25-dashboard-fieldstation-visual-identity.md
<!-- guarana:record:end -->
