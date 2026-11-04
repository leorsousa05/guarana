---
name: guarana:memory
description: Use when searching, reviewing, or saving durable knowledge in the Guarana memory graph. Automatic context can include eligible categorized preferences from the selected project and eligible Global preferences, ranked as separate trust groups under a shared whole-record budget.
---

# guarana:memory

The orchestrator can inject eligible confirmed categorized preferences from
exactly the selected project, together with eligible Global preferences, once per
session and after context compaction. Project preferences are direct-only and form
a separate, lower-trust group ranked before Global direct, related, and superseded
groups under one shared effective budget. Candidates are ranked and included
only as whole records when adding them fits the remaining shared budget;
oversized records are skipped without truncation while later candidates are still
considered. If no usable budget exists or no record fits, no preference content
is injected and an explicit notice is given. Project decisions, bugs, solutions,
refactors, and legacy project preferences without a valid category remain
explicit/searchable only, not injected.
Current requests and system, developer, and security policies outrank stored
project text. Use explicit memory tools to search or retrieve project knowledge.
Use this skill for deeper searches, decision review, or inspecting the graph;
normal work does not require a `guarana:memory` command.

The memory system has a project graph and a private user graph. Project decisions,
bugs, solutions, refactors, and categorized project preferences live in the
selected project's shared vault at `<project>/.guarana/memory/`; durable
preferences intended to apply across projects live in `~/.config/guarana/memory/`.
The assistant judges user intent and invokes a memory tool when the user states
durable knowledge. Tool/file activity itself is telemetry, not memory.

## The memory tools
| Tool | When to call |
|---|---|
| `memory_search({query,type?,scope?,since?,until?,limit?})` | Search confirmed memory; scope can be `project`, `global`, or `both` (default). |
| `memory_get_context_for_task({task,scope?,limit?})` | Explicitly retrieve a bounded task-relevant subgraph from the selected scope(s); this tool is not automatic prompt injection. |
| `memory_save_decision({intent,decision,rejectedAlternatives?,tags?,author?})` | Backward-compatible project decision save. |
| `memory_save_node({type,scope,intent,summary,category?,priority?,relatedTo?,tags?,author?})` | Save project `decision`, `bug`, `solution`, or `refactor`; a project `preference` with required category `agent_behavior`, `workflow`, or `communication`; or a Global `preference` with one of those required categories. Optional priority (`essential` or `normal`) applies only to Global preferences. |
| `memory_review_draft({id,action:"confirm"\|"discard",edits?})` | Discard a legacy draft, or confirm only with an explicit `edits.type` conversion to project `decision`, `bug`, `solution`, `refactor`, or categorized `preference` (the latter requires a supported category in `edits`). |
| `memory_delete_node({id,scope,confirm:true})` | Hard-delete one confirmed node by exact ID; matching `project`/`global` scope and explicit confirmation are mandatory. Drafts remain on `memory_review_draft`. |
| `skill_list({scope?})` | Read the metadata-only catalog of Guarana-generated skills, including category, scope, and revision. |
| `skill_read({name,scope})` | Load one relevant generated skill body on demand. |
| `skill_create({name,description,scope,category,content})` | Persist a distinct reusable procedure; the tool never overwrites an existing name. |
| `skill_update({name,description,scope,category?,content,expectedRevision})` | Enrich one generated skill with optimistic concurrency; never overwrites manual skills. |
| `guarana_learning_review({summary,changedPaths})` | Run the separate, bounded OpenCode post-task reviewer after successful substantive work. |

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
them or explicitly convert them with `memory_review_draft` by supplying project
`decision`, `bug`, `solution`, or `refactor` in `edits.type`, or project
`preference` with a supported category in `edits`. Confirmation without an
allowed target (and category for a preference) is rejected, and conversion
preserves existing project edges. Legacy drafts are never converted implicitly.

## Skill discovery and post-task review

