# Feature spec: Configurable workflow automation preferences

**Status: VALIDATED**

## Goal
Add persistent CLI and dashboard controls for whether Guarana automatically creates human-readable task specs and uses worker-specs, and whether it automatically runs independent verification. Dashboard controls live in the unified Settings page.

## Requirements
- Store settings in global $XDG_CONFIG_HOME/guarana/workflow.json, falling back to ~/.config/guarana/workflow.json when XDG_CONFIG_HOME is unset, and project .guarana/workflow.json. Both settings default to true; project values override per field, unset fields inherit global values, and clearing a project field restores inheritance. Reject malformed or unknown settings without partial writes and do not mutate advisor.json.
- Add guarana workflow read, set, and clear subcommands with the optional --project selector and deterministic help, errors, and status; project scope uses the current working directory. Add controls to the dashboard Settings page with Global/Project editing, effective source, clear-to-inherit, and Project as the editor default. Workflow is the state monitor, not a preference editor.
- Use one combined Specs/worker-specs preference. When disabled, suppress automatic human-readable task-record bootstrap, creation, and updates and automatic worker-specs dispatch. Keep .specs/state/workflow.json operational, preserve existing human-readable .specs files byte-identically when the setting changes, and permit explicit user-requested spec work to override the setting for that task.
- Independent verification defaults enabled. When disabled, skip automatic worker-verify dispatch and record a distinct verify_skip outcome, never verifier PASS or VALIDATED without independent proof; proportionate primary checks remain permitted. Explicit user requests or forced guarana:verify may override for that task without persisting a preference change.
- Keep other code and workflow behavior independent of these settings. Do not release or push.

## Assumptions and scope
- Shared settings core, CLI workflow command, dashboard Settings workflow controls and scoped API, orchestrator and plugin policy, state-machine event/history, and tests.
- Canonical orchestrator sources are in orchestrator/ and synchronized to cli/orchestrator/; canonical plugin is plugin/guarana-orchestrator.js and is mirrored to cli/plugin/; CLI sources are in cli/; dashboard routes and components are under dashboard/server and dashboard/web.
- Dashboard controls follow existing ledger styling, labels, keyboard/focus accessibility, and 375px responsive rules; preserve ownership, atomic/safe writes, current workflow-state JSON, default behavior when unset, and project records.
- Use ADR-005 budget defaults: main thread at most 8k steady-state tokens; worker-code 8k, worker-verify 4k, worker-debug 6k per dispatch; per-run cap 32k tokens and 15 minutes.

## Acceptance criteria
1. Shared settings core reads, validates, and writes both scopes; defaults both settings to true; project per-field override, global fallback, and clear-to-inherit work; malformed or unknown settings fail without partial writes; advisor.json remains byte-identical.
2. CLI read, set, and clear accept both booleans, global default and --project, deterministic help/errors/status, current-working-directory project paths, and XDG_CONFIG_HOME-aware global paths.
3. Dashboard Settings fetches effective workflow preferences, exposes two labeled accessible toggles with effective source and Global/Project editing, and saves only the selected scope through a validated API; clearing a project field restores inheritance and malformed API payloads are rejected without writes.
4. With Specs disabled, automatic new_task and force bootstrap neither create task README, conventions, or feature records nor dispatch worker-specs instructions; .specs/state/workflow.json still persists and existing human-readable files remain byte-identical; explicit user-requested spec work remains allowed.
5. With verification disabled, normal automatic workflow reaches completed through verify_skip from coding or verifying without worker-verify instructions or dispatch, logs a distinct skip event, and claims neither verification PASS nor VALIDATED; proportionate primary checks remain permitted. Enabled or absent configuration preserves existing worker-verify behavior. Explicit guarana:verify or user requests can override without persisting a setting change.
6. Canonical and CLI mirrors remain synchronized; API, settings, CLI, orchestrator, prompt, and dashboard tests distinguish defaults-on, configured-off, and explicit overrides. Relevant full tests, dashboard build, npm run check-cli, specs validation, and diff checks pass. No dependency or release changes occur.

<!-- guarana:record:start -->
Status: VALIDATED
Proof: Final independent browser report: /tmp/opencode/guarana-settings-e2e-rerun/run-njcd6t/report.json (status passed, 22/22 steps); screenshot: /tmp/opencode/guarana-settings-e2e-rerun/run-njcd6t/settings.png. Fresh free-port preflight and unique API identity passed. Chromium at 375x812 had document/body widths 375, no horizontal overflow, zero browser errors, and accessible names passed. Body-start Tab traces reached Specs in 18 presses and Verify in 20; Space toggled Specs on/off while retaining focus; both controls displayed visible solid 2px outlines.; The browser run passed Global and Project Web/Workflow UI saves, reloads, and effective-source checks; 30s refresh and light theme applied immediately; explicit /#/settings took precedence; hashless Project Workflow and post-clear Global Overview startup passed. Both Workflow overrides were cleared through the UI and each effective source/value returned to Global. Post-clear reload showed empty Project JSON; Global Web/Workflow files retained expected values; read-only `workflow read` and `workflow read --project` agreed with Global values and sources.; In the immediately prior source-unchanged verifier run, focused Settings tests passed 4/4, `npm test` passed 556/556, `npm run build` passed, `npm run smoke:pack` passed with 131 files, `npm run check-cli` passed, and `git diff --check` passed. Current specs validation passed 189 files with 0 issues.; The confirmed checkbox event-lifetime issue remains resolved in its existing record. The final verifier made no source/spec edits. No release or push occurred; status is VALIDATED, not SHIPPED.
Change: none
<!-- guarana:record:end -->
