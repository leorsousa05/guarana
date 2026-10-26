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

Global preference injection selects the complete eligible active preference
set and preserves its text. The whole serialized payload is injected only when
it fits the effective budget; otherwise an explicit notice is shown and no
preference content is included. Configure the optional positive-integer
`memory.preferenceInjectionBudgetTokens` in global workflow settings
(`$XDG_CONFIG_HOME/guarana/workflow.json`, falling back to
`~/.config/guarana/workflow.json`) or project settings
(`.guarana/workflow.json`). Project values override global values, and clearing
a project value restores inheritance. When configured and a model
`limit.context` is available, the lower limit applies; when unset, model context
is used. If neither provides a usable budget, injection fails closed. The hook
compares UTF-8 serialized byte length with the token budget as an estimate, not
exact tokenization or remaining conversation capacity. Configure it in
Dashboard Settings or with `guarana workflow set
memory.preferenceInjectionBudgetTokens <positive-integer>`; use
`guarana workflow clear memory.preferenceInjectionBudgetTokens` to clear it
(add `--project` for project settings).

## Silent context truncation
Contexts truncate without notice. Keep transient stage, budget, and current-step
checkpoints in operational workflow/run state; project-state records task start/end
and material blockers/status, not every stage. On restore, verify the checkpoint
matches; on mismatch, re-read from disk — never reconstruct from recall. Markdown
over vector DB (ADR-004): inspectable, diffable, append-only, zero infrastructure.
