# 2026-10-02 — Guarana 1.0 release readiness

- **Feature:** `.specs/features/release/release-readiness.md`
- **Decision:** `.specs/decisions/ADR-018-release-support-contract.md`
- **Validated:** Node.js >=22 contract; CI matrix for 22.x/24.x; deterministic CLI bundle generation excluding local dependencies; npm tarball includes license/release docs and no `node_modules`; isolated install/list/plugin-health/dashboard-startup/uninstall smoke; project skills are installed in OpenCode's discoverable `.opencode/skills/` path; stale known issues classified; Vite 6.4.3 and both dashboard lockfiles audit clean.
- **OpenCode host evidence:** `GUARANA_OPENCODE_SMOKE=1 npm run smoke:pack` passed on OpenCode 1.18.34; all three plugins resolve and `guarana:plan` is discoverable.
- **Verification:** `npm test` 189/189 on Node 22.23.3 and 24.20.0; `npm run build`, `npm run check-cli`, `npm run specs:validate`, `npm run audit`, and `npm run smoke:pack` pass on both supported Node lines.
- **Artifact:** `guarana-0.8.6.tgz` smoke manifest contained 80 files and no `node_modules` paths.
- **Release-only next action:** run the provider-backed fresh-session test on the 1.0.0 candidate and record its exact OpenCode version before publishing.
