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

Project knowledge is searched on demand and is never injected into assistant
context. Every eligible confirmed active global user preference is included
losslessly, without truncating its text, only when the complete serialized
preference payload fits the effective budget; otherwise the entire payload is
omitted. Direct preferences, confirmed related preferences exactly one graph
hop away, and reached superseded preferences retain distinct labeled trust
groups; no second hop is traversed. New preferences use the `agent_behavior`, `workflow`, or
`communication` categories, while a legacy confirmed global preference without
a stored category is read as `general` without rewriting its vault.

The optional positive-integer token budget is `memory.preferenceInjectionBudgetTokens`
in the existing global workflow settings (`$XDG_CONFIG_HOME/guarana/workflow.json`,
falling back to `~/.config/guarana/workflow.json`) or project settings
(`.guarana/workflow.json`); a project value overrides the global value. Set it in
Dashboard Settings → Workflow preferences → Global preference injection budget
(tokens), or with `guarana workflow set memory.preferenceInjectionBudgetTokens
<positive-integer>` (`--project` selects the project override). When the setting
is unset, the model context limit is used when available; when both limits are
available, the lower one applies. If neither a configured budget nor a usable
model context limit is available, preference injection is omitted and the
generated prompt directs the assistant to report that no saved preference text
was injected and how to configure a budget. The comparison uses UTF-8 serialized
byte length against a token count as an estimate only, not exact tokenization or
remaining conversation capacity.

New project records are limited to decisions, bugs, solutions, and refactors.
Project preferences, atoms, and supernodes are legacy-only records available
through explicit read/search paths; they are not injected, migrated, or newly
written. Compact and prune preserve legacy records and neither create nor delete
atoms or supernodes.
Confirming a legacy draft requires explicit conversion to `decision`, `bug`,
`solution`, or `refactor`; implicit atom confirmation is not supported.

Missing spec scaffolding is created only for a clear mutation request or
explicit workflow-skill command; read-only requests do not cause task-specific
record writes. Explicit project-knowledge and global-preference saves, plus the
existing verified-workflow completion record, are persisted as vault nodes;
normal tool activity remains telemetry. The disk tree remains the source of
truth.

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
