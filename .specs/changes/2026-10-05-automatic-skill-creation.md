# 2026-10-05 — automatic skill creation and dashboard inventory

- **Feature:** `.specs/features/skills/automatic-skill-creation.md`
- **Decision:** `.specs/decisions/ADR-019-intent-driven-skill-creation.md`
- **Validated:** model-directed creation for clear reusable procedures; assistant-selected global/project roots; `skill_list`/`skill_create` with duplicate, input, and secret checks; CLI engine deployment/status/uninstall; generated-only `/api/skills`; loopback-only dashboard with Global/Project tabs and skill reader.
- **Verification:** `npm test` — PASS, 201/201; `npm run build` — PASS; `npm run check-cli` — PASS; final `npm run specs:validate` — PASS, 100 Markdown files, 14 feature specs, 19 ADRs, 143 local links; `GUARANA_OPENCODE_SMOKE=1 npm run smoke:pack` — PASS, 86-file packed CLI, no `node_modules`, OpenCode 1.18.34 discovers Guarana and generated project skills.
- **Independent review:** worker-verify PASS for criteria 1–8; overall AND PASS.
- **Boundary:** the OpenCode host smoke is providerless. A provider-backed fresh-session smoke on the 1.0.0 candidate remains required before publishing/tagging.
