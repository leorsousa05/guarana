# ADR-018 — 1.0 runtime and host support contract

**Status:** Accepted (2026-10-02) · append-only

## Context

The package README promised Node 18+, while package metadata did not declare a
minimum runtime and CI did not exercise a version matrix. Node 18 and 20 are no
longer maintained as of this 1.0 readiness decision. Guarana also depends on
OpenCode's plugin API, whose host compatibility needs release-time evidence.

## Decision

1. Guarana 1.0 requires Node.js 22 or newer. CI validates Node 22.x and 24.x;
   the npm `engines` field and user-facing docs carry the same minimum.
2. The supported OpenCode target is the latest stable release. Each release
   candidate must record the exact host version and pass the documented plugin,
   workflow, memory, and dashboard smoke test. Earlier host versions are not
   promised unless separately validated.
3. npm release artifacts must be generated from the canonical CLI bundle and
   must not contain environment-local `node_modules` directories.

## Alternatives considered

- Retain Node 18+ — rejected because it promises support for end-of-life runtimes.
- Set Node 20+ — rejected because Node 20 is also end-of-life at this decision date.
- Claim support for a fixed OpenCode range based on one installed version —
  rejected because no historical minimum-version compatibility evidence exists.

## Consequences

- Node 18/20 users must upgrade Node before installing the next Guarana release.
- CI covers maintained Node lines, while the release checklist verifies the
  external OpenCode host API and records its exact version.
- Packaging and smoke checks become part of the normal release gate.
