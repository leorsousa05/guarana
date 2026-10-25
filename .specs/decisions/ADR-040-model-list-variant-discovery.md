# ADR-040 — Project-scoped model.list for variant discovery

**Status:** Accepted (2026-10-25) · append-only

## Context

ADR-024 decision 2 selected `opencode models <provider> --verbose` as the model
variant metadata source. That command contract is absent in the installed
OpenCode v2.1.3. The read-only `model.list` API returns project-scoped model
metadata, while `provider.list` does not contain model entries. Variant metadata
must remain bounded and must not expose settings or credentials.

## Decision

1. Supersede only ADR-024 decision 2's metadata-source choice. For the selected
   project, invoke read-only `opencode api model.list --param
   location[directory]=<repoRoot>` with the project as the working directory.
   Keep ADR-024 decisions 1 and 3, including the existing UI, manual entry, and
   model-default behavior.
2. Retain the connected-provider authorization gate and bound the API invocation
   to 10 seconds and 2 MiB of output. Fail closed with safe errors when the
   response is absent, malformed, oversized, unsafe, or ambiguous.
3. Read model entries from the response's `data` array. Match exactly one entry
   using both `providerID` and model `id`; accept only a `variants` array whose
   entries have a valid identifier and settings object. Expose unique enabled
   variant identifiers only. Never return variant settings, model options,
   credentials, or raw authorization output.
4. Preserve `/api/models/variants`, Primary and Advisor role association and
   automatic lookup, connected-provider filtering, manual variant entry, and
   blank/model-default fallback. Discovery failure remains non-blocking.
5. Treat `model.list` as experimental and verified only on the installed
   OpenCode v2.1.3. ADR-018 remains the version policy: this observation creates
   no fixed compatibility range, earlier-version promise, or release claim.

## Alternatives considered

- Retain `opencode models <provider> --verbose` — rejected because the installed
  v2.1.3 CLI does not expose that provider argument or `--verbose` contract.
- Use `provider.list` — rejected because it does not provide model metadata.
- Hardcode a global variant list — rejected because variants are model-specific
  and would expose identifiers not validated for the selected model.

## Consequences

- Variant discovery uses a bounded, project-scoped, read-only API request and
  emits validated identifiers only.
- ADR-024 remains append-only and unchanged; only its decision 2 metadata-source
  choice is superseded. Its separate UI, custom-entry, and default decisions
  remain in force.
- Compatibility beyond the installed OpenCode v2.1.3 remains unverified and is
  not promised; release support continues to follow ADR-018.
