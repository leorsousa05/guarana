# ADR-025 — Searchable advisor model controls

**Status:** Accepted (2026-10-08) · append-only

## Context

The advisor Models page has an unsearchable provider field and a model list
whose control hierarchy does not make the two model roles or variant choices
clear. The user explicitly requires provider search, improved inputs and overall
page UX, and selectable variants.

## Decision

1. Give Primary and Advisor peer work areas with searchable provider and model
   comboboxes. A provider change updates the role's provider state, and selecting
   a model preserves the exact provider/model ID. Manual provider/model entry
   remains available.
2. Discover selectable variants from the selected OpenCode model's verbose
   metadata (`opencode models <provider> --verbose`) on demand. Keep a default/no
   variant option and allow custom/manual variant IDs; a lookup failure must not
   block model selection or save.
3. Redesign the internal page hierarchy/spacing while retaining the dashboard's
   established palette, typography, hairline rules, keyboard focus, and mobile
   behavior. Use flat ledger surfaces rather than generic rounded cards.

## Alternatives considered

- Keep provider as a free-text field and only filter the model catalog — rejected
  because the user explicitly requires searching/selecting providers too.
- Hardcode variant choices by provider — rejected because variants are
  model-specific and can be customized in OpenCode.
- Replace the dashboard's visual language with card-based generic settings UI —
  rejected to preserve the established ledger identity.

## Consequences

- The frontend needs keyboard-accessible searchable comboboxes and a provider
  change path that avoids stale model/variant values.
- The dashboard variant endpoint must return only validated variant names for
  the selected connected model, not model options or credentials.
- Responsive layout and search/variant states require focused UI/API tests.
