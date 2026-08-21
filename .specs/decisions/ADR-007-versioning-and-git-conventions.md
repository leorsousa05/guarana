# ADR-007 — Project versioning and git commit conventions

**Status:** Accepted (2026-08-21) · append-only

## Context
The project ships as an installable package (root `package.json`, version surfaced via `guarana --version`). Without a forced version policy, feature commits can land without a version bump, and commit messages drift into inconsistent styles, harming changelog generation and release discipline.

## Decision

1. **Always bump the version on shipped changes.** Every commit that ships user-facing behavior must bump the version in root `package.json` (0.1.0 → 0.2.0 → …). Patch/minor-major semantics follow the size of the change (ADR-005 budgets imply feature-sized work → minor bump by default).
2. **Use Conventional Commits.** Every commit message is `<type>(<scope>): <subject>` with types `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `chore`, and `breaking` for backward-incompatible changes. The body states the what and why, and cites the worker-verify proof when applicable.
3. **Never commit or push without explicit human instruction.**

## Tradeoffs

- A mandatory bump adds a small step per change, but guarantees the shipped package version never silently lags the code.
- Conventional Commits add structure; in exchange the log is greppable and auto-changelog-able.

## Consequence

Recorded in `.specs/conventions.md` (Versioning and Git conventions sections). Enforced on every future commit by guarana:plan / guarana:build / worker-code.