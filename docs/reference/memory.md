# Memory — Disk Over Context

## Axiom
The model forgets between runs; only files survive (hard truth 3). Anything that exists only in a context window is treated as nonexistent (ADR-004).

## Where things live (guarana)
- Status → `.specs/README.md` + `.specs/state/project-state.md`
- Decisions → `.specs/decisions/ADR-*.md` (append-only)
- Failures → `.specs/state/known-issues.md`
- Specs/acceptance → `.specs/features/*` (one directory per feature; skills under `features/guarana/`)
- Evidence → `.specs/features/guarana/proofs/*` (append-only, written before commit)
- Change log → `.specs/changes/*.md`

## Restoration round-trip
Every run: read README.md → project-state.md → decisions/* → current feature spec. That round-trip IS the memory mechanism — across sessions, across models.

The orchestrator automatically creates missing spec scaffolding, initializes the
project vault, and injects relevant confirmed vault context for the active task.
The disk tree remains the source of truth; drafts are never injected.

## Silent context truncation
Contexts truncate without notice. Defenses: checkpoint open facts at stage boundaries; on restore, verify the checkpoint matches; on mismatch, re-read from disk — never reconstruct from recall. Markdown over vector DB (ADR-004): inspectable, diffable, append-only, zero infrastructure.
