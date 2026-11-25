# Dashboard Fieldstation visual identity

**Date:** 2026-11-25
**Status:** VALIDATED, not SHIPPED.

## Scope

This receipt validates only the bounded Fieldstation visual-identity slice in
`.specs/features/dashboard/fieldstation-visual-identity.md`. The desktop side
rail uses an inline SVG brand mark and CSS-numbered route markers; responsive
mobile navigation is named and horizontally scrollable. The separately
validated Dashboard reintroduction remains VALIDATED, not SHIPPED. The
2026-11-05 Dashboard removal remains historical.

Candidate: `/home/arch/Projects/active/guarana`, branch `main`, HEAD
`469da6bcce9464263056afdd2439f1b101cf74d6`; dirty and uncommitted. No commit,
push, release, deployment, or publication occurred. Shipping remains separate.

## Changed paths

Feature-attributed source and test paths:

- `dashboard/web/src/components/Header.jsx`
- `dashboard/web/src/components/Sidebar.jsx`
- `dashboard/web/src/components/Sidebar.test.mjs`
- `dashboard/web/src/components/Settings.test.mjs`
- `dashboard/web/src/style.css`

Generated bundle paths from the final build and CLI sync:

- `dashboard/web/dist/index.html`
- `dashboard/web/dist/assets/index-CtKp7ZEv.js`
- `dashboard/web/dist/assets/index-dPfKVJKn.css`
- `cli/dashboard/web/dist/index.html`
- `cli/dashboard/web/dist/assets/index-CtKp7ZEv.js`
- `cli/dashboard/web/dist/assets/index-dPfKVJKn.css`

No API, payload, route, settings, project-security, telemetry, or dependency
changes occurred; no source behavior edits were made.

## Primary gates

- `node --test dashboard/web/src/components/Sidebar.test.mjs` — PASS.
- `node --test dashboard/web/src/components/Settings.test.mjs` — PASS, 12/12.
- `npm test` — PASS, 854/854. The earlier first-suite failure was a stale test
  expectation, corrected before the complete final suite; it was not product
  behavior. Nonfatal existing Vite port-in-use and Node
  `MODULE_TYPELESS_PACKAGE_JSON` warnings occurred.
- `npm run build` — PASS (Vite 6.4.4, 59 modules); canonical dashboard assets
  were synchronized to the CLI bundle.
- `npm run check-cli` — PASS.
- Candidate pre-record `npm run specs:validate` — PASS (267 Markdown files,
  106 features, 48 ADRs, 303 links, 0 issues).
- `git diff --check` — no issues; source/test trailing-whitespace scan passed.

## Independent verification

Fresh native `worker-verify` returned overall PASS on all five feature criteria.
The exact report is `/tmp/opencode/dashboard-fieldstation-visual-identity-verify.json`.
Firefox 157.0.1, geckodriver 0.37.1, Linux/headless were used. Browser checks
used synthetic in-memory APIs on loopback only; built CLI JS/CSS were served
byte-identically, external font links were prevented, and no real project or
Global data or external services were accessed.

All eight routes were exercised at 1440×900 and 375×812. Firefox headless has
a 500px minimum top-level viewport; the 375×812 mobile proof therefore used a
same-origin iframe and directly measured its CSS viewport. The actual frame
screenshot is 375×812. Screenshots:

- `/tmp/opencode/dashboard-fieldstation-1440x900.png`
- `/tmp/opencode/dashboard-fieldstation-375x812.png`

All mobile named links were reachable with native Tab/Enter and touch, with no
page overflow and exactly one active `aria` route. Hash deep links overrode the
synthetic saved start page, and saved Settings loaded without a hash. Populated
Runs and Specs Documents tab interactions passed. Light/dark contrast and 2px
focus passed; reduced-motion scroll behavior was `auto`. The browser observed
84 local API requests, no runtime or console errors, and no missing assets.

No known issue is warranted: the only first-suite failure was the corrected
stale test expectation, and the complete final suite and independent browser
verification passed.
