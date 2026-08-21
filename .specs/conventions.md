# Guarana — Conventions

## Naming
- Project name is **guarana** — final, never renamed.
- Skill namespace is `guarana:*`; skills are always addressed as `guarana:plan`, `guarana:build`, `guarana:code`, `guarana:verify`, `guarana:remember`, `guarana:debug`, `guarana:measure`. These names are final.
- The substring "loop" never appears in any file path. Paths use feature names (e.g., `docs/reference/outer-loop-triggers.md` is the sole tolerated exception as a document *title* — path segments still avoid it where possible; the canonical rule is: no path under `skills/` or `.specs/` contains "loop").

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
