# ADR-036 — Retire package and OpenCode-host smoke tests

**Status:** Accepted (2026-10-22) · append-only

## Context

ADR-018 and the release readiness requirements made packed CLI lifecycle and
dashboard-startup smoke tests, plus latest-stable OpenCode-host smoke evidence,
part of release assurance. The package smoke also had a root `smoke:pack`
entrypoint and a CI invocation. The user explicitly decided to retire all
Guarana package/release/OpenCode-host smoke tests and to preserve historical
smoke results rather than rewriting them.

## Decision

1. All Guarana package, release, and OpenCode-host smoke tests are retired. They
   MUST NOT be run or reintroduced as development, CI, or release gates.
2. Remove `scripts/smoke-packed-cli.mjs`, the root package `smoke:pack` script,
   its CI invocation, and packed CLI lifecycle/dashboard-startup and
   latest-stable OpenCode-host smoke requirements from the release checklist.
3. Preserve ordinary unit/integration tests, build, CLI parity, specs
   validation, and `npm pack --dry-run --json` package-content inspection. The
   package inventory inspection does not install or execute the tarball and is
   not a smoke test.
4. Preserve historical smoke results and transcripts unchanged. This decision
   does not authorize a release action or change any release status.

This supersedes ADR-018's requirement to pass and record a release-time
OpenCode-host smoke test, and other future-facing smoke requirements, only to
the extent they conflict with this decision. ADR-018's Node.js and package
artifact requirements remain in force.

## Alternatives considered

- Keep the existing packed CLI and latest-stable OpenCode-host smoke gates, as
  required by the prior release policy — rejected by the explicit decision to
  retire all such smoke tests.
- Retire only the packed CLI smoke while retaining the host smoke — rejected
  because the decision covers all package/release/OpenCode-host smoke tests.

## Consequences

- Release policy and implementation must contain no executable or instructional
  smoke-test gate, while the specified ordinary checks remain.
- Historical receipts and transcripts remain as evidence of what ran at the
  time; they are not instructions or future release requirements.
- This is a policy decision only. It does not validate the separate 1.4.0
  release, authorize release operations, or claim a version bump, tag,
  publication, commit, or push.
