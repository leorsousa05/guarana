---
name: guarana:memory
description: Use when searching, reviewing, or saving durable knowledge in the Guarana memory graph, including decisions, bugs, solutions, refactors, and standing preferences. The orchestrator supplies bounded confirmed context automatically.
---

# guarana:memory

The orchestrator automatically initializes both memory scopes, injects relevant
project context and global standing preferences once per session and after
context compaction. Use this
skill for deeper searches, decision review, or inspecting the graph; normal work
does not require a `guarana:memory` command.

The memory system has a project graph and a private user graph. Project decisions,
bugs, solutions, and refactors live in `<project>/.guarana/memory/`; durable
"always/never" preferences live in `~/.config/guarana/memory/` and apply across
projects. The assistant judges user intent and invokes a memory tool when the
user states durable knowledge. Tool/file activity itself is telemetry, not memory.

## The memory tools
| Tool | When to call |
|---|---|
| `memory_search({query,type?,scope?,since?,until?,limit?})` | Search confirmed memory; scope can be `project`, `global`, or `both` (default). |
| `memory_get_context_for_task({task,scope?,limit?})` | Retrieve the task's relevant project/global subgraph; standing global preferences are included. |
| `memory_save_decision({intent,decision,rejectedAlternatives?,tags?,author?})` | Backward-compatible project decision save. |
| `memory_save_node({type,scope,intent,summary,relatedTo?,tags?,author?})` | Save a confirmed `decision`, `bug`, `solution`, `refactor`, or `preference`; use `global` for standing user preferences and `project` for current-project knowledge. |
| `memory_review_draft({id,action:"confirm"\|"discard",edits?})` | Migrating or discarding legacy draft atoms from older versions. |
| `skill_list({scope?})` | Check Guarana-generated skills in project/global scopes before proposing a new reusable procedure. |
| `skill_create({name,description,scope,content})` | Persist a clear reusable procedure or project context as a native OpenCode skill; the tool never overwrites an existing name. |

## Explicit memory lifecycle
When a user sets a lasting preference or makes a durable project decision, save
it automatically with `memory_save_node` before answering. Search its scope to
avoid duplicates; use a `supersedes` link when the user changes an existing
preference. Add other `relatedTo` links only when the relation is real. Ordinary
requests, temporary instructions, inferred personal facts, tool calls, and file
edits do not create memory nodes. `memory_save_decision` remains for explicit
decision saves.
Legacy draft atoms from older versions are never retrieved automatically; use
`memory_review_draft` only to migrate or discard them.

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
Relevant project nodes and up to three current global preferences are injected
automatically (ten nodes total). Global preferences apply across projects unless
a project-specific instruction overrides them. Legacy drafts are never injected.

## Gotchas
- A normal task request is not a memory; capture only durable user intent.
- Legacy drafts don't exist to search. Migrate one only if it contains durable knowledge.
- Memory complements the disk restore (`guarana:remember`); it never replaces disk as truth.
