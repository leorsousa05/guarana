---
name: guarana:memory
description: Use when using or querying the memory vault — recovering prior decisions/bugs, saving a decision, searching confirmed memory, or reviewing auto-captured drafts. The orchestrator supplies bounded confirmed context automatically.
---

# guarana:memory

The orchestrator automatically initializes the project vault, retrieves
relevant confirmed context for active tasks, and records completed verified
runs. Use this skill for deeper searches, decision review, or inspecting the
memory graph; normal work does not require a `guarana:memory` command.

The memory vault is a project-local graph of decisions, bugs, solutions and refactors. The orchestrator automatically supplies bounded confirmed context for the active task; explicit tools provide deeper access.

## The four tools
| Tool | When to call |
|---|---|
| `memory_search({query,type?,since?,until?,limit?})` | You need to find something in confirmed memory: a past decision, bug, or solution matching a topic. Confirmed-only hybrid search. |
| `memory_get_context_for_task({task,limit?})` | Resuming/interrupting work and you want the decision rationale, rejected alternatives, and bugs behind how something is built. Returns a bounded subgraph. |
| `memory_save_decision({intent,decision,rejectedAlternatives?,tags?,author?})` | Closing/completing a run and a key decision is worth persisting for future resumes. Writes a confirmed node. |
| `memory_review_draft({id,action:"confirm"\|"discard",edits?})` | Reviewing auto-captured drafts before relying on them. |

## Draft → confirmed lifecycle
Auto-captured atoms are `status: draft`. Drafts are never returned by search or context retrieval — only confirmed nodes are. Review a draft (`memory_review_draft`) before you rely on it; confirm it to make it retrievable, or discard it if it's noise. Treat unreviewed drafts as untrusted.

## Automatic retrieval boundary
Only relevant confirmed nodes are automatically injected, capped at ten nodes.
Drafts are never injected. Query the tools when you need deeper context or need
to review and confirm a draft.

## Gotchas
- Drafts don't exist to search. If you need it in a search result, confirm it first.
- Memory complements the disk restore (`guarana:remember`); it never replaces disk as truth.
