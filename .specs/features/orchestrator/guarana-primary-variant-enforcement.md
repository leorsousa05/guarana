# Feature spec: Guarana Primary Variant Enforcement

**Status: VALIDATED**

## Goal
Ensure new Guarana Primary chat requests use the configured Primary variant instead of OpenCode's session default variant.

## Requirements
- Saved project Primary settings currently contain provider=openai, model=gpt-6-luna, variant=low (the user selected low to test).
- The generated guarana.md and opencode debug config resolve variant low, but the new-session UI still displays medium.
- A fresh run reports provider/model but OpenCode run telemetry does not expose variant.

## Assumptions and scope
- Only enforce the variant on chat requests from agent guarana when the active provider/model match the configured Primary.
- Use the active model's own named variant options; if the variant is absent or unsupported, leave request options unchanged.
- The UI session selector label may remain independent; this feature guarantees outgoing chat parameters, not UI text.
- Add chat.params enforcement in the Guarana orchestrator plugin, canonical and CLI mirrors.
- Add tests for configured variant override of session-default options, other agents/models unchanged, and missing variant no-op.
- No changes to worker-code, Advisor subagent variant, or model selection.

## Acceptance criteria
1. A matching guarana chat uses the effective project-over-global Primary variant's model-specific options, overriding conflicting session-default options.
2. A non-Guarana agent, mismatched model, missing/unsupported variant leaves output unchanged; unrelated options are preserved.
3. Canonical/CLI plugin copies sync and tests assert observable hook output.
4. Full npm test, build, check-cli, specs validation and diff-check pass.

<!-- guarana:record:start -->
Status: VALIDATED
Proof: worker-verify ses_ede16ad48ffebKd0q46x3CZDDv — PASS (4/4); plugin focused tests — PASS (31/31); npm test — PASS (293/293); npm run build — PASS and CLI plugin synchronized; npm run check-cli — PASS; npm run specs:validate — PASS (137 Markdown, 26 features, 30 ADRs, 208 links); git diff --check — PASS; project Primary `openai/gpt-6-luna` / `low` options and plugin copies installed project/global; plugin hook overrides conflicting request option for agent guarana only
Change: none
<!-- guarana:record:end -->

## Superseded policy — Primary session precedence (2026-10-09)
The approved [Primary session precedence plan](primary-session-precedence.md) supersedes this feature's policy: Primary configuration supplies agent/profile defaults, while an explicit or remembered OpenCode session selection prevails. The old guarantee that Guarana overrides conflicting session variants is no longer current. Remove the hidden `chat.params` enforcement without introducing `chat.message` model/variant mutation; Advisor behavior remains unchanged. The historical status, acceptance criteria, and proofs above are retained as evidence of the prior implementation, not proof that the replacement plan is implemented or verified.

The replacement is now independently verified: worker-verify `ses_eddb9384dffeAhauAWkupC1iZt` returned PASS (5/5) on 2026-10-09; see the [replacement change/proof record](../../changes/2026-10-09-primary-session-precedence.md). The earlier paragraph records the supersession at planning time; historical enforcement proofs remain unchanged and do not establish current override behavior.
