# ADR-035 — Versioned known-issue status updates

**Status:** Accepted (2026-10-20) · append-only

## Context

The fixed `guarana specs record --file .specs/state/worker-specs-handoff.json`
transport currently accepts schema v1 task handoffs. Updating an existing
known-issue entry's status through this worker-owned path requires an explicit
versioned contract. Guarana 1.3.1 accepts only schema v1 and ignores unknown v1
fields, so placing issue-update fields in v1 could falsely succeed without
applying an update.

## Decision

Add schema v2 inside the existing fixed-file recorder for known-issue status
updates. Preserve schema-v1 behavior for ordinary task handoffs; the new CLI
continues accepting v1. A v2 handoff requires a non-empty status-update array
and may contain only issue updates or combine them with an existing task
handoff. Status-only writes target only `.specs/state/known-issues.md`; combined
task and issue writes form one all-or-nothing transaction. Guarana 1.3.1 must
reject the v2 schema before changing records.

## Alternatives considered

- Extending schema v1 was rejected because Guarana 1.3.1 ignores unknown v1
  fields and could report success without applying the issue update.
- Adding a shell subcommand was rejected because it requires a new worker-specs
  shell allow rule and duplicates the existing fixed-handoff transport.
- Manual edits to `known-issues.md` were rejected in favor of the recorder's
  explicit contract and transaction boundary.

## Consequences

- V1 task handoffs and their output/status behavior remain unchanged; v2 is
  fail-closed on Guarana 1.3.1.
- Exact heading targeting, single-line free-form status text, preservation of
  history and unrelated bytes, idempotency, sanitized errors, and rollback are
  part of the v2 contract.
- Canonical and CLI-mirrored recorder/parser/help/tests and worker-specs
  instructions/examples must change together; the fixed shell allowlist and
  dependency set remain unchanged.
- This decision records planning only. It does not authorize implementation,
  version changes, commit/push, tag, publication, or release.
