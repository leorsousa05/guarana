# Feature spec: guarana persistent memory

**Status:** SPECIFIED → VALIDATED (Slices 1–5) · Slice 6 (workflow integration) SPECIFIED
**Date:** 2026-08-30

## Goal
Give the OpenCode agent long-term, project-local memory: a graph of decisions, bugs, solutions and refactors captured at tool-call granularity, queryable only through explicit tool calls — never auto-injected into context. The agent can resume interrupted work weeks later by asking the graph *why* the code looks the way it does.

## Design principles (contract from brief)
1. **Tool-call granularity atoms.** Each captured tool interaction produces a memory atom: `intent`, `input`, `output` (summarized), `decision` (derived), `ts`, `projectHash` (context hash of the project).
2. **Graph, not stack.** Nodes: `decision | bug | solution | refactor | atom | supernode`. Edges: `caused-by | depends-on | supersedes | summarizes`. Enables partial-context retrieval and semantic navigation.
3. **Explicit retrieval only.** No automatic injection into system prompt or context. The agent calls `memory_search`, `memory_save_decision`, `memory_get_context_for_task`, `memory_review_draft` when it judges necessary (ADR-008).
4. **Draft quarantine.** Auto-captured memories are `status: draft`. They become `confirmed` — and thus retrievable — only after explicit review (human via CLI, or a reviewer agent via tool). Drafts are auditable (`memory status`, `memory review --list`) but never returned by search.
5. **OpenCode-native capture.** Plugin hooks: `session.created`, `tool.execute.before`, `tool.execute.after`, `file.edited`, `session.idle`. No adapters for other platforms.
6. **Two vaults** (ADR-010): project `.guarana/memory/` (gitignored, shareable via export/import) and user `~/.config/guarana/memory/` (private). JSONL serialization only.
7. **Automatic compaction.** When a project graph exceeds a configurable node threshold, oldest non-`decision` nodes are summarized into `supernode`s preserving decisions/lessons; intermediate execution detail is discarded. `summarizes` edges keep provenance.

   > **Amended (Slice 4).** Provenance is recorded in the supernode's `collapsedIds` array instead of `summarizes` edges; collapsed atoms and their edges are removed (no dangling refs). The `summarizes` line above is **superseded** — supernodes carry `collapsedIds`, and the compaction routine never emits `summarizes` edges to removed nodes.
8. **Hybrid search** (ADR-009): structural filters first (type, project, date, author, status), then semantic ranking — built-in TF-IDF by default, pluggable embedding provider via config.

## Architecture
- **`memory/`** (new root dir, source of truth, ESM, zero deps) — the engine, shared by CLI and plugin:
  - `graph.js` — CRUD for nodes/edges, schema validation, JSONL persistence.
  - `search.js` — structural filters + TF-IDF ranking + provider seam.
  - `capture.js` — tool-call event → draft atom (with security filters).
  - `compact.js` — threshold check + supernode summarization.
  - `vault.js` — vault paths, config load, init, export/import.
  - `security.js` — sanitization: reject/sanitize credentials, API keys, `.env` content.
- **`cli/commands/memory.js`** — subcommands `init | status | search | review | prune | export | import`, delegating to `memory/` (dynamic import from CJS). Registered in `cli/main.js`, documented in `cli/help.js`.
- **`plugin/guarana-memory.js`** — OpenCode plugin (ESM, zero deps, marker header `// guarana memory plugin`, never throws): capture hooks + 4 custom tools, all delegating to `memory/`.
- **Telemetry**: memory operations append to `<project>/.specs/state/telemetry/events.jsonl` (existing pipeline); no parallel logging.
- **Bundle**: `memory/` and `plugin/guarana-memory.js` added to the mappings in `scripts/sync-cli-bundle.mjs` and `scripts/check-cli-bundle.mjs`.

## Security constraints (hard)
- Capture filters must drop or redact: contents of `.env*` files, strings matching common secret shapes (API keys, tokens, private keys), and any tool input/output flagged sensitive. Filtered events are recorded as `type: memory-filtered` telemetry, never stored.
- No memory is ever auto-injected; retrieval is pull-only.

## Slices (each = one build→verify cycle)
| # | Slice | Contents |
|---|---|---|
| 1 | **Engine + CLI** | `memory/` graph engine, storage, TF-IDF search, security filters; `guarana memory init/status/search/prune/export/import`; bundle sync wiring; tests |
| 2 | **Capture plugin** | `plugin/guarana-memory.js` event listeners → draft atoms; `guarana plugin install` extended (or `memory plugin`); plugin tests |
| 3 | **Tools + review** | 4 custom tools; draft→confirmed review workflow (CLI `memory review` + reviewer-agent path via `memory_review_draft`) |
| 4 | **Compaction** | threshold config, supernode summarization, provenance edges, prune integration |
| 5 | **Web view** | dashboard memory routes + React page + nav (addendum 2026-08-30) |
| 6 | **Workflow integration** | teach plan/remember when to call memory tools; new guarana:memory skill (addendum 2026-08-31) |

