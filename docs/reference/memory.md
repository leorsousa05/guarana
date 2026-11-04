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
For an active task, use targeted search in README.md and project-state.md, then
read only the matching feature sections and specific governing ADRs. Never read
`decisions/*` or the full tracker wholesale; this round-trip IS the memory
mechanism across sessions and models. Read-only questions do not bootstrap task
records.

Project decisions, bugs, solutions, and refactors are searched on demand and
never injected into assistant context. Confirmed current-project preferences
are eligible only when explicitly categorized as `agent_behavior`, `workflow`,
or `communication`; legacy uncategorized project preferences remain excluded.
Eligible current-project preferences rank before Global candidates. Eligible
unseen confirmed Global preferences are considered as complete records, without
truncating text, against the shared effective budget. The orchestrator ranks
Global direct preferences before exactly-one-hop related context and reached
superseded history; within each Global group it ranks `essential` before
`normal`, then newer records first. It includes a record only when the complete
compact serialized payload still fits, skips non-fitting records, and considers
later smaller records. Project, direct, related, and superseded preferences
retain distinct labeled trust groups; no second hop is traversed. New
preferences use the `agent_behavior`, `workflow`, or `communication` categories.
A legacy confirmed Global preference without a stored category remains eligible
and is read as `general` without rewriting its vault; a project preference
without a stored category is not eligible.

The optional positive-integer token budget is `memory.preferenceInjectionBudgetTokens`
in the existing global workflow settings (`$XDG_CONFIG_HOME/guarana/workflow.json`,
falling back to `~/.config/guarana/workflow.json`) or project settings
(`.guarana/workflow.json`); a project value overrides the global value. Set it in
Dashboard Settings → Workflow preferences → Current-project + Global preference injection budget
(tokens), or with `guarana workflow set memory.preferenceInjectionBudgetTokens
<positive-integer>` (`--project` selects the project override). When the setting
is unset, the model context limit is used when available; when both limits are
available, the lower one applies. If neither a configured budget nor a usable
model context limit is available, preference injection is omitted and the
generated prompt directs the assistant to report that no saved preference text
was injected and how to configure a budget. Injection notices report exact
injected and omitted record counts; if none fit, they say no preferences were
injected. With no usable configured or model budget, injection remains visibly
fail-closed. Dashboard presets are Automatic (unset), Less (8192), Medium
(32768), and More (65536); custom integer values remain supported. The
comparison uses UTF-8 serialized byte length against a token count as an
estimate only, not exact tokenization or remaining conversation capacity.

The Dashboard's aggregate estimate covers the selected project's categorized
preferences plus Global direct, related, and superseded candidates before budget
fitting or per-session deduplication; it returns only a candidate count and
serialized byte estimate.

New project records include categorized preferences as well as decisions, bugs,
solutions, and refactors. Legacy uncategorized project preferences, atoms, and
supernodes remain available through explicit read/search paths; they are not
eligible for injection, migrated, or newly written. Compact and prune preserve
legacy records and neither create nor delete atoms or supernodes.
Confirming a legacy draft requires explicit conversion to `decision`, `bug`,
`solution`, `refactor`, or `preference`. Preference conversion requires an
explicit `category` of `agent_behavior`, `workflow`, or `communication`;
implicit conversion to a legacy `atom` is not supported.

Human-readable `.specs` files are not scaffolded when a project or task starts.
Create or update them only on explicit request or after requirements discovery
establishes a durable cross-session need; ordinary one-off work stays in code and
tests. Specs are not injected wholesale: use the index and retrieve only relevant
feature sections, governing ADRs, or state excerpts. Explicit project-knowledge
and global-preference saves, plus the existing verified-workflow completion
record, are persisted as vault nodes; normal tool activity remains telemetry.
The disk tree remains the source of truth.

Automatic preference injection can be disabled per global/project scope with
`memory.autoInject`. It defaults to enabled; set it through Dashboard Settings or
`guarana workflow set memory.autoInject false` (add `--project` for a project
override), and restore inheritance with `guarana workflow clear memory.autoInject`.
Disabling it omits saved preferences from the automatic prompt, but leaves
explicit `memory_*` search/retrieval available.

Preference injection considers the eligible selected-project and complete
Global unseen candidate set and preserves every included record's full text.
Project preferences precede Global direct, related, and superseded candidates;
Global records retain their priority ordering. It adds complete records while
the entire compact payload fits, skips oversized records and continues
considering later ones, and reports injected/omitted counts.
Configure the optional positive-integer
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
checkpoints in operational workflow/run state; project-state records meaningful
completion and material blockers/status, not task starts or every stage. On restore, verify the checkpoint
matches; on mismatch, re-read from disk — never reconstruct from recall. Markdown
over vector DB (ADR-004): inspectable, diffable, append-only, zero infrastructure.
