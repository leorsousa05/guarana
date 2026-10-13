# Feature spec: Global Guarana install/update

**Status: VALIDATED**

## Goal
Plan a global Guarana skill/plugin update from this verified checkout, using global defaults, and record the observed pre-update state and verification gate. This is a planning handoff only; installation has not been run.

## Requirements
- When the primary executes the update, use this checkout's bundled CLI with `node bin/guarana.js install` and `node bin/guarana.js plugin install`, both with default global scope.
- Do not use `--project`; keep all update activity within global skill/plugin scope.
- Do not alter Advisor settings. Report any `settings incomplete` notice as unrelated configuration.
- Do not tag or publish npm, and do not edit code.

## Assumptions and scope
- The supplied observation that current-checkout CLI help identifies version 1.2.0 is the version reference for the later global skill-suite comparison.
- The supplied global status observations are planning inputs, not post-install verification.
- Global Guarana skills under `/home/arch/.agents/skills/guarana` and global plugins.
- Post-update read-only checks with `node bin/guarana.js list` and `node bin/guarana.js plugin status`.
- No project-scope update, Advisor settings change, code edit, tag, or npm publication.

## Acceptance criteria
1. After the authorized global install, `node bin/guarana.js list` reports the installed global skill suite current and matching this checkout's suite version; current-checkout CLI help identifies 1.2.0.
2. After global plugin installation, `node bin/guarana.js plugin status` reports all three plugins current and engines deployed/healthy.
3. Any Advisor `settings incomplete` notice is reported as unrelated configuration; Advisor settings remain unchanged.
4. No project scope is updated, no code is edited, and no tag or npm publication occurs.
5. Record exact check commands and outcomes, then validate `.specs`; do not report installation or verification as complete before they occur.

<!-- guarana:record:start -->
Status: VALIDATED
Proof: Independent worker-verify overall PASS; all acceptance criteria PASS.; Before install, the global skill suite was 1.1.0 and guarana-memory.js was stale. node bin/guarana.js install updated the global suite 1.1.0 to 1.2.0 at /home/arch/.agents/skills/guarana and refreshed all three global plugins plus engines, workers, and the advisor command.; Post-install node bin/guarana.js list reports suite 1.2.0 and all three plugins installed; node bin/guarana.js plugin status reports telemetry, memory, and orchestrator ok (up to date), engines deployed/healthy, and workers and advisor command current.; Independent verification confirmed checkout package version and installed .guarana-version are both 1.2.0; installed plugin SHA-256 values match current checkout artifacts.; Advisor primary/advisor settings remain settings incomplete and install emitted advisor setup-only command installed; model profiles unavailable: undefined. These are unrelated provider/model configuration and were not changed.; Global scope only; no project install or project source changes; no tag or npm publish. This task is VALIDATED, not SHIPPED or released.; Specs validator PASS: 164 files, 47 feature specs, 30 ADRs, 205 links, 0 issues.
Change: none
<!-- guarana:record:end -->
