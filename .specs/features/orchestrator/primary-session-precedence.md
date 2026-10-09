# Feature spec: Guarana Primary Session Precedence

**Status: VALIDATED**

## Goal
Make Primary configuration an agent/profile default while preserving explicit or remembered OpenCode session model/variant selection, removing Guarana's hidden override and explaining the precedence rule.

## Requirements
- Primary configuration supplies agent/profile defaults; explicit or remembered OpenCode session selection prevails.
- Remove hidden chat.params enforcement from the canonical and bundled Guarana orchestrator; do not introduce chat.message model/variant mutation.
- Generated Primary preserves the selected model/variant frontmatter and explicitly explains defaults versus remembered/explicit session precedence.
- Explain the rule in the Web Models UI, CLI help, generated Primary profile, and README while preserving existing controls, settings round-trip, and accessible layout.
- Supersede guarana-primary-variant-enforcement through an append-only semantic note retaining historical proofs; its old override guarantee is no longer current.

## Assumptions and scope
- The user-approved plan is implemented and independently verified; see the dated proof notes below.
- No API schema change.
- No OpenCode core or state changes, including model.json; no saved model changes.
- Advisor behavior remains unchanged; saved Primary and Advisor settings must remain untouched.
- Refresh only managed project/global artifacts.

## Acceptance criteria
1. Canonical and bundled orchestrator have no chat.params enforcement; regression verifies the absent hook with conflicting configured/session variant, and no chat.message model/variant mutation is introduced.
2. Generated Primary preserves selected model/variant frontmatter and explicitly describes agent/profile defaults versus remembered/explicit session precedence.
3. Models UI, CLI help, and README explain the rule; existing controls, settings round-trip, and accessible layout are preserved.
4. Focused and full tests, build, check-cli, specs validation, and diff checks pass.
5. Only managed project/global artifacts are refreshed; saved Primary/Advisor settings and OpenCode model.json/core remain untouched.

## Final proof notes — 2026-10-09
Independent worker-verify `ses_eddb9384dffeAhauAWkupC1iZt` returned PASS (5/5); implementation/build evidence comes from worker-code `ses_eddbf1be2ffeLp2aFbUCv4dnjX`. The [dated change record](../../changes/2026-10-09-primary-session-precedence.md) preserves the implementation and final proof summary. Browser verification at 375px was unavailable (no browser/Playwright); evidence is source and SSR only, not real viewport proof. Pending writes: none. Stop reason: `condition-met`. No commit, push, or version changes occurred. Restart OpenCode once to unload the old hidden hook; this does not promise a remembered variant will reset.

<!-- guarana:record:start -->
Status: VALIDATED
Proof: worker-verify ses_eddb9384dffeAhauAWkupC1iZt — independent PASS (5/5); Independent focused checks PASS (47/47); npm test PASS (293/293, 46 suites); check-cli/dist cmp PASS; specs validate PASS (138/27/30/209, zero issues); diff-check PASS; Build PASS per worker-code ses_eddbf1be2ffeLp2aFbUCv4dnjX; Canonical/CLI/project/global plugins identical; no chat.params or nested message.model.variant mutation; Generated frontmatter preserves current user choice; docs describe defaults/session precedence; Install preserved project settings and model.json Buffer/SHA; global settings absent; no fake global Primary; 375px browser unavailable (no browser/Playwright); source and SSR only, no real viewport proof
Change: .specs/changes/2026-10-09-primary-session-precedence.md
<!-- guarana:record:end -->
