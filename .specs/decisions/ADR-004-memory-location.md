# ADR-004 — Memory location for guarana:remember

**Status:** Accepted (2026-08-21) · append-only

## Context
The model forgets between runs; only files survive. A memory mechanism must pick a physical home.

## Decision
Memory lives in `.specs/` — markdown files only, not a vector DB. Specifically: status → `.specs/README.md` + `.specs/state/project-state.md`; decisions → `.specs/decisions/ADR-*.md` (append-only); failures → `.specs/state/known-issues.md`; specs → `.specs/features/*` (one directory per feature); evidence → `.specs/features/guarana/proofs/*`; change log → `.specs/changes/`.

## Rationale
This decision depends on `.specs/` persisting over all context-window truth: any fact that exists only in a context window is treated as nonexistent. Restoration order every run: README.md → project-state.md → decisions/* → current feature spec.

## Tradeoffs
- Markdown over vector DB: loses semantic search, gains inspectability, diffability, append-only integrity, and zero infrastructure. Retrieval is by path convention, not embedding — sufficient at this scale.
