# ADR-048 — Project-scoped preference context

**Status:** Accepted (2026-10-31) · implementation TASKED · append-only

## Context

ADR-042 separates project knowledge from user preferences and excludes project-
scoped preferences from automatic context. The accepted follow-up adds a
distinct preference path for the currently selected project while preserving
the existing Global preference path and the exclusion of project decisions,
bugs, solutions, refactors, and other project knowledge. The existing two vault
roots remain the only storage roots. No actual vault data was inspected or
changed for this decision.

## Decision

1. Reuse `type: preference` with `scope: project` for new project-preference
   writes. Require `category` to be exactly `agent_behavior`, `workflow`, or
   `communication`. The same categories continue to govern Global preference
   writes; Global scope and priority behavior do not change.
2. Only confirmed project preferences with one of those stored categories are
   eligible for automatic injection, and only from the project selected by
   `req.projectRoot`. Legacy project preferences without a valid category
   remain searchable but are excluded from injection. Do not expand project
   preference graph neighbors. Project knowledge and unrelated project vaults
   are not injected or read for this path.
3. Use the existing `memory.preferenceInjectionBudgetTokens` and model-context
   ceiling for the combined candidate payload, with the existing complete-record
   fit algorithm and no truncation. When the budget is tight, prioritize
   selected-project preferences, Global direct preferences, existing Global
   related preferences, then Global superseded preferences. Do not add a
   separate budget setting. Preserve existing Global behavior and trust groups.
4. Render project preferences as a separate trust-labeled group below the
   current explicit user request and system, developer, and security policies.
   Project preference content does not override those sources.
5. The existing Dashboard estimate aggregates eligible selected-project
   preferences and the complete Global candidate set before fit or session
   deduplication. Its response contains only aggregate candidate count and
   serialized bytes; the UI labels the estimate approximate. The selected
   `req.projectRoot` determines the project candidate source.
6. Do not inspect, seed, migrate, copy, or reclassify actual Global or project
   vault records. The 18 supplied candidate entries remain Global. No Dashboard
   memory CRUD surface is added.

This decision supersedes only the ADR-042 clauses that restrict new
project-scoped preference writes to legacy/read-only data and exclude eligible
project preferences from automatic injection. Project knowledge types, legacy
compatibility, Global preference behavior, and all other ADR-042 provisions
remain unchanged. Implementation and proof are pending in the
[project-scoped preference injection feature](../features/memory/project-scoped-preference-injection.md).

## Alternatives considered

- Keep project-scoped preferences excluded from injection, as in ADR-042 —
  rejected; the accepted scope includes categorized preferences from only the
  selected project.
- Inject uncategorized legacy preferences or expand project preference graph
  neighbors — rejected; eligibility is limited to confirmed categorized
  records and has no project graph expansion.
- Add a separate project-preference budget or truncate records to fit —
  rejected; the existing shared budget and complete-record fit behavior apply.
- Create another vault or copy/reclassify the supplied Global entries —
  rejected; retain the existing roots and leave all actual vault data
  untouched.

## Consequences

Project-scoped preferences gain a bounded automatic-context path without
expanding automatic injection to project knowledge or other project vaults.
Dashboard estimate labels and API results describe the combined candidate set.
Implementation, synthetic-fixture proof, and independent verification remain
pending.

## Implementation status update — 2026-10-31

The acceptance-time `implementation TASKED` status and statement that proof was
pending above are historical. The feature is now **VALIDATED, not SHIPPED**.
Implementation criteria 1–7 and all required commands passed; the prior
implementation `worker-verify` returned overall PASS (8/8). A later final
review returned overall FAIL solely because record-coherence proof and this
implementation status were stale. The record-only correction now synchronizes
the proof and status; a fresh final independent review remains pending, so final
verification is not yet complete. The post-record validator returned
`{"ok":true,"filesScanned":261,"featureSpecs":101,"adrs":48,"linksChecked":300,"issues":[]}`.

No actual project or Global vault data was accessed or mutated, and no supplied
record was copied or reclassified. Receipt: [project-scoped preference
injection](../changes/2026-10-31-project-scoped-preference-injection.md).

## Scope clarification — 2026-10-31

Decision 2's phrase “not read” means project knowledge and legacy invalid-category
preferences are not selected, returned, or injected as context; it does not mean
the selected project's shared `nodes.jsonl` is never enumerated. The selector
enumerates only that selected project's shared records to identify eligible
categorized preferences. Non-preference project records and legacy preferences
without a valid category are not selected, returned, or injected; no project
graph expansion occurs, and unrelated project vaults are not read.

The fresh final `worker-verify` found this criterion-2 wording mismatch and stale
global-only guidance in the canonical and CLI memory skill documents. The
worker-debug classified the criterion-2 finding as an acceptance-wording
mismatch, not a product defect. The canonical memory skill has now been updated;
CLI mirror synchronization/build will follow. Fresh final independent
verification remains pending. The implementation status update above is retained
as historical context.

## Documentation correction and gates — 2026-10-31

The canonical and CLI memory skill documents are now synchronized after the
documentation correction. Post-correction gates passed: `npm test` (721/721),
`npm run build` (Vite 60 modules and CLI synchronization), `npm run check-cli`,
`npm run specs:validate -- --json` (`ok:true`, 261 files, 101 features, 48 ADRs,
300 links, 0 issues), and `git diff --check`. Fresh independent
`worker-verify` remains pending; no latest PASS is claimed. No actual project or
Global vault data was accessed or changed.

## Final verification update — 2026-10-31

The fresh final independent `worker-verify`, after all corrections, returned
overall PASS (8/8). It verified the categorized write/schema and draft matrix;
selected-vault-only preference projection without project graph expansion;
shared project, Global direct, related, and superseded budget behavior with
complete-record skipping; lower-trust prompt placement; aggregate count/bytes-
only estimates and selected-project routing; approximate Settings labeling;
canonical/CLI documentation parity; synthetic-only fixtures with no real-vault
access or mutation and no preference reclassification; and the final gates.
The verifier independently reran `npm test` (721/721), `npm run check-cli`,
`npm run specs:validate -- --json` (`{"ok":true,"filesScanned":261,"featureSpecs":101,"adrs":48,"linksChecked":300,"issues":[]}`), and `git diff --check`; all passed. It did not rerun `npm run build` because that writes assets. The primary's post-correction build passed (Vite 60 modules and canonical-to-CLI synchronization, including the memory skill).

The feature is VALIDATED, not SHIPPED. All tests used synthetic fixtures; no
actual project or Global vault was inspected or mutated, and all 18 supplied
candidate entries remain Global. No commit, push, publish, tag, deployment, or
runtime install occurred.
