---
name: guarana:memory
description: Use when using or querying the memory vault — recovering prior decisions/bugs, saving a decision, searching confirmed memory, or reviewing auto-captured drafts. Pull-only: never auto-injected.
---

# guarana:memory

The memory vault is a project-local graph of decisions, bugs, solutions and refactors. Everything is retrieved by explicit tool call — nothing is ever auto-injected into context.

## The four tools
| Tool | When to call |
|---|---|
| `memory_search({query,type?,since?,until?,limit?})` | You need to find something in confirmed memory: a past decision, bug, or solution matching a topic. Confirmed-only hybrid search. |
| `memory_get_context_for_task({task,limit?})` | Resuming/interrupting work and you want the decision rationale, rejected alternatives, and bugs behind how something is built. Returns a bounded subgraph. |
| `memory_save_decision({intent,decision,rejectedAlternatives?,tags?,author?})` | Closing/completing a run and a key decision is worth persisting for future resumes. Writes a confirmed node. |
| `memory_review_draft({id,action:"confirm"\|"discard",edits?})` | Reviewing auto-captured drafts before relying on them. |

## Draft → confirmed lifecycle
Auto-captured atoms are `status: draft`. Drafts are never returned by search or context retrieval — only confirmed nodes are. Review a draft (`memory_review_draft`) before you rely on it; confirm it to make it retrievable, or discard it if it's noise. Treat unreviewed drafts as untrusted.

## Hard rule: explicit retrieval only
Retrieval is always pull-only. Never auto-inject vault content into the system prompt or context. Query the tools only when you judge it valuable — never automatically.

## Gotchas
- Drafts don't exist to search. If you need it in a search result, confirm it first.
- Memory complements the disk restore (`guarana:remember`); it never replaces disk as truth.