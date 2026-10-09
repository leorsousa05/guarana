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
- `dashboard/server/` — Express API, Node 22+, serves on `localhost:4200` (env `GUARANA_DASH_PORT` overrides):
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

## Addendum 2026-09-28: memory injection history — brain view

Add a dedicated **Injected** tab to the Memory view. The orchestrator logs a
`memory-injected` event at system-context construction with session/time/state
and memory `{ id, type, scope }` references only. `GET /api/memory/injections`
hydrates those references from the project and private user vaults, keeping
global preference text out of project telemetry.

The page presents the selected injection as a bilateral brain: project memories
on one hemisphere, global preferences on the other, with injected nodes colored
by type. Selecting a neuron reveals its exact text; a recent-injection timeline
switches the view between turns. The brain is an information map, not decoration.

43. A context injection appends one reference-only telemetry event; no raw prompt or memory text is duplicated into telemetry.
44. `GET /api/memory/injections` returns recent events with hydrated text/type/scope from their correct vault; missing nodes remain identifiable by ID.
45. The Memory view opens on an Injected tab with an accessible brain map, distinct project/global hemispheres, type-colored memory nodes, keyboard selection, and recent history.
46. Empty history has a clear next-step message; 375px layout stacks the brain and history without overflow.
47. Repeated system transforms in one session do not re-inject or re-log the same memory IDs; duplicate global/project plugin instances produce one system block/event.
48. A `session.compacted` event resets the session cache and causes the current relevant memory set to be injected and logged once again.
49. Consecutive duplicate injection history is collapsed within each session; a compaction boundary preserves the next identical set as a new event.
50. The default memory graph includes confirmed project and private global nodes and edges; every displayed node is labeled with its scope.
51. Memory summary cards report project/global counts separately; project/global edges remain scoped and node identities do not collide.
51. Reject path → same, wording "rejected".
52. Path-traversal `file` → 4xx; duplicate resolve → 409.
53. Frontend: panel renders statement + Accept/Reject; click resolves and panel updates (headless browser or curl+code-inspection, state method).

## Addendum 2026-09-28: continuity UX polish

Preserve the existing ledger tokens, typography, layout, and interaction vocabulary.
Refinements focus on status clarity and keyboard operation across existing views.

54. Memory and Specs tabs support ArrowLeft/ArrowRight/Home/End with roving focus and explicit tab-panel relationships.
55. Decision resolution disables duplicate actions and provides an announced success or error outcome; document loading and failures are visible.
56. Successful polling clears a previous transient error; loading states are announced without changing their visual treatment.
57. The Memory Graph has an informative empty state, and unavailable clipboard support is reported from the resume action.

## Addendum 2026-09-28: restrained layout refinement

Keep the ledger's paper/ink palette, existing type system, square geometry, and
rule-based surfaces. Improve reading order through proportion, spacing, and
responsive flow; keep Overview as stacked ledger sections rather than a KPI-card grid.

58. Every view uses the same simple shell: header, horizontal section rail, then one main content column; the active item is marked with the existing red token.
59. Overview presents workflow/run evidence before supporting memory/decision data as a simple single-column ledger, separated by rules rather than boxed cards.
60. System-state documents stack in one reading column; at tablet/mobile widths the section rail scrolls within its own bounds without causing page overflow.

## Addendum 2026-09-28: Memory Graph stability and legibility

Keep the graph focused on relationships: scope-aware initial placement, labels
only where useful, and explicit drag/reset guidance. Manual placement is user
state and must survive telemetry polling and view changes.

61. Refreshing an unchanged node/edge topology preserves every node coordinate; adding nodes preserves existing coordinates and places only new nodes.
62. Manual coordinates persist across Memory tab changes and app-view remounts; Reset layout is an explicit user action.
63. Nodes support keyboard selection; pointer capture allows dragging across the canvas, and drag movement does not trigger click-selection.
64. Unselected edges omit relation labels; selecting a node reveals labels only for its connected edges and labels its neighboring nodes.

## Addendum 2026-09-28: Specs and Workflow reading order

Use page-specific structure within the shared single-column ledger shell. Specs
separates implementation status, roadmap, and documents; Workflow foregrounds
the current task and phase before its supporting details and history.

