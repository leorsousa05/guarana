# Feature spec: Global preference injection budget

**Status: VALIDATED**

## Goal
Inject every confirmed active global preference in full using a user-configurable token ceiling and fail-closed whole-payload behavior when the complete set cannot fit.

## Requirements
- Inject every confirmed active global preference in full; remove the direct-three, total-ten, per-entry-1000-character, and total-payload-6000-character caps for preference injection.
- Preserve all preference text losslessly; use compact serialization only to reduce repeated overhead, never summarize or truncate preference text.
- Preserve current scope, type, sensitive-tag, and trust safeguards and the existing global preference graph/one-hop boundaries; superseded records remain historical and non-active.
- If the complete serialized preference set exceeds the effective budget, fail closed for the entire set, with an explicit notice and no partial preference content.
- Add an optional positive-integer preference injection budget measured in tokens to existing global XDG workflow settings and project `.guarana/workflow.json`, configurable through the existing CLI and Dashboard Settings page, with project-over-global inheritance and clear-to-inherit.
- When configured, use the configured budget; when model `limit.context` is available, use the lower of the configured budget and model context. When unset, use model `limit.context`; if neither provides a usable budget, fail visibly rather than silently omitting or truncating.
- Read model context from `input.model.limit.context` supplied to `experimental.chat.system.transform` by the installed OpenCode plugin API.
- Because the hook supplies neither exact tokenization nor remaining conversation usage, compare UTF-8 serialized byte length against the token budget and explicitly label/document this as an estimate.
- Reuse existing settings and storage; add no new vault, database, schema, or migration. Use synthetic fixtures only and do not inspect or mutate actual vault contents.

## Assumptions and scope
- Configuration through both the existing CLI and Dashboard Settings page follows the validated workflow-settings pattern; the global settings path is `$XDG_CONFIG_HOME/guarana/workflow.json` (falling back to `~/.config/guarana/workflow.json`) and the project path is `.guarana/workflow.json`.
- Existing active-preference eligibility, scope/type/sensitive-tag safeguards, and the global graph's one-hop boundaries remain authoritative except for removing the stated preference count and serialized-size caps.
- The OpenCode system-transform hook receives `input.model.limit.context`; it does not expose exact tokenization or remaining conversation usage.
- Global active-preference selection and prompt serialization/overflow behavior.
- The existing plugin system-transform path and model-context limit input.
- The existing workflow settings core, CLI, Settings page API, and Dashboard Settings UI.
- Regression tests and user-facing documentation for the estimated UTF-8-byte budget.

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
1. Memory selector tests prove that every eligible confirmed active global preference is selected without the former direct-three or total-ten caps, while scope/type/sensitive-tag eligibility remains enforced and superseded records stay non-active; proof source: memory selector tests and synthetic preference fixtures.
2. Prompt serializer tests prove byte-for-byte round-trip preservation of every preference's full text and compact serialization without summarizing or truncating text; proof source: prompt serializer tests with synthetic Unicode and punctuation fixtures.
3. Workflow settings core, CLI, Settings API, and UI tests prove the optional value accepts positive integers in tokens, rejects non-positive/non-integer values, persists in existing global/project files, resolves project-over-global inheritance, and clears a project value back to inheritance; proof source: workflow settings, CLI, API, and UI tests.
4. Plugin system-transform tests prove the effective ceiling uses configured budget alone when model context is absent, model `limit.context` when configuration is unset, the lower value when both exist, and an explicit fail-closed notice with no preference content when neither is usable; proof source: system-transform tests using `input.model.limit.context` and synthetic settings.
5. Boundary and overflow tests prove the complete UTF-8 serialized preference payload is injected only when its byte length is within the effective ceiling; when it exceeds the ceiling, the transform emits an explicit notice and no portion of any preference, and the notice/documentation labels the byte-to-token comparison as an estimate rather than exact tokenization or remaining conversation capacity; proof source: serializer and system-transform tests at under/equal/over boundaries plus documentation review.
6. Synthetic-fixture tests prove scope/type/sensitive-tag safeguards and the existing global graph/one-hop boundary remain effective, superseded preferences remain historical/non-active, and no actual vault contents are read or changed; proof source: selector/plugin fixture tests and vault byte comparisons.
7. Focused tests, full `npm test`, `npm run build`, `npm run check-cli`, `npm run specs:validate`, and `git diff --check` pass, and a fresh independent `worker-verify` returns a criterion-level overall PASS before validation is claimed; proof source: exact command results and independent verifier report.

<!-- guarana:record:start -->
Status: VALIDATED
Proof: Fresh independent worker-verify returned overall PASS with criteria 1–7 each PASS after inspecting feature and proof sources; no actual vault contents were accessed or mutated.; Focused worker reports: prompt/serializer 63/63; plugin system-transform 48/48; workflow settings core 47/47; CLI 8/8; Dashboard API 33/33; Settings UI 4/4.; Initial npm test had 656 passed and 1 failed on README CLI usage parity; worker-debug identified the README omission; worker-code added the two metadata-exact budget set/clear forms and inheritance text; node --test cli/command-metadata.test.js passed; corrected npm test passed 657/657.; npm run build passed (production Dashboard Vite build and CLI sync); npm run check-cli passed (bundle matches canonical); pre-record npm run specs:validate passed with 242 Markdown files, 95 feature specs, 44 ADRs, and 273 local links; git diff --check passed.; The independent verifier first passed specs validation and cited focused memory selector, prompt serializer, workflow settings, plugin system-transform, documentation, README parity, and bundle evidence. UTF-8 serialized byte length is an estimate compared with the token budget, not exact tokenization or remaining context; no actual vault was inspected or changed.; After the first record write, primary final-tree `npm run specs:validate` passed: 243 Markdown files, 95 feature specs, 44 ADRs, 277 local links, no issues.; After the first record write, primary final-tree `git diff --check` passed.
Change: .specs/changes/2026-10-25-global-preference-injection-budget.md
<!-- guarana:record:end -->
