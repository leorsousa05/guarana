# ADR-002 — Skill naming and namespace

**Status:** Accepted (2026-08-21) · append-only

## Context
Seven skills need final names that trigger reliably and never collide.

## Decision
Namespace `guarana:*`. Final names: `guarana:plan`, `guarana:build`, `guarana:code`, `guarana:verify`, `guarana:remember` (core); `guarana:debug`, `guarana:measure` (optional, trigger-only). Names are never renamed. The substring "loop" appears in no path under `skills/` or `.specs/`.

## Tradeoffs
- Short generic stems (`code`, `build`) risk collision with other suites; the `guarana:` namespace prefix is the mitigation.
- Optional skills excluded from default load paths keeps steady-state context small; cost is they can be forgotten — mitigated by explicit triggers in the suite index.
