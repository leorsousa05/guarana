# Feature spec: Advisor proactive consultation guidance

**Status: SHIPPED**

## Goal
Update the generated Guarana primary profile policy to proactively encourage useful read-only Advisor consultation during planning and other meaningful decision points when Advisor is enabled and configured.

## Requirements
- When advisor.enabled=true and Advisor provider/model are configured, encourage consultation during planning for substantial or ambiguous work and later when independent advice materially helps with scope/assumptions/risks, architecture/trade-offs, execution decisions, debugging, or verification.
- Do not make consultation universal for trivial tasks; ask distinct meaningful questions when valuable and avoid repeating identical unchanged questions.
- Do not encourage or dispatch Advisor when disabled or unconfigured.
- Keep the primary as sole owner of decisions, edits, Task worker dispatch, and workflow state; Advisor remains read-only.
- Send concise, task-specific summaries: goal, constraints, assumptions, and open questions during planning; relevant evidence during execution. Do not send secrets or full transcripts.
- Retain one unchanged blocker protection and existing no-fabricated-handoff behavior. The existing optional/blocked-only ADR is superseded only for consultation policy; preserve the runtime guard.

## Assumptions and scope
- Generated primary profile policy and regression tests.
- Regenerate the current managed primary artifact only if it matches the repository's effective settings.
- Do not change Advisor execution rights or worker dispatch rules.

## Acceptance criteria
1. Enabled and configured primary output has proactive planning and other-phase consultation guidance, with no blocked-only restriction.
2. Disabled or unconfigured output has no proactive encouragement and remains opt-in/blocked by settings.
3. Owner, read-only, privacy, duplicate guard, and no-fabricated-handoff text is retained.
4. node --test cli/lib/advisor.test.js and relevant orchestrator tests pass.

<!-- guarana:record:start -->
Status: SHIPPED
Proof: Commit 4b7a9a6c2814dffd18cbafe28d4af795617257a5 was pushed successfully to origin/main.; git rev-parse HEAD and origin/main both equal 4b7a9a6c2814dffd18cbafe28d4af795617257a5.; The 23-path commit includes the validated proactive Advisor guidance and telemetry refresh refactor plus stale managed-profile hash reconciliation.; Human explicitly authorized commit/push.
Change: none
<!-- guarana:record:end -->