65. Specs Overview labels the tracker and roadmap as separate sections; Documents categories begin collapsed and the category containing the active document opens.
66. Project state and known issues remain a stacked, rule-separated reading flow.
67. Workflow presents the active task and current phase before the ordered phase rail and labeled run details.
68. Transition history separates route, event, note, and time, wrapping at narrow widths without page overflow.

## Addendum 2026-09-28: compact Specs and interactive Workflow

Keep Specs page height bounded by showing concise previews and opening the full
Markdown only when requested. Make workflow progress directly inspectable with
phase-specific state and color semantics.

69. Roadmap entries, pending decisions, project state, and known issues show compact previews; each opens the complete content in an accessible modal.
70. Documents lists titles only; selecting a document opens its complete Markdown in the same modal reader rather than an inline page-length pane.
71. Specs modal supports Escape/backdrop close, focus containment/restoration, and links to other local `.specs` documents.
72. Workflow phase controls are keyboard-operable; selected phase shows whether it is current, passed, or upcoming and the associated transition event/history.
73. Workflow uses existing red/leaf/amber tokens for current/passed/upcoming phases and remains legible at mobile widths.

## Addendum 2026-09-28: cross-instance memory injection deduplication

Injection deduplication must work even when project/global plugin instances run
in isolated processes. Same-turn telemetry from duplicate instances represents
one context build; merge overlapping node references in history without
crossing session or compaction boundaries.

74. Per-session seen memory IDs are claimed atomically in shared project telemetry state; duplicate plugin instances inject each ID at most once until compaction.
75. Session creation and compaction reset persisted seen IDs; compaction preserves its distinct injection-history boundary.
76. Overlapping memory-injected events from the same session within one second merge to one history entry containing the union of unique scope/ID references.

## Addendum 2026-10-08: live Activity view and Advisor history

Replace the simple Now summary surface with a dedicated live **Activity** view.
Keep the existing `#/now` hash working for deep links, but label its navigation
item “Activity”. Lead with two peer square/rule-ledger work areas: the latest root
session and the Advisor. Keep model settings in Models; remove the Advisor runtime
proof panel from that settings page.

- The root-session area shows identity, evidenced status, current workflow
  phase/task, elapsed time and tool/token/error counts.
- The Advisor area shows not-called/running/completed/error based on observed
  dispatch/session/completion events, the configured vs observed model metadata,
  and a button that opens an accessible Advisor history modal. The modal lists
  call time, status, child ID and observed provider/model/variant, not prompts or
  raw response/tool-error text.
- Supporting sections show workflow transition flow, recent safe tool/session
  activity, and memory actually injected into the selected root session, hydrated
  from the existing memory-injections API. Never label the newest session “active”
  unless telemetry supplies busy/running evidence; otherwise say latest/last seen.
- Use existing telemetry SSE for live refresh. Preserve the ledger palette,
  typography, square outlines and hairlines; on 375px the two work areas stack
  without horizontal overflow.

77. Navigation label “Activity” opens the existing `#/now` deep link and keeps the
  rendered section directly focusable.
78. Desktop shows distinct Current session and Advisor square work areas; 375px
  stacks them with no horizontal page overflow.
79. Current-session selection considers root sessions (no parent session ID),
    prefers a root with observed `busy/running`, then greatest last-activity time;
    active status appears only when busy/running is actually observed.
80. Advisor panel distinguishes not-called/running/completed/error, compares
  observed model metadata to configured settings only when an observed event
  exists, and opens its history in an accessible modal.
81. Advisor history modal shows safe event metadata only; Escape/backdrop closes,
  focus is contained and restored to the history button.
82. Workflow timeline, safe recent tool activity and actual injected memories for
  the root session refresh via telemetry SSE; empty states are explicit.
83. Models displays configuration only and no longer renders the runtime proof
   panel.
84. The Advisor panel and each Advisor-history row explain why advice was
   requested, using the native Task `description` as a concise 3–5-word reason.
   The Primary profile directs that description to say why help is needed now, not
   repeat the task title. Store only a bounded, secret-filtered description—never
   the Task prompt/output. Missing or unsafe reason displays “Reason not recorded.”

### Follow-up — root session was hidden by helper sessions

