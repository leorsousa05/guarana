# Feature spec: guarana dashboard (telemetry plugin + web UI)

**Status: VALIDATED**
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

## Addendum 2026-10-10: complete dashboard visual/UX redesign plan

The user approved a complete visual and UX redesign of all eight existing
dashboard views: Overview, Activity, Runs, Specs, Workflow, Memory, Skills, and
Models. This plan covers their shared shell/navigation, dialogs, and consistent
empty, loading, and error states. Appearance may change, and small UI features
may be added when needed within the dashboard scope.

### Design direction

Evolve rather than discard the Guarana ledger identity. Treat the dashboard as
an **operational folio / field instrument** for an internal engineering
workflow: a restrained warm paper/ink base, sparse Guarana red for current or
critical state, muted leaf for healthy state, and amber only for warnings.
Retain Space Grotesk for display and IBM Plex Mono for data while improving
type hierarchy, spacing, navigation, information density, and component
consistency. Avoid generic gradients, rainbow colors, and rounded-card SaaS
kits.

Use the approved restrained tokens: paper `#F5F0E4`, ink `#1E1710`, hairline
`#D8D0BE`, Guarana red `#9E1B1E` for current or critical state, muted leaf
`#3E5C3A` for healthy state, and amber `#B87A14` for warnings. Space Grotesk is
for display and IBM Plex Mono for data. Use neutral hierarchy and spacing for
dense information; spend visual emphasis on the current workflow/session state.

On desktop, use a persistent section rail, compact project/live-status header,
page title and action, then a focused ledger/detail work area. On mobile, use a
compact header, contained scrollable navigation, and stacked single-column
pages; at 375px the page must not overflow. Keep the existing API contracts,
data meanings, capabilities, and privacy boundaries. Do not make backend, API,
or data-schema changes unless implementation demonstrates they are necessary
and they are separately planned and approved. Small new UI features are allowed
only when needed within this dashboard scope.

### Preserved behavior and constraints

- Keep root-session selection and show busy/active status only when telemetry
  provides that evidence; preserve live SSE behavior.
- Preserve safe Activity, Advisor-history, and memory-injection display; do not
  expose prompts, raw response/error text, or private/global memory text in
  project telemetry.
- Preserve exact model IDs, per-field project/global inheritance, and existing
  Models configuration semantics.
- Preserve the existing meanings and capabilities of Specs, Memory, Workflow,
  and Skills, as well as every other current view.
- Preserve keyboard-operable tabs and dialogs, visible focus, Escape behavior,
  focus containment/restoration, reduced motion, and accessible live regions.

### Planned phases

1. Establish design tokens and the shared shell/navigation.
2. Redesign Overview, Activity, and Runs.
3. Redesign Specs and Workflow.
4. Redesign Memory, Skills, and Models.
5. Polish cross-screen empty/loading/error states and accessibility; update
   relevant documentation and tests.

### Acceptance criteria

1. All eight existing views/routes remain usable, retaining their capabilities,
   data meanings, privacy rules, and existing deep links.
2. The shared shell, navigation, dialogs, and common state surfaces use the
   approved restrained operational-folio visual direction consistently across
   all views.
3. Existing API calls and payloads remain unchanged. Any demonstrated need for
   backend/API/data-schema changes is separately planned before implementation.
4. Root-session busy evidence and SSE updates remain correct; safe Activity and
   injection display, exact model IDs and inheritance, and Specs/Memory/
   Workflow/Skills semantics are preserved.
5. Keyboard access and visible focus remain available; dialogs close on Escape,
   contain and restore focus; reduced-motion behavior and live-region
   announcements remain accessible.
6. At 375px and desktop widths, no unintended page-level overflow or clipped
   content occurs; navigation and content remain usable.
7. Focused tests cover affected and previously uncovered views/API flows;
   `npm test`, `npm run build`, `npm run check-cli`, and specs validation pass.
8. An independent visual/behavior verification records criterion-level results,
   screenshots at 375px and desktop, and interactive-state evidence.

This is an accepted plan only. The overall dashboard code status remains
**TASKED** until independent proof is recorded; this work is not shipped.

### Phase 1 implementation checkpoint — 2026-10-10

Recorded before `run_start`. Worker-code owns only the shared visual-token,
shell, navigation, and header refactor in this phase. Retain all eight existing
hash routes, navigation labels and data flow, ARIA tab/navigation behavior and
visible focus, and current API polling/SSE behavior. Do not change endpoints or
data logic. Full view redesign remains in later phases.

Phase 1 acceptance:
1. The refreshed restrained operational-folio shell works at desktop and
   375px widths.
2. Keyboard navigation works with ARIA tab/navigation behavior and visible
   focus retained.
3. There is no unintended horizontal overflow.
4. Existing screens render within the same shared shell.

### Phase 1 independent verification failure — 2026-10-10

- Independent worker-verify reports the browser metrics on a temporary copy of
  canonical `dashboard/web/dist` passed, and the other Phase 1 criteria passed.
  However, the actual packaged CLI still serves the old bundle, so Phase 1 is
  **not passed**.
- The code worker built the dashboard only. `npm run build:dashboard` updated
  canonical `dashboard/web/dist` but not the mirrored `cli/dashboard/web/dist`.
  Exact check failure: `npm run check-cli` reported
  `DRIFT detected: dashboard/web/dist -> cli/dashboard/web/dist`; `index.html`
  and hashed assets differ.
 - Follow-up recorded 2026-10-10: `npm run sync-cli` synchronized the generated
   CLI dashboard dist, removing `index-D8Sm78hd.js` and `index-_96YojPo.css` and
   adding canonical `index-BkgJlX6g.js` and `index-DBHfXKwr.css`. No source edits
   were made. The sync helper excludes source `node_modules`; none existed at the
  copied dist target. `npm run check-cli` now passes. Independent desktop and
  375px viewport QA against the actual CLI bundle remains pending; do not mark
  Phase 1 passed until that re-verification succeeds.

