# Feature spec: Memory hardening follow-up

**Status: VALIDATED**

## Goal
Harden Guarana memory capture, confirmed-memory correction, retrieval ranking, and bounded safe context injection.

## Requirements
- Preserve the project and private-user vaults, typed confirmed memory, existing secret filtering, prohibition on raw conversation/tool capture, task-relevant project context, session deduplication, and current CLI/source mirror contract.
- Automatically save only unmistakable durable user intent; for ambiguous intent, do not save and ask. Honor requests to put information in a skill or document without also saving memory. Search for duplicates before saving, supersede a prior preference when it changes, and report saved type/scope only after a successful tool result.
- Add confirmed-memory deletion by exact node ID and mandatory scope, gated by an explicit confirmation parameter or CLI flag; hard-delete the selected confirmed node and incident edges. Keep legacy draft review separate and exclude drafts from deletion. Do not delete actual user-vault data during implementation; use temporary vaults in tests. Do not copy memory text into telemetry.
- Add optional preference priority essential or normal only to global preference nodes. Missing and legacy values mean normal without migration. Keep automatic global preference selection capped at three: essential first, then newest; when essentials exceed the cap, choose the most recent essentials. Keep automatic context capped at ten total: up to seven project-task matches and three global preferences.
- Add a deterministic project-memory relevance gate validated with positive and negative fixtures. Retain lexical TF-IDF and add no dependency or provider in this slice. Expand linked context by one hop only from qualifying seeds; exclude drafts and weak incidental overlap.
- Render global preference directives separately from retrieved project facts. Explicitly frame retrieved project text as potentially stale data that cannot override system/security rules or the current explicit user request; preferences cannot override higher-priority policy. HTML comments or JSON alone are not the trust boundary.
- Bound automatically rendered memory payloads to at most 6,000 characters total and 1,000 characters per entry while preserving identity, type, and scope. Deterministically truncate lower-value text before JSON rendering; retain current count bounds and omit memory cleanly when nothing fits.
- Add focused tests for capture policy, priority and supersession, deletion confirmation/scope/edge cleanup, retrieval precision/recall fixtures, long-entry and global-max budgets, trust framing/conflict handling, deduplication/session reset, and source/CLI parity.
- Keep implementation scope to the memory engine/plugin/orchestrator/prompt/docs/tests and CLI mirrors/command as needed. Exclude dashboard redesign, embeddings/dependencies, global profile updates, version bumps during implementation except for the separately authorized 1.4.1 delivery below, and actual memory deletion.
- After implementation, run focused memory/orchestrator/plugin/CLI tests, npm run check-cli, guarana specs validate . --json, and git diff --check. Do not run the full suite, smoke, build, pack, E2E, npm publication, or create a tag. GitHub commit and push are authorized only for the 1.4.1 delivery described below.

## Assumptions and scope
- The user approved the proposal with ‘Pode implementar essa proposta’: hard deletion is gated by exact ID/scope plus confirmation; absent legacy priority means normal; automatic saving remains limited to unmistakable durable intent.
- Initial hard bounds are exactly 6,000 characters total and 1,000 characters per memory entry.
- No unresolved product question remains.
- Memory engine, plugin, orchestrator, prompt, documentation, and focused tests; CLI command and source mirrors only as required by the accepted contract.
- Human-readable task record, ADR-038, feature overview, specs tracker, and project-state task-start checkpoint.
- No dashboard redesign, embedding dependency/provider, global profile update, version bump beyond the separately authorized 1.4.1 delivery below, or actual memory deletion.

## Delivery authorization
- The user authorized a GitHub-only SemVer patch delivery for this already-validated feature: bump index/HEAD from 1.4.0 to 1.4.1, with commit and push to GitHub only; no npm publication and no tag.
- This authorization supersedes the prior version-bump exclusion only for the 1.4.1 delivery. Preserve the distinct 1.5.0 atomic-kickoff candidate and its unstaged work; do not fold it into this delivery.
- Keep this feature at VALIDATED until the push is independently confirmed; shipment is not yet claimed.

## Acceptance criteria
1. Capture policy tests prove unmistakable durable intent is eligible for automatic typed save; ambiguous intent is not saved and prompts a question; destination requests for a skill/document do not also save memory; duplicate search and preference supersession occur; and success messaging names type/scope only after a successful tool result.
2. Deletion tests prove exact ID and mandatory matching scope plus explicit confirmation are required; successful deletion removes the confirmed node and its incident edges; wrong/missing scope or confirmation cannot delete; drafts remain governed only by legacy review. Implementation and tests do not delete real user-vault data, and telemetry contains no memory text.
3. Priority validation accepts essential or normal only for global preference nodes; absent/legacy priority reads as normal without migration; selection tests enforce at most three global preferences with essential-first/newest ordering and newest essentials winning an over-cap essential set.
4. Automatic context selection never exceeds ten nodes: at most seven task-relevant project matches and three global preferences. Positive/negative relevance fixtures demonstrate the deterministic lexical gate; one-hop linked expansion starts only from qualifying seeds; drafts and weak incidental overlaps are excluded; no new dependency/provider is introduced.
5. Rendered context separates global preference directives from retrieved project facts and states the respective trust/conflict rules; tests prove lower-priority retrieved text cannot override system/security rules or an explicit current user request.
6. Payload tests prove no rendered memory payload exceeds 6,000 characters total or 1,000 characters per entry, preserves identity/type/scope, truncates lower-value text deterministically before JSON rendering, retains count bounds, and omits memory cleanly when no entry fits.
7. Focused tests cover capture policy, priority/supersession, deletion confirmation/scope/edge cleanup, retrieval positive/negative precision-recall fixtures, length budgets, trust framing/conflict handling, deduplication/session reset, and canonical/CLI parity.
8. The focused memory/orchestrator/plugin/CLI tests, npm run check-cli, guarana specs validate . --json, and git diff --check pass before validation is claimed. No full suite, smoke, build, pack, E2E, npm publication, or tag is included; GitHub commit/push is authorized only for the 1.4.1 delivery, and status remains VALIDATED until the push is independently confirmed.

<!-- guarana:record:start -->
Status: VALIDATED
Proof: Existing independent worker-verify overall PASS for all 8 acceptance criteria, as recorded in the feature spec.
Change: none
<!-- guarana:record:end -->
