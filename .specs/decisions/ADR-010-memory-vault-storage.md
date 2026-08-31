# ADR-010 — Memory vault storage layout: `.guarana/memory/` (project) + `~/.config/guarana/memory/` (user)

**Status:** Accepted (2026-08-30) · append-only

## Context
Memory data must be local to the project and to the user, human-inspectable (JSON/YAML only), and project data must be shareable via export/import. Machine-generated memory does not belong in `.specs/` — that tree is the human-curated system of record (ADR-004); mixing machine-generated graph data into it would pollute "disk is truth".

## Decision
Two vaults:
1. **Project vault**: `<project>/.guarana/memory/` — graph (`nodes.jsonl`, `edges.jsonl`), `config.json` (compaction threshold, embedding provider, capture toggles), `drafts/`. The directory lives inside the versionable project tree but **must be gitignored** (the `memory init` command adds the `.gitignore` entry). Sharing happens via explicit `memory export` / `memory import`, never via git.
2. **User vault**: `~/.config/guarana/memory/` — private, never exported by default; same schema.

Serialization: JSONL (one node/edge per line) — append-friendly, diffable, human-inspectable, no binary formats. Telemetry about memory operations follows the existing pipeline (append to `<project>/.specs/state/telemetry/events.jsonl`), reusing the dashboard reader.

## Tradeoffs
- JSONL is not a graph database; queries load the file set into memory. Acceptable at project scale (thousands of nodes); compaction (Slice 4) bounds growth.
- A new `.guarana/` top-level dir appears in user projects; the gitignore automation prevents accidental commits of potentially sensitive drafts.

## Consequence
Recorded in `.specs/features/memory/memory.md`. Answered via Rule 0 (2026-08-30).
