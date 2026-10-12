# Feature spec: Advisor proactive consultation guidance

**Status: VALIDATED**

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
Status: VALIDATED
Proof: Independent native worker-verify result ses_ecebd5162ffevYgBGn2dxeVMq9: overall PASS on all criteria.; Both direct opencode run --agent guarana --format json --dir <temp> --auto <same synthetic planning prompt> runs exited 0; worker-code execution result ses_ececa9d36ffegAJB8RQBm0bWk5.; Persisted exports /tmp/opencode/enabled.json and /tmp/opencode/disabled.json prove both parents are guarana and finish stop; enabled parent has completed native Task targeting guarana-advisor, whose child session /tmp/opencode/advisor-child.json finishes stop with nonempty assistant response; disabled parent has zero Task calls or children.; Persisted user prompts are byte-identical, one each, 658 bytes, SHA-256 9997503f615ea52053717011b029d29f1b428d9e324695129ab0f5ccf3a4084e; the earlier disabled attempt with a different prompt was superseded.; Fixture project advisor.enabled was the only setting difference; effective models matched. Temporary roots were deleted; read-only current check confirms root Advisor remains enabled/configured and all artifacts ok (up to date).; No user/project settings or source files were changed by the runs; traces contain no shell/edit calls.
Change: none
<!-- guarana:record:end -->
