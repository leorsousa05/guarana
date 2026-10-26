# Feature spec: Dashboard Memory preference graph and related context

## Goal

Add a read-only global-preference graph to Dashboard User preferences and include
confirmed global preference neighbors exactly one hop from the already-selected
active preferences in automatic context, without changing the strict memory
scope/type matrix or established bounds.

## Requirements

- Preserve the current scope/type matrix in
  `.specs/features/memory/project-knowledge-and-user-preferences-separation.md`
  and ADR-042: new preferences are global-only; new project memories are
  `decision | bug | solution | refactor`; legacy project `preference` remains
  searchable only in Project knowledge and is neither a new-write nor an
  automatic-injection type.
- Add a read-only `Preference graph` section or tab within User preferences. Reuse
  `GET /api/memory/graph?scope=global`, whose existing projection returns
  confirmed global preference nodes and edges only when both endpoints remain
  in that filtered node set. The graph has no project scope choice and no
  relationship mutation path.
- Mark every User preferences library entry `Global`. Mark legacy project
  preferences in Project knowledge search `Project · legacy preference` (or an
  equally explicit label). Neither workspace displays the other scope's memory
  text; project preferences never appear in the global library or graph.
- Starting with the existing selection of up to three active confirmed global
  preferences, include confirmed global preference neighbors at exactly one hop
  in the global vault, using only the existing `CTX_RELS` allowlist:
  `caused-by`, `depends-on`, `supersedes`, `fixes`, and `relates-to`. Do not
  traverse from a neighbor, cross scope, or include global legacy non-preference
  node types. A reached superseded preference stays explicitly in the existing
  superseded bucket and is not reclassified as active.
- Keep active-preference eligibility, the direct selected-preference maximum of
  three, and all existing total-context count, serialized-size, and token caps
  unchanged. Related entries consume those existing bounds. Keep current
  sensitive-tag filtering and exclude `summarizes`; do not add relation
  semantics.
- Keep the Dashboard preference library and graph read-only: no preference
  content or relationship create, edit, or delete controls, requests, or routes.
- Preserve the two vault roots, schema, migration/storage rules, prompt trust
  boundaries, global privacy, and ledger design. Use temporary synthetic
  fixtures only; do not inspect or mutate actual vault contents.

## Assumptions and scope

- User-approved scope is the strict existing type/scope matrix, a read-only
  global graph in User preferences, and exactly one hop of linked preference
  context under existing caps. No material discovery question remains.
- `GET /api/memory/graph?scope=global` already projects confirmed global
  preference nodes and edges whose endpoints are both in that result set.
- `memory/tools.js` already defines the context relation allowlist as
  `caused-by`, `depends-on`, `supersedes`, `fixes`, and `relates-to`; it excludes
  `summarizes`. The selected-preference expansion is new behavior: current
  task-relevant seed expansion does not guarantee a selected preference's
  neighbor is included when that preference does not match the task.
- The existing active global preference selector chooses at most three items;
  the existing total context count/serialized-size/token bounds remain
  authoritative.
- Source map:
  - Scope/type matrix and injection policy:
    `.specs/features/memory/project-knowledge-and-user-preferences-separation.md`
    and `.specs/decisions/ADR-042-project-knowledge-and-user-preference-separation.md`.
  - Validated UI predecessor and preserved proof:
    `.specs/features/dashboard/memory-domain-separation-ui.md`.
  - Current preference, graph, workspace components, and tests:
    `dashboard/web/src/components/MemoryPreferences.jsx`,
    `dashboard/web/src/components/MemoryGraph.jsx`,
    `dashboard/web/src/components/Memory.jsx`, and
    `dashboard/web/src/components/Memory.test.mjs`.
  - Current graph projection/routes:
    `dashboard/server/lib/memory.js` and
    `dashboard/server/routes/memory.js`.
  - Selection, context relations, and bounded injection:
    `memory/tools.js`, `memory/memory.test.mjs`,
    `plugin/guarana-memory.js`, and `plugin/guarana-memory.tools.test.mjs`.
  - Actual automatic system-prompt transformation and rendering:
    `plugin/guarana-orchestrator.js`,
    `plugin/guarana-orchestrator.test.mjs`, `orchestrator/prompt.js`, and
    `orchestrator/prompt.test.js`.
- In scope: the read-only global preference graph, explicit scope/legacy labels,
  exactly-one-hop related context from selected active preferences, regression
  coverage, and browser/accessibility proof.