### Phase 1 final independent verification — 2026-10-10

- Independent `worker-verify` visited all eight existing hashes against the
  actual CLI-served bundle at 375×812 and 1440×900. All 16 viewport checks found
  document/body `scrollWidth` exactly equal to the viewport width (375/1440).
- Header/navigation bounds were mobile x=12–363 and desktop x=40–1400, with the
  desktop section rail x=40–240. The mobile nav is contained at 351px client /
  516px scroll width with `overflow-x:auto` and
  `overscroll-behavior-inline:contain`; the Runs table is contained at 351/808.
- Keyboard focus is visibly rendered as a 2px solid outline. Reduced-motion
  emulation reduces animation duration to 1e-05s. APIs returned 2xx, with no
  console, page, or failed-request errors.
- Specs validation reported 149 files, 33 features, 30 ADRs, 205 links, and 0
  issues. Sidebar test passed 1/1; `npm run check-cli` passed. No build rerun was
  performed because it would create an unsynchronized `dist` bundle.
- Screenshots for Overview, Activity, Skills, and Models at mobile/desktop sizes
  and focus states are under `/tmp/opencode/phase1-actual-cli-...`. The server
  was stopped and port 42763 closed.
- **Phase 1: VALIDATED.** This does not validate or ship the overall dashboard
  redesign, which remains **TASKED** and not shipped. No source edits were made.

### Bounded Overview redesign slice — 2026-10-10

This accepted slice updates only the Overview view within the larger dashboard
redesign. It is independently validated as of 2026-10-10; the overall dashboard
redesign remains TASKED and no shipping is claimed.

Restructure Overview around the primary operational job: show the current
workflow/active goal and next action first, recent run health/evidence next, and
supporting memory counts, pending decisions, and roadmap after. Preserve all
current Overview source data and fields (`summary.runs`, workflow/state,
tracker, `/api/memory/summary`, and `/api/decisions/pending`), their meanings,
and all current content. Preserve empty, loading, and roadmap behavior. Make no
new API calls or backend-semantic changes.

Apply the approved quiet operational-folio design from the complete redesign
plan: restrained paper/ink, red only for current or critical state, muted leaf
for healthy state, amber for warnings, existing type system, and hairline-led
sections. Do not use a colorful KPI-card grid. Retain accessible section labels
and semantic structure. Add a focused render/content regression test using the
existing Vite SSR testing style.

#### Acceptance criteria

1. Overview orders current workflow/active goal and next action first, recent
   run health/evidence next, and supporting memory counts, pending decisions,
   and roadmap after; existing section data and field meanings are preserved.
2. The slice uses no new API calls and changes no backend semantics; existing
   empty, loading, and roadmap behavior is unchanged.
3. The view follows the approved quiet folio design without a colorful
   KPI-card grid, and retains accessible section labels and semantic structure.
4. A focused render/content regression test covers the Overview ordering and
   source content using the existing Vite SSR testing style; keyboard/focus and
   reduced-motion behavior remain unaffected.
5. Playwright verification uses the actual CLI-served bundle at 375px and
   desktop widths and confirms no unintended overflow. No CLI bundle or runtime
   behavior changes are in scope.

#### Phase 2a independent verification — 2026-10-10

- Independent worker-verify reports Phase 2a Overview **PASS (6/6)**. This
  validates the bounded Overview slice only; the complete dashboard redesign
  remains **TASKED** and is not shipped.
- Overview hierarchy and content: `Overview.jsx:169-214`; scoped styles:
  `style.css:2541-2797`. Existing Overview API polling for runs, memory, and
  pending decisions is unchanged from HEAD; no API or backend change is claimed.
- SSR content/state regression coverage:
  `Overview.test.mjs:12-93`. Focused Overview/Activity checks passed 4/4 (exact
  command not supplied), and the dashboard build passed.
- Playwright used the current source via Vite against the actual API at 375x812
  and 1440x900. At both sizes document/body `scrollWidth` equaled viewport
  width, with no page overflow; skip link displayed a visible 2px focus outline,
  reduced-motion was honored, APIs returned 200, and there were no page errors.
  A nonfatal WebSocket warning occurred. Screenshots:
  `/tmp/opencode/overview-fixture-375x812.png`,
  `/tmp/opencode/overview-fixture-1440x900.png`,
  `/tmp/opencode/overview-375x812.png`, and
  `/tmp/opencode/overview-1440x900.png`.
- This browser proof used Vite/current source, not the actual CLI-served bundle;
  CLI mirror sync and actual CLI-served verification remain pending.

### Bounded Activity redesign planning — 2026-10-10

Activity design and acceptance are closed for the next bounded implementation
slice. The next worker-code task may redesign `Activity.jsx` and its scoped
Activity styles/tests only. Preserve existing privacy and root-session semantics,
the Advisor history dialog's keyboard and focus behavior, and responsiveness at
375px. Do not change API, data, or telemetry contracts. No implementation or
independent verification result is recorded by this planning checkpoint; the
overall dashboard redesign remains TASKED.

#### Acceptance criteria

1. The Activity view redesign is limited to `Activity.jsx` and scoped Activity
   styles/tests; unrelated views and the shared shell are not part of this slice.
