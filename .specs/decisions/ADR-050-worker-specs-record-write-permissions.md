# ADR-050 — Worker-specs record-write permissions

**Status:** Accepted (2026-11-26) · implementation VALIDATED · append-only

## Context

The `worker-specs` worker writes human-readable Specs through a fixed handoff
file and needs to create direct-domain feature Markdown and append ADRs. Its
permissions must preserve deny-by-default behavior and the existing fixed
`specs record` shell protocol.

The prior edit grants cover `.specs/README.md`, `.specs/state/*.md`,
`.specs/features/*.md`, and `.specs/changes/*.md`. They do not include the
handoff JSON, direct-domain feature files, or ADRs.

## Decision

Keep `worker-specs` edits deny-by-default and retain all prior grants. Add only
these exact resources:

- `.specs/state/worker-specs-handoff.json`
- `.specs/features/*/*.md`
- `.specs/decisions/ADR-*.md`

The path matcher treats `*` as one path segment; bare `*` continues to match
any resource. Keep shell deny-by-default except for these two fixed recorder
commands:

- `guarana specs record --file .specs/state/worker-specs-handoff.json`
- `node bin/guarana.js specs record --file .specs/state/worker-specs-handoff.json`

## Alternatives considered

- Keep the required paths inaccessible — rejected because it prevents the
  worker from writing the fixed handoff and its intended feature and ADR
  records.
- Grant broad `.specs/**` edit access — rejected in favor of the least-privilege
  exact resources listed above.

## Consequences

The worker can write its fixed handoff and the specified direct-domain feature
and ADR Markdown while unrelated edits remain denied. Shell execution remains
limited to the fixed recorder commands. The feature record documents the
validated implementation and proof:
[worker-specs record-write permissions](../features/orchestrator/worker-specs-record-write-permissions.md).
