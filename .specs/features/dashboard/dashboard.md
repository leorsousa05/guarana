# Feature spec: guarana dashboard (telemetry plugin + web UI)

**Status:** SHIPPED (human final gate accepted 2026-08-21 for ledger redesign + curated Documents + UX pass + decisions panel)
**Date:** 2026-08-21

## Goal
See guarana run information in a web interface. Two components, one feature:
1. **Telemetry plugin** (OpenCode plugin) that records run data to disk.
2. **Web dashboard** (Express API + React/Vite frontend) that displays it, plus the `.specs/` system of record.

## Component A — telemetry plugin (`plugin/guarana-telemetry.js`)
An OpenCode plugin (per https://opencode.ai/docs/plugins/) that appends events to `.specs/state/telemetry/events.jsonl` in the current project (create dir if missing).

Hooked events:
- `tool.execute.after` → `{ts, type:"tool", tool, sessionID, ok, error?}`
- `message.part.updated` → token/cost usage when present → `{ts, type:"tokens", sessionID, tokens?, cost?}` (best-effort; record only fields that exist)
- `session.created` / `session.idle` / `session.error` / `session.compacted` → `{ts, type:"session", status, sessionID}`
- `todo.updated` → `{ts, type:"todo", sessionID, count}`

Constraints:
- JS, no external npm deps (local plugin; must not require a package.json).
- Append-only JSONL, one event per line. Never throws — telemetry must not break a run (wrap in try/catch).
- Install is manual for now: copy/symlink into `.opencode/plugins/`. (CLI integration = future work.)

## Component B — dashboard (`dashboard/`)
- `dashboard/server/` — Express API, Node 18+, serves on `localhost:4200` (env `GUARANA_DASH_PORT` overrides):
  - `GET /api/telemetry/summary` — runs (sessions) with start/end, event counts, token totals
  - `GET /api/telemetry/events?session=<id>` — raw events for a run
  - `GET /api/specs/tracker` — parsed `.specs/README.md` tracker table + DONE/NEXT/BLOCKED
  - `GET /api/specs/state` — `project-state.md` + `known-issues.md` raw content
- `dashboard/web/` — React + Vite frontend, two sections:
  - **Runs**: table of sessions (id, started, duration, tool calls, tokens, errors); click → event stream.
  - **Specs**: tracker table, DONE/NEXT/BLOCKED, project state, known issues.
- Reads project root from cwd of the server process.

## Verifiable condition (acceptance)
1. Plugin loads in isolation: simulating hook calls with mock input produces valid JSONL lines (one JSON object per line, all 4 event kinds covered).
2. Plugin never throws when given malformed/missing fields.
3. `npm install && npm run build` succeeds in `dashboard/`; server starts on 4200.
4. With a seeded `.specs/state/telemetry/events.jsonl` (fixture), `GET /api/telemetry/summary` returns correct aggregates (verified with curl).
5. `GET /api/specs/tracker` returns the 8-row tracker including the CLI row.
6. Frontend builds and serves; both sections render with fixture data (verified via headless browser or the built bundle + curl of API-backed pages).

## Addendum 2026-08-21: design overhaul ("ledger" direction)
Redesign `dashboard/web/` to make the dashboard genuinely useful + distinctive. Subject: a *system of record* for AI agent runs. Job: "what is the system doing right now, and is it healthy?" in <5s.

**Tokens:**
- Colors: aril `#F5F0E4` (bg), seed-ink `#1E1710` (text), guarana `#9E1B1E` (errors/stamps, restraint), leaf `#3E5C3A` (live/ok), amber `#B87A14` (warn), hairline `#D8D0BE` (rules). Zero border-radius. Hairline 1px rules as dividers.
- Type: Space Grotesk (display, section titles only), IBM Plex Mono (body + all data — the lead voice). Clear scale; data is always mono/tabular.
- Signature elements: (a) **live event ticker tape** — horizontally scrolling strip of raw telemetry events (from `/api/telemetry/events`, latest across sessions), each kind prefixed (`›tool`, `›tokens`, `›session`, `›todo`), color-coded; embodies "disk is truth". (b) **rubber stamps** — statuses (SHIPPED/PASS/FAIL/error) rendered as bordered, slightly rotated uppercase stamps in guarana red/leaf.

**New useful surface — NOW panel** (top of Runs): derive from events the latest session: status (running/idle/error/compacted from last session event), duration, tool calls, tokens, errors; plus open goal from project-state checkpoint if present. This is the hero — a live status panel, not a big-number stat.

**Structure:** header (wordmark "guarana — system of record", live pill showing last-event age, port) → NOW → ticker → RUNS ledger table (stop status stamped; click → event stream as ledger lines) → SYSTEM OF RECORD (tracker with stamped statuses, DONE/NEXT/BLOCKED, project-state, known-issues rendered as ledger pages).

**Copy rules:** plain verbs, sentence case, errors say what happened and the fix (e.g. empty state: "No telemetry yet. Install the plugin: guarana plugin install --project"). No marketing voice.

**Quality floor:** responsive to mobile, visible focus states, `prefers-reduced-motion` disables ticker scroll.

### Acceptance (design addendum)
17. Visual: tokens applied exactly (spot-check computed styles: bg #F5F0E4, mono body font, 0 border-radius).
18. NOW panel renders correct data from fixture (status, duration, counts match API).
19. Ticker shows events; pauses/respects reduced-motion.
20. Empty state appears with guidance when telemetry file absent.
21. Mobile (375px) usable: no horizontal overflow except intentional ticker/table scroll.
22. Keyboard: tabs and run rows focusable with visible outline.

## Addendum 2026-08-21c: formatted specs browser
User-reported defects + feature:
1. Tracker proof/change links are dead (relative repo paths the server doesn't serve).
2. project-state / known-issues show raw markdown — must render formatted.
3. New: a full **Specs browser** — see every `.specs/**/*.md` formatted.

**Server (dashboard/server):**
- `GET /api/specs/tree` → JSON list of all `.md` files under `<root>/.specs/` (relative paths, sorted).
- `GET /api/specs/file?path=<rel>` → raw markdown of that file. Guard: resolve within `<root>/.specs/`, reject traversal/absolute paths and non-`.md` (400/404). Never serve outside `.specs/`.

**Frontend:**
- Add a markdown renderer (dependency `marked` is allowed; render via `dangerouslySetInnerHTML` after sanitizing? — `.specs` content is trusted local, but still escape raw HTML in the markdown source before rendering to keep it safe and literal).
- Specs section becomes two views: **Overview** (existing tracker + DONE/NEXT/BLOCKED) and **Files** (file list sidebar + rendered document). project-state.md and known-issues.md render formatted in both Overview (as today, but formatted) and Files.
- Tracker proof/change cells become links that open the target file in the Files view (parse the markdown link target; if it points to a `.specs/` md file → Files view; else render as plain text).
- Keep ledger styling: rendered markdown styled with the same tokens (hairlines, mono, stamps where feasible are optional).

### Acceptance (addendum)
23. `/api/specs/tree` lists ≥15 md files including decisions/ADR-001..006, features/overview.md, features/guarana/*.md, features/cli/cli.md, features/dashboard/dashboard.md.
24. `/api/specs/file?path=state/project-state.md` → 200 with content; `?path=../../etc/passwd` and `?path=../package.json` → 4xx, no content leaked.
25. project-state + known-issues render formatted (headings, tables, bold), not raw `#`/`|`.
26. Files view: clicking ADR-004 in the sidebar shows it formatted.
27. Tracker `proofs`/`2026-08-21` cells open the corresponding file in Files view.
28. Mobile 375px: Files sidebar stacks above content; no overflow.

## Addendum 2026-08-21d: curated Specs documents (replaces Files tab)
User rejected the file-browser/editor concept. Replace it: the Specs section becomes a **curated documentation index** grouped by the ledger's own categories — Decisions, Changes, Features, Archives — with an Overview. No file paths as the primary navigation, no raw tree, no editor split.

**Frontend restructure (dashboard/web/src/App.jsx):**
- Specs = two views: **Overview** (unchanged: tracker + DONE/NEXT/BLOCKED + formatted project-state/known-issues) and **Documents**.
- Documents view groups files from `/api/specs/tree` into categories by top-level path segment:
  - **Decisions** — `decisions/ADR-*.md` (list by ADR number, e.g. "ADR-001 — Project root name is guarana").
  - **Changes** — `changes/*.md` (validated change ledger).
  - **Features** — feature specs under `features/` (overview + 7 skill specs in guarana/ + cli/cli.md + dashboard/dashboard.md; proofs/ and audits/ are NOT primary items — surface feature specs only).
  - **Archive** — `archive/*.md`.
  - **Overview docs** — top-level `README.md`, `project.md`, `architecture.md`, `conventions.md`, `glossary.md` grouped as "Foundations" (state/ stays in the Overview tab).
- Each category renders as a titled block; documents shown as a clean list with a human title (derive from the ADR `#` heading if readable, else the filename minus extension and dirs), not raw file paths. No numeric "01/02" markers (records, not a sequence).
- Clicking a document opens it in a **reading pane** below/inline (formatted markdown), with the active document marked. This is the only document-display surface — no side-by-side editor columns, no file-list look.
- Tracker proof/change links open the target document in the Documents view (fall back to reading it inline).

**Style:** keep ledger tokens; Documents list uses hairline rules and the stamp vocabulary where statuses appear; reading pane is a single column, generous measure.

### Acceptance (addendum d)
29. Documents view has exactly the four categories (Decisions, Changes, Features, Archive) + Foundations for top-level docs — no "files" list/editor.
30. ADR docs show human titles (from their `#` heading), not paths; sorted by ADR number.
31. Clicking an ADR in Documents renders it formatted in a reading pane.
32. Tracker `proofs` link opens the proofs doc in the reading pane (not an editor).
33. `state/` docs do not appear as Documents items (they live in Overview).
34. Mobile 375px: Documents list + reading pane stack; no overflow.

## Addendum 2026-08-21e: guided UX pass
Targeted UX improvements to `dashboard/web/` (keep the ledger identity and tokens):
1. **Fixed bottom ticker** — the event ticker becomes a fixed bottom bar (sticky), no longer inline.
2. **Sticky section nav** — a slim left or top jump-nav for the page sections (Now, Runs, Specs) using scroll-to-section; compact on mobile.
3. **Collapsible category groups** — Decisions/Changes/Features/Archive/Foundations blocks collapse/expand (accessible buttons, aria-expanded).
4. **Full-run modal** — clicking a run opens its event stream in a modal overlay (not an inline push-down); Esc/backdrop closes; focus trapped; content scrolls within the modal.
5. **Empty/error polish** — consistent empty-state guidance (copy + command hint) and error banner styling across panels.
6. Keyboard focus + reduced-motion preserved (existing :focus-visible and reduced-motion rules extended to new elements).

### Acceptance (addendum e)
35. Ticker is fixed to viewport bottom and scrolls independently.
36. Section nav scrolls to Now/Runs/Specs; works on mobile.
37. Categories collapse/expand with proper aria-expanded.
38. Run click opens a modal; Esc and backdrop both close; focus returns to the trigger.
39. Empty state (no telemetry) and error banner render per guidance copy.
40. At 375px: no page overflow; modal fits; focus visible.

## Addendum 2026-08-21f: decisions-needing-you (proposal acceptance)
Surface spec proposals that need a human decision and let the user accept/reject, writing the outcome back append-only.

**Convention (agent-side contract, documented in the spec):** a pending decision is any line in an ADR (`decisions/ADR-*.md`) or feature spec (`features/guarana/*.md`) of the form:
`- **Decision:** pending: <statement>`  (case-insensitive "pending"). Agent writes these when it needs a human call (Rule-0 deferred items etc.).

**Server (dashboard/server):**
- `GET /api/decisions/pending` — scan `.specs/decisions/*.md` and `.specs/features/guarana/*.md` for `**Decision:** pending:` lines. Return `[{file, statement}]`.
- `POST /api/decisions/resolve` body `{file, statement, outcome: "accepted"|"rejected"}` — append to that file a new line:
  `- **Resolved (YYYY-MM-DD):** accepted — via dashboard.` (matching existing decision line style). Guard: `file` must resolve inside `.specs/decisions/` or `.specs/features/guarana/`, be `.md`, and must NOT already contain an unresolved (pending) marker for that statement being resolvable only once (if already resolved, 409). Append-only: never modify existing lines.

**Frontend:**
- New panel in the Specs section (top of it, above tabs): **"Decisions needing you"** — when pending items exist, list each `statement` with Accept / Reject buttons; on click, POST then refresh pending list. When none pending, show a quiet "No open decisions" (or hide).

### Accept (addendum f)
41. With a temp `.specs` containing one `**Decision:** pending:` line in an ADR, `GET /api/decisions/pending` lists it.
42. `POST /api/decisions/resolve` accept → 200; ADR gains appended resolved line; subsequent pending list is empty; original content untouched.
43. Reject path → same, wording "rejected".
44. Path-traversal `file` → 4xx; duplicate resolve → 409.
45. Frontend: panel renders statement + Accept/Reject; click resolves and panel updates (headless browser or curl+code-inspection, state method).

## Out of scope
- npm publish, auth, multi-project views, live websockets (polling is fine).
