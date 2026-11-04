# ADR-047 — Priority-ranked complete preference budget subsets

**Status:** Accepted (2026-10-31) · implementation pending · append-only

## Context

ADR-044 established a configurable global preference injection budget and required
the entire preference payload to fail closed when it exceeded the effective
ceiling. The accepted follow-up keeps that budget contract but replaces only the
all-or-nothing overflow rule: a budget now selects a priority-ranked subset of
complete global-preference records. Preference text must remain intact, and the
existing UTF-8-byte comparison remains an estimate against the token ceiling.

## Decision

1. Keep Automatic model-context based, preserve Custom values, and set the
   Dashboard presets to Less (8192), Medium (32768), and More (65536). Preserve
   the existing configured/model minimum, UTF-8-byte estimate, and settings
   contract.
2. Preserve existing record eligibility, scope/type/sensitive-tag safeguards,
   trust labels, and the global preference graph's one-hop boundaries. Candidate
   groups remain active direct, related, and superseded history.
3. Rank active direct records ahead of related records, and related records
   ahead of superseded history. Within each group, rank essential preferences
   first, then more recent preferences.
4. In that order, include a record only if adding its complete serialized form
   keeps the payload within the effective budget. If it does not fit, omit that
   complete record and consider later records. Never summarize or truncate a
   preference record.
5. Report included and omitted record counts. If no candidate fits, state that
   none fit and that preferences were not injected. Preserve one-time-per-session
   deduplication.
6. Add no storage schema, API, migration, or CLI setting contract change. Use
   synthetic fixtures only; do not inspect or mutate real vault data.

## Alternatives considered

- Keep all-or-nothing overflow with no preference content — rejected because it
  omits complete records that fit within the accepted budget.
- Truncate a record to make it fit — rejected; only complete record text may be
  injected.

## Consequences

Budget overflow can inject a ranked subset of full records instead of rejecting
the entire payload. Eligible records that do not fit are counted as omitted,
and later records are considered. Trust, scope, graph, and deduplication
boundaries remain unchanged. Implementation and proof remain pending in the
[global preference injection budget feature spec](../features/memory/global-preference-injection-budget.md).

## Status update (2026-11-03)

The header and the final sentence under Consequences record status when this
decision was accepted. The budget-fitting implementation was subsequently
validated; see the current master-tracker row and
the linked feature/change records for its source-level proof. That validation used
synthetic fixtures and does not claim access to real vault data or a package
release. This appended note preserves the original decision text and its
append-only history.
