# ADR-024 — Searchable OpenCode model and variant controls

**Status:** Accepted (2026-10-08) · append-only

## Context

The advisor Models page exposes connected OpenCode models, but currently uses a
large plain selector and a free-text variant field. The user wants searchable,
better-styled controls and selectable variants. OpenCode model definitions carry
per-model `variants`; available values vary by model and provider.

## Decision

1. Add an accessible search/filter control for the model catalog in each primary
   and advisor section. Keep the existing editable provider/model fields as the
   manual/custom fallback and retain the dashboard's ledger visual language.
2. Load variant keys from the selected OpenCode model definition via the
   documented `opencode models <provider> --verbose` output, parsing only the
   model's `variants` keys. Query on model selection and bound execution/output;
   do not refresh the remote model catalog automatically.
3. Provide a selectable per-model variant list plus OpenCode default/no variant
   and manual custom entry. Preserve the selected variant unchanged in settings
   and generated agent profiles. Catalog/variant errors remain non-blocking.

## Alternatives considered

- Hardcode one variant list for every model — rejected because OpenCode's built-in
  and custom variants are provider/model-specific.
- Remove manual entry and require a discovered variant — rejected because custom
  providers and newly configured variants may not be in the current catalog.
- Replace the ledger form with generic rounded cards — rejected in favor of the
  existing dense, hairline-rule visual language and mobile layout.

## Consequences

- The dashboard backend needs a bounded, on-demand query for verbose model
  metadata and must return variant identifiers only, never model options or
  credentials.
- Tests must cover search/filtering, provider/model selection, variant metadata,
  default/custom handling, and profile round-trip without changing the selected
  model ID.
