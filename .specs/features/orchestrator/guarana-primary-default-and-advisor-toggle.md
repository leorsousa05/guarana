# Feature spec: Guarana Primary Default and Advisor Toggle

**Status: VALIDATED**

## Goal
Use the configured Guarana Primary profile as the OpenCode default in project/global scopes, while making Advisor consultation independently configurable and optional.

## Requirements
- Rename the generated `guarana-advisor-primary` profile to `guarana`.
- Make Guarana Primary the default agent in project/global scopes when an effective Primary provider/model is configured.
- Expose a boolean Advisor consultation setting in CLI and project Models UI.
- Keep the `/guarana-advisor` command as an alias to the renamed Primary profile.
- Keep worker-code as the implementation worker and guarana-advisor as read-only advice.

## Assumptions and scope
- If Primary provider/model is absent, preserve existing OpenCode default (normally `build`).
- Preserve a user-selected custom default agent; replace `build`/unset with `guarana` when Primary is configured.
- Advisor consultation defaults disabled; project setting overrides global; enabling it requires Advisor provider/model configuration.
- Disabling Advisor keeps the Guarana Primary default active but prevents Advisor Task dispatch.
- Profile/default-agent changes take effect after OpenCode restart.
- Rename and safely migrate Guarana-managed primary agent artifact while refusing foreign-name collisions.
- Update advisor settings schema, CLI set/read/clear, dashboard Models checkbox and API merge/source behavior.
- Set OpenCode default_agent from the installed configured Primary via runtime config integration without overwriting unrelated config.
- Gate read-only Advisor profile/Task consultation by advisor.enabled; retain command alias.
- Test project/global scopes, precedence, missing model fallback, legacy profile migration, UI accessibility/responsive behavior, and disabled/enabled Advisor routes.

## Acceptance criteria
1. Generated primary agent is named `guarana`; `/guarana-advisor` targets it; migration removes only Guarana-owned legacy `guarana-advisor-primary` and refuses to overwrite foreign `guarana` artifacts.
2. When an effective Primary provider/model exists, OpenCode uses `default_agent: guarana` in project/global installs; project settings override global. Without configured Primary it preserves existing default/build, and a custom non-build default is not overwritten.
3. CLI and dashboard expose `advisor.enabled` as a boolean in their supported scope; missing setting defaults false and, when absent or false, the Advisor profile is not generated and native Advisor Task dispatch is rejected; when true, an effective Advisor provider/model is required and the read-only Advisor profile is generated; project setting overrides global.
4. Renamed Primary follows Guarana workflow, delegates code to worker-code, and may consult the read-only guarana-advisor only when enabled and blocked; worker-code cannot dispatch Advisor itself.
5. Regression tests cover CLI/settings/API/UI/config hook/profile migration and runtime gating; dashboard layout remains accessible at 375px.
6. `npm test`, `npm run build`, `npm run check-cli`, `npm run specs:validate`, and `git diff --check` pass; managed project/global profiles install/status safely and restart activation is documented.

<!-- guarana:record:start -->
Status: VALIDATED
Proof: worker-verify ses_ede51947fffe7vb29aVenXfgUT — PASS (6/6); project opencode debug config — default_agent guarana; project/global CLI/status show renamed Primary artifacts current; old Guarana profile migration tested; advisor.enabled defaults false; project UI/CLI toggles and runtime Task gate verified; npm test — PASS (291/291); npm run build — PASS; npm run check-cli — PASS; npm run specs:validate — PASS (136 Markdown, 25 features, 30 ADRs, 208 links); git diff --check — PASS; npm run smoke:pack — PASS (guarana-1.1.0.tgz, 100 files, no node_modules); package remains local/unpublished
Change: none
<!-- guarana:record:end -->
