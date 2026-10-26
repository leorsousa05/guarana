# Feature spec: Dashboard project selection and Memory drafts

## Goal

Plan a bounded Dashboard follow-up that lets a user switch among explicitly
registered project roots and review project-only legacy Memory drafts, while
keeping browser inputs away from filesystem paths and preserving global/project
data boundaries. The same follow-up reconciles the suite overview and root CLI
reference with current authoritative records and implemented command forms.

## Requirements

- Store canonical registered project roots in an explicit persistent per-user
  XDG configuration allowlist. Keep full roots server-side; the browser receives
  and displays only opaque project IDs and safe names.
- When no valid browser-saved selection exists, use the dashboard server's
  process current project as the default. Persist the user's selected opaque
  project ID in browser-local storage.
- The “Add this project” action registers only the current server's known
  `process.cwd()`. Register another project by starting `guarana web` inside
  that project and registering it there. Never accept a filesystem path from
  the browser.
- Provide unregister/remove. It removes only the allowlist entry, never project
  files or project settings. The process current project remains an implicit
  fallback. A removed or stale saved selection fails closed and visibly falls
  back to the current project; this fallback presentation is a reversible UI
  assumption.
- Apply the selected root to every project-scoped Dashboard read and write:
  telemetry, runs, activity and OpenCode root; Specs and decisions; project
  Memory; workflow settings; and project Skills, Models, and settings. Global
  settings and global Memory remain global.
- Resolve each API request's opaque project ID server-side against the
  allowlist. Unknown or stale IDs are not paths and must not silently access a
  different registered project. Keep the Dashboard loopback-only; the allowlist
  is not authentication.
- Add an accessible fifth Memory tab named `Drafts`, retaining Injected,
  Summary, Search, and Graph and their existing behavior. Use existing
  `/api/memory/drafts` and `/api/memory/review` behavior for project-only drafts.
  Display exactly intent, type, timestamp/date, and tags. Provide Confirm and
  Discard, with no field editing and no global-draft review in this slice.
- Show an explicit irreversible warning before Discard because the action deletes
  the draft and its edges. Switching projects reloads Drafts and binds review
  actions to the selected project.
- Reconcile `.specs/features/overview.md`'s skill inventory and current-status
  summary using current source records. Update the root README CLI reference in
  the later implementation to cover current commands, including `advisor`,
  `workflow`, `specs record`, memory compact/prune/delete, and other implemented
  but omitted command forms. This planning record does not edit root README.

## Assumptions and scope

- User-approved design choices are the XDG allowlist, current-root-only
  registration action, browser-local selected-project persistence, and
  unregister. Exact XDG file name/schema and opaque-ID generation remain
  implementation details; do not expose canonical paths to the browser.
- Current process root remains available as the implicit fallback even if its
  explicit allowlist entry is removed. Invalid saved selection fallback is a
  reversible UI assumption, not a claim about existing implementation.
- Project selection covers all project-scoped APIs listed above; global
  settings and global Memory are intentionally unaffected.
- Draft review is limited to project drafts and the existing APIs. It does not
  add draft editing, global-draft review, or new API behavior.
- This follow-up supersedes only the earlier multi-project-view and
  dashboard-draft/review exclusions for the bounded accepted scope. Earlier
  statements remain historically accurate for their original checkpoints.
- Scope includes the dashboard server/UI, project root resolution and allowlist,
  the Memory Drafts view, related regression tests, the README CLI reference,
  and the two specified `.specs` reconciliations. Do not change existing tags,
  release state, or claims of npm publication.
- Use ADR-005 budgets: main thread at most 8k steady-state tokens; worker-code
  8k, worker-verify 4k, and worker-debug 6k tokens per dispatch; 32k tokens and
  15 minutes per run.
## Implementation checkpoint

Implementation is complete; this record remains **IMPLEMENTED**, not VALIDATED
or SHIPPED. Fresh independent `worker-verify` passed acceptance criteria 1–8
and returned overall FAIL only on criterion 10 because interactive desktop and
375px browser proof was unavailable. No code defect was found. SSR, source, and
CSS assertions are not browser proof. No Chromium-family executable, Playwright
or Puppeteer package, or browser tool was available.

Primary gates passed: `npm test` (633/633), `npm run build`, `npm run check-cli`,
`npm run specs:validate` (234 Markdown files, 91 feature specs, 41 ADRs, 254
local links, 0 issues), and `git diff --check`. The independent verifier reran
`guarana specs validate /home/arch/codes/Guarana --json` with the same zero-issue
result. Full tests emitted nonfatal Vite WebSocket port-in-use and Node
module-type warnings. The overview inventory and root README CLI reference were
reconciled (`.specs/features/overview.md`, `README.md`). At the independent
verification snapshot, no Memory drafts had been inspected or modified and no
cleanup had occurred. This is a historical checkpoint: after the user
explicitly authorized current-project-only cleanup, a count-only inventory
found 999 drafts at deletion time (an earlier count was 1,000). The existing
review API discarded all 999 sequentially, with zero failures and zero drafts
remaining; the confirmed node count remained 114, and incident edges before
deletion were 0. No draft content was read or copied, and no other project or
global vault was touched. Shipping did not occur.

