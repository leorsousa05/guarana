# ADR-029 — Show the reason for Advisor consultation

**Status:** Accepted (2026-10-08) · append-only

## Context

The Activity Advisor work area and history show status/model metadata, but do not
answer why the Primary chose to call the Advisor. Task telemetry already receives
the native OpenCode Task `description` (short, intended to be 3–5 words), separate
from its detailed prompt.

## Decision

1. Treat the Task `description` as the concise human-readable consultation reason.
   It should explain why Advisor help is needed now, not repeat the overall task
   title (e.g. “Repeated verification failure”).
2. Capture only that description on Advisor dispatch/history records. Never store
   the Task prompt or output to explain the reason.
3. Bound and screen the reason for secret-shaped values. If absent or unsafe, omit
   it and display “Reason not recorded”; do not invent a reason from status or
   model settings.
4. Display the reason prominently in the Advisor Activity area and for each row in
   the Advisor history modal.

## Alternatives considered

- Display only status such as `completed` or `running` — rejected because it does
  not explain the consultation trigger.
- Persist the full Task prompt — rejected due to unnecessary prompt/context
  storage; the short description is sufficient for the requested rationale.
- Generate a synthetic explanation from provider/model/error metadata — rejected
  because it could misstate why the Primary dispatched the Advisor.

## Consequences

- The generated Primary profile must tell the model to put the reason in Task's
  description field.
- Telemetry, history API, Activity panel, and modal carry one safe optional
  `reason` string; missing/unsafe values have an explicit UI state.
- Tests cover extraction, redaction/omission, and display in both current Activity
  and history.
