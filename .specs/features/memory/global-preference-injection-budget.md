# Feature spec: Global preference injection budget

**Status: VALIDATED**

## Goal
Inject a priority-ranked subset of complete eligible global-preference records within the effective user-configurable budget. Never truncate a record; report included and omitted counts, and state that no preferences were injected when none fit. In Dashboard Settings, also show an aggregate-only approximate serialized-byte estimate and candidate count for the complete eligible Global preference candidate set before budget fitting or session deduplication.

## Requirements
- Discover every otherwise-eligible confirmed active global preference without the former direct-three, total-ten, per-entry-1000-character, or total-payload-6000-character caps; budget fitting may omit whole records only under the rules below.
- Preserve every included preference's complete text losslessly. Compact serialization may reduce repeated overhead, but no preference text is summarized or truncated.
- Rank records by group: active direct preferences precede related preferences, which precede superseded history. Within each group, essential preferences precede non-essential preferences, then more recent records precede older records.
- In ranked order, include a candidate only when adding its complete serialized record keeps the total UTF-8 serialized payload within the effective budget. If a candidate does not fit, omit it and test later candidates; never truncate it.
- Report included and omitted record counts. If candidates exist but none fit, explicitly state that none fit and that preferences were not injected; do not emit language claiming injection occurred.
- Preserve current scope, type, sensitive-tag, trust-label, and global preference graph/one-hop safeguards; superseded records remain in their historical, non-active group.
- Keep the existing effective-budget contract: when a configured value and model `limit.context` both exist, use the lower; when configuration is unset, use model `limit.context`; if neither provides a usable budget, fail visibly without preference content.
- Read model context from `input.model.limit.context` supplied to `experimental.chat.system.transform` by the installed OpenCode plugin API.
- Because the hook supplies neither exact tokenization nor remaining conversation usage, compare UTF-8 serialized byte length against the token budget and explicitly label/document this as an estimate.
- Preserve one-time-per-session preference-injection deduplication.
- Reuse existing settings and storage; add no new vault, database, schema, migration, or CLI setting contract. The accepted estimate follow-up may add only a read-only aggregate-only estimate API, which must not return preference text or IDs. Use synthetic fixtures only and do not inspect or mutate actual vault contents.
- In Dashboard Settings, use Automatic (unset), Less (8192), Medium (32768), and More (65536); Automatic remains model-context based and existing non-preset values remain `Custom (N)` until changed.
- Keep `memory.preferenceInjectionBudgetTokens` and existing global/project workflow settings, CLI setting behavior, project-over-global inheritance, and clear-to-inherit semantics intact; add no sentinel value.
- Estimate the existing complete Global candidate set: eligible confirmed Global direct preferences and its existing one-hop related/superseded groups. Include candidates before applying the configured budget or session deduplication; do not count unrelated stored Global records or filter the set to active records only.
- Calculate the estimate with the established compact serializer and UTF-8 serialized-byte measurement used by budget fitting. Label the result as approximate, not exact tokens.
- Return only the aggregate candidate count and serialized-byte estimate from the estimate API; do not expose preference text or IDs in the API response or Settings display.
- Place the estimate beside the Dashboard Settings budget selector and render loading, error/unavailable, and refreshed polling states without exposing candidate contents.
- Preserve the existing budget settings, injection algorithm, eligibility, security/trust rules, one-hop boundary, and schema/storage/CLI setting contract.

## Assumptions and scope
- Configuration follows the existing workflow-settings pattern; global settings remain at `$XDG_CONFIG_HOME/guarana/workflow.json` (falling back to `~/.config/guarana/workflow.json`) and project settings at `.guarana/workflow.json`.
- Existing eligibility, scope/type/sensitive-tag safeguards, one-hop graph boundaries, trust labels, model-context source, and project/global inheritance remain authoritative.
- The system-transform hook does not expose exact tokenization or remaining conversation usage; UTF-8 byte comparison remains an estimate.
- Scope includes Dashboard preset values, preference selection and serialization, system-transform fitting/notices/deduplication, the aggregate-only candidate-size estimate and Settings display/polling, regression tests and user-facing documentation, canonical sources, and the generated CLI mirror.
- The estimate follow-up may add a read-only aggregate-only estimate API; no storage schema, migration, or CLI setting contract change is in scope. Keep effective value/source display and existing project clear-to-inherit behavior.

## Source map

- Existing preference eligibility and memory context tests: `memory/memory.test.mjs` and `plugin/guarana-memory.tools.test.mjs`.
- Prompt serialization tests: `orchestrator/prompt.test.js`.
- Actual `experimental.chat.system.transform` behavior and supplied model limit: `plugin/guarana-orchestrator.test.mjs`.
- Scoped workflow setting behavior: the existing workflow settings core, CLI, Dashboard Settings API, and Settings UI test suites.
- Existing global preference graph and one-hop boundaries: `.specs/features/dashboard/memory-preference-graph-and-context.md`; existing scope/type matrix: `.specs/features/memory/project-knowledge-and-user-preferences-separation.md` and ADR-042.

## Budgets

