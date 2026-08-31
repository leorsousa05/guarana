# ADR-008 — Memory tools exposed as OpenCode custom tools, not a standalone MCP server

**Status:** Accepted (2026-08-30) · append-only

## Context
The persistent-memory feature brief asked for an "MCP server with 4 tools" (`memory_search`, `memory_save_decision`, `memory_get_context_for_task`, `memory_review_draft`). OpenCode plugins can register custom tools natively via the plugin API (`tool()`), which the agent invokes exactly like MCP tools. A separate stdio MCP server would add an extra process, JSON-RPC plumbing, and manual user config in `opencode.json` — with no capability gain, since the plugin already runs inside the agent's process and can delegate to the same internal modules as the CLI.

## Decision
Expose the 4 `memory_*` tools as **OpenCode custom tools** registered by the memory plugin (`plugin/guarana-memory.js`). No standalone MCP server process, no `opencode.json` MCP registration required. Tools delegate to the shared `memory/` engine modules (single source of truth with the CLI).

## Tradeoffs
- The tools are OpenCode-only (consistent with the "no adapters for other platforms" constraint).
- If a standalone MCP server is ever needed for non-OpenCode clients, the engine modules are transport-agnostic and can be wrapped later without redesign.

## Consequence
Recorded in `.specs/features/memory/memory.md` (Slice 3). Answered via Rule 0 (2026-08-30); supersedes the literal "MCP server" wording of the brief.
