# Memory — Disk Over Context

## Axiom
The model forgets between runs; only files survive (hard truth 3). Anything that exists only in a context window is treated as nonexistent (ADR-004).

## Where things live (guarana)
- Durable task status → `.specs/README.md` + `.specs/state/project-state.md`
- Material architecture/contract/data/security/privacy/integration decisions with
  alternatives → `.specs/decisions/ADR-*.md` (append-only; not tactical choices)
- Confirmed reproducible product failures with a durable mitigation →
  `.specs/state/known-issues.md`
- Specs/acceptance → `.specs/features/*` (one directory per feature; skills under `features/guarana/`)
- Evidence → `.specs/features/guarana/proofs/*` (append-only, written before commit)
- Change log → `.specs/changes/*.md`

## Restoration round-trip
For an active task, restore relevant records from README.md → project-state.md →
decisions/* → current feature spec. That round-trip IS the memory mechanism —
across sessions, across models. Read-only questions do not bootstrap task records.

The orchestrator initializes the project vault and injects relevant confirmed
vault context for the active task. Missing spec scaffolding is created only for a
clear mutation request or explicit workflow-skill command; read-only requests do
not cause task-specific record writes.
Only explicit memory decisions, plus the existing verified-workflow completion
record, are persisted as vault nodes; normal tool activity remains telemetry.
The disk tree remains the source of truth; legacy drafts are never injected.

## Silent context truncation
Contexts truncate without notice. Keep transient stage, budget, and current-step
checkpoints in operational workflow/run state; project-state records task start/end
and material blockers/status, not every stage. On restore, verify the checkpoint
matches; on mismatch, re-read from disk — never reconstruct from recall. Markdown
over vector DB (ADR-004): inspectable, diffable, append-only, zero infrastructure.
