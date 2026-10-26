# ADR-042 — Project knowledge and user preference separation

**Status:** Accepted (2026-10-25) · implementation TASKED · append-only

## Context

The two existing memory vaults currently serve distinct storage scopes, but
project knowledge and global user preferences are both eligible for automatic
assistant context. This follow-up separates project knowledge from user
preferences without adding a vault or rewriting existing data. No actual vault
entries or contents were inspected for this decision.

## Decision

1. Retain the existing two physical roots: project memory and the existing
   global XDG user vault. Do not create a third vault or preference database.
2. New project-scoped memory writes are limited to `decision | bug | solution |
   refactor`. Project memory remains searchable on demand, but project-scoped
   knowledge is not eligible for automatic assistant-context injection.
3. New global user preference writes use type `preference` exclusively and a
   separate `category` field whose allowed values are exactly
   `agent_behavior | workflow | communication`. New writes outside the accepted
   type/scope/category matrix are rejected.
4. Global user preferences remain eligible for bounded automatic injection.
   Confirmed global preferences with no stored category are read compatibly as
   category `general`; this is a read-time default and does not rewrite stored
   data. Render the category with injected preference content.
5. Existing project-scoped `preference` records remain searchable as legacy data
   but are neither moved, copied, nor automatically reclassified, and are
   excluded from automatic injection. Existing project `atom` and `supernode`
   records are also explicit legacy-read compatibility cases: they must not
   expand the accepted new project-write types and must not enter automatic
   context. Resolve their read compatibility without automatic migration.
6. Do not mutate actual vaults during implementation. Preserve existing
   automatic-context caps, security controls, and trust safeguards. If
   implementation discovers a necessary compatibility exception, record that
   decision explicitly before broadening behavior.

This decision supersedes only the automatic project-context injection clauses
of ADR-014 (task-relevant project context) and ADR-038 (project-match selection
and project-fact rendering), and only when this follow-up is implemented. All
other provisions and historical statuses in those append-only ADRs remain
unchanged.

## Alternatives considered

- Continue automatically injecting project knowledge — rejected; project
  knowledge is available through explicit search instead.
- Silently move, copy, or reclassify legacy records — rejected; legacy data
  remains in place and retains its existing stored classification.
- Create a third preference vault/database — rejected; retain the two existing
  physical vault roots.

## Consequences

Automatic context contains eligible global preferences, not project memory.
Project knowledge remains available through explicit search, and legacy global
preferences without category retain read compatibility without disk writes.
Implementation and proof remain pending in the [separation follow-up](../features/memory/project-knowledge-and-user-preferences-separation.md).

## Clarification — strict legacy lifecycle (2026-10-25)

For this follow-up, project knowledge remains limited to `decision | bug | solution | refactor`, with no legacy-type exceptions. Compaction must not write or delete legacy atom or supernode records: `memory prune` creates no supernodes, deletes no legacy atoms, and does not automatically clean up existing legacy supernodes. A legacy draft can be discarded; confirmation requires an explicit conversion to one of the four allowed project types. This clarification supersedes the prior compaction behavior only for this follow-up and leaves earlier accepted ADR text intact.

## Clarification — project archive import (2026-10-25)

The strict project type/scope/category matrix also applies to `memory import`. The required import contract is to validate the complete archive, nodes, and edges against that matrix before any target write, and to reject unsupported legacy project node types. The current implementation does not yet enforce this contract; correction and proof remain pending.

## Implementation and proof update — 2026-10-25

Fresh independent `worker-verify` found no remaining implementation defect. Criteria 1–7, 9–11, and 13 pass; criterion 12 remains BLOCKED because browser binaries, Playwright/Puppeteer, and a browser tool are unavailable. Criterion 8 is not complete until interactive browser proof exists and independent verification returns an overall PASS. The verifier confirmed explicit null-scope rejection; engine, prompt, and Dashboard filtering of legacy secret-tagged records; project-only injection; category/general behavior; strict prune and draft lifecycle; canonical and CLI documentation; and complete archive preflight. Criterion 13 verified archive shape, project type/scope/category matrix, edge integrity, and pre-write rejection behavior. This update supersedes only the pending implementation/proof statement in the archive-import clarification; the accepted decision and prior text remain unchanged.

Primary gates passed: `npm test` (640/640), `npm run build`, `npm run check-cli`, `npm run specs:validate` (236 Markdown files, 92 feature specs, 42 ADRs, 257 local links, zero issues), and `git diff --check`. Independent verification reran `npm test` (640/640), `npm run check-cli`, specs validation, and diff-check successfully; it did not rerun build under its no-edit constraint, and the primary build PASS is retained. Focused Dashboard canonical/mirror tests passed 32/32, and security injection/temp-fixture checks passed. No actual memory vault contents were inspected or mutated.
