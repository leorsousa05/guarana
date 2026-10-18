# Feature spec: .specs Filename Conventions and Worker-specs Adherence

**Status: VALIDATED**

## Goal
Define deterministic, category-specific paths and names for future .specs records, and make worker-specs follow those rules without renaming historical records.

## Requirements
- Record forward-looking filename rules in .specs/conventions.md and align the canonical worker-specs procedure and generated profile permission source with those rules.
- Do not add strict filename rejection to guarana specs validate and do not rename or migrate existing records.

## Assumptions and scope
- Existing paths are historical facts, not grounds for speculative renames; the feature record, tracker, and project-state remain TASKED until independent verification.
- The established domain directories and fixed documents/indexes remain the applicable categories; use the closest existing feature domain for new feature records.
- Human-readable .specs/conventions.md naming rules; canonical worker-specs procedure; generated worker profile permission/source required to edit only the conventions document in addition to existing permissions.
- No CLI validator behavior changes and no unrelated record migration or bulk rename.

## Acceptance criteria
1. .specs/conventions.md defines a clear, compact category table with examples: general new Markdown names are lowercase ASCII kebab-case except fixed names and ADR prefixes; slugs are stable, concise accepted-scope slugs; same-scope records are searched/reused; new features use an appropriate existing domain or one new lowercase-kebab domain only if none fits, without arbitrary nested folders; features use .specs/features/<domain>/<scope-slug>.md, features/overview.md is fixed, and root-level legacy/bootstrap files are retained but not precedent; ADRs use decisions/ADR-NNN-<decision-slug>.md with the next number after the maximum and are append-only/no-reuse; changes use changes/YYYY-MM-DD-<feature-slug>[-<slice-slug>].md, dated at validated delivery, written only after validation, with unique same-day records allowed for distinct scopes; state uses only the listed fixed paths, including all existing telemetry files and transient worker-specs-handoff.json; fixed docs/indexes retain their exact names; nested evidence uses features/<domain>/audits/<subject>-audit.md and proofs/<subject>-proofs.md, with subject based on the feature or canonical skill slug, and <subject>-smoke.jsonl only when a raw transcript is needed; feature/evidence names omit dates, statuses, versions, and session IDs.
2. The canonical worker-specs procedure directs the writer to select or reuse feature paths under the conventions and to preserve historical paths without speculative renames.
3. Generated worker-specs permissions add only the required edit permission for .specs/conventions.md while retaining the existing deny-by-default boundaries.
4. Canonical and CLI mirrors of the changed worker-specs procedure/profile-generation source are synchronized.
5. Existing record names remain unchanged; no strict filename-rejection behavior is added to guarana specs validate and no unrelated record is migrated.
6. After the implementation, node bin/guarana.js specs validate . --json returns ok:true.

## Implementation milestone (worker-code report)
- Added mandatory convention lookup, same-scope reuse, path-selection, and no-renames guidance plus explicit-only convention edits to canonical `skills/guarana/skills/specs/SKILL.md`; synced the CLI mirror at `cli/skills/...`.
- Added only the `.specs/conventions.md` generated-profile edit permission in `cli/lib/agents.js`. Tests assert the instruction, exact allowlist boundary, and deny-by-default behavior.
- `node --test cli/lib/agents.test.js` passed 4/4. `npm run sync-cli`, `npm run check-cli`, and `git diff --check` passed.
- Primary regenerated local managed worker profiles with `agents.installWorkerAgents(true)`; worker-specs status was `ok (up to date)`, and `opencode reload` succeeded.
- No strict validator behavior changed and no existing file was renamed. This is implementation evidence only; independent verification remains pending and shipping is not confirmed.

## Implementation correction milestone (worker-code report)
- Clarified `.specs/conventions.md` to forbid renaming, migrating, or normalizing any existing record or path, whether individually or in bulk.
- Canonical `skills/guarana/skills/specs/SKILL.md` and its synced CLI mirror now direct feature-path selection to use the closest existing domain when it fits, or otherwise create exactly one new direct lowercase-kebab domain for the bounded subsystem; arbitrary nested feature directories are forbidden. They also explicitly forbid renaming, migrating, or normalizing existing records or paths, singly or in bulk.
- After the correction, `node --test cli/lib/agents.test.js` passed 4/4, `npm run check-cli` passed, and `git diff --check` passed. No validator behavior changed and no legacy file was renamed.
- Targeted generated worker profiles were refreshed again with `agents.installWorkerAgents(true)`; worker-specs reports `ok (up to date)`, and `opencode reload` succeeded.
- This is implementation evidence only. Fresh independent verification remains pending; no VALIDATED or SHIPPED status is claimed.

<!-- guarana:record:start -->
Status: VALIDATED
Proof: Fresh independent worker-verify overall PASS (5/5) for .specs/features/orchestrator/spec-filename-conventions.md; the corrected PASS supersedes the initial FAIL while preserving the recorded correction history. .specs/conventions.md contains the category rules/examples, stable kebab slugs, same-scope reuse, fallback domain/no-nesting policy, and explicit prohibition on renaming, migrating, or normalizing any existing path. Canonical and CLI worker-specs skills compare byte-identical and prescribe convention lookup, path selection/reuse, correct domain fallback, no legacy path changes, and explicit-only convention edits. The generated worker profile grants exactly .specs/conventions.md as the new path, retains prior paths and deny-by-default, rejects backup/subpath variants, and reports status ok (up to date). node --test cli/lib/agents.test.js PASS (4/4); npm run check-cli PASS; git diff --check PASS; guarana specs validate . --json PASS (ok:true, 179 files, 0 issues). cli/lib/specs-validator.js is unchanged, no strict filename validator rule was added, and no relevant rename/deletion occurred. Full worktree cleanliness is not claimed. No release or ship occurred; VALIDATED only.
Change: none
<!-- guarana:record:end -->
