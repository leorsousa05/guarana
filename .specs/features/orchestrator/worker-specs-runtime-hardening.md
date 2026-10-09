# Feature spec: Worker Specs Runtime Hardening

**Status: VALIDATED**

## Goal
Align canonical and installed Guarana skills and narrow worker-specs shell permissions to preserve its intended write boundary.

## Requirements
- The worker needs shell only to invoke the deterministic specs record CLI.
- Project and global skill/profile copies should reflect canonical sources.

## Assumptions and scope
- OpenCode profiles reload only at process start.
- Only Guarana-managed global artifacts may be refreshed.
- Restrict worker-specs Bash to the record CLI invocation and deny other shell commands.
- Refresh project and global skill/profile artifacts where ownership is confirmed.
- Verify profiles, bundle synchronization, tests and install status.

## Acceptance criteria
1. Generated worker-specs profile denies Bash by default and allows only `guarana specs record --stdin` and `node bin/guarana.js specs record --stdin`; regression tests cover the rules.
2. Canonical and CLI skill/plugin bundles remain synchronized.
3. Project/global update and plugin installation refresh owned skills and worker profiles without overwriting foreign artifacts.
4. Installed project and global worker-specs profiles and plan/specs skills match canonical sources; status confirms this.
5. Focused/full tests, check-cli, specs validation and diff-check pass.

<!-- guarana:record:start -->
Status: VALIDATED
Proof: worker-verify ses_eded22aeeffeXNY6ISzvB2u1sQ — PASS (5/5); npm test — PASS (272/272); npm run check-cli — PASS; npm run specs:validate — PASS (132 Markdown, 21 features, 30 ADRs, 208 links); git diff --check — PASS; node bin/guarana.js update --project and global reported 4 worker profiles; project/global status shows all managed profiles current; canonical plan/specs skills match project/global installed files byte-for-byte
Change: none
<!-- guarana:record:end -->

## Follow-up transport update

The previously validated stdin-only Bash allowlist was superseded after the live smoke showed heredoc JSON input was denied. The current worker-specs route uses the fixed `.specs/state/worker-specs-handoff.json` file with `specs record --file`; other Bash remains denied. The follow-up implementation is documented in `.specs/features/orchestrator/worker-specs-handoff-transport.md`. Project and global files are refreshed, but live post-restart smoke remains pending.