- Main thread: at most 8k tokens steady-state.
- `worker-code`: 8k tokens per dispatch; `worker-verify`: 4k tokens per dispatch; `worker-debug`: 6k tokens per dispatch.
- Per-run hard cap: 32k tokens / 15 minutes per outer-loop rotation.
- These are ADR-005 defaults; human override remains available.

## Acceptance criteria
1. Selector tests prove every otherwise-eligible confirmed active global preference is discovered without the former direct-three, total-ten, per-entry-1000-character, or total-payload-6000-character caps; budget fitting is separately tested against criteria 5–6.
2. Prompt serializer tests prove byte-for-byte round-trip preservation of complete included record text and compact serialization without summarizing or truncating text, using synthetic Unicode and punctuation fixtures.
3. Workflow settings core, CLI, Settings API, and UI tests prove existing positive-integer validation, persistence, project-over-global inheritance, and clear-to-inherit behavior remain unchanged.
4. System-transform tests prove the effective ceiling uses model `limit.context` when configuration is unset, the configured/model minimum when both exist, and a visible fail-closed notice with no preference content when neither is usable.
5. Synthetic records prove strict group priority (active direct before related before superseded), then essential-before-non-essential and newest-before-older ordering within each group; each fitting record is included whole, an oversized record is skipped, and later smaller records are still considered.
6. Boundary tests prove included and omitted record counts match complete records considered, no record text is truncated, and when zero candidates fit the notice says none fit and does not claim preferences were injected; the notice and documentation label UTF-8-byte comparison as an estimate, not exact tokenization or remaining conversation capacity.
7. System-transform tests prove one-time-per-session preference-injection deduplication remains in effect across repeated transforms for the same session.
8. Synthetic-fixture tests prove scope/type/sensitive-tag eligibility, direct/related/superseded trust labels, the existing global graph/one-hop boundary, and historical/non-active superseded grouping remain intact; no actual vault contents are read or changed.
9. Dashboard Settings tests prove the exact mapping Automatic (unset), Less (8192), Medium (32768), and More (65536), while existing non-preset integers remain `Custom (N)` until changed.
10. Scoped Dashboard Settings tests prove Global Automatic uses model context and Project Automatic removes the local override and restores Global inheritance or its model-context fallback without a sentinel; effective value/source display and existing scoped-save behavior remain intact.
11. For the original budget-setting slice, focused tests, `npm test`, `npm run build`, `npm run check-cli`, `npm run specs:validate`, and `git diff --check` pass; build and check-cli prove canonical sources and generated CLI mirror are synchronized, and a fresh independent `worker-verify` returns criterion-level overall PASS before validation is claimed. Tests use synthetic fixtures only; no storage schema, migration, or CLI setting contract change is present.
12. Synthetic temporary-vault tests prove the estimate includes eligible confirmed Global direct preferences and the existing one-hop related/superseded groups, including non-active candidates, while excluding unrelated stored Global records; the set is measured before budget fitting and session deduplication.
13. Serializer tests prove the full-set estimate uses the established compact serializer and the same UTF-8 serialized-byte measurement used by budget fitting, and the UI labels it approximate rather than exact tokens.
14. Estimate API tests prove its response exposes only aggregate candidate count and serialized-byte estimate, never preference text or IDs; the Settings display likewise renders no candidate content.
15. Dashboard Settings tests prove the estimate appears beside the budget selector, has an accessible approximate-size label and candidate count, shows loading and error/unavailable states, and updates after a successful estimate refresh/poll.
16. Regression tests prove existing budget selection/fitting, injection behavior, security/trust and one-hop boundaries, settings/storage behavior, and CLI setting contract remain unchanged; the estimate does not change the budget or injected preference set.
17. Focused tests, `npm test`, `npm run build`, `npm run check-cli`, `npm run specs:validate`, and `git diff --check` pass; build and check-cli prove canonical Dashboard/backend sources and the generated CLI mirror are synchronized, and a fresh independent `worker-verify` returns criterion-level overall PASS before validation is claimed. All vault tests use temporary/synthetic fixtures only; no real vault contents are accessed or mutated.

Decision details: [ADR-047 — Priority-ranked complete preference budget subsets](../../decisions/ADR-047-priority-ranked-complete-preference-budget-subsets.md).

<!-- guarana:record:start -->
Status: VALIDATED
Proof: Fresh independent worker-verify overall PASS, criteria 1–17; criterion 15 now proves estimate A is replaced by B and both share the same .settings-row. The earlier coverage gap was fixed by an SSR regression test, not a runtime defect.; npm test — PASS, 717 passed and 0 failed.; npm run build — PASS, 60 modules and canonical-to-CLI sync; npm run check-cli — PASS.; Pre-record npm run specs:validate — PASS: 257 Markdown, 100 features, 47 ADRs, 296 links, 0 issues; git diff --check — PASS.; All vault tests used synthetic temporary fixtures; no real Global vault was inspected, and no browser smoke was performed. VALIDATED, not SHIPPED.
Change: .specs/changes/2026-10-31-global-preference-injection-budget-estimate.md
<!-- guarana:record:end -->
