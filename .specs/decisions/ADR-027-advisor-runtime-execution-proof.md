# ADR-027 — Advisor runtime execution proof

**Status:** Accepted (2026-10-08) · append-only

## Context

The Advisor profile contains a configured model and variant, but neither the
profile nor the Task agent name alone proves what the child session actually
used. Users need to compare current configuration with runtime evidence from a
completed Advisor response.

OpenCode v1.18.35's native Task tool selects the subagent's configured model.
Its SessionPrompt resolves the subagent's configured variant against the chosen
model's supported variants and writes the resolved value to the child message
metadata. Completed child assistant messages expose agent, provider, model, and
variant metadata to plugin events.

## Decision

1. Show runtime proof on the dashboard Models page, beside the existing Advisor
   configuration.
2. Record a sanitized telemetry event for a completed assistant message whose
   agent is `guarana-advisor`, with child session ID, parent session ID when
   available, observed provider/model, observed variant when present, timestamp,
   and outcome status. Do not record the prompt, response text, credentials, or
   unrelated conversation data.
3. Display configured provider/model/variant and observed runtime provider/model/
   variant as separate values. The current settings are not evidence of a past
   runtime call. If the host message omits the variant, show “runtime did not
   report variant”; never infer that the configured value was applied.
4. Expose the most recent completed Advisor execution in the Models API response.
   No completed execution yields an explicit empty state.
5. Keep native Task dispatch, existing advisor permissions, and the repeated-
   blocker guard unchanged.

## Alternatives considered

- Treat the installed profile or `subagent_type` as proof of execution — rejected;
  these prove routing intent, not a completed child model invocation.
- Store full Task prompts or advisor output to make the trace auditable — rejected
  because the metadata needed for proof is sufficient and narrower.
- Log the configured variant as if it were an observed parameter — rejected
  because runtime evidence must distinguish configuration from execution.
- Put the proof only in CLI status or raw JSONL — rejected after the user chose
  the dashboard Models page as the inspection surface.

## Consequences

- Telemetry and dashboard API/UI need a parent-child correlation and a no-data /
  missing-variant state.
- OpenCode message metadata is the runtime authority for observed model/variant;
  if it does not contain a field, the dashboard must say it was not reported.
- Tests must prove actual child message correlation, exact observed values, safe
  event shape, and dashboard display without leaking prompts or credentials.
