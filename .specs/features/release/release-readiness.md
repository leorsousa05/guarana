# Feature spec: Guarana release readiness

**Status:** VALIDATED
**Date:** 2026-10-02

## Summary

Make Guarana releases reproducible with an explicit runtime and package contract,
without package, release, or OpenCode-host smoke-test gates.

## Goal

Prepare release engineering for Guarana 1.0 without publishing or changing the
current package version.

## Acceptance criteria

1. `npm pack --dry-run --json` includes the license and release notes and no
   environment-local `node_modules`; this is package-content inspection only
   and does not install or execute the packed tarball.
2. The package metadata and public docs declare Node.js >=22, and CI validates
   Node 22.x and 24.x while running tests, production build, bundle check, and
   CLI parity and `.specs` validation, with no smoke tests.
3. The OpenCode support policy is documented, and maintained policy explicitly
   retires all package/release/OpenCode-host smoke tests and forbids running or
   reintroducing them as development, CI, or release gates.
4. The repository ships an MIT license and public changelog; known-issue entries
   are resolved or explicitly classified with current evidence.
5. `npm run audit` reports zero vulnerabilities for the dashboard build workspace
   and the standalone dashboard server lockfile.

## Definition of done

All acceptance criteria pass, the validated change is recorded in
`.specs/changes/`, and no package publish or git commit is performed by this task.

## Release-only final gate

Package, release, and OpenCode-host smoke tests are retired and MUST NOT be run
or reintroduced as development, CI, or release gates. The prior OpenCode 1.18.34
plugin-resolution, project-skill-discovery, and CLI-engine-health result is
historical evidence only; it does not create a future smoke-test requirement.
