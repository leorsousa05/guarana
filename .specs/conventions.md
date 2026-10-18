# Guarana — Conventions

## Naming
- Project name is **guarana** — final, never renamed.
- Skill namespace is `guarana:*`; skills are always addressed as `guarana:plan`, `guarana:build`, `guarana:code`, `guarana:verify`, `guarana:remember`, `guarana:debug`, `guarana:measure`. These names are final.
- The substring "loop" never appears in any file path. Paths use feature names (e.g., `docs/reference/outer-loop-triggers.md` is the sole tolerated exception as a document *title* — path segments still avoid it where possible; the canonical rule is: no path under `skills/` or `.specs/` contains "loop").

## Human-authored `.specs` paths
New human-authored Markdown names use lowercase ASCII kebab-case, except fixed names and the `ADR-NNN-` prefix. Derive a stable, concise scope slug from the accepted task; do not paste arbitrary request text or put dates, statuses, versions, or session IDs in feature/evidence names. Before creating a record, search for and update an existing record with the same scope; avoid duplicates.

| Category | Rule | Example |
|---|---|---|
| Features | Use `.specs/features/<domain>/<scope-slug>.md`. Prefer an appropriate existing domain; create one new lowercase-kebab domain only if none fits. Do not create arbitrary nested feature folders. `features/overview.md` is the fixed index. Retain other root-level feature files, including bootstrap/legacy exceptions, but do not use them as precedent for new specs. | `.specs/features/orchestrator/spec-filename-conventions.md`; `.specs/features/overview.md` |
| ADRs | Use `.specs/decisions/ADR-NNN-<decision-slug>.md`, with the next number after the highest existing ADR. ADRs are append-only; numbers are never reused. | `.specs/decisions/ADR-NNN-safe-profile-updates.md` (`NNN` is the next number) |
| Changes | Use `.specs/changes/YYYY-MM-DD-<feature-slug>[-<slice-slug>].md`, dated at validated delivery. Create only after validation. Distinct same-day records are allowed when scopes differ and filenames are unique. | `.specs/changes/YYYY-MM-DD-spec-filename-conventions.md` |
| State | Use established fixed paths only; do not invent ad hoc state filenames. | `.specs/state/project-state.md`; `.specs/state/known-issues.md`; `.specs/state/workflow.json`; `.specs/state/telemetry/{events.jsonl,token-usage.jsonl,memory-injection-state.json}`; transient `.specs/state/worker-specs-handoff.json` |
| Fixed docs/indexes | Preserve and update these exact paths; do not create alternate indexes. | `.specs/{README.md,architecture.md,conventions.md,glossary.md,project.md}`; `.specs/features/overview.md`; `.specs/changes/README.md`; `.specs/archive/README.md` |
| Evidence | Use `.specs/features/<domain>/audits/<subject>-audit.md` or `.specs/features/<domain>/proofs/<subject>-proofs.md`. The subject is the scoped feature slug or, for shared skill evidence, the canonical skill slug. Use `<subject>-smoke.jsonl` under the domain feature directory only when a raw transcript is needed. | `.specs/features/orchestrator/audits/spec-filename-conventions-audit.md`; `.specs/features/orchestrator/proofs/spec-filename-conventions-proofs.md`; `.specs/features/orchestrator/spec-filename-conventions-smoke.jsonl` |

Never rename, migrate, or normalize any existing path, whether individually or in bulk.

## Format
- Markdown only for specs, skills, ADRs, proofs, and ledgers.
- Skill files follow OpenCode's skill schema: YAML frontmatter with recognized fields only (`name`, `description`, optional `license`, `compatibility`, `metadata`, `allowed-tools`).
- OpenCode schema only: trigger and references live in the description / body, never as YAML keys — unknown frontmatter fields are ignored, so adding them would silently do nothing.

## Proof-before-commit
Every claim that a task passed is backed by a proof written BEFORE the commit. Proof files are append-only per committed task.

## Vague-word ban
The words **"support", "handle", "easier", "improve"** are prohibited in acceptance criteria and definitions of done. Every acceptance is a falsifiable claim with a runnable proof and demo I/O.

## Budgets
Every feature spec states its token budget per subagent, per-run cap, and wall-clock budget. Defaults per ADR-005.

## ASK-first gate
The ASK-first gate (Rule 0) always precedes implementation. Unanswered items are recorded as ADRs; the record must exist before work proceeds.

## Versioning
The project version (root `package.json`, read by `cli/main.js` for `guarana --version`) is ALWAYS bumped on every shipped change. No commit that ships user-facing behavior lands without a version bump.

## Git conventions
Every commit message follows the Conventional Commits format: `<type>(<scope>): <subject>`, where `type` is one of `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `chore` (and `breaking` for backward-incompatible changes). Body lines describe the what and why, and reference the proof (worker-verify PASS) when applicable. Do not commit/push without explicit human instruction.