User saw an Advisor call in history while its Activity work area said it had not
been called. Telemetry showed the event's `parentSessionID` matched the long-lived
root, but `rootSessionFrom()` had chosen the first parentless run in session-start
order. Recent helpers without parent metadata could sort ahead. The fix prefers an
observed busy/running root, else the greatest end/last-activity timestamp; Advisor
status/history remains scoped to that root, never the child Advisor.

### Implementation status

- Worker-code `ses_ee17270effferhcAi7zt3WWKbR` implemented Activity at the existing
  `#/now` hash, relabeled navigation, added Advisor dispatch status/history modal,
  workflow and safe recent-event sections, and root-session injected-memory view.
  Models configuration no longer contains the runtime proof block.
- Telemetry records observed busy/retry state, safe session agent/parent IDs, and
  start/completion events for native Advisor Task calls. The activity summary now
  carries parent session/agent/status metadata so Advisor children can be excluded
  from root-session selection.
- Follow-up worker-code `ses_ee152fee3ffeGU1GHJ8CNjnUjp` changed root selection to
  prefer observed busy/running roots and then last activity; Advisor history is
  matched by the selected root's parent session. `node --test
  dashboard/web/src/components/Activity.test.mjs` passed 2/2, including older-start
  busy root vs newer-start idle roots, last-end fallback, and unrelated Advisor
  parent filtering. Independent worker-verify `ses_ee14cc5aaffexxrn2km3Um7Tuf`
  passed at 375px with the main busy root behind newer helper/Advisor entries;
  the correct root and its Advisor call were rendered. Screenshot:
  `/tmp/opencode/activity-root-fix-375.png`.
- Independent worker-verify `ses_ee1646f18ffe9eLPHP4MpHYGNx` passed at 375×812:
  Activity/nav route retained, root picked over newer Advisor child, observed busy
  status and workflow shown, injected root memory shown and child-only memory
  excluded, event timeline omits raw error content, and Advisor history modal
  closes on Escape/backdrop and restores focus; no overflow. Screenshot:
  `/tmp/opencode/activity-view-375.png`.
- Focused telemetry/server/Activity/Models command passed 37/37; `npm test`
  passed 264/264; dashboard build/CLI sync, `npm run check-cli`,
  `npm run specs:validate`, and `git diff --check` passed.
- Root-selection correction proof and full-check record:
  `.specs/changes/2026-10-08-activity-root-selection.md`.
- Worker-code `ses_edf3af320ffeFQOXaZ77wexRLH` added the why-now Task-description
  convention to the generated Primary profile; telemetry stores only a bounded,
  secret-filtered reason on Advisor dispatch, history API passes it through, and
  both the current Activity square and history modal display it with an explicit
  missing-reason fallback. It never stores the Task prompt/output. Focused CLI,
  telemetry, history projection/API, and Activity/modal tests passed 60/60.
- Independent worker-verify `ses_edf332acfffensm5362id9anSa` passed profile
  guidance, Task description extraction, secret-shaped reason omission, history
  projection, Activity card and modal reason display, and “Reason not recorded”
  fallback. Focused independent test run: 59/59; full `npm test` 266/266,
  dashboard build/sync, `check-cli`, `specs:validate`, and `git diff --check` pass.
  Proof: `.specs/changes/2026-10-08-advisor-consultation-reason.md`.
- A live Advisor Task (`ses_edf1b2176ffe0QFXvnLfob0RR6`) returned `Advisor ativo.`;
  telemetry recorded parent `ses_ee39ce5c0ffeA5wDL8irBmzskV`, actual
  `openai/gpt-6-sol`/`xhigh`, but no reason. `plugin status --project` then found
  the loaded telemetry plugin and Primary profile stale; `guarana plugin install
  --project` refreshed both and status is current. Restart/reload OpenCode and
  repeat to validate live reason capture. No prompt/output was stored.
- After the project plugin reload, live Task `ses_edf12824affeTImYKdFojUTX8x`
  returned `Advisor ativo.` and dispatch event 67004 recorded
  `reason=Verificar captura do motivo`, parent `ses_ee39ce5c0ffeA5wDL8irBmzskV`,
  and the matching child/call IDs. The execution event confirms `openai/gpt-6-sol`
  / `xhigh`. This passes live reason capture; no prompt/output was stored.

## Out of scope
- npm publish, auth, multi-project views, live websockets (polling is fine).
