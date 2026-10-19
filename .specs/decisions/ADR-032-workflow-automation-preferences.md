# ADR-032 — Workflow automation preferences

**Status:** Accepted (2026-10-19) · append-only

## Context

Guarana automatically bootstraps and updates human-readable task records and
dispatches `worker-specs`, and automatically dispatches independent
verification. Users need persistent global defaults with project overrides,
while an unset configuration must preserve current behavior. Skipping
verification must remain distinct from a successful verification result.

## Decision

1. Store workflow preferences separately from Advisor settings: global
   `$XDG_CONFIG_HOME/guarana/workflow.json` (falling back to
   `~/.config/guarana/workflow.json` when `XDG_CONFIG_HOME` is unset) and
   project `.guarana/workflow.json`. Both settings default to enabled. Project
   fields override global fields independently; unset fields inherit, and
   clearing a project field restores inheritance. Do not extend or mutate
   `advisor.json` for these settings.
2. Treat human-readable task-spec automation and `worker-specs` dispatch as one
   preference. When disabled, suppress automatic task-record bootstrap,
   creation, and updates and automatic `worker-specs` dispatch. Keep
   `.specs/state/workflow.json` operational and preserve existing human-readable
   `.specs` records. An explicit user request for specs work may override the
   preference for that task.
3. Keep independent verification enabled by default. When disabled, skip the
   automatic `worker-verify` dispatch and record a distinct `verify_skip`
   workflow event from `coding` or `verifying` to `completed`. Never represent
   this event as verifier PASS or claim `VALIDATED` without independent proof.
   The primary may run proportionate checks. An explicit request, including a
   forced `guarana:verify`, may override the preference for that task without
   changing saved preferences.

## Alternatives considered

- Extend `advisor.json` with workflow fields — rejected; workflow preferences
  have a dedicated configuration contract and dedicated JSON files.
- Record a verification skip as `verify_pass` — rejected because a skipped
  verifier is not a successful verifier.
- Add a new workflow state for skipped verification — rejected; a distinct
  `verify_skip` event records the outcome in existing workflow history and
  completes from the existing `coding` or `verifying` states.

## Consequences

- Missing settings preserve current automatic specs and independent-verification
  behavior.
- Changing preferences does not delete or rewrite existing human-readable
  `.specs` records, and does not disable the operational workflow-state file.
- A skipped automatic verification is observable without asserting independent
  proof or changing persisted user preferences when an explicit override is
  used.
