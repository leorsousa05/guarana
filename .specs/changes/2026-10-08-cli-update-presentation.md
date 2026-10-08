# Change — Guarana update terminal presentation

**Status:** VALIDATED · 2026-10-08

`guarana update` now presents a compact boxed summary with version transition, destination, refreshed runtime components, and restart guidance. Color is limited to interactive terminals that support it; non-TTY and `NO_COLOR` output stays plain. The update still uses the existing install path and its ownership guards, while suppressing nested install logs for a clean result.

## Files

- `cli/commands/update.js` — update summary formatting and terminal-aware color.
- `cli/commands/install.js`, `cli/commands/plugin.js` — optional quiet mode for nested deployment.
- `cli/commands/update.test.js` — project/global update, version, output, and styling coverage.
- `.specs/features/cli/cli.md` — acceptance criteria 27–29.

## Validation

- `node --test cli/commands/update.test.js cli/commands/plugin.test.js` — PASS (5/5).
- `npm run check-cli` — PASS.
- `npm run specs:validate` — PASS (111 Markdown, 17 feature specs, 20 ADRs, 167 local links).
- `git diff --check` — PASS.
- Independent worker-verify session `ses_ee67b4010ffeJhDGph4ujFWRba` — PASS (3/3 criteria).
