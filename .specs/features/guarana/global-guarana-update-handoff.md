# Feature spec: Global Guarana runtime update handoff

**Status: VALIDATED**

## Goal
Record the user-requested system-wide Guarana runtime update and its independently verified operational state without changing project scope or claiming a code release.

## Requirements
- Perform and record the explicitly requested global update and global plugin installation; do not update project scope.
- Preserve the Advisor settings-incomplete and OpenCode-restart caveats; no Advisor settings were changed.
- Record the project memory plugin stale status as a read-only observation, not as an update.
- Do not claim code or project configuration changes, publication, or a version release.

## Assumptions and scope
- System-wide installation under global OpenCode/agent locations only.
- Operational record of the supplied command outcomes and independent verification.

## Acceptance criteria
1. The global Guarana skill suite is version 1.1.0 under /home/arch/.agents/skills/guarana.
2. Global plugin files are up to date and all three engines are deployed and healthy after the global update and plugin installation.
3. The global Advisor profile remains settings incomplete, no settings were changed, and a running OpenCode process must restart to load refreshed files.
4. Project status was checked read-only and still reports the project memory plugin stale; project scope was not updated.
5. The /usr/local/bin/guarana command resolves to this checkout at /home/arch/codes/Guarana/bin/guarana.js, version 1.1.0; no code or project configuration was modified and no release is claimed.

<!-- guarana:record:start -->
Status: VALIDATED
Proof: Global CLI resolution: /usr/local/bin/guarana resolves to /home/arch/codes/Guarana/bin/guarana.js; version 1.1.0.; Executed with global defaults and without --project: node bin/guarana.js update; node bin/guarana.js plugin install.; Installer reported 8 skills, 3 plugins, 3 engines, and 4 worker profiles refreshed.; Independent worker-verify PASS confirmed global skill suite 1.1.0 under /home/arch/.agents/skills/guarana, all global plugin files up to date, and all engines deployed and healthy.; Global Advisor profile remains settings incomplete; no settings were changed; running OpenCode must restart to load refreshed files.; Project status was read-only checked and still reports the project memory plugin stale; project scope was not updated.; Installation modified no code or project configuration; no code/version release is claimed.
Change: .specs/changes/2026-10-09-global-guarana-update-handoff.md
<!-- guarana:record:end -->
