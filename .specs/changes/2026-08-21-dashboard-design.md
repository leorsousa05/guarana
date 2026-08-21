# Change: dashboard design overhaul ("ledger" direction) — 2026-08-21

**Spec:** [features/guarana/dashboard.md](../features/guarana/dashboard.md) addenda (checks 17–45)
**Status:** SHIPPED — human final gate accepted 2026-08-21 (ledger redesign + curated Documents + UX pass + decisions panel)

## Direction
Subject: a *system of record* for AI agent runs. Job: "what is the system doing, and is it healthy?" in <5s.
- Tokens: aril `#F5F0E4`, seed-ink `#1E1710`, guarana `#9E1B1E`, leaf `#3E5C3A`, amber `#B87A14`, hairline `#D8D0BE`. Zero radius, 1px hairline rules, no gradients.
- Type: Space Grotesk (display, titles only) + IBM Plex Mono (body/data — lead voice).
- Signatures: live event **ticker tape** (raw telemetry, `›tool`/`›tokens`/`›session`/`›todo`, reduced-motion safe) and rubber **stamps** for statuses.
- New surface: **NOW panel** — latest session status/duration/tokens/errors + checkpoint goal from project-state.

## Files
- `dashboard/web/{index.html,src/App.jsx,src/style.css}` — full rewrite.
- `cli/dashboard/web/dist/` — rebuilt bundle synced into the CLI.

## Critique-loop defects found & fixed
1. Tracker stamps rendered literal `**`; markdown links shown raw → strip `**`, real `<a>` labels.
2. DONE/NEXT/BLOCKED lines overflowed → wrap.
3. NOW STARTED datetime overlapped DURATION (desktop + mobile) → wrap-in-cell fix, geometry-measured at 375px/1280px.
4. `unknown` status → `—`.

## Verified
Screenshot passes (desktop full-page, mobile 375px): NOW panel correct against live telemetry; ticker live; tracker stamps clean; empty state with guidance copy confirmed (when server run from wrong cwd — incidentally proving the empty state works). Acceptance 17–22 addressed per worker reports + visual evidence.

## Addendum 2026-08-21c: formatted specs browser — VALIDATED
User defects/feature: (1) dead proof/change links, (2) raw markdown in state docs, (3) want a tab to see everything in `.specs` formatted.
- Server: `GET /api/specs/tree` (50 md files, sorted), `GET /api/specs/file?path=` (guarded: rejects traversal/absolute/symlink/non-`.md`; 400/404, never reads outside `.specs/`).
- Frontend: `marked` renderer (HTML-escaped, images as literal text); Specs section → **Overview** and **Files** (sidebar tree + formatted doc). Tracker proofs/change cells open target file in Files view.
- Verified: checks 23–28 PASS. Plan-thread visual confirmation in-browser.

## Addendum 2026-08-21d: curated Specs documents (replaces Files tab) — VALIDATED
User rejected the file-browser/editor look. Replaced with a **curated documentation index** grouped by ledger category: Decisions, Changes, Features, Archive, Foundations (top-level index docs). No raw file tree, no editor split.
- Removed `FilesTab`/`FileBody`/files view. Documents view: category blocks → human-titled doc lists (titles from `#` headings, ADRs sorted by number), hairline rules; click opens a single-column reading pane (70ch) with the active doc marked.
- Tracker proof/change links open target doc in the reading pane.
- `state/` docs excluded from Documents (belong to Overview).
- Verified: acceptance 29–34 PASS. Plan-thread in-browser: ADR-002 titled by `#` heading and renders formatted; proofs link opens plan-proofs.md in pane; no file-tree. Awaiting human gate.

## Addendum 2026-08-21e: guided UX pass — VALIDATED
Fixed bottom ticker, section jump-nav (Now/Runs/Specs, mobile strip), collapsible Documents categories (aria-expanded), full-run **modal** (focus trap, Esc + backdrop close, focus returns to trigger), consistent empty/error states, focus + reduced-motion extended to new elements.
Verified: acceptance 35–40 PASS (headless browser: ticker fixed bottom while scrolled; nav scrolls sections; categories toggle; modal Esc/backdrop close + focus return; empty/error banners; 375px no overflow, modal fits). Plan-thread in-browser: nav scrolls to Runs; modal opens event stream; Esc closes.

## Addendum 2026-08-21f: decisions-needing-you (proposal acceptance) — VALIDATED
Convention: `- **Decision:** pending: <statement>` in an ADR or feature spec = a decision needing the human.
- Server: `GET /api/decisions/pending` (scan decisions/ + features/guarana/ for marker), `POST /api/decisions/resolve` {file, statement, outcome} → appends `- **Resolved (YYYY-MM-DD):** accepted|rejected — via dashboard.` (append-only, guarded: no traversal/symlink/non-.md; 400/404/409). Worker verified 41–44 (curl).
- Frontend: "Decisions needing you" panel atop Specs (polls pending; Accept/Reject posts + refreshes; hides when none). Worker verified 45 (headless).
- Plan-thread: panel correctly hidden in repo (no pending items — ADR-005 deferral is expressed as prose, not the marker; content decision, not a bug).
- **Human final gate accepted 2026-08-21 — SHIPPED.**
