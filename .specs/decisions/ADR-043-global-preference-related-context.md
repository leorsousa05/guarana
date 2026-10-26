# ADR-043 — Global preference related context

**Status:** Accepted (2026-10-25) · implementation VALIDATED · append-only

## Context

ADR-042 establishes a strict separation between project knowledge and global
preferences, with bounded automatic injection of active confirmed global
preferences. The existing task-relevant context expansion can omit a related
preference when its selected active preference does not itself match the task.
The user approved adding exactly one relation hop from selected active global
preferences while preserving existing scope, trust, and size bounds. This
decision follows ADR-042 and does not alter its type/scope matrix.

## Decision

1. Keep the existing active global preference selection and its maximum of three
   selected preferences unchanged.
2. From those selected preferences, include confirmed global preference
   neighbors at exactly one hop in the global vault, using the existing
   `CTX_RELS` allowlist only: `caused-by`, `depends-on`, `supersedes`, `fixes`,
   and `relates-to`. The existing policy excludes `summarizes`; do not add
   relation semantics.
3. Never traverse from a neighbor a second time. Include no project records,
   cross-scope text, or global legacy non-preference node types in this expansion.
4. A reached confirmed superseded preference remains explicitly in the existing
   superseded bucket; do not recast it as active.
5. Keep all existing total-context count, serialized-size, and token caps
   unchanged. Related entries consume the existing bounds. Keep current
   sensitive-tag filtering and trust boundaries.
6. Keep the Dashboard preference graph and library read-only. Add no preference
   content/relationship mutation path, schema change, storage change, or vault
   migration.

This is an approved automatic-context behavior change layered on ADR-042. It
does not revise ADR-042's strict memory type/scope matrix or its existing direct
preference-selection policy.

## Alternatives considered

- Keep task-match-only expansion — rejected because a selected preference that
  does not match the task may have a relevant confirmed global preference
  neighbor that is then omitted.
- Traverse multiple hops — rejected to keep expansion bounded and prevent
  indirect graph growth from expanding context beyond the approved one-hop
  behavior.
- Follow project or cross-scope relationships — rejected to preserve global
  privacy and the existing project/global separation.
- Make preference content or relationship editing available in Dashboard —
  rejected; the approved graph and library are read-only.

## Consequences

Automatic context can include one-hop confirmed global preference neighbors of
the already selected active global preferences, subject to the existing total
bounds and filtering. Selection eligibility, direct count, storage, schema,
vault roots, and historical records remain unchanged. Implementation and proof
are pending in the [Dashboard Memory preference graph and related context
follow-up](../features/dashboard/memory-preference-graph-and-context.md).

## Implementation-path clarification — 2026-10-25

This clarification records the delivery contract for the accepted one-hop
decision; it does not change the decision's scope or alternatives. The one-hop
result is required both in the explicit `memory_get_context_for_task` output,
preserving its `relatedPreferences` and `relatedSuperseded` buckets, and in the
actual automatic system-prompt transformation: the orchestrator carries the
selected global preferences and one-hop related context into the prompt
renderer. The prompt renders direct, active-related, and superseded preferences
as distinct groups. The direct group remains separately capped at three;
related records are not labeled as directly selected, and superseded records
are not included in the active group.

The sourced bounds remain a default combined context/merge count limit of 10
records, a direct selected-preference maximum of three, at most 1000 characters
per serialized memory entry, and at most 6000 characters for the total
serialized memory payload. Related and superseded neighbors consume the same
combined count and size bounds. No additional numeric token cap is asserted;
existing token-handling behavior remains unchanged. This clarification is not
implementation or verification proof; those remain pending.

## Implementation and validation receipt — 2026-10-25

This append-only receipt does not change the accepted decision or alternatives.
The explicit `memory_get_context_for_task` result now preserves direct
preferences separately from `relatedPreferences` and `relatedSuperseded` for
both `scope: "both"` and `scope: "global"`, under the existing count limit. The
actual automatic system-prompt path renders direct, active-related, and
superseded preferences as distinct bounded groups. The direct maximum remains
three, and reached superseded preferences remain in the superseded group.

Fresh independent `worker-verify` returned overall PASS with criteria 1–8 all
passing. Focused tests passed 154/154 in primary and independent runs; the full
suite passed 654/654. Production Dashboard build and CLI sync, `npm run
check-cli`, pre-record specs validation (239 Markdown files, 94 feature specs,
43 ADRs, 265 local links, zero issues), and `git diff --check` passed. Built
Dashboard browser evidence at 375x812 and 1440x900 is recorded in
`/tmp/opencode/guarana-memory-preference-browser/browser-report.json`, with
screenshots `preferences-library-375x812.png`,
`preferences-library-1440x900.png`, `preference-graph-375x812.png`, and
`preference-graph-1440x900.png` in the same directory. Verification used
synthetic fixtures only; no actual memory vault contents were accessed or
changed.

Only `plugin/guarana-memory.js` and `plugin/guarana-memory.tools.test.mjs` are
attributed to the final explicit-tool result-grouping correction. The broader
follow-up also includes the Dashboard UI components/tests and graph projection/
routes, `memory/tools.js` and its tests, and plugin/orchestrator/prompt paths
enumerated in the active feature spec's source map. No schema, vault, or
type-matrix change is attributed to this follow-up; the separate Memory
architecture work remains TASKED. This implementation is **VALIDATED, not
SHIPPED**. The earlier pending statements above are retained as historical
checkpoints.

## Lifecycle status transition — 2026-10-25

Implementation status is **VALIDATED, not SHIPPED**, as recorded in the
implementation and validation receipt above. This transition updates lifecycle
status only; the accepted decision, its date, and alternatives are unchanged.