2. Existing root-session selection and busy evidence, safe Activity/Advisor
   history/memory display, and their privacy boundaries are preserved.
3. Advisor history remains keyboard-operable, with its existing focus behavior
   preserved.
4. At 375px, Activity remains usable without unintended horizontal page overflow.
5. Existing API, data, and telemetry contracts remain unchanged.

### Bounded Specs redesign planning — 2026-10-10

This planning checkpoint scopes the next implementation slice to the Specs
screen only. It does not implement or independently verify the slice. The overall
dashboard redesign remains **TASKED** and is not shipped.

Keep the approved restrained operational-folio hierarchy and all current Specs
content and actions. Preserve Overview tracker, roadmap, and state data, including
the existing Unknown-schema fallback. Do not change backend behavior, APIs,
payloads, or data schemas.

The pending-decision UI continues to use the existing pending-decision API and
the Accept/Reject POST payload `{file, statement, outcome}` with `outcome` set to
`accepted` or `rejected`. Preserve success/error feedback, refresh the pending
list after resolution, and retain the existing file-wide resolution limitation.
Overview and Documents remain ARIA tabs with their tab-panel relationships and
ArrowLeft/ArrowRight/Home/End keyboard behavior.

Documents keeps the existing tree/file APIs (`GET /api/specs/tree` and
`GET /api/specs/file?path=<rel>`), category collapse behavior, human-title lookup
from Markdown headings with the existing filename fallback, and the Markdown
reader modal. Local Specs-document links open their target in the reader; Escape
and backdrop close, focus containment, and focus restoration remain intact.

**Known discrepancy resolution:** `Documents.buildGroups` currently shows
unmatched `state/` documents as an extra group, while the existing dashboard
contract says project-state and known-issues belong only in Overview. Follow that
documented contract: omit every `state/` document from Documents, while retaining
other unmatched/unknown directories there.

#### Acceptance criteria

1. Overview preserves current tracker, roadmap, and state content and meanings,
   including Unknown-schema fallback; existing empty/loading behavior remains.
2. Pending decisions preserve the existing Accept/Reject POST payload and
   file-wide resolution limitation, show resolution feedback, and refetch the
   pending list after an action.
3. Overview and Documents retain accessible ARIA tab/panel relationships and
   ArrowLeft/ArrowRight/Home/End keyboard operation.
4. Documents uses the existing tree/file APIs, category collapse behavior, and
   Markdown-heading title lookup with filename fallback. No `state/` documents
   appear there; other unmatched/unknown directories remain available.
5. Selecting documents and following local Specs links opens the correct
   formatted document in the reader modal; Escape/backdrop closing, focus
   containment/restoration, and visible keyboard focus are preserved.
6. Focused regression tests cover all Specs screen contents and actions,
   including the `state/` exclusion and retention of other unknown directories.
7. At 375px and desktop widths, Specs has no unintended page overflow or
   clipped content; keyboard, modal, focus, and reduced-motion behavior remain
   accessible.
8. Focused tests and browser checks pass, with screenshots at 375px and desktop;
   `npm test`, `npm run build`, `npm run check-cli`, and
   `npm run specs:validate` pass. No backend/API changes are in scope.

<!-- guarana:record:start -->
Status: VALIDATED
Proof: Preserved prior worker-code final build/sync evidence: npm run build PASS, CLI bundle synchronized, local cli/dashboard/server/node_modules tree hash preserved, npm run check-cli PASS.; Preserved prior independent final combined worker-verify PASS for all eight actual CLI-served routes at 375x812 and 1440x900; results /tmp/opencode/dashboard-actual-cli/final-results.json; npm test PASS 439/439 on Node 24.20 and Node 22.23.3; npm pack --dry-run --json PASS with 122 entries and zero packaged node_modules; npm run smoke:pack PASS; specs validation PASS with 154 files and 0 issues. This historical proof does not verify or fix the refresh incident.; Diagnostic evidence only: user reports TypeError: NetworkError when attempting to fetch resource on refresh; live CLI-bundled server at 127.0.0.1:4200 observed at 118-119% CPU, 569-621 MB RSS, listen backlog 1-2; / and /api/telemetry/summary timed out after 3-5 seconds; telemetry JSONL 28,347,021 bytes; isolated source app returned HTTP 200 for summary (232,556 bytes/1450ms), one-session events (12,072 bytes/1059ms), and specs state/tracker/workflow (11-17ms). Source trace: usePoll.js:7-28 ties four endpoint reloads to SSE tick; App.jsx:51-78 can issue five events requests per tick; telemetry.js:11-27 reparses full JSONL per request. No app code changed and no service was killed or restarted. Proposed refactor is not approved or applied; this incident is not fixed or independently validated.; No shipping, commit, or release occurred. Latest-stable OpenCode host smoke remains release-only; CLI ADR-031 write remains ACL-blocked and was not retried.
Change: .specs/changes/2026-10-11-dashboard-redesign.md
<!-- guarana:record:end -->

### Specs slice independent verification failure — 2026-10-10

- Worker-verify reproduced that activating a local Specs link inside
  `SpecsMarkdownModal` changes document content while the modal component stays
  mounted, after which focus is lost outside the dialog and Escape no longer
  closes it. This occurred at both 375px and 1440px.
- Root references: `Specs.jsx:279-284`, `SpecsMarkdownModal.jsx:46-66`, and
  `markdown.jsx:64-70`.
- The root `npm test` script omits `Specs.test.mjs`, so its six new UI tests are
  not part of the normal suite.
