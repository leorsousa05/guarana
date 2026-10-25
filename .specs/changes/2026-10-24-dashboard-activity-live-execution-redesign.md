# Change — Dashboard Activity live-execution redesign

**Status: VALIDATED — fresh independent worker-verify overall PASS for criteria 1–5; not SHIPPED.**

## Outcome

Activity now has a clearer live-execution-first visual hierarchy, a unified responsive roster/detail timeline workbench, restrained summary totals, and lower-priority Workflow, Advisor, and RecentActivity signals, using existing light/dark ledger design tokens.

Completed terminal telemetry child sessions are absent from default markup and available through a count-labelled button and modal. The modal lists only the existing 20 newest observed rows with safe existing fields and an overflow notice. Selecting a row closes the modal and opens that exact existing terminal detail. Focus entry, Tab/Shift+Tab containment, Escape/backdrop/close dismissal, and trigger-focus restoration are covered. No backend/API/schema change was made by this redesign. Earlier current-task worker active-detail route changes remain distinct and unrelated.

## Independent verification and checks

- Fresh independent `worker-verify` returned overall PASS for criteria 1–5: visual hierarchy/tokens; completed history absent from default DOM with bounded on-demand modal and exact selection; accessible focus/keyboard/dismissal/restoration and reduced-motion compatibility; existing activity/count/fallback/totals/Advisor/RecentActivity/privacy preservation; and gates/browser proof.
- `node --test dashboard/web/src/components/Activity.test.mjs` — PASS 13/13.
- `npm test` — PASS 619/619; nonfatal Vite WebSocket port-in-use and Node module-type warnings.
- `npm run build` — PASS; Dashboard bundle built and CLI synced. `npm run check-cli` — PASS. `git diff --check` — PASS.
- Pre-record `npm run specs:validate` — PASS: 215 Markdown files, 83 feature specs, 39 ADRs, 242 links, 0 issues.
- Independent verifier reran focused Activity tests (13/13), `npm run check-cli`, `npm run specs:validate` (215 Markdown, 83 features, 39 ADRs, 242 links, 0 issues), and `git diff --check`; all passed. It did not rerun full root `npm test` or build; those PASS results were supplied by the primary.
- Browser report `guarana-activity-live-execution-redesign.json` (mode 0600, aggregate-only synthetic-fixture evidence) — PASS at 1440px and 375px. It verifies hidden default history, modal focus/trap/dismissal/restoration, 20-row bound, keyboard selection and exact selected detail, no overflow/private fixture payload/page errors. Screenshots: `guarana-activity-live-1440.png`, `guarana-activity-live-375.png`, and `guarana-activity-history-modal-375.png`. These artifacts were temporary local synthetic-fixture evidence and are not included in the repository.
- Final post-record checks after all requested record writes: `npm run specs:validate` — PASS: 216 Markdown files, 83 feature specs, 39 ADRs, 243 local links, 0 issues; `git diff --check` — PASS; `npm run check-cli` — PASS.

## Boundary

Browser proof uses synthetic fixtures only. No live deployment, service restart, or shipping occurred. Pre-existing API/CLI edits from the prior active-worker task are not attributed to this screen-only redesign and remain untouched.
