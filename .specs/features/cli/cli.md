# Feature spec: guarana CLI

**Status:** SHIPPED (human final gate accepted 2026-08-21)
**Date:** 2026-08-21

## Goal
A Node.js CLI named `guarana` that installs/uninstalls/lists/updates the guarana skill suite for OpenCode.

## Commands
- `guarana install [--project]` — install the skill suite.
  - Default (global): copy `skills/guarana/` → `~/.agents/skills/guarana/`.
  - `--project`: copy into `./skills/guarana/` of the current working directory.
- `guarana uninstall [--project]` — remove the installed suite from the target.
- `guarana list [--project]` — show installed skills and version at the target.
- `guarana update [--project]` — re-install from the CLI's bundled skills (overwrites target).
- `guarana --version`, `guarana --help`.

## Addendum 2026-08-21: plugin command
- `guarana plugin install [--project]` — install the telemetry plugin (`plugin/guarana-telemetry.js`, bundled in the CLI package):
  - Default (global): `~/.config/opencode/plugins/guarana-telemetry.js`
  - `--project`: `./.opencode/plugins/guarana-telemetry.js`
- `guarana plugin uninstall [--project]` — remove it.
- Same guard semantics: refuse to overwrite a file that exists and was not installed by guarana (compare content hash against bundled copy; if identical or absent → proceed; else exit 1 with message).
- `guarana list` also reports plugin presence at the target.

### Acceptance (addendum)
7. `guarana plugin install` → file at `~/.config/opencode/plugins/guarana-telemetry.js`, byte-identical to bundle.
8. `guarana plugin install --project` in temp dir → `./.opencode/plugins/guarana-telemetry.js`.
9. Pre-existing foreign file at target → refused, exit 1, file untouched.
10. `guarana plugin uninstall` removes only guarana-installed plugin.
11. `guarana list` shows plugin installed/not-installed.
12. `--help` documents the plugin command.

## Addendum 2026-08-21b: `web` command
- `guarana web [--port N]` — start the guarana dashboard and open it in the browser.
- The CLI bundles the dashboard: `cli/dashboard/` contains `server/` source + the **prebuilt** frontend (`web/dist/`, committed at build time).
- On run: if `cli/dashboard/server/node_modules` is missing → run `npm install --omit=dev` there once (network required, print a clear message); then spawn `node server/index.js` with **cwd = user's current project dir**, env `GUARANA_DASH_PORT` (default 4200, `--port` overrides).
- Open browser: `xdg-open` (Linux) / `open` (macOS), best-effort, never fail the command if opening fails. `--no-open` flag skips it.
- Server runs in foreground; Ctrl+C stops it (child process is killed).

### Acceptance (addendum)
13. With deps pre-installed in the bundled server dir: `guarana web --port 4399 --no-open` from a temp project dir → server answers on 4399 with correct tracker data for THAT temp project's `.specs/` (proves cwd forwarding).
14. `--help` documents `web`.
15. Ctrl+C / SIGTERM to the CLI stops the child server (port freed).
16. Missing-deps path: with node_modules absent, command runs `npm install --omit=dev` (verifiable by output/message; may be checked with a stubbed npm on PATH to avoid network in tests).

## Constraints
- Node.js, stdlib only (`fs`, `path`, `os`). No runtime dependencies.
- Single bin entry `guarana` via `package.json` (`bin` field).
- Skills are bundled inside the CLI package (copied from repo `skills/` at publish/dev time, or referenced relative to the CLI source).
- Idempotent install: safe to run twice; prints what it did.
- Refuses to overwrite a non-guarana directory at the target (guard: check for `SKILL.md` with guarana marker or a `.guarana-version` stamp file written on install).

## Verifiable condition (acceptance)
From a temp HOME:
1. `node bin/guarana.js install` → `~/.agents/skills/guarana/SKILL.md` and all 7 sub-skill SKILL.md files exist; stamp file present.
2. `guarana list` prints the 7 skills.
3. `guarana install --project` in a temp dir → `./skills/guarana/` populated.
4. `guarana uninstall` removes the global install cleanly.
5. `guarana update` re-installs without error.
6. `--help` and `--version` work.
