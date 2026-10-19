# ADR-034 — Optional exact-name tracker-row removal

**Status:** Accepted (2026-10-19) · append-only

## Context

The validated `guarana specs record` command currently performs an upsert and
updates its checkpoint and receipt as one validated transaction. The accepted
task requires removing one explicitly named stale row from the Master tracker
without directly editing the tracker or disturbing other rows.

## Decision

Add an optional `task.removeTrackerNames` string array to the existing
schema-v1 handoff. Each supplied name targets only a Master tracker data row
whose tracker-name cell matches exactly. Missing names are no-ops; invalid,
duplicate, empty, or upsert-name-equal values are rejected. Omission preserves
existing handoffs. The recorder performs removal with the ordinary upsert,
checkpoint, and receipt in one all-or-nothing transaction, runs validation
before commit, and includes the names actually removed in its JSON result.

This keeps authorization explicit in the handoff, constrains targeting to the
exact requested cell, retains the existing transaction and validation
guarantees, and keeps human-readable record writes within worker-specs
ownership.

## Alternatives considered

- A separate CLI mutation command was rejected in favor of the optional
  schema-v1 handoff field, which keeps removal explicitly authorized in the
  same request and within the existing recorder transaction and validation.
- A direct or manual tracker edit was rejected because it bypasses those
  transaction and validation guarantees and the worker-specs record-writing
  ownership boundary.

## Consequences

- Existing handoffs remain unchanged when the optional field is absent.
- Exact-name matching and the returned list of actual removals make the
  destructive operation bounded and auditable; absent names remain
  idempotent no-ops.
- The recorder, its canonical and CLI mirrors, and focused rollback, security,
  and idempotency tests must be updated together.
- This decision does not authorize a version change, tag, npm publication, or
  public release; package version remains 1.3.1, and any commit/push is limited
  to `origin/main`.
