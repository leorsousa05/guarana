# ADR-022 — Discover models from connected OpenCode providers

**Status:** Accepted (2026-10-08) · append-only

## Context

The model advisor CLI and dashboard currently accept manually entered provider
and model IDs. The user wants the selection experience to show models available
in OpenCode, especially for providers already connected to that OpenCode
installation.

## Decision

1. Use OpenCode's documented local CLI commands: `opencode auth list` to identify
   connected providers and `opencode models [provider]` to list their model
   catalog. Return only provider/model IDs and display names; never expose or
   persist authentication material in Guarana.
2. Filter the model catalog to connected provider IDs, then expose it through a
   `guarana advisor models [provider]` CLI command and a local dashboard API.
   Both primary and advisor model settings consume the same catalog.
3. Keep manual provider/model ID entry available when OpenCode is absent, no
   providers are connected, or discovery fails. Discovery failure does not block
   other advisor configuration or dashboard use.
4. Use OpenCode's existing model cache by default; do not force a remote catalog
   refresh as a side effect of opening the dashboard or running configuration.

## Alternatives considered

- Read and parse OpenCode's credential file directly — rejected because the
  supported CLI commands provide provider discovery while keeping credential
  handling inside OpenCode.
- Show the full Models.dev catalog — rejected because it includes providers the
  user has not connected and cannot guarantee that the choice works locally.
- Fetch provider catalogs from Guarana — rejected because provider credentials,
  discovery rules, and provider-specific behavior belong to OpenCode.

## Consequences

- CLI/API discovery depends on the local `opencode` executable and its current
  model catalog cache.
- The dashboard backend must bound subprocess time/output, invoke commands
  without a shell, and sanitize output to model metadata only.
- If OpenCode is unavailable, the UI and CLI report that state while manual
  model IDs remain usable.
