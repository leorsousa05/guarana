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
| `skill_create({name,description,scope,content})` | Persist a clear reusable procedure as a native OpenCode skill; the tool never overwrites an existing name. |

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

The memory plugin also injects an automatic skill-capture policy on every turn.
Create a skill when the user gives a repeatable specialized procedure, recurring
checks, or a correction intended to guide similar future work. One message is
enough when future reuse is clear. For example, a repo-specific dashboard review
sequence is a project skill; rewriting one paragraph in bullets is a one-off and
should not create a skill. A technically complex request, temporary acceptance
criteria, generic best practices, or a simple task are not triggers by themselves.
If reuse is ambiguous, do not create one. Preferences and decisions remain
memories; skills capture how to perform a repeatable method. Use project scope
for repository conventions and global scope for portable procedures. The plugin's
always-on policy remains the runtime authority.

## Automatic retrieval boundary
Relevant project nodes and up to three current global preferences are injected
automatically (ten nodes total). Global preferences apply across projects unless
a project-specific instruction overrides them. Legacy drafts are never injected.

## Gotchas
- A normal task request is not a memory; capture only durable user intent.
- Legacy drafts don't exist to search. Migrate one only if it contains durable knowledge.
- Memory complements the disk restore (`guarana:remember`); it never replaces disk as truth.
