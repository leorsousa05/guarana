# Feature spec: Memory project knowledge and user preference separation

**Status: TASKED**

## Goal
Separate project knowledge memory from user preferences while retaining the existing two physical vault roots and the established bounded-context security and trust safeguards.

## Requirements
- Project memory is exclusively the decision, bug, solution, and refactor types, remains searchable on demand, and is excluded from automatic assistant context.
- New user preferences live exclusively in the existing global XDG user vault, use type preference and a separate category field whose exact new-write values are agent_behavior, workflow, and communication, and remain eligible for bounded automatic injection.
- Confirmed legacy global preferences without a stored category are read as category general without rewriting stored data.
- Existing project-scoped preference records remain searchable as legacy data but are excluded from automatic injection; do not move, copy, or automatically reclassify them.
- Existing project atom and supernode records are explicit read-compatibility cases only: do not admit them as new project-memory types or include them in automatic context.
- Retain the two existing physical vault roots; create no new preference vault or database, and do not mutate actual vaults during implementation.
- Preserve existing automatic-context caps, security safeguards, and trust boundaries unless a necessary compatibility exception is explicitly recorded.
- Update canonical `README.md` and `docs/reference/memory.md` plus CLI mirrors so they no longer claim project-context injection or legacy prune/atom semantics that conflict with this accepted follow-up.

## Assumptions and scope
- Legacy project atom and supernode records may remain available to explicit read/search paths without being accepted as new project writes or eligible for injection; the implementation must choose a read-compatible path without expanding the write matrix.
- The general category for a legacy global preference without category is a read-time compatibility value only and does not create a disk write.
- All migration and compatibility tests can use temporary fixtures; actual project and global vaults remain uninspected and unmodified.
- Implement and test strict new-write type, scope, and category validation; explicit project search; automatic-context selection; and preference rendering.
- Update canonical `README.md` and `docs/reference/memory.md`, plus CLI mirrors, to remove project-context injection and legacy prune/atom claims that conflict with this accepted follow-up.
- Out of scope: moving, copying, or automatically reclassifying legacy records; creating a third vault; mutating actual vault data; unrelated features; claiming implementation, validation, or shipping before proof.

## Acceptance criteria
1. Focused tests prove project new writes accept only decision, bug, solution, and refactor; global new writes accept preference only with category agent_behavior, workflow, or communication; invalid type/scope/category combinations and missing or unknown new-write categories are rejected.
2. Automatic-context tests prove project knowledge, project legacy preferences, and legacy project atom/supernode records are never injected.
3. Automatic-context tests prove eligible confirmed global preferences are injected within the existing bound and their category is rendered with each preference.
4. A seeded confirmed global preference with no stored category is read/rendered as general, and a byte comparison proves the fixture vault data is not rewritten by that compatibility read.
5. An explicit project memory search returns matching project knowledge while the same seeded project knowledge remains absent from automatic context.
6. Regression tests prove established automatic-context count/size limits, security filtering, draft exclusion, and trust-boundary rendering remain in force; any necessary compatibility exception is explicitly recorded before behavior is broadened.
7. Relevant canonical documentation and CLI mirrors describe the same scope/type/category and legacy-compatibility contract.
8. Focused tests, full npm test, npm run build, npm run check-cli, npm run specs:validate, and independent worker-verify each pass for the implemented follow-up.

## Clarification: strict project legacy lifecycle (TASKED)

- Project memory remains limited to `decision | bug | solution | refactor` for new and confirmed knowledge. User selected this strict type set over allowing explicit legacy-type exceptions.
- `memory prune` must not create supernodes, delete legacy atoms, or automatically clean up existing legacy supernodes. Legacy atoms and supernodes stay in place; compaction does not migrate or delete them.
- `memory_review_draft` rejects confirmation unless an explicit target project type is supplied, accepts only `decision | bug | solution | refactor` for an explicit conversion, and keeps discard available. Existing scope and edge safety remains in force; there is no implicit atom confirmation.
- Dashboard Drafts review makes the conversion type explicit before confirmation and sends it through the existing project-scoped review request; it never directly confirms an atom implicitly.
- Add responsive and accessibility browser checks for the changed Drafts interaction. If an interactive browser environment is unavailable, record that proof as blocked and pending rather than claiming a pass.