- **Specs slice verification: FAIL.** Pending fix: keep focus inside the modal
  after internal document navigation and retain Escape closing, focus return,
  and the focus trap; add `Specs.test.mjs` to the root `npm test` glob; rerun the
  full checks.
- No fix is claimed. The overall dashboard redesign remains **TASKED** and is
  not shipped.

### Specs reader focus implementation milestone — 2026-10-10

- Worker-code reported changes to `dashboard/web/src/components/SpecsMarkdownModal.jsx`,
  `dashboard/web/src/components/Specs.test.mjs`, and root `package.json`. The
  modal captures the opener once and restores it on close, refocuses the close
  button when reader title/path/text changes, and retains the mounted modal and
  Escape/key handling.
- A dependency-free SSR/source-wiring regression covers the local-link update;
  root `npm test` now discovers `Specs.test.mjs`.
- Worker self-check: focused Specs tests PASS (7/7), `npm test` PASS (438/438),
  and diff-check PASS.
- No real-browser focus test is available. Independent browser verification
  remains pending, so the related known issue remains OPEN and no independent
  PASS is claimed. The overall dashboard remains TASKED and is not shipped.

### Specs reader independent browser verification — 2026-10-10

- After internal local-link navigation, Escape and normal close restore the
  original document trigger. Backdrop close fails at both 375x812 and 1440x900:
  after modal unmount, `document.activeElement === #main-content`, not the
  original opener. Current implementation references:
  `SpecsMarkdownModal.jsx:19-32,58-77`.
- The current Specs modal-fix verification is **FAIL on criterion 1**.
  Independent Playwright reproduced the backdrop failure. Focused tests passed
  29/29, `npm` passed 438/438, and build passed; these checks do not negate the
  browser failure.
- **Debugging/fix pending:** restore the same original trigger on every close
  path and add/run the independent backdrop-close browser regression at both
  viewport sizes. The known issue remains OPEN; overall dashboard status stays
  **TASKED** and no shipping is claimed.

### Specs modal-focus final independent verification — 2026-10-10

- Independent worker-verify **PASS** closes the bounded Specs modal-focus fix
  and supersedes the pending/FAIL verification outcomes above. For close button,
  Escape, and backdrop, both with and without local Specs-link navigation, the
  original Docs opener is restored at 375x812 and 1440x900. After link navigation
  focus remains in the mounted dialog; Tab/Shift+Tab are trapped; the visible
  focus indicator is 2px; reduced motion is honored; document, body, and
  container widths equal the viewport with no overflow.
- Proof artifact: `/tmp/opencode/specs-focus-final-results.json`; screenshots
  were captured at 375x812 and 1440x900. Tab/local-link safety is covered by
  `Specs.test.mjs:123-153,209-270`; server traversal security is covered by
  `security.test.js:24-44`.
- Focused tests PASS (29/29, Specs 7/7), `npm test` PASS (438/438), build PASS
  (54 modules), diff-check PASS, and specs validation PASS (151 files, 35
  features, 30 ADRs, 206 links, 0 issues). No dependencies or API changes.
- Both related Specs modal-focus known issues are RESOLVED for this bounded fix.
  The overall dashboard redesign remains **TASKED** and is not shipped.

### Bounded Workflow screen redesign planning — 2026-10-10

This planning checkpoint scopes the next implementation slice to the Workflow
screen only. It does not implement or independently verify the slice. The overall
dashboard redesign remains **TASKED** and is not shipped.

Preserve the existing seven-state order and transition mapping, and the exact
`GET /api/workflow/current` payload and meaning. Retain the active task, skill,
goal, condition, and `updatedAt` fields; phase-select button behavior; current,
passed, and upcoming phase semantics; and the associated transition history,
event, note, and time. Preserve the no-engine empty state. Do not change APIs,
backend behavior, payloads, or data schemas.

Present the screen as a clear state-machine folio: active task and current phase
first, then the ordered phase path, then its related transition record and
metadata. Use the approved restrained semantic colors. Keep existing keyboard
controls and visible focus, status live-region behavior, and reduced-motion
support. At 375px and 1440px, the page must not overflow horizontally.

#### Acceptance criteria

1. The Workflow view preserves the existing seven-state order and transition
   mapping, the current `GET /api/workflow/current` payload and meaning, and the
   active task, skill, goal, condition, and `updatedAt` fields; no API, backend,
   payload, or schema changes are made.
2. The view presents active task/current phase first, the ordered phase path
   second, and the related transition record and metadata after it. Phase-select
   button behavior and current/passed/upcoming semantics are preserved using
   restrained semantic colors.
3. Transition history retains its associated event, note, and time; the existing
   no-engine empty state remains available and meaningful.
4. Existing keyboard controls and visible focus, status live-region behavior,
   and reduced-motion support remain intact.
5. An SSR regression covers state order, current/passed/upcoming states,
   transition history, task details, and the no-engine empty state.
6. A browser regression covers phase selection and navigation. Browser checks at
   375px and 1440px record screenshots and layout metrics, confirm no page-level
   horizontal overflow, and cover keyboard/focus and reduced-motion behavior.
   Focused tests and the dashboard build pass; no backend changes are in scope.

No implementation, test, build, browser, or independent-verification result is
claimed by this planning checkpoint.

### Bounded Memory screen redesign planning — 2026-10-10

This planning checkpoint scopes the next implementation slice to the Memory
screen only. It records no implementation or independent verification result;
the overall dashboard redesign remains **TASKED** and is not shipped.