- Out of scope: project-preference writes or changes to the type/scope matrix;
  preference CRUD; vault, schema, migration, storage, or prompt-trust changes;
  real-vault inspection or mutation; scope-crossing links; changing preference
  selection eligibility or its direct three-item cap; multihop traversal; and
  new relation semantics.
- No implementation, test, browser, independent-verification, or shipping
  result is claimed by this planning record.
- Budget: ADR-005 defaults — main thread ≤8k tokens steady-state; worker-code
  8k tokens per dispatch; worker-verify 4k tokens per dispatch; per-run hard cap
  32k tokens / 15 minutes.

## Acceptance criteria

1. User preferences exposes a `Preference graph` that requests only
   `GET /api/memory/graph?scope=global`; rendered nodes are confirmed global
   preferences and rendered edges have two endpoints in that node set. The
   preference graph presents no Project scope choice and sends no relationship
   mutation request; no preference CRUD route or UI is added. **Proof source:**
   route/library tests with temporary project/global fixtures, component request
   method assertions, and browser network evidence.
2. The graph has an accessible panel and keyboard navigation; a keyboard user
   can select a node and inspect its details and connected relations, with
   visible focus. **Proof source:** component accessibility/interaction tests
   and independent browser keyboard/focus evidence.
3. Every global preference library entry is visibly marked `Global`. A legacy
   project preference search result is visibly marked `Project · legacy
   preference` or equally explicit. Project preference text is absent from the
   global library and graph; global preference text is absent from Project
   knowledge. Other legacy project-record labels remain unchanged. **Proof
   source:** synthetic sentinel fixtures, component tests, and browser workspace
   isolation evidence.
4. Both context paths preserve one-hop preference relationships. The
   `memory_get_context_for_task` result preserves `relatedPreferences` and
   `relatedSuperseded`; the actual automatic system-prompt transformation in
   `plugin/guarana-orchestrator.js` carries the selected global preferences and
   one-hop related context into `orchestrator/prompt.js`, which renders direct,
   active-related, and superseded preferences in distinct groups. The direct
   group remains separately capped at three; related records are not labeled as
   directly selected, and reached superseded records remain only in the
   superseded group. A selected direct preference and its linked neighbor whose
   wording does not match the task still result in that neighbor appearing in
   the actual system transform. A second-hop-only preference, project record,
   cross-scope target, and global legacy non-preference record are absent.
   **Proof source:** temporary-vault relation fixtures and focused
   `memory/tools.js` / `memory/memory.test.mjs` /
   `plugin/guarana-memory.tools.test.mjs` tests for the context-tool result, plus
   `plugin/guarana-orchestrator.test.mjs` and `orchestrator/prompt.test.js` tests
   of the actual system transform and rendered groups, including positive and
   negative edge cases.
5. Regression evidence proves the direct selected-preference maximum remains
   three and the default combined context/merge count limit remains 10 records.
   The prompt renderer caps each serialized memory entry at 1000 characters and
   the total serialized memory payload at 6000 characters; related and
   superseded neighbors consume those same combined count and serialized-size
   bounds. Existing sensitive-tag filtering remains effective, and
   `summarizes` does not become a traversal relation. No additional numeric
   token cap is specified; preserve any existing token-handling behavior
   unchanged. **Proof source:** focused context-bound and sensitive-tag tests in
   `memory/memory.test.mjs`, `plugin/guarana-memory.tools.test.mjs`,
   `plugin/guarana-orchestrator.test.mjs`, and `orchestrator/prompt.test.js`, plus
   source/diff review of cap constants and relation policy in
   `memory/tools.js`, `plugin/guarana-memory.js`, and `orchestrator/prompt.js`.
6. Temporary synthetic-fixture tests show no write or delete operation occurs
   and byte comparisons of fixture vault files remain identical. Sentinel data
   proves there is no cross-project or project/global text leakage and no
   sensitive-tagged entry leakage. No actual memory vault contents are read or
   changed. **Proof source:** fixture byte snapshots, request/write-call
   assertions, and independent security review.
7. Independent browser evidence at 375x812 and 1440x900 records screenshots and
   layout metrics; confirms no page-level horizontal overflow, keyboard tab and
   graph navigation, visible focus, and reduced-motion behavior. **Proof
   source:** browser report, viewport metrics, screenshots, and interaction
   traces using synthetic fixtures only.