## Verifiable condition (acceptance, per slice)
**Slice 1:**
1. `guarana memory init` in a temp project → `.guarana/memory/` created with `config.json`, empty JSONL files, and `.gitignore` containing `.guarana/memory/`.
2. Engine unit tests: node/edge CRUD round-trip, schema validation rejects malformed nodes, edges reject unknown node ids.
3. `guarana memory search "<term>"` returns only `confirmed` nodes matching structural filters; drafts never appear.
4. Security unit tests: `.env` content and API-key-shaped strings are rejected/redacted, never persisted.
5. `export` → single JSON file; `import` into a fresh vault → identical node/edge set.
6. `npm run check-cli` passes (bundle mappings updated).
7. `npm test` green including new engine tests.

**Slice 2:**
8. Plugin test: simulated `tool.execute.after` → draft atom appended to project vault with `intent/input/output/ts/projectHash`.
9. Sensitive tool calls produce no atom (or redacted atom) + a `memory-filtered` telemetry event.
10. Plugin never throws on missing vault, malformed config, or readonly FS.

**Slice 3:**
11. Tool contract tests: each of the 4 tools returns schema-valid output against a seeded vault.
12. `memory_save_decision` writes a `confirmed` node; `memory_review_draft` flips draft→confirmed or discards.
13. `memory_get_context_for_task` returns a bounded subgraph (decisions + rejected alternatives + bugs) for a task query.

**Slice 4:**
14. With threshold N configured, seeding >N nodes and running compaction → oldest eligible nodes collapsed into a `supernode` with `collapsedIds` provenance (decisions preserved verbatim in the summary). *(`summarizes` edges superseded by `collapsedIds` per the design-principle amendment.)*
15. Compaction is idempotent (second run is a no-op).

**Slice 5 (addendum 2026-08-30): web memory view**
- `GET /api/memory/summary` — node counts (by type + draft/confirmed), compaction info.
- `GET /api/memory/search?q=&type=&limit=` — hybrid search via the `memory/` engine, confirmed-only.
- `GET /api/memory/graph` — nodes + edges for visualization (bounded, e.g. latest 200 confirmed + their edges).
- `GET /api/memory/drafts` — draft nodes for review.
- `POST /api/memory/review` — `{ id, action: confirm|discard, edits? }` → delegates to `memory/tools.js memoryReviewDraft`.
- React page (`components/Memory.jsx`): summary cards, search box, graph/list of decisions/bugs/supernodes, drafts panel with confirm/discard; nav entry. Server route factory in `dashboard/server/routes/memory.js`, pure logic in `dashboard/server/lib/memory.js`, wired in `app.js`; server reuses the `memory/` engine (single source of truth). Server runs with cwd = user project (web command forwards cwd), so it resolves `.guarana/memory/` relative to cwd.
- Bundle: `dashboard/server` + `dashboard/web/dist` are already synced; server import of `memory/` must resolve from both repo-root and bundled `cli/dashboard/server → cli/memory` layouts.

**Slice 5 acceptance:**
16. `guarana web` on a seeded project → `/api/memory/summary` returns correct counts; `/api/memory/search?q=` returns only confirmed matches; `/api/memory/graph` returns bounded nodes+edges; drafts listed; review confirm/discard mutates the vault and updates subsequent reads.
17. Server route/lib unit tests green; security: graph/search responses never include draft content beyond the drafts endpoint; no vault or engine error crashes the route (404/empty, not 500).
18. `npm run check-cli` passes (bundle includes dashboard + memory engine + server).

**Slice 5 acceptance:**
16. `guarana web` on a seeded project → `/api/memory/summary` returns correct counts; `/api/memory/search?q=` returns only confirmed matches; `/api/memory/graph` returns bounded nodes+edges; drafts listed; review confirm/discard mutates the vault and updates subsequent reads.
17. Server route/lib unit tests green; security: graph/search responses never include draft content beyond the drafts endpoint; no vault or engine error crashes the route (404/empty, not 500).
18. `npm run check-cli` passes (bundle includes dashboard + memory engine + server).

**Slice 6 (addendum 2026-08-31): workflow integration — teach the skills when to use memory**
Close the gap: the memory tools exist but no skill instructs when to call them (pull-only by design, but "explicit" must be *taught*, not left to chance). Three changes:
- **guarana:plan** — on state restore, consider `memory_get_context_for_task` when resuming/interrupting work; after closing a run, consider `memory_save_decision`.
- **guarana:remember** — document the memory vault as an additional resume layer (query `memory_get_context_for_task` on context loss, alongside the `.specs/` disk restore).
- **New skill `guarana:memory`** — a dedicated skill body: when to call each of the 4 tools, the draft→confirmed lifecycle, and the guidance that retrieval is always explicit (never auto-injected). Registered in the suite index + routed from plan.

**Slice 6 acceptance:**
19. `guarana:plan` SKILL.md instructs explicit `memory_get_context_for_task` on resume and `memory_save_decision` on run close — without auto-injecting vault content.
20. `guarana:remember` SKILL.md documents the vault as a resume layer; new `skills/memory/SKILL.md` exists, covers the 4 tools + draft lifecycle; suite index lists it; plan routing table routes to it.
21. `npm run check-cli` passes (skills synced to bundle); no `.specs/` content or vault content is hardcoded into skill bodies (no project-specific facts).

**Final gate (human):** the end-to-end resume scenario — interrupt work, wipe session, resume via explicit tool calls, recover decision rationale, rejected alternatives, and prior bugs.
