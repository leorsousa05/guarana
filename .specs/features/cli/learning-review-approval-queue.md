# Feature spec: Learning-review approval queue and auto-accept configuration

**Status: VALIDATED**

## Goal
Record the accepted CLI and Dashboard design for a durable per-project learning-review approval queue and configurable auto-accept setting.

## Requirements
- Add `learningReview.enabled` in Global and Project scopes, defaulting false with independent `autoAccept` default false; expose effective values, source, and overrides in CLI and restored Dashboard.
- Run the post-task learning review at most once and only after successful `verify_pass → completed`; exclude trivial, failed, and interrupted tasks. Send only a bounded sanitized summary and changed paths, and keep review failure nonblocking and safe.
- Persist learning-review memory proposals and project-scope skill create/update proposals exactly in a persistent per-project queue under the existing Git-ignored project memory area, separate from the confirmed memory graph and legacy drafts; entries survive session and process restart.
- Provide CLI commands to list, approve, and reject proposals by ID. Approval applies only the exact immutable proposal; rejection writes nothing; replayed proposals and stale skill updates are rejected.
- Add an accessible Dashboard Approvals tab within Project knowledge, bound to the selected project. Display pending memory and skill proposals and provide approve/reject actions; do not mix legacy memory drafts or expose another project's proposal.
- Add learningReview.autoAccept as a Global and Project workflow setting with Project override. It defaults false, covers both learning-review proposal families, affects only newly produced proposals, and never auto-applies items already pending when enabled. If automatic application fails, leave the proposal reviewable. Malformed settings fail closed.
- Recreate the historical project solution proposal as a new pending item with a new ID, using only the confirmed subject of ignoring unknown flags in the web CLI. Do not claim the original text or ID is carried forward or that the item is confirmed.
- Limit auto-accept to learning-review proposals; unrelated direct memory and skill actions are not subject to this setting.

## Assumptions and scope
- The only confirmed historical fact is that the prior item was a project solution proposal about ignoring unknown flags in the web CLI; its original text and ID are unavailable, and its confirmation is not established.
- The existing Dashboard remains local and loopback-only, and existing selected-project and Global-versus-Project settings boundaries remain in force.
- The bounded feature covers CLI proposal review, the Dashboard Project knowledge Approvals tab, and learningReview.autoAccept.
- Keep the queue in the existing Git-ignored project memory area and separate from confirmed memory and legacy drafts; no data migration or external service is included.
- No package release, Git push, or root README edit is included.
- The broader implementation also covers Advisor policy/query limits/duplicate protection and sanitized usage observability, restored Dashboard status/history, and product documentation; existing feature records remain the scope-specific sources.
- Leave ADR-019 and ADR-049 and their historical receipts unchanged; see [ADR-052](../../decisions/ADR-052-project-local-learning-review-approval-queue.md).
- Use ADR-005 budgets: main thread at most 8k steady-state tokens; worker-code 8k, worker-verify 4k, and worker-debug 6k tokens per dispatch; per-run cap 32k tokens and 15 minutes.

## Acceptance criteria
0. Regression tests prove `learningReview.enabled` and `autoAccept` independently default false and resolve Global/Project overrides; CLI and restored Dashboard expose matching effective value, source, and overrides.
0. Lifecycle tests prove exactly one review follows successful `verify_pass → completed`, and no review occurs for trivial, failed, or interrupted tasks; only bounded sanitized summary and changed paths are sent, and safe review failures do not block completion.
0. Advisor tests prove manual or recommended policy preserves current proactive recommendation without unconditional consultation, configurable per-task query limits, and unchanged-context duplicate protection.
0. Telemetry tests prove sanitized review/Advisor outcomes and provider/model/tokens/cost when known, with unknown cost distinct from zero; restored Dashboard history is covered when available.
0. Product documentation describes the settings, policy/limits, privacy, telemetry, and Dashboard behavior. `npm test`, build, sync, `check-cli`, specs validation, and diff check pass; independent verification must pass before VALIDATED. No commit, push, publish, release, or SHIPPED status without explicit authorization.
1. With temporary project-memory fixtures containing memory, project-scope skill-create, and project-scope skill-update proposals, persistence tests assert exact proposal preservation after a new session and process reopen, queue placement under the existing Git-ignored project memory area, and no insertion into the confirmed memory graph or legacy drafts.
2. CLI tests list proposals and review each by ID. Approval applies only the exact immutable proposal; rejection writes no proposed memory or skill content; replay of an already-used proposal ID and a stale skill update are rejected before proposed content is applied.
3. A browser test exposes a programmatically named and keyboard-operable Project knowledge Approvals tab with pending memory and skill proposals and approve/reject controls. After switching from project A to project B, no project A proposal is visible or actionable, and legacy memory drafts are not shown in Approvals.
4. Settings tests show learningReview.autoAccept defaults false, resolves Global and Project values with Project override, and fails closed for malformed values. Both proposal families follow the effective setting only when newly produced; enabling it leaves already-pending proposals unchanged.
5. When automatic application fails in a test, the exact proposal remains pending and reviewable.
6. A recreated historical item is a new pending project solution proposal with a new ID and only the known subject of ignoring unknown flags in the web CLI; no test or record claims its original text or ID was carried forward or that it is confirmed.
7. Tests prove learningReview.autoAccept does not govern unrelated direct memory or skill actions.
8. Project and Dashboard tests preserve the selected-project boundary, Global-versus-Project settings boundary, and loopback-only Dashboard scope.

## Historical proposal evidence

The primary independently inspected the ignored project queue using
`listLearningReviewProposals(process.cwd())` and confirmed one relevant entry:

- **ID:** `a5057be4-ead5-4c8f-af0f-e6d8fcaf1700`
- **Status:** pending
- **Action:** `save_memory`
- **Type:** solution
- **Intent:** Ignore unknown flags in the web CLI

The original proposal text and ID are unavailable, and whether the original was
confirmed is unknown. This evidence does not claim otherwise and reproduces no
other queue or memory content.

<!-- guarana:record:start -->
Status: VALIDATED
Proof: Fresh independent worker-verify PASS; proof includes its read-only check of runtime artifact /tmp/opencode/guarana-advisor-runtime-output.json confirming recommended/manual/disabled policy and no model call.; npm test PASS (914/914); npm run build passed Vite 6.4.4 / 62 modules and CLI sync, independently rerun with unchanged git status; npm run check-cli passed.; Specs validation before record write passed: 278 files, 112 features, 52 ADRs, 311 links, 0 issues; git diff --check passed.; Focused relevant workflow/Advisor/settings/CLI/Dashboard tests passed (182/182); README updated.
Change: none
<!-- guarana:record:end -->
