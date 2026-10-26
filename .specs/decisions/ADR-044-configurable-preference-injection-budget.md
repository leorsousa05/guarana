# ADR-044 — Configurable global preference injection budget

**Status:** Accepted (2026-10-25) · implementation pending · append-only

## Context

The existing automatic global-preference path has direct-count and serialized
size bounds. The user approved injecting every confirmed active global
preference in full without the direct-three, total-ten, per-entry-1000-character,
or total-payload-6000-character caps. The installed OpenCode plugin API supplies
`input.model.limit.context` to `experimental.chat.system.transform`, but the hook
does not provide exact tokenization or remaining conversation usage. The user
chose a configurable budget rather than a hard-coded 10% share.

## Decision

1. Add an optional positive-integer preference injection budget measured in
   tokens to existing global XDG workflow settings and project
   `.guarana/workflow.json`. Configure it through the existing CLI and Dashboard
   Settings page; project values override global values and clearing a project
   value restores inheritance.
2. Use the model's `limit.context` when the configured value is unset. When both
   values are known, use the lower value as the effective maximum.
3. Since exact tokenization and remaining conversation usage are unavailable,
   compare the UTF-8 serialized payload's byte length with the token budget and
   label/document that comparison as an estimate.
4. Inject the complete preference payload only when it fits. If it exceeds the
   effective maximum, or no usable budget exists, fail closed for the complete
   set, emit an explicit notice, and include no partial preference content.
5. Preserve existing eligibility, scope/type/sensitive-tag safeguards, global
   preference graph/one-hop boundaries, and historical/non-active superseded
   records. Add no new vault, database, schema, or migration; use synthetic
   fixtures and do not inspect or mutate actual vault contents.

## Alternatives considered

- Hard-code a 10% share of model context — rejected; the user chose a
  user-configurable budget.
- Summarize, truncate, or inject only a partial preference set on overflow —
  rejected; the accepted contract requires lossless complete preference text
  and whole-payload fail-closed behavior.

## Consequences

The complete eligible active preference set is injected losslessly when its
serialized UTF-8 byte length is within the effective ceiling. The byte/token
comparison is explicitly an estimate, not exact tokenization or remaining
conversation capacity. Overflow and missing-budget conditions are visible and
never produce partial preference content. Implementation and proof remain
pending in the [global preference injection budget feature
spec](../features/memory/global-preference-injection-budget.md).
