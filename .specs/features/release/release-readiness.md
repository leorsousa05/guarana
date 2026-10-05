# Feature spec: Guarana release readiness

**Status:** VALIDATED
**Date:** 2026-10-02

## Summary

Make the next Guarana release reproducible and establish an explicit runtime,
package, and OpenCode host validation contract.

## Goal

Prepare release engineering for Guarana 1.0 without publishing or changing the
current package version.

## Acceptance criteria

1. `npm pack --dry-run --json` includes the license and release notes and no
   environment-local `node_modules`; the packed tarball installs and passes the
   CLI lifecycle and dashboard-startup smoke tests in an isolated prefix.
2. The package metadata and public docs declare Node.js >=22, and CI validates
   Node 22.x and 24.x while running tests, production build, bundle check, and
   `.specs` validation.
3. The OpenCode support policy is documented, and a release checklist requires
   recording the exact stable host version plus plugin/workflow/memory/dashboard
   smoke evidence.
4. The repository ships an MIT license and public changelog; known-issue entries
   are resolved or explicitly classified with current evidence.
5. `npm run audit` reports zero vulnerabilities for the dashboard build workspace
   and the standalone dashboard server lockfile.

## Definition of done

All acceptance criteria pass, the validated change is recorded in
`.specs/changes/`, and no package publish or git commit is performed by this task.

## Release-only final gate

Before publishing 1.0, run the provider-backed fresh-session OpenCode smoke test
in `RELEASING.md` and record its exact host version and result. Automated plugin
resolution, project skill discovery, and CLI engine health were validated here
against OpenCode 1.18.34.