Keep the four existing Memory tabs — Injected, Summary, Search, and Graph — with
Injected as the default. Preserve the current summary values and project/global
scopes; Search continues to use the existing project-only memory search API,
including its type filter and result fields (type, intent, summary, score, and
timestamp); and Graph continues to show project/global nodes and edges with
scope-qualified identity, node selection, neighbors, decision lineage, dragging,
and explicit layout reset. Node positions remain in `sessionStorage` and retain
the existing topology-refresh stability behavior.

Injected retains recent-history selection, the bilateral project/global brain
map, type-colored nodes, keyboard selection, and selected-node detail. Keep
`memory-injected` telemetry reference-only: event metadata and `{id, type,
scope}` references only, never prompt or memory text. Injection history hydrates
node details from the correct project/private global vault; missing nodes remain
identifiable, and private/global text is not copied into project telemetry.
Draft migration/review remains available through existing CLI/API paths only;
do not add dashboard draft/review controls.

Reshape hierarchy and responsive layout in the approved restrained operational-
folio style. Preserve existing API contracts, payloads, data meanings, and
privacy behavior; make no API, backend, or data-schema changes. Keep ARIA tab
relationships and keyboard operation, graph node keyboard/pointer controls,
visible focus, and reduced-motion behavior. At 375px and 1440px, there must be
no page-level horizontal overflow; contained graph scrolling is acceptable.

#### Acceptance criteria

1. Memory retains exactly the four existing ARIA tabs and their tab-panel
   relationships, opens on Injected, and preserves ArrowLeft/ArrowRight/Home/End
   tab navigation.
2. Summary preserves current count values, project/global scope reporting, and
   the existing loading/error/empty semantics without changing summary API data
   meanings.
3. Search remains project-only and uses the existing search API and type filter;
   confirmed-only behavior and all existing result fields (type, intent,
   summary, score, timestamp) remain intact.
4. Graph preserves project/global nodes and edges, scope-qualified identities,
   selection, connected neighbors and decision lineage, keyboard selection,
   pointer-captured dragging, and explicit reset. Existing node positions remain
   stable across refreshes and are persisted in `sessionStorage`; drag movement
   does not trigger selection.
5. Injected preserves history selection, bilateral project/global brain map,
   type-colored keyboard-selectable nodes, and selected-node details including
   unavailable-node identity. Reference-only telemetry and correct project/global
   hydration/privacy behavior remain unchanged.
6. Draft/review remains CLI/API-only. No API, backend, payload, or data-schema
   changes are made.
7. The redesigned hierarchy follows the approved restrained folio direction;
   visible focus and reduced-motion behavior remain accessible. At 375px and
   1440px there is no page-level horizontal overflow; contained graph scrolling
   is acceptable.
8. Focused tests cover summary counts/scopes, search filtering/result semantics,
   tabs, graph interactions/layout persistence, and injection privacy/hydration
   semantics. Browser verification records screenshots and viewport/layout
   metrics at 375px and 1440px, including keyboard/pointer, focus, and
   reduced-motion behavior. Dashboard build and specs validation pass; no
   implementation or verification outcome is claimed by this planning entry.

### Memory design planning milestone — 2026-10-10 (before run_start)

The Memory design plan is complete. The next worker-code task is limited to the
Memory and MemoryGraph components and Memory-scoped CSS/tests. Preserve existing
API, scope, data, and graph behavior, keep Injected as the default tab, and make
no backend changes. No implementation or verification result is recorded by
this milestone; the overall dashboard remains TASKED and is not shipped.

### Bounded Memory Injected folio visual verification — 2026-10-10

- Independent browser verification **PASS** for the bounded Memory Injected
  folio visual slice at 375x812 and 1440x900. Screenshots:
  `/tmp/opencode/memory-injected-folio-375x812.png` and
  `/tmp/opencode/memory-injected-folio-1440x900.png`.
- Backgrounds are transparent with no shadows; the brain map is unboxed and
  injection history is separated only by a thin divider. Project/global map
  distinction, 2px focus, selected-node state, and all 42 history entries are
  preserved. Document/body widths are 375/375 and 1440/1440; history scrolling
  remains contained with reported metrics 2922/223 and 2922/463.
- Regression and implementation references: `Memory.test.mjs:223-231`;
  `MemoryInjections.jsx:43-96,144-195`; `style.css:2144-2219,2287-2323`.
  Focused Memory/graph tests PASS (11/11), including summary/search/graph
  coverage; dashboard build PASS; specs validation clean. Memory API routes and
  library are unchanged.
- **Bounded Memory Injected folio visual slice: VALIDATED.** This result closes
  only the bounded visual known issue; it does not claim validation of the full
  Memory screen redesign. The overall dashboard redesign remains **TASKED** and
  is not shipped.

### Memory full-screen re-verification task acceptance — 2026-10-10

This is a planning-only acceptance update for independent re-verification of all
four Memory tabs after the separately validated bounded Injected folio fix. The
full Memory redesign and overall dashboard remain **TASKED**; this entry records
no implementation or full-screen verification result. The bounded Injected
visual slice remains separately **VALIDATED** as recorded above.

1. Verify exactly the four existing ARIA tabs and associated panels (Injected,
   Summary, Search, Graph), Injected as the default, and ArrowLeft/ArrowRight/
   Home/End keyboard navigation.
2. Verify Summary project/global scope counts and loading, error, and empty
   states while preserving current values and API meanings.
3. Verify Search remains project-only, confirmed-only, and type-filterable, with
   the existing type, intent, summary, score, and timestamp result fields.
