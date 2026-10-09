# Change — Activity root-session selection

**Status:** VALIDATED · 2026-10-08

Fixed an Activity mismatch where Advisor history contained a call for the current
root session but the Advisor work area showed “not called.” The run summary sorts
by session start; newer helper sessions with missing parent IDs could appear before
the long-lived, busy root.

## Implementation

- `dashboard/web/src/components/Activity.jsx` — root selection now excludes child
  sessions, prefers an observed busy/running root, then selects the root with the
  greatest last-activity/end timestamp. Advisor status/history is matched against
  the selected root's `parentSessionID`.
- `dashboard/web/src/components/Activity.test.mjs` — regressions for an older-start
  busy root behind newer-start idle helpers, last-end fallback, and unrelated
  Advisor history from another root.

## Evidence

- Focused test: `node --test dashboard/web/src/components/Activity.test.mjs` — PASS
  (2/2).
- Independent worker-verify `ses_ee14cc5aaffexxrn2km3Um7Tuf` — PASS at 375×812:
  the fixture placed newer helpers and an Advisor child before the busy root;
  Activity selected the busy root and showed its correctly parent-linked Advisor
  call/model. Root-only memory and recent events were shown; child-only items were
  excluded. History modal Escape/backdrop close and focus restoration passed.
- Screenshot: `/tmp/opencode/activity-root-fix-375.png`.
- This fixture reproduced the reported hierarchy: main root had older start but
  observed `busy`; two parentless helper roots had newer starts and `idle`; the
  Advisor child also appeared before the root. Activity selected the busy root
  and matched the Advisor history row to its parent ID.
- `npm test` — PASS (264/264).
- `rtk npm run build` — PASS; dashboard built and CLI mirrors synchronized.
- `rtk npm run check-cli` — PASS; CLI bundle matches canonical sources.
- `rtk npm run specs:validate` — PASS (126 Markdown files, 18 feature specs,
  28 ADRs, 202 local links).
- `rtk git diff --check` — PASS.
