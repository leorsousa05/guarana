# Change — Dashboard live Activity view

**Status:** VALIDATED · 2026-10-08

Reworked the existing `#/now` destination into an Activity view that lets users
watch the current root session, Advisor calls, workflow flow and injected memory
without switching between dashboard sections. The visible navigation label is
Activity; the existing hash stays valid.

## Implementation

- `dashboard/web/src/components/Activity.jsx` — selects the latest root session,
  shows observed current/session status, workflow/task/counts, Advisor state,
  recent safe events, and memory injected into that root session.
- `dashboard/web/src/components/AdvisorHistoryModal.jsx` — accessible history
  modal with sanitized runtime metadata, Escape/backdrop close, focus containment
  and restoration.
- `plugin/guarana-telemetry.js` and `dashboard/server/lib/telemetry.js` — record
  busy/retry session status, safe session parent/agent metadata, Advisor Task
  dispatch lifecycle, and root/child summary metadata.
- `dashboard/server/routes/telemetry.js` — bounded sanitized Advisor history API.
- `dashboard/web/src/App.jsx`, `Sidebar.jsx`, `MemoryInjections.jsx`, and
  `dashboard/web/src/style.css` — live view wiring, Activity label, root-session
  memory filter, square ledger panels and responsive stacking.
- Models is configuration-only; the runtime block was moved into Activity.
- Decision and acceptance: [ADR-028](../decisions/ADR-028-live-activity-and-advisor-history.md),
  [dashboard Activity criteria 77–83](../features/dashboard/dashboard.md#addendum-2026-10-08-live-activity-view-and-advisor-history).

## Independent evidence

- Worker-verify `ses_ee1646f18ffe9eLPHP4MpHYGNx` passed rendered checks at 375×812:
  Activity nav/hash, root selected over newer child, observed busy/session state,
  workflow and task, root memory shown while child-only memory is excluded, raw
  error content not displayed, modal safe history, Escape/backdrop close and focus
  restoration, and no horizontal overflow.
- Screenshot: `/tmp/opencode/activity-view-375.png`.
- Fixture-backed browser run; no live provider inference. Activity reflects actual
  project telemetry and says latest/last seen when active/busy status is absent.

## Validation

- Focused telemetry/server/Activity/Models tests — PASS (37/37).
- `npm test` — PASS (264/264).
- `rtk npm run build` — PASS; dashboard built and CLI mirrors synchronized.
- `rtk npm run check-cli` — PASS; CLI bundle matches canonical sources.
- `rtk npm run specs:validate` — PASS (125 Markdown files, 18 feature specs,
  28 ADRs, 199 local links).
- `rtk git diff --check` — PASS.
