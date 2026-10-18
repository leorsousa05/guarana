# Feature spec: Global Guarana Primary agent availability and stale-artifact diagnosis

**Status: VALIDATED**

## Goal
Diagnose the missing global Guarana agent and reports of old Guarana artifacts in other repositories, and make the Guarana Primary agent available globally using the user-authorized Primary defaults.

## Requirements
- Use the supported Guarana CLI to configure only global Primary provider openai, model gpt-6-luna, and variant medium, as explicitly authorized from this project's defaults.
- Refresh only global Guarana Advisor/Primary profile artifacts using safe supported operations; do not run full global guarana install.
- Leave Advisor globally disabled and unconfigured; do not copy this project's Advisor enabled/provider/model values.
- Verify the global settings, generated Primary profile, and Advisor read/status without changing other artifact groups.
- In a fresh disposable project, run guarana install --project and verify Primary profile generation, current plugin and skill artifacts, and healthy project status.
- Record that stale artifacts were not reproduced in this checkout and keep the affected other-repository path unresolved until supplied; do not clean up or overwrite an unidentified repository.

## Assumptions and scope
- The user explicitly authorized global Primary values openai/gpt-6-luna with variant medium; this does not authorize enabling/configuring Advisor.
- Existing behavior remains that a model-less Primary is not generated or bound; project-over-global settings and OpenCode session precedence continue to apply.
- The disposable project is for isolated installation verification; no existing project-local configuration is in scope.
- Global Primary configuration and only the global Guarana Advisor/Primary profile artifacts needed to make the Primary agent available.
- Fresh disposable-project installation and artifact/status checks.
- Preserve global worker-specs bytes and all unrelated artifact groups; global plugins, engines, skills, worker profiles, existing project-local configuration, Advisor configuration, and unrelated files are out of scope.

## Acceptance criteria
1. Global effective settings contain only the intended Primary provider/model/variant values and do not enable or configure Advisor.
2. Global agents/guarana.md is generated/current and advisor read/status reports Primary ready; global worker-specs bytes and unrelated artifact groups remain unchanged.
3. A fresh disposable project installed with guarana install --project generates agents/guarana.md; installed plugins match current canonical V2/V1 sources, skill stamp/content match the current distribution, and project status is healthy/current.
4. The exact stale artifacts are not reproduced in this checkout; the unspecified other-repository path remains open, with no arbitrary cleanup or overwrite.
5. No code, release, commit, global plugins/engines/skills, worker profiles, existing project-local config, Advisor settings, or unrelated files are changed.

<!-- guarana:record:start -->
Status: VALIDATED
Proof: Fresh independent worker-verify PASS for all 5 criteria; first specs validator ok:true, 184 files, 0 issues.; Read-only effective global settings contain only Primary openai/gpt-6-luna/medium; Advisor fields are absent; advisor status reports current Primary and Advisor agent absent; global agents/guarana.md is current.; Authenticated location-scoped OpenCode catalog from a projectless temporary location returned exactly one matching Primary; readiness and location passed on poll 3.; Fresh isolated project install verified generated Primary, all three plugins byte-match canonical and CLI copies, skill stamp 1.3.0 with all 11 files matching, current plugin/profile status, healthy engines, and vault uninitialized as expected; temporary project and scratch removed.; Before/after SHA-256 values matched for worker-specs, manifest file and groups, global agents/plugins/engines/skills, settings, and Primary/Advisor artifacts; worker-specs remains stale/foreign but unchanged; no global mutation occurred.; Stale artifacts were not reproduced in this checkout. The affected external repository remains unidentified and unresolved; no TUI symptom fix is claimed. No shipping occurred; status is VALIDATED, not SHIPPED.
Change: none
<!-- guarana:record:end -->
