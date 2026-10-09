# Change: Primary session precedence — 2026-10-09

## Scope and history
The [session precedence feature](../features/orchestrator/primary-session-precedence.md) replaces the [historical variant enforcement policy](../features/orchestrator/guarana-primary-variant-enforcement.md), whose prior proofs remain preserved. Primary configuration supplies agent/profile defaults; explicit or remembered OpenCode session selection prevails. Advisor behavior remains unchanged.

Implementation was recorded as IMPLEMENTED from worker-code `ses_eddbf1be2ffeLp2aFbUCv4dnjX`, including managed project/global installation and build PASS. Final independent worker-verify `ses_eddb9384dffeAhauAWkupC1iZt` returned PASS (5/5); the primary supplied the VALIDATED decision.

## Criterion-level evidence
1. Canonical, CLI, project, and global plugins are identical, with no `chat.params` hook and no nested `message.model.variant` mutation.
2. Generated Primary frontmatter preserves the current user choice; documentation explains agent defaults versus session precedence.
3. Models UI, CLI, and README explanations preserve existing controls; review evidence is source and SSR only. A browser at 375px was unavailable (no browser/Playwright). No real viewport proof is claimed.
4. Independent focused checks PASS (47/47); `npm test` PASS (293/293, 46 suites); check-cli/dist comparison PASS; specs validation PASS (138 Markdown files, 27 features, 30 ADRs, 209 links, zero issues); diff-check PASS. Build PASS is the worker-code result, not an independently rerun build claim. Exact focused/comparison command strings were not supplied in the final handoff.
5. Install preserved project settings and OpenCode `model.json` bytes (Buffer and SHA equality). Global settings were absent; no fake global Primary was created. Only managed project/global artifacts were refreshed.

## Completion and next action
Pending writes: none. Stop reason: `condition-met`. No commit, push, or version changes occurred; no shipping claim is made.

Restart OpenCode once to unload the old hidden hook. This is not a promise that a remembered session variant will reset.