Historical pending browser gate for criterion 10 (superseded 2026-10-26): obtain an authorized browser runner or
remote browser with Chromium and Playwright/Puppeteer; exercise selector add,
select, remove, and stale fallback; project-scoped surfaces; Drafts confirm and
discard; keyboard, focus, and accessibility; overflow at 375px and desktop; and
capture viewport/layout evidence. Do not treat SSR/source/CSS assertions as a
substitute for this proof. This gate was completed by the criterion-level
evidence below; the historical checklist is retained.

## Browser gate follow-up — 2026-10-26

Fresh independent `worker-verify` passed acceptance criterion 10 using real
Chromium with synthetic fixtures at 375x812 and 1440x900. Coverage included
opaque project IDs and safe names, two roots, selection persistence/removal and
stale fallback, path rejection, project-scoped surfaces, project-bound Drafts
review, typed confirmation and irreversible discard, keyboard/focus/accessibility,
and no viewport overflow. No real vault or provider data was used. Evidence:
`/tmp/opencode/guarana-final-browser-gates/verification.md`, `report.json`,
`request-audit.json`, and the report-referenced screenshots including
`drafts-focused-375.png` and `drafts-focused-1440.png`.

The same verifier reports `npm test` PASS (658/658), production build and CLI
sync PASS, `check-cli` PASS before and after build, candidate specs validation
PASS (245 files, 96 feature specs, 44 ADRs, 278 links, 0 issues),
`npm run specs:validate -- --json` PASS, `npm run audit` PASS (zero
vulnerabilities), and staged/unstaged/untracked diff-check PASS. This records
the criterion-level browser result; no overall release or shipping claim is
made.

## Acceptance criteria

1. A persistent per-user XDG allowlist stores canonical roots server-side, while
   project-list/selection browser data contains only opaque IDs and safe names;
   a full path marker is absent from browser-visible responses and rendered UI.
2. With no valid saved choice, the process current project is selected. Browser
   reload retains a valid user selection. “Add this project” registers only the
   current `process.cwd()`; an arbitrary browser-supplied path is rejected and
   causes no allowlist write. A second project is registerable only by starting
   the Dashboard there and invoking that action.
3. Unregister removes only the selected allowlist entry and leaves that
   project's files and settings unchanged. Removing or presenting a stale saved
   selection fails closed, visibly falls back to the current project, and does
   not silently select another registered project.
4. Every project-scoped read/write listed in Requirements resolves its opaque
   ID server-side to the requested registered root. Unknown/stale IDs never
   resolve as paths or return data from another project. Global settings and
   global Memory remain global. Loopback-only binding remains in force; no
   authentication claim is added.
5. The earlier requirement for exactly five Memory tabs is superseded by the
   already-validated `.specs/features/dashboard/memory-domain-separation-ui.md`,
   which is authoritative for Memory workspace structure and takes precedence
   over this criterion's historical tab-count and placement language. The
   Dashboard exposes separate first-level `Project knowledge` and `User
   preferences` workspaces: project-only summary, search, graph, relationships,
   and drafts belong to `Project knowledge`; the read-only global preference
   library/history belongs to `User preferences`. Drafts show only intent, type,
   timestamp/date, and tags; no draft field editing or global-draft review is
   present.
6. Confirm and Discard act only on the selected project's draft. Discard
   requires an explicit warning that the draft and its edges are deleted
   irreversibly. Changing projects reloads drafts and prevents actions from
   applying to the previously selected project.
7. `.specs/features/overview.md` lists the nine canonical procedures once each,
   describes `specs` as the worker-specs procedure, does not count CLI mirror
   copies as separate skills, and reconciles only the supported stale status
   statements with their current authoritative records. Historic checkpoints
   and unrelated overview text remain intact.
8. The root README CLI reference matches implemented command/help metadata and
   includes `advisor`, `workflow`, `specs record`, memory compact/prune/delete,
   and all other currently implemented command forms omitted from the existing
   reference. No release, tag, or npm-publication claim changes.
9. Focused server/UI/CLI/docs regression tests cover allowlist persistence and
   path rejection, per-project isolation and global boundaries, stale/removal
   fallback, project-bound draft review and irreversible warning, tab
   accessibility, and documented command completeness. The full `npm test`,
   dashboard production build, `npm run check-cli`, and `npm run specs:validate`
   pass.
10. Independent browser proof at 375px and desktop exercises selector add,
    select, remove, stale fallback, all project-scoped surfaces, Drafts confirm
    and discard, keyboard/focus/accessibility behavior, and confirms no
    unintended page-level horizontal overflow. Capture viewport/layout evidence.
     The current criterion-level verification result is recorded in the
     2026-10-26 browser gate follow-up above.

<!-- guarana:record:start -->
Status: IMPLEMENTED
Proof: none
Change: none
<!-- guarana:record:end -->