4. Verify Graph project/global scope-qualified node IDs and edges, selection,
   connected neighbors, decision lineage, keyboard selection, and pointer drag;
   dragging must not select. Verify there is no `<select>` filter, graph-position
   `sessionStorage` persistence, or reset control.
5. Verify Injected history selection, bilateral project/global map, type-colored
   nodes, selected-node details, and identifiable missing nodes. Telemetry must
   remain reference-only (`id`, `type`, `scope`), hydrate details from the
   correct vault, and never copy prompt or private/global memory text into
   project telemetry.
6. Verify draft/review controls are absent from the dashboard and no API,
   backend, payload, or data-schema changes are made.
7. Verify the restrained no-card folio direction, visible focus, reduced-motion
   behavior, and no page-level overflow at 375x812 and 1440x900. Record viewport
   metrics and screenshots; contained graph scrolling is acceptable.
8. Focused tests cover the tab, summary, search, graph, injection, and privacy
   behaviors above; the dashboard build and specs validation pass. Independent
   verification is pending; no test, build, screenshot, or verification outcome
   is claimed by this task acceptance.

### Bounded Skills screen redesign planning — 2026-10-10

This planning checkpoint scopes the next implementation slice to the Skills
screen only. It records no implementation or independent verification result;
the overall dashboard redesign remains **TASKED** and is not shipped.

Redesign Skills as a quiet registry/list with clear Project/Global scope context,
not a card grid. Preserve the existing `GET /api/skills` response and its
`project` and `global` arrays. Keep the existing count meanings: counts derive
from the arrays only after a successful response and are not presented as
loaded counts during loading or error states. Global remains the default scope.

Preserve the existing skill name and description, and the read modal's content
and security behavior. Retain accessible tab semantics and
ArrowLeft/ArrowRight/Home/End navigation, plus existing empty, loading, and error
states. The read modal continues to close by its existing close control and
Escape, contain focus while open, and restore focus on close.

A local client-side search over loaded skill names and descriptions may be used;
it must not change the API, response data, or scope semantics. Keep the approved
restrained operational-folio visual direction, visible keyboard focus, and
reduced-motion behavior. At 375px and 1440px, the page must not overflow
horizontally.

#### Acceptance criteria

1. Skills remains backed by the unchanged `GET /api/skills` response, including
   the existing `project` and `global` arrays; counts keep their current meaning
   and appear only for successful responses.
2. Global remains the default scope. Accessible tab/panel semantics and
   ArrowLeft/ArrowRight/Home/End navigation remain functional; scope context,
   skill names, and descriptions are clear in the registry/list presentation.
3. The view uses a quiet, hairline-led registry/list rather than a card grid. The
   read modal preserves its existing skill content and security behavior.
4. Existing loading, empty, and error states remain clear. The read modal retains
   its close control, Escape handling, focus containment, and focus restoration.
5. A local name/description search may be included, operating only on already
   loaded skills without API or data changes. Focused tests cover counts,
   loading/error and empty states, search behavior if present, and the read-modal
   path/content/security behavior.
6. Visible focus and reduced-motion behavior remain accessible. At 375px and
   1440px there is no unintended page-level horizontal overflow.
7. Browser evidence records screenshots and viewport/layout metrics at 375px and
   1440px, including scope/tab keyboard use, search if present, and the modal
   open/close and focus behavior. Focused tests and dashboard build pass; this
   planning checkpoint claims no implementation or verification outcome.

### Bounded Models screen redesign planning — 2026-10-10

This planning checkpoint scopes the next implementation slice to the Models
screen only. It records no implementation or independent verification result;
the overall dashboard redesign remains **TASKED** and is not shipped.

Reshape the long introduction and forms into a clearer, quiet operational-folio
hierarchy. On desktop, Primary and Advisor role areas may sit adjacent; at mobile
widths they stack. Do not change API routes, request/response payloads, backend
behavior, or data schemas.

Preserve exact provider/model IDs: search text is not a committed ID. Only an
explicit catalog choice or the “Use this ID” action commits the selected/manual
ID. Project values override global values independently per field; inherited
values are omitted from PUT unless the user explicitly overrides them. A
provider/model mismatch blocks save. Keep exactly one variant input per role;
blank means the model default. Variant discovery remains model-specific, and
discovery errors do not prevent manual configuration. Advisor remains an
optional read-only consultant and can be enabled in the same valid draft. Do
not handle credentials; OpenCode continues to manage them.

Preserve accessible combobox keyboard selection and active-descendant behavior,
status/live-region and error feedback, visible focus, and reduced-motion support.
Focused tests and Playwright coverage at 375px and 1440px must cover exact IDs,
inheritance and save payloads, no accidental ID commit, responsive overflow, and
keyboard operation.

#### Acceptance criteria

1. The Models view uses the clearer quiet folio hierarchy; Primary and Advisor
   roles are adjacent on desktop where space permits and stack at mobile widths.
2. Provider/model search text never commits by typing alone. Only explicit
   catalog selection or “Use this ID” commits the exact ID; tests cover both
   intentional commit paths and no accidental commit.
3. Project values override global values independently per field, inherited
   values are omitted from PUT unless overridden, and provider/model mismatches
   block save. Tests assert the exact save payload and mismatch behavior.
4. Each role has exactly one variant input; blank uses that model's default.
   Discovery is specific to the selected model, and discovery errors leave
   manual configuration available.
5. Advisor remains optional and read-only, and can be enabled in the same valid
   draft. Credentials remain OpenCode-managed.
6. No API, request/response payload, backend behavior, or data-schema changes
   are made.