8. Focused affected tests, `npm test`, `npm run build` (including CLI sync),
   `npm run check-cli`, `npm run specs:validate`, and `git diff --check` pass;
   independent `worker-verify` records a criterion-level result and the browser
   evidence above. **Proof source:** exact command outputs, proof report and
   screenshots, and independent verification. Until then, this criterion and
   the feature remain pending; no implementation or validation is inferred.

## Validation receipt — 2026-10-25

Fresh independent `worker-verify` returned overall PASS; criteria 1–8 all
passed.

1. **PASS:** The User preferences graph uses `GET /api/memory/graph?scope=global`
   only, has no project-scope choice or mutation path, and renders the filtered
   global preference graph.
2. **PASS:** Browser evidence confirms keyboard tab/graph focus and the details
   inspector at mobile and desktop widths, with reduced motion active.
3. **PASS:** Global scope labels are visible; synthetic legacy project/global
   sentinels remain separated, with no cross-scope text leakage.
4. **PASS:** Explicit `memory_get_context_for_task` calls with `scope: "both"`
   and `scope: "global"` keep direct, `relatedPreferences`, and
   `relatedSuperseded` groups distinct under the count limit. The actual system
   transform keeps direct, active-related, and superseded preferences distinct
   and bounded; the selected direct preference's nonmatching one-hop neighbor
   is included, while second-hop and disallowed-scope/type targets are excluded.
5. **PASS:** The direct selection maximum remains three; related records consume
   the existing count and serialized-size bounds, and the existing filtering
   and relation policy remain in effect.
6. **PASS:** Synthetic-fixture write assertions and byte comparisons pass. No
   actual memory vault contents were accessed or changed.
7. **PASS:** Built-Dashboard browser evidence at 375x812 and 1440x900 records no
   page-level horizontal overflow, visible Global labels, read-only GET-only
   behavior, keyboard/focus/inspector interactions, and reduced-motion behavior.
   Report: `/tmp/opencode/guarana-memory-preference-browser/browser-report.json`.
   Screenshots: `/tmp/opencode/guarana-memory-preference-browser/preferences-library-375x812.png`,
   `/tmp/opencode/guarana-memory-preference-browser/preferences-library-1440x900.png`,
   `/tmp/opencode/guarana-memory-preference-browser/preference-graph-375x812.png`,
   and `/tmp/opencode/guarana-memory-preference-browser/preference-graph-1440x900.png`.
   Desktop client/scroll width is 1425px within the 1440px viewport because of
   the vertical scrollbar; mobile width is 375px.
8. **PASS:** Focused command
   `node --test dashboard/web/src/components/Memory.test.mjs memory/memory.test.mjs plugin/guarana-memory.tools.test.mjs plugin/guarana-memory.test.mjs plugin/guarana-orchestrator.test.mjs orchestrator/prompt.test.js`
   passed 154/154 in both primary and independent runs. `npm test` passed
   654/654; only non-fatal Vite WebSocket port 24678-in-use and Node module-type
   warnings were reported. `npm run build` passed the production Dashboard build
   and canonical-to-CLI sync; `npm run check-cli` passed; pre-record
   `npm run specs:validate` passed with 239 Markdown files, 94 feature specs,
   43 ADRs, 265 local links, and zero issues; `git diff --check` passed.

The final tool-result grouping correction is limited to
`plugin/guarana-memory.js` and `plugin/guarana-memory.tools.test.mjs`. It makes no
schema, vault, or type-matrix change; the separate Memory architecture work remains TASKED. This follow-up is
**VALIDATED, not SHIPPED**. The Dashboard Memory domain-separation UI predecessor
remains VALIDATED, not SHIPPED.

<!-- guarana:record:start -->
Status: VALIDATED
Proof: Fresh independent worker-verify overall PASS 8/8; focused tests 154/154; npm test 654/654; npm run build including Dashboard production bundle and CLI sync; npm run check-cli PASS; final post-record npm run specs:validate PASS with 240 Markdown files, 94 feature specs, 43 ADRs, 270 local links, and zero issues; git diff --check PASS; synthetic browser report /tmp/opencode/guarana-memory-preference-browser/browser-report.json and screenshots in the same directory; synthetic fixtures only, no actual vault access or change; not shipped.
Change: .specs/changes/2026-10-25-dashboard-memory-preference-graph-scope-labels-one-hop-groups.md
<!-- guarana:record:end -->
