# ADR-026 — Single editable model-variant input

**Status:** Accepted (2026-10-08) · append-only · supersedes the variant-control presentation in ADR-024

## Context

The Models page currently renders a variant selector and a second custom-variant
input underneath it, along with a visible “OpenCode default” option. The user
explicitly wants one variant input for each of Primary and Advisor and no default
option in the control.

## Decision

1. Render one editable/searchable variant input per role, populated with the
   selected model's supported OpenCode variant keys as suggestions.
2. A user can select a suggestion or type a custom variant into the same input.
   An empty value means OpenCode's default variant; do not add a visible
   “OpenCode default” option or a second stacked input.
3. Preserve any saved custom/stale variant value in the single input even when it
   is not among current OpenCode suggestions. Lookup errors leave the input
   manually editable.

## Alternatives considered

- A native select plus a second custom text input — rejected by the user because
  it produced duplicate stacked variant controls.
- A visible default/no-variant option — rejected; an empty field already means
  OpenCode's default.
- Remove custom entry — rejected because custom providers and variants may not be
  present in current OpenCode metadata.

## Consequences

- The variant datalist/control must remain searchable and keyboard accessible.
- Tests must prove one variant input per role, suggestion selection, custom
  editing, empty default, and exact save/profile round-trip.