7. Combobox keyboard selection and active-descendant semantics, status/live
   region and error feedback, visible focus, and reduced-motion behavior remain
   accessible.
8. Playwright checks at 375px and 1440px capture responsive layout and confirm
   no unintended horizontal overflow; keyboard operation, exact IDs,
   inheritance, save payload, and absence of accidental commit are covered.
   Focused tests and the dashboard build pass. This planning checkpoint claims
   no implementation or verification outcome.

### Complete redesign implementation and bounded-proof reconciliation — 2026-10-11

Implementation now exists for all eight screens—Overview, Activity, Runs, Specs,
Workflow, Memory, Skills, and Models—plus the shared Phase 1 shell. The former
screen-specific planning-only statements above describe the state when those
checkpoints were written; they are superseded by this implementation milestone.
Historical failures remain part of the record, with later bounded PASS results
superseding them only where stated below.

Bounded independent results supplied for this checkpoint:

- **Phase 1 shell/routes:** the earlier actual-CLI proof visited all eight routes
  at 375px and 1440px. It remains Phase 1 shell/route evidence only; it does not
  prove the redesigned screen implementations in the final combined CLI bundle.
- **Overview:** PASS (6/6), browser used Vite/current source with the actual API.
- **Activity:** PASS (5/5), browser used Vite with mocked fixtures.
- **Runs:** PASS (6/6), browser used Vite mocks.
- **Specs:** modal-focus PASS after the earlier failures; root `npm test` now
  includes `Specs.test.mjs`. This closes the bounded modal-focus issue, not the
  final combined-bundle gate.
- **Workflow:** browser PASS at 375px and 1440px, including the no-engine state.
- **Memory:** full four-tab PASS after the unboxed fix.
- **Skills:** PASS (7/7) with mocked data.
- **Models:** PASS (at least 9 checks) in Vite mocks.

The evidence has distinct source-versus-CLI boundaries: Overview, Activity,
Runs, and Models explicitly used Vite; Activity, Runs, Skills, and Models used
mocked data, while Overview used the actual API. The Phase 1 CLI proof predates
the completed screen work. The final combined CLI bundle has not been rebuilt or
synchronized after screen work, so the redesigned screens have not yet received
the requested final actual-CLI-served 8-route browser pass.

**Current status: TASKED; not shipped.** A bundle-sync data-safety blocker is
open: worker-code inspection found `scripts/sync-cli-bundle.mjs` recursively
removes destination directories before copy, and exact preflight confirmed that
`cli/dashboard/server/node_modules/` exists. The worker stopped safely and did
not run `npm run build` or `npm run check-cli`; see
`.specs/state/known-issues.md` for the issue record.

Before any build/sync closeout run, change sync copying to clean generated
destination entries while preserving nested `node_modules` directories and
other unrelated files, continue excluding source `node_modules`, retain
canonical parity, and add a regression. After that mitigation is implemented,
the remaining overall gates are `npm run build`, `npm run check-cli`, full
`npm test`, package smoke, and specs validation, followed by independent
criterion-level browser verification of the final actual CLI-served bundle on
all eight routes at 375px and 1440px. All final gates remain pending. Do not
claim overall UI validation until those checks and browser results are
recorded. No shipping confirmation was supplied.

### Bounded CLI bundle sync safety planning — 2026-10-11

This planning-only checkpoint narrows the sync-safety mitigation required before
dashboard build/sync closeout. The overall dashboard remains **TASKED**; no code,
test, sync, package, parity, or independent-verification result is claimed here.

`scripts/sync-cli-bundle.mjs` must continue replacing mirrored generated assets
exactly and excluding source `node_modules`. It must preserve an existing
destination `node_modules` tree, including its bytes, whether that directory is
at the mirror root or nested within it. Remove other stale generated files so
`check-cli` parity holds; do not preserve arbitrary stale mirror files. No
runtime dependency changes are in scope.

#### Acceptance criteria

1. Sync copies/updates canonical generated assets exactly, excludes source
   `node_modules`, preserves destination `node_modules` trees at root and nested
   destinations, and removes stale generated files other than those protected
   dependency trees. Arbitrary stale mirror files are not retained and
   `check-cli` parity holds.
2. A fixture regression covers root and nested destinations and asserts stale
   file removal, canonical file copy/update, source `node_modules` exclusion,
   and byte/tree preservation of destination `node_modules` sentinels.
3. The regression is included in the root `npm test` suite. No runtime dependency
   changes are made.
4. With the existing local `cli/dashboard/server/node_modules` present, run
   `npm run sync-cli` and assert the directory tree remains intact; then run
   `npm run check-cli` and a package dry-run that confirms no `node_modules`
   paths are packaged.

Worker-code implementation and self-checks are recorded below; independent
verification remains pending. Final actual-CLI dashboard verification and
shipping confirmation also remain pending.

### Bounded CLI bundle sync safety implementation milestone — 2026-10-11

Worker-code changed `scripts/sync-cli-bundle.mjs`, added
`scripts/sync-cli-bundle.test.mjs`, and included the fixture regression in the
root `npm test` script. Sync recursively updates and prunes generated entries,
excludes source `node_modules`, preserves destination `node_modules` trees,
does not auto-sync on module import, and fails rather than overwriting a
preserved dependency conflict. Fixture coverage includes root/nested dependency
sentinels, stale and canonical entries, and source exclusion.

Worker self-check: `npm test` PASS (439/439); `npm run sync-cli` PASS with the
existing `cli/dashboard/server/node_modules` tree retained; `npm run check-cli`
PASS; package dry-run reports 122 files, zero packaged `node_modules` paths,
and required assets retained. No npm build was run. Independent verification is
pending; the overall dashboard remains TASKED and no shipping is claimed.

