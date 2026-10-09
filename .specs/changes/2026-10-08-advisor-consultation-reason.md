# Change — Show why the Advisor was consulted

**Status:** IMPLEMENTED · source/tests/UI pass; live reason event pending OpenCode reload

Activity now shows the human-readable reason for an Advisor call in both the
Advisor work area and each history entry. The native Task `description` is used
as the brief rationale; prompt/output content is not persisted.

## Implementation

- `cli/lib/advisor-profiles.js` — instructs the Primary to put the why-now reason
  in the native Task description (3–5 words), not the overall task title.
- `plugin/guarana-telemetry.js` — carries only a bounded description through the
  Advisor dispatch event and filters common secret-shaped content; it does not
  write the Task prompt, output, or raw error into the reason field.
- `dashboard/server/lib/telemetry.js` — re-sanitizes legacy history reasons and
  exposes only the allow-listed reason.
- `dashboard/web/src/components/Activity.jsx` and
  `AdvisorHistoryModal.jsx` — show “Why Advisor was called” or “Reason not
  recorded.”
- Decision: [ADR-029](../decisions/ADR-029-advisor-consultation-reason.md); acceptance:
  [dashboard criterion 84](../features/dashboard/dashboard.md#addendum-2026-10-08-live-activity-view-and-advisor-history).

## Verification

- Independent worker-verify `ses_edf332acfffensm5362id9anSa` passed profile
  guidance, Task-description capture, secret-shaped reason omission, history
  projection, Advisor card/modal rendering, and explicit missing-reason state.
- Focused independent tests — PASS (59/59); implementation focused tests — PASS
  (60/60).
- `npm test` — PASS (266/266).
- `rtk npm run build` — PASS; dashboard and CLI bundle synchronized.
- `rtk npm run check-cli` — PASS.
- `rtk npm run specs:validate` — PASS (128 Markdown files, 18 feature specs,
  29 ADRs, 206 local links).
- `rtk git diff --check` — PASS.

## Live smoke

- A native Advisor Task completed with observed `openai/gpt-6-sol` / `xhigh`,
  but no `reason` was recorded because the active project telemetry plugin was
  stale. `guarana plugin install --project` refreshed the plugin and Primary
  profile; the project status now reports them current.
- OpenCode loads local plugins at process startup; project plugin installation
  and reload are required after changing the plugin bundle.
- Test Task `ses_edf1b2176ffe0QFXvnLfob0RR6` returned `Advisor ativo.` with observed
  `openai/gpt-6-sol` / `xhigh`, but no reason field in its dispatch event. The
  project telemetry plugin and Primary profile were stale; `guarana plugin install
  --project` refreshed them.
- After reload, Task `ses_edf12824affeTImYKdFojUTX8x` returned `Advisor ativo.`.
  Event 67004 records `reason=Verificar captura do motivo`, parent
  `ses_ee39ce5c0ffeA5wDL8irBmzskV`, the matching child session/call ID, and the
  execution event records `openai/gpt-6-sol` / `xhigh`. Live reason capture PASS;
  no Task prompt/output was stored.