## Additional acceptance criteria

9. Fixture tests prove `memory prune` creates no supernodes, deletes no legacy atoms, and does not automatically clean up existing legacy supernodes; byte comparison of fixture data proves no unintended changes.
10. `memory_review_draft` rejects confirmation without an explicit target project type, accepts only `decision | bug | solution | refactor` when conversion is explicit, preserves discard, and retains existing scope/edge safety. Tests prove there is no implicit atom confirmation.
11. Dashboard Drafts review requires an explicit conversion type before confirmation and passes it through the existing project-scoped review request; it does not use a direct implicit atom-confirm path.
12. Responsive browser checks at mobile and desktop sizes and accessibility checks cover the changed Drafts interaction, including explicit type selection and confirmation. If the interactive proof environment is unavailable, the criterion remains blocked/pending; no proof is inferred.
13. Project archive import is a write path: fixture tests using temporary archives and vaults prove the complete archive shape, every node against the project type/scope/category matrix, and edge integrity are validated before the first target write; invalid archives are rejected and leave target nodes, edges, and config bytes unchanged; valid archives import only allowed project types, and unsupported legacy project node types are rejected.

## Browser criterion follow-up — 2026-10-26

Fresh independent `worker-verify` passed acceptance criterion 12 on synthetic
fixtures with real Chromium at 375x812 and 1440x900. The browser coverage
included Drafts project binding and typed confirmation, irreversible discard,
keyboard/focus/accessibility, and no viewport overflow. No real vault or
provider data was used. Evidence: `/tmp/opencode/guarana-final-browser-gates/verification.md`,
`report.json`, `request-audit.json`, and report-referenced screenshots including
`drafts-focused-375.png` and `drafts-focused-1440.png`.

The same verifier reports `npm test` PASS (658/658), production build and CLI
sync PASS, `check-cli` PASS before and after build, candidate specs validation
PASS (245 files, 96 feature specs, 44 ADRs, 278 links, 0 issues),
`npm run specs:validate -- --json` PASS, `npm run audit` PASS (zero
vulnerabilities), and staged/unstaged/untracked diff-check PASS. This
supersedes the earlier blocked result for criterion 12 only. The supplied
result is criterion-level; no final independent overall verdict or shipping
claim is added here.

<!-- guarana:record:start -->
Status: TASKED
Proof: Fresh independent worker-verify passed project-knowledge-and-user-preferences-separation criterion 12 on synthetic fixtures using real Chromium at 375x812 and 1440x900; coverage included Drafts project binding and typed confirmation, irreversible discard, keyboard/focus/accessibility, and no viewport overflow.; Evidence: /tmp/opencode/guarana-final-browser-gates/verification.md, report.json, request-audit.json, and report-referenced screenshots including drafts-focused-375.png and drafts-focused-1440.png; no real vault or provider data was used.; npm test PASS (658/658); production build and CLI sync PASS; check-cli PASS before and after build.; guarana specs validate <candidate> --json PASS (245 files, 96 feature specs, 44 ADRs, 278 links, 0 issues); npm run specs:validate -- --json PASS.; npm run audit PASS with zero vulnerabilities; staged/unstaged/untracked diff-check PASS.; Candidate HEAD and origin/main both equal d976ddf76a1c7e354b4dbe734ab05caad8e43d85 with zero divergence. No commit, push, tag, or npm publication occurred; original-checkout byte-preservation evidence remains unresolved. The supplied result is criterion-level and does not assert an overall verifier verdict or shipping.
Change: none
<!-- guarana:record:end -->
