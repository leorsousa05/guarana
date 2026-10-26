---
name: guarana:memory
description: Use when searching, reviewing, or saving durable knowledge in the Guarana memory graph, including project knowledge and categorized global preferences. The orchestrator supplies the complete eligible global preference payload only when it fits the effective budget.
---

# guarana:memory

The orchestrator injects every eligible confirmed active global user preference
with full text, once per session and after context compaction, only when the
complete preference payload fits the effective budget. Direct, exactly-one-hop
related, and reached superseded preferences remain separate trust groups. If no
usable budget exists or the complete payload exceeds it, all preference content
is omitted with an explicit notice. Project knowledge is never automatically
injected; use explicit memory tools to search or retrieve it.
Use this skill for deeper searches, decision review, or inspecting the graph;
normal work does not require a `guarana:memory` command.

The memory system has a project graph and a private user graph. Project decisions,
bugs, solutions, and refactors live in `<project>/.guarana/memory/`; durable
"always/never" preferences live in `~/.config/guarana/memory/` and apply across
projects. The assistant judges user intent and invokes a memory tool when the
user states durable knowledge. Tool/file activity itself is telemetry, not memory.

## The memory tools
| Tool | When to call |
|---|---|
| `memory_search({query,type?,scope?,since?,until?,limit?})` | Search confirmed memory; scope can be `project`, `global`, or `both` (default). |
| `memory_get_context_for_task({task,scope?,limit?})` | Explicitly retrieve a bounded task-relevant subgraph from the selected scope(s); this tool is not automatic prompt injection. |
| `memory_save_decision({intent,decision,rejectedAlternatives?,tags?,author?})` | Backward-compatible project decision save. |
| `memory_save_node({type,scope,intent,summary,category?,priority?,relatedTo?,tags?,author?})` | Save project `decision`, `bug`, `solution`, or `refactor`; or a global `preference` with required category `agent_behavior`, `workflow`, or `communication`. Optional priority (`essential` or `normal`) applies only to global preferences. |
| `memory_review_draft({id,action:"confirm"\|"discard",edits?})` | Discard a legacy draft, or confirm only with an explicit `edits.type` conversion to project `decision`, `bug`, `solution`, or `refactor`. |
| `memory_delete_node({id,scope,confirm:true})` | Hard-delete one confirmed node by exact ID; matching `project`/`global` scope and explicit confirmation are mandatory. Drafts remain on `memory_review_draft`. |
| `skill_list({scope?})` | Check Guarana-generated skills in project/global scopes before proposing a new reusable procedure. |
| `skill_create({name,description,scope,content})` | Persist a clear reusable procedure or project context as a native OpenCode skill; the tool never overwrites an existing name. |

## Explicit memory lifecycle
Automatically save only unmistakable durable intent with `memory_save_node`.
If durability or intent is ambiguous, do not save and ask one clarifying question.
If the user asks to put guidance in a skill or document, honor that destination
without also creating duplicate memory unless memory is separately requested.
Before every save, call `memory_search` in the intended scope and avoid duplicates;
use a `supersedes` link when a preference changes. Add other `relatedTo` links only
when the relation is real. Ordinary requests, temporary instructions, inferred
personal facts, tool calls, file edits, prompts, and tool input/output do not create
memory nodes. Report the saved type and scope only after a successful tool result.
`memory_save_decision` remains a compatible project-decision-only save.
Legacy drafts from older versions are never retrieved automatically; discard
them or explicitly convert them with `memory_review_draft` by supplying one of
the four allowed project types in `edits.type`. Confirmation without that target
is rejected, and conversion preserves existing project edges.

## Skill capture boundary

The memory plugin also injects an automatic skill-capture policy. After completing
task work and before the final response, assess whether what surfaced is likely to
help with similar future work. Create a concise skill for reusable workflow,
project knowledge, conventions, or context, including explanations of application
architecture/components and how to work with or change them. This is a positive
trigger even when the user did not explicitly ask for or document a procedure; one
task can reveal reusable context. Repeatable sequences/checklists, specialized
recurring checks, and corrections meant to guide similar work are also triggers.

Do not create a skill for one-off deliverables (such as rewriting one paragraph in
bullets), temporary acceptance criteria, generic best practices, or a simple task.
A technically complex or long request is not a trigger by itself. If future reuse
is ambiguous, do not create one. Durable preferences and decisions remain memories;
skills capture reusable procedures or project context, and the same content should
not be duplicated across both. Use `skill_list` across both scopes before creating
one to avoid semantic duplicates; never overwrite an existing skill. Choose project
scope for repository-specific conventions, tools, architecture, or context and
global scope for portable procedures. Never copy secrets, credentials, private
data, or raw conversation transcripts. The plugin's always-on policy remains the
runtime authority.

## Automatic retrieval boundary
Every eligible confirmed active preference from the global user vault is
selected, retaining its full text and rendering its `category`. Direct active
preferences, exactly-one-hop related preferences, and reached superseded
preferences stay in distinct trust groups; no second-hop traversal occurs. The
entire serialized payload must fit the effective configured/model token budget,
or it is omitted as a whole. The UTF-8-byte/token comparison is an estimate, not
exact tokenization or remaining conversation capacity. A category-less legacy
global preference reads as `general` without rewriting its vault record.
Existing project preferences, atoms, and supernodes remain available only
through deliberate legacy read/search paths; they are never automatically
injected or migrated. New project writes are limited to `decision`, `bug`,
`solution`, and `refactor`; new global writes are limited to categorized
`preference` records. Secret filtering, draft exclusion, and trust labels still
apply.

## Gotchas
- A normal task request is not a memory; capture only durable user intent.
- Legacy drafts don't exist to search. Migrate one only if it contains durable knowledge.
- Memory complements the disk restore (`guarana:remember`); it never replaces disk as truth.
