# Change: features layout restructure — 2026-08-21

**Status:** PENDING — worker-verify, then human gate

## What changed
Per human decision, restructured `.specs/features/` from a single project umbrella (`features/guarana/`) to a per-feature layout:
- Grouped the 7 skill specs (`plan.md`, `build.md`, `code.md`, `verify.md`, `remember.md`, `debug.md`, `measure.md`) as the guarana suite feature, keeping them grouped under `features/guarana/` with their `proofs/` and `audits/` inside.
- Moved `overview.md` up to `features/overview.md`.
- Moved `cli.md` → `features/cli/cli.md`.
- Moved `dashboard.md` → `features/dashboard/dashboard.md`.

## Cross-references updated
- `.specs/README.md` — tracker spec rows for CLI/dashboard now point to `features/cli/cli.md` and `features/dashboard/dashboard.md`; index line now lists the split layout.
- `.specs/decisions/ADR-001-project-root.md` — ledger feature path now `.specs/features/` (one dir per feature).
- `.specs/decisions/ADR-004-memory-location.md` — specs → `.specs/features/*`.
- `.specs/changes/{2026-08-21-cli,dashboard,dashboard-design}.md` — moved spec links updated.
- `.specs/features/overview.md` — the 7 skill links now point to `guarana/*.md`.
- `.specs/features/dashboard/dashboard.md` — Features category definition + tree acceptance criterion reflect the new layout.
- `dashboard/web/src/App.jsx` — Features grouping + `isDocPath` now cover all feature dirs (overview + guarana/ + cli/ + dashboard/).
- `skills/guarana/skills/{plan,remember}/SKILL.md` and the CLI-bundled copies — restore step 4 references `.specs/features/` (one directory per feature).

## Unchanged (by design)
- The 7 skill-proof links and `features/guarana/proofs/*` paths stay (skills stay grouped).
- `.specs/architecture.md`, `.specs/state/project-state.md` — reference `features/guarana/proofs/` which stays put.
- The dashboard server's decisions scan still targets `features/guarana/` (the 7 skill specs remain there).

## Verification
Pending worker-verify, then human gate.