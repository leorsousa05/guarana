# Feature spec: guarana persistent memory

**Status:** VALIDATED — Slices 1–6 (6/6) · FINAL GATE PASSED (2026-08-31) · hardening batch applied
**Date:** 2026-08-30

## Goal
Give the OpenCode agent long-term, project-local memory: a graph of explicitly
saved decisions, bugs, solutions and refactors. Relevant confirmed context is
automatically supplied for active tasks, while the full graph remains available
through explicit tool calls. Normal tool activity is telemetry, not memory.

## Design principles (contract from brief)
1. **Intent-driven persistence.** The assistant identifies durable intent in user messages and records it with `memory_save_node`: standing preferences are global `preference` nodes; current-project decisions/bugs/solutions/refactors are project nodes. Ordinary task requests and tool/file activity are not captured.
2. **Graph, not stack.** Nodes: `decision | bug | solution | refactor | preference | atom | supernode`. Edges: `caused-by | depends-on | supersedes | summarizes | fixes | relates-to`. `memory_save_node` preserves type and scope and can link to existing confirmed nodes; it never invents associations.
3. **Automatic bounded retrieval.** The orchestrator injects only relevant confirmed context, capped at ten nodes. The agent calls `memory_search`, `memory_save_node` (or compatible `memory_save_decision`), `memory_get_context_for_task`, and `memory_review_draft` for deeper retrieval or review.
4. **Legacy draft quarantine.** Draft atoms created by older versions remain untrusted and are never retrieved automatically. They may be explicitly migrated or discarded with review tools.
5. **OpenCode-native lifecycle.** The plugin injects memory-capture guidance and initializes/retrieves both vaults; `session.created` and `session.idle` record lifecycle telemetry. No hook stores raw messages or tool activity, and no adapters target other platforms.
6. **Two vaults** (ADR-010): project `.guarana/memory/` (gitignored, shareable via export/import) and user `~/.config/guarana/memory/` (private). JSONL serialization only.
7. **Automatic compaction.** When a project graph exceeds a configurable node threshold, oldest non-`decision` nodes are summarized into `supernode`s preserving decisions/lessons; intermediate execution detail is discarded. `summarizes` edges keep provenance.

   > **Amended (Slice 4).** Provenance is recorded in the supernode's `collapsedIds` array instead of `summarizes` edges; collapsed atoms and their edges are removed (no dangling refs). The `summarizes` line above is **superseded** — supernodes carry `collapsedIds`, and the compaction routine never emits `summarizes` edges to removed nodes.
8. **Hybrid search** (ADR-009): structural filters first (type, project, date, author, status), then semantic ranking — built-in TF-IDF by default, pluggable embedding provider via config.

## Architecture
- **`memory/`** (new root dir, source of truth, ESM, zero deps) — the engine, shared by CLI and plugin:
  - `graph.js` — CRUD for nodes/edges, schema validation, JSONL persistence.
  - `search.js` — structural filters + TF-IDF ranking + provider seam.
  - `capture.js` — legacy tool-call → draft helper retained for migration/tests (with security filters).
  - `compact.js` — threshold check + supernode summarization.
  - `vault.js` — project/user vault paths, config load, init, export/import.
  - `security.js` — sanitization: reject/sanitize credentials, API keys, `.env` content.
- **`cli/commands/memory.js`** — subcommands `init | status | search | review | prune | export | import`, delegating to `memory/` (dynamic import from CJS). Registered in `cli/main.js`, documented in `cli/help.js`.
- **`plugin/guarana-memory.js`** — OpenCode plugin (ESM, zero deps, marker header `// guarana memory plugin`, never throws): automatic vault initialization, lifecycle telemetry, and 5 custom tools, all delegating to `memory/`.
- **Telemetry**: memory operations append to `<project>/.specs/state/telemetry/events.jsonl` (existing pipeline); no parallel logging.
- **Bundle**: `memory/` and `plugin/guarana-memory.js` added to the mappings in `scripts/sync-cli-bundle.mjs` and `scripts/check-cli-bundle.mjs`.

## Security constraints (hard)
- Legacy capture filters must drop or redact: contents of `.env*` files, strings matching common secret shapes (API keys, tokens, private keys), and any tool input/output flagged sensitive. Filtered events are recorded as `type: memory-filtered` telemetry, never stored.
- Only confirmed memory is automatically injected; drafts are always excluded.

## Slices (each = one build→verify cycle)
| # | Slice | Contents |
|---|---|---|
| 1 | **Engine + CLI** | `memory/` graph engine, storage, TF-IDF search, security filters; `guarana memory init/status/search/prune/export/import`; bundle sync wiring; tests |
| 2 | **Capture plugin** | Historical raw-event capture retired; current plugin injects model-directed capture guidance and exposes typed project/global tools |
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
8. Plugin test: no `tool.execute.before/after` or `file.edited` hooks are registered; lifecycle events do not append memory nodes.
9. Explicit memory saves are subject to the engine's security filters; sensitive content is never persisted.
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
- `GET /api/memory/drafts` — legacy draft nodes for migration/review.
- `POST /api/memory/review` — `{ id, action: confirm|discard, edits? }` → delegates to `memory/tools.js memoryReviewDraft` for legacy nodes.
- React page (`components/Memory.jsx`): summary cards, search box, and graph/list of confirmed decisions/bugs/supernodes; nav entry. Legacy review remains available through the CLI/API. Server route factory in `dashboard/server/routes/memory.js`, pure logic in `dashboard/server/lib/memory.js`, wired in `app.js`; server reuses the `memory/` engine (single source of truth). Server runs with cwd = user project (web command forwards cwd), so it resolves `.guarana/memory/` relative to cwd.
- Bundle: `dashboard/server` + `dashboard/web/dist` are already synced; server import of `memory/` must resolve from both repo-root and bundled `cli/dashboard/server → cli/memory` layouts.

**Slice 5 acceptance:**
16. `guarana web` on a seeded project → `/api/memory/summary` returns correct counts; `/api/memory/search?q=` returns only confirmed matches; `/api/memory/graph` returns bounded nodes+edges; legacy draft review mutates the vault and updates subsequent reads.
17. Server route/lib unit tests green; security: graph/search responses never include draft content beyond the drafts endpoint; no vault or engine error crashes the route (404/empty, not 500).
18. `npm run check-cli` passes (bundle includes dashboard + memory engine + server).

**Slice 5 acceptance:**
16. `guarana web` on a seeded project → `/api/memory/summary` returns correct counts; `/api/memory/search?q=` returns only confirmed matches; `/api/memory/graph` returns bounded nodes+edges; legacy draft review mutates the vault and updates subsequent reads.
17. Server route/lib unit tests green; security: graph/search responses never include draft content beyond the drafts endpoint; no vault or engine error crashes the route (404/empty, not 500).
18. `npm run check-cli` passes (bundle includes dashboard + memory engine + server).

**Slice 6 (addendum 2026-08-31): workflow integration — automatic memory context**
The orchestrator initializes project/user vaults, injects relevant project context and standing global preferences, and the memory plugin guides intent-based typed capture without saving raw messages.

**Slice 6 acceptance:**
19. The orchestrator initializes both vaults, injects relevant project context and global preferences on task start/resume, and does not create generic completion nodes.
20. The injected policy directs automatic typed capture for durable preferences/project decisions while ordinary tasks and tool activity create no memory.
21. `npm run check-cli` passes (skills and engines synced to bundle); no project-specific facts are hardcoded into skill bodies.

**Final gate (human):** the end-to-end resume scenario — interrupt work, wipe session, resume via explicit tool calls, recover decision rationale, rejected alternatives, and prior bugs.

## Amendment: explicit-only persistence (2026-09-09)

The raw automatic capture path is retired. Normal tool calls, file edits, and
session events remain telemetry and do not create memory atoms. The model may
use typed memory tools after recognizing durable user intent; `memory_save_decision`
remains as a compatible confirmed decision tool. The graph, search, context injection, compaction, and telemetry
behavior remain unchanged. Draft storage and review endpoints are retained only
to migrate or discard draft atoms created by older versions; legacy drafts are
never injected or returned by search. Workflow completion itself creates no memory.

## Amendment: typed writes and explicit links (2026-09-27)

`memory_save_node` accepts `decision | bug | solution | refactor | preference`,
scope (`project` or `global`), summary, intent, and optional `relatedTo` links to
existing confirmed nodes. `memory_save_decision` remains backward compatible.
Task-context retrieval follows these relations and preserves each node's type.

## Amendment: no generic completion memories (2026-09-27)

The orchestrator no longer records a generic confirmed decision for every
verified task completion. Completion and workflow transitions remain telemetry;
only explicit durable knowledge is persisted in the memory graph.

22. `memory_save_node` writes the requested confirmed type, validates every
    explicit relation against an existing confirmed node, and task-context
    retrieval returns related bugs/solutions through one-hop `fixes` links.
23. The memory plugin continues exposing the compatible decision tool and adds
    the typed-node tool; graph viewers label `fixes` and `relates-to` edges.

## Amendment: automatic intent capture and global preferences (2026-09-28)

The memory plugin injects instructions for the model to detect durable user
intent. Standing assistant-behavior preferences are saved as `preference` nodes
in the private user vault and loaded every turn; each preference is injected
once per session, then again after compaction, independent of task wording.
Project decisions and knowledge use the project vault and task-relevant retrieval.
When a preference changes, the new node supersedes its previous version.
