# ADR-023 — Preserve OpenCode provider-specific model IDs

**Status:** Accepted (2026-10-08) · append-only

## Context

OpenCode's model catalog can return IDs whose model portion contains additional
path segments or a leading tilde, such as `openrouter/~anthropic/model-name`.
The advisor catalog's generic model-ID validation currently rejects `~`, and
the settings schema would reject the same selection on save. OpenCode also lists
models for providers that are not authenticated; validating every model before
filtering by connected providers lets an unrelated catalog entry break all
connected-provider choices.

## Decision

1. Treat the first path segment as the provider ID and preserve the remaining
   model ID exactly, including nested segments and OpenCode-supported `~` aliases.
2. Filter models to authenticated providers before validating individual model
   IDs. Continue to reject malformed IDs for connected providers and all
   whitespace/control characters.
3. Apply the same safe model-ID grammar in discovery and advisor settings so
   catalog selections can round-trip through CLI, dashboard, and generated agent
   profiles unchanged.

## Alternatives considered

- Reject OpenRouter aliases containing `~` — rejected because they are returned
  by OpenCode and must be selectable in the advisor.
- Normalize or strip the tilde/subpath — rejected because it changes the model
  identifier and may select a different or nonexistent model.
- Validate all global catalog rows before checking provider authentication —
  rejected because disconnected-provider entries must not block connected models.

## Consequences

- The model-ID validator must accept the OpenCode tilde alias character while
  retaining a strict allowlist and non-empty/no-whitespace checks.
- Tests must prove discovery → settings persistence → generated profile uses the
  exact same provider/model ID, and disconnected entries are ignored first.
