# ADR-031 — Project selector and memory-search filter

**Status:** Accepted (2026-10-19) · append-only

## Context

The CLI uses `--project` as a global project-scope selector, while memory search
also needs a project-local filter. Unconditionally stripping `--project` as a
global option consumes the nested memory-search filter before it reaches the
handler. The memory vault remains local to `.guarana/memory/`; a global scope
selector does not itself filter memory.

## Decision

1. For all current command forms other than `memory search`, `--project` remains
   the global project-scope selector wherever it appears.
2. After the `memory search` subcommand, `--project <HASH>` is a project-local
   memory filter passed to the handler. Before `search`, `--project` remains the
   global selector.
3. `guarana --project memory search --project HASH` supports both selectors.
   Other forms, including `install --project`, `plugin install --project`, and
   `advisor ... --project`, remain supported.
4. The prior parser collision was not an approved memory-filter contract. This
   decision governs CLI parsing only and requires no persisted-data migration.

## Alternatives considered

- Retain unconditional global stripping — rejected because it loses the nested
  memory-search filter.
- Recognize only the post-`search` selector as nested — accepted because it
  fixes that loss while preserving all other global `--project` forms.

## Consequences

- Only a `--project` selector after `memory search` is passed as the memory
  filter; global scope selection remains available in the other supported
  positions and command forms.
- The memory vault remains at the current project's `.guarana/memory/` path.
- No persisted data is migrated.