### Final combined-dashboard plan/checkpoint — 2026-10-11

All eight dashboard screens—Overview, Activity, Runs, Specs, Workflow, Memory,
Skills, and Models—and the shared shell are implemented. Bounded independent
proofs for the screens and shell are recorded above, but they do not establish
the final combined-bundle result: the combined CLI bundle has not yet been built
and synchronized after all screen work, or browser-tested as a whole.

The bounded CLI sync-safety proof is now recorded: destination `node_modules`
preservation is verified, including the existing local
`cli/dashboard/server/node_modules` tree. The earlier sync-safety blocker is
closed; this does not imply that the final dashboard build or browser gate has
run.

#### Accepted final sequence

1. Run `npm run build`; the sync-safety change preserves local destination
   `node_modules` during the build/sync.
2. Run `npm test`, `npm run check-cli`, `npm pack --dry-run --json`,
   `npm run smoke:pack`, and `npm run specs:validate`.
3. Independently run Playwright against the actual CLI-served combined bundle.
   Cover all eight routes at 375px and 1440px; exercise interactions against
   mocked API responses; check accessibility behavior; and record screenshots.

The package/build/test/spec checks and combined-bundle browser proof above remain
pending; no results are claimed here. Keep overall dashboard status **TASKED**,
not SHIPPED, until this combined proof is completed and recorded. OpenCode host
smoke is release-only and remains a future release gate, not part of this
dashboard closeout sequence.

### Final dashboard gates agreed — 2026-10-11 (before run_start)

The final dashboard gate sequence is agreed. Next, worker-code runs
`npm run build` and `npm run check-cli`, relying on the sync helper that preserves
existing destination `node_modules`. No results for these final commands are
recorded yet. Then worker-verify runs the tests, package dry-run/smoke, and
independent browser checks against the actual CLI-served combined bundle, while
covering the existing final-gate requirements above. Overall status remains
**TASKED**, not shipped; no verification result is claimed by this milestone.

### Final combined dashboard validation — 2026-10-11

This final independent result supersedes the earlier checkpoint statements above
that the combined build, browser pass, or overall status were still pending. Those
statements record the accurate state at their checkpoint; prior bounded screen
proofs remain bounded proof and are not substituted for this final combined
verification.

- Independent `worker-verify` returned **PASS** against the actual CLI-served
  combined bundle for Overview, Activity, Runs, Specs, Workflow, Memory, Skills,
  and Models at 375x812 and 1440x900. At both sizes document/body widths equal
  viewport, active `aria` navigation matches, and there were no console, page, or
  API errors or secret leaks.
- Interactions covered Overview and Activity; Runs filter/show-all/modal/Escape;
  Specs document/decision actions/modal; Workflow phase/history; Memory's four
  tabs/search/graph identity; Skills scope/search/modal; and Models exact ID,
  manual/catalog selection, variant, and PUT. Existing sources and API semantics
  were retained; fixture APIs were mocked.
- Full results: `/tmp/opencode/dashboard-actual-cli/final-results.json`;
  screenshots and interaction details: `/tmp/opencode/dashboard-actual-cli/`.
- `npm test` passed 439/439 on Node 24.20 and Node 22.23.3. `npm run build` and
  CLI synchronization passed; `npm run check-cli` passed.
- `npm pack --dry-run --json` passed with 122 entries, zero `node_modules` paths,
  and required assets present. `npm run smoke:pack` passed. Specs validation
  passed with 154 files and 0 issues.
- The subsequent `specs record` validator passed with 155 files and 0 issues
  after this dated record was added.
- **Overall dashboard redesign: VALIDATED, not SHIPPED.** The master tracker,
  project-state dashboard status, and this feature status are reconciled. The
  latest-stable OpenCode host smoke remains pending as a release-only gate; no
  shipping confirmation was supplied.
- Dated change record: `.specs/changes/2026-10-11-dashboard-redesign.md`.

### Dashboard refresh NetworkError diagnostic — 2026-10-12

- The user reports `TypeError: NetworkError when attempting to fetch resource` on page refresh and asked to be told before any refactor.
- Confirmed diagnostic evidence: the live CLI-bundled server at `127.0.0.1:4200` was CPU-bound at approximately 118–119% CPU and 569–621 MB RSS, with listen backlog 1–2. `/` and `/api/telemetry/summary` timed out after 3–5 seconds. The telemetry JSONL measured 28,347,021 bytes. An isolated source app returned HTTP 200 for summary (232,556 bytes/1450ms), one-session events (12,072 bytes/1059ms), and specs state/tracker/workflow (11–17ms).
- Source evidence supports request/parse amplification: `dashboard/web/src/hooks/usePoll.js:7-28` ties fetch reloads for four app-level endpoints to SSE `tick`; `dashboard/web/src/App.jsx:51-78` can issue five events requests per tick; `dashboard/server/routes/telemetry.js:11-27` fully reparses the JSONL per request. Worker-debug classified the incident unclassified under the failure-mode matrix.
- Candidate refactor only, not approved or applied: coalesce/debounce SSE-driven refreshes, avoid up to five event requests, and use bounded/incremental/indexed/cached telemetry reads. No app code changed and no service was killed or restarted. Status: diagnosed, awaiting human decision; this incident is not fixed or independently validated. The overall dashboard feature remains **VALIDATED** based on the prior 2026-10-11 proof above; that proof does not validate this incident.
