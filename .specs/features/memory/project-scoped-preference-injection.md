# Feature spec: Project-scoped preference injection

**Status: VALIDATED**

## Goal
Implement project-scoped, current-project preference writes and bounded automatic injection alongside Global preferences with a shared budget and aggregate estimate, preserving accepted scope, security, and trust boundaries.

## Requirements
- R1. New project-preference writes reuse type preference and scope project and require category exactly agent_behavior, workflow, or communication; existing project knowledge writes remain decision, bug, solution, or refactor, and Global preference behavior remains unchanged.
- R2. Only confirmed project preferences with a valid stored category from the selected project are eligible for automatic injection. Legacy project preferences without a valid category remain searchable but are excluded from injection.
- R3. The selector may enumerate only the selected project's shared `nodes.jsonl` to identify preference records. It selects, returns, and injects only confirmed project preferences with a valid stored category (`agent_behavior`, `workflow`, or `communication`). Project decisions, bugs, solutions, refactors, other project knowledge, and legacy preferences with absent or invalid categories are not selected, returned, or injected. No project preference graph expansion occurs, unrelated project vaults are not read, and priority remains Global-only.
- R4. The combined candidate payload uses the existing memory.preferenceInjectionBudgetTokens and model-context ceiling with the existing complete-record fit algorithm and no truncation. Under a tight budget, ordering is selected-project preferences, Global direct, Global related, then Global superseded.
- R5. Project preferences render in a separate trust-labeled group below current explicit user requests and system, developer, and security policies. Existing Global behavior and trust groups remain unchanged.
- R6. The Dashboard estimate aggregates eligible selected-project categorized preferences and complete existing Global candidates before fit and session deduplication, and returns only aggregate candidate count and serialized bytes. The estimate is labeled approximate and uses the selected req.projectRoot for project candidates.
- R7. Canonical and CLI mirrors describe and implement the same preference eligibility, budget ordering, trust boundary, and aggregate estimate contract. No Dashboard memory CRUD surface or separate budget setting is added.
- R8. Requirements source map: ADR-042 and the existing memory separation feature define the prior boundary; plugin/guarana-orchestrator.js and cli/plugin/guarana-orchestrator.js are the canonical and CLI injection sources; dashboard/server/lib/memory.js and cli/dashboard/server/lib/memory.js plus their memory routes are the estimate API sources; dashboard/web/src/components/Settings.jsx and generated CLI Dashboard assets are the estimate UI; README.md and docs/reference/memory.md plus applicable CLI mirrors are documentation sources, including `skills/guarana/skills/memory/SKILL.md` and `cli/skills/guarana/skills/memory/SKILL.md`.
- R9. All tests use synthetic fixtures. Do not inspect, seed, mutate, migrate, copy, or reclassify actual project or Global vault data; all 18 supplied candidate entries remain Global.

## Assumptions and scope
- Budget defaults are ADR-005 worker-code 8k tokens per dispatch and worker-verify 4k tokens per dispatch, with a 32k-token and 15-minute per-run hard cap.
- In scope: canonical and CLI injection, estimate API and mirrors, Dashboard estimate UI and labels, memory documentation, synthetic fixture tests, and independent verification.
- Out of scope: project knowledge injection, project preference graph expansion, a separate setting or vault, Dashboard memory CRUD, and any actual vault access or mutation.
- Source map: .specs/decisions/ADR-042-project-knowledge-and-user-preference-separation.md; .specs/features/memory/project-knowledge-and-user-preferences-separation.md; plugin/guarana-orchestrator.js; cli/plugin/guarana-orchestrator.js; dashboard/server/lib/memory.js; cli/dashboard/server/lib/memory.js; dashboard/server/routes/memory.js and cli/dashboard/server/routes/memory.js; dashboard/web/src/components/Settings.jsx and generated CLI Dashboard assets; README.md; docs/reference/memory.md; applicable CLI documentation mirrors; skills/guarana/skills/memory/SKILL.md; cli/skills/guarana/skills/memory/SKILL.md.

## Acceptance criteria
1. Synthetic write-matrix tests accept project preference writes only with scope project and category agent_behavior, workflow, or communication; reject missing and unknown categories and invalid type/scope/category combinations; and preserve existing Global preference and project-knowledge behavior.
2. Synthetic injection tests show that selection enumerates only the selected project's shared `nodes.jsonl` to find eligible preferences; only confirmed preferences with a valid stored category from that project are selected into context, returned, or injected; legacy preferences with absent or invalid categories and project decisions, bugs, solutions, refactors, and other project knowledge are not selected into context; no project graph expansion occurs; and no unrelated project vault is read.

   Clarification: earlier “not read” wording meant project records were not selected, returned, or injected as context; it did not prohibit enumerating the selected project's shared JSONL to identify eligible preferences.
3. Budget-fit tests use the existing configured preference budget and model-context ceiling on combined candidates, never truncate a record, and demonstrate tight-budget ordering of selected-project, Global direct, Global related, then Global superseded preferences while preserving existing Global trust groups.
4. Rendered-context tests show a separate trust-labeled project-preference group below explicit user requests and system, developer, and security policies, with no project preference overriding those sources.
5. Estimate API tests show the aggregate count and serialized bytes cover eligible selected-project and complete Global candidates before fit and session deduplication, with no candidate records in the response; Dashboard tests show selected req.projectRoot controls project candidates and the UI labels the result approximate.
6. Documentation and canonical/CLI mirror checks show the same accepted write matrix, eligibility, ordering, trust boundary, and aggregate estimate contract.
7. Fixture byte comparisons show no fixture data changes outside the explicitly exercised synthetic writes; no actual Global or project vault data is inspected or mutated, and no supplied Global candidate is seeded or reclassified.
8. Focused tests, npm test, npm run build, npm run check-cli, npm run specs:validate -- --json, git diff --check, and independent worker-verify pass before the feature is marked VALIDATED.

<!-- guarana:record:start -->
Status: VALIDATED
Proof: Final independent worker-verify overall PASS (8/8).; npm test PASS (721/721); npm run build PASS (Vite 60 modules and canonical-to-CLI sync); npm run check-cli PASS.; npm run specs:validate -- --json PASS: 261 files, 101 features, 48 ADRs, 300 links, 0 issues; git diff --check PASS.; Synthetic fixtures only; no actual project or Global vault access, change, or migration. Not shipped.
Change: .specs/changes/2026-10-31-project-scoped-preference-injection.md
<!-- guarana:record:end -->