The bundled `guarana` index lists built-in skills with topical categories. Its
scope is the selected project or global installation location; category and scope
are independent. Generated-skill context starts as a bounded metadata-only catalog
that prioritizes the current project. If it says the catalog is truncated, call
`skill_list` to inspect more metadata. The agent chooses relevant skills
automatically and calls `skill_read` only for relevant generated skills; do not
load every body. Use `guarana:skill-authoring` for explicit creation or maintenance.

After successful, substantive task work, the primary may call
`guarana_learning_review` once with a concise sanitized summary and changed paths.
OpenCode runs in a separate isolated session with no tools. It receives no raw
conversation transcript. The reviewer model is selected only from user-level
Guarana/OpenCode configuration (or the user process environment); project
configuration cannot choose an authenticated provider destination. The payload
includes up to 100 skill metadata entries, up to 3 relevant project skill bodies,
and up to 8 matching project memories; these are sent to the user-selected provider
and may incur configured usage. Memory and skill proposals are returned as
`approval_required` and never written automatically because reviewer context may be
influenced by untrusted project data. Present the complete exact proposal and ask the
user to reply exactly `approve <approvalId>` or `reject <approvalId>`. The primary
plugin binds that message to the session and proposal; write tools reject pending,
altered, rejected, and replayed proposals. Pass the unchanged approvalId to the
matching memory or skill write tool.
Automatic review never writes Global skills; make those changes only through an
explicit user-directed skill tool call. The reviewer content is model-generated:
project scoping and structural/secret checks reduce impact but cannot guarantee
that proposed content is free of every prompt-injection instruction. Skill bodies
are loaded only from the current project scope—never from Global skills. Do not call
it for trivial, failed, or interrupted work, and never trigger recursive review.
The primary waits for the receipt and reports only writes that were verified.

The reviewer may propose project `decision`, `bug`, `solution`, or `refactor` records;
it does not infer global user preferences and cannot persist them without approval.
Save Global preferences only from clear explicit user intent through the normal
memory tools. Skills capture reusable procedures and project context; memories
capture durable facts, decisions, and preferences. Do not duplicate the same content
across both or preserve secrets, private data, prompts, or transcripts.

## Automatic retrieval boundary
Eligible confirmed active preferences from the Global user vault are candidates,
retaining their full text and rendering their `category`. For the exactly
selected/current project, the selector enumerates that project's shared vault
only to identify confirmed preferences with a valid `agent_behavior`, `workflow`,
or `communication` category. Those project preferences are direct-only: they form
a separate, lower-trust group, ranked before the Global direct, related, and
superseded groups under the same shared budget. No unrelated project vault is
read. Project decisions, bugs, solutions, refactors, atoms, supernodes, and
legacy project preferences without a valid category are not selected into,
returned in, or injected as automatic context. Project direct preferences do
not expand through graph edges. Global direct active preferences, exactly-one-hop
related preferences, and reached superseded preferences remain in distinct
trust groups; no second-hop traversal occurs. Candidate records are ranked, then
included whole only when adding each record fits the remaining shared effective
configured/model token budget. Oversized records are skipped without truncation
and later candidates are still considered. If no usable budget exists or no
record fits, no preference content is injected and an explicit notice is given.
The UTF-8-byte/token comparison is an estimate, not exact tokenization or remaining conversation
capacity. A category-less legacy global preference
reads as `general` without rewriting its vault record. Categorized project
`preference` writes are allowed; new project writes otherwise include `decision`,
`bug`, `solution`, and `refactor`, while new global writes are limited to
categorized `preference` records. Secret filtering, draft exclusion, and trust
labels still apply. Current explicit user requests and system, developer, and
security policies remain higher priority than injected memory.

## Gotchas
- A normal task request is not a memory; capture only durable user intent.
- Legacy drafts don't exist to search. Migrate one only if it contains durable knowledge.
- Memory complements the disk restore (`guarana:remember`); it never replaces disk as truth.
