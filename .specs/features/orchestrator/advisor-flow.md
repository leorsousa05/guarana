# Feature spec: optional model advisor flow

**Status:** VALIDATED — ADR-027 source/API/UI and live child trace verified
**Date:** 2026-10-08

## Goal

Provide an explicitly invoked OpenCode workflow that runs a task through a
configured Guarana primary model and can consult a separately configured,
stronger advisor model when the primary is blocked. The advisor returns
read-only recommendations; the primary remains in charge of the existing
workflow and continues the task.

## Confirmed requirements

- Preserve the existing always-on Guarana orchestrator and its state machine.
- The new model flow is optional and starts only when the user invokes its
  OpenCode command. It must not change the model used by ordinary conversations.
- The command starts the configured primary model. When it recognizes that it
  cannot progress, or relevant tool failures/retries show it is stuck, it may
  consult the advisor once for that blocking context. A fresh opt-in command
  starts a fresh consultation budget.
- The advisor receives a concise, relevant summary of the request, workflow
  state/progress, attempts, and failure/tool evidence; it returns possible next
  steps and limitations without implementing them. The primary chooses what to
  do and continues the existing workflow.
- Configure the primary and advisor provider/model IDs and their optional model
  variants/reasoning settings through both the CLI and dashboard.
- Support project and global CLI configuration. A project setting overrides its
  global counterpart. The dashboard edits the current project's settings and
  shows effective values including global fallback.
- The advisor configuration UI and CLI must show model IDs available through
  OpenCode, including models for providers already connected in that OpenCode
  installation.
- Only connected-provider model choices are listed; never return provider
  credentials. Keep manual model-ID entry available if discovery is unavailable.
- Preserve OpenCode model IDs exactly, including provider-specific subpaths and
  leading characters such as `~` (for example
  `openrouter/~anthropic/claude-fable-latest`).
- Make primary/advisor model choices searchable and visually clearer while
  retaining manual ID entry and the existing dashboard ledger style.
- Let users select variants supported by the chosen OpenCode model, with a
  manual custom-variant fallback.
- Keep exactly one variant input per role; offer supported choices within that
  input, make it manually editable, and represent OpenCode default by an empty
  value rather than a separate visible default option.
- The provider control itself must be searchable; do not rely on a separate
  model-only filter above an unsearchable provider input.

## Design and scope

- Add a native OpenCode custom command backed by a Guarana primary-agent profile;
  keep advisor dispatch on OpenCode's native Task/subagent mechanism.
- Store only model routing preferences (primary/advisor provider/model IDs and
  optional variants); credentials remain managed by OpenCode providers.
- Store project preferences in `.guarana/advisor.json` and global preferences in
  `$XDG_CONFIG_HOME/guarana/advisor.json` (default `~/.config/guarana/advisor.json`);
  generated OpenCode command/agent profiles stay in their native config roots.
- Provide CLI configuration/status commands and a dashboard Models view with a
  validated API for project settings.
- Generate/manage Guarana-owned command and agent profile files in supported
  OpenCode roots without overwriting or deleting foreign files.
- Reuse OpenCode's documented local CLI discovery (`opencode auth list` and
  `opencode models`) for connected providers and their catalog. Surface only
  provider/model IDs and display names through the local Guarana CLI/API.
- Filter the global model output by authenticated provider before validating
  provider-specific model-ID syntax so disconnected catalog entries cannot
  poison usable connected models.
- Discover per-model variant keys on demand from OpenCode's verbose model
  definition; do not hardcode one variant list for every model/provider.
- Keep the Models page a flat, rule-based ledger form: searchable catalog input,
  provider/model identity fields, a model-specific variant chooser, and a quiet
  manual fallback. Avoid generic rounded-card layout.
- Enforce repeated-advice limits at the native Task dispatch boundary, keyed by
  parent session and normalized blocker context; prompt wording alone is not a
  runtime guard.
- Do not replace or fork the existing orchestrator state machine, automatically
  route ordinary chats, let the advisor edit files, or add provider credentials.

## Acceptance criteria

1. **Opt-in execution.** The installed custom OpenCode command starts work with
   the configured primary model; ordinary messages retain the user's active
   OpenCode model and current Guarana routing. Missing configuration produces a
   clear setup instruction.
2. **CLI configuration and precedence.** CLI commands can read, set, and clear
   primary/advisor model IDs and optional variants in project or global scope.
   Invalid values are rejected without damaging existing settings; project
   values override global values independently per field.
3. **Dashboard configuration.** The Models view loads and saves current-project
   values through validated API routes, distinguishes project overrides from
   effective global fallback, reports save/validation errors, and remains usable
   by keyboard at 375px without unintended horizontal overflow.
4. **Managed OpenCode artifacts.** Project/global install and update generate
   the command, a configured primary profile, and a read-only advisor subagent
   profile. Status detects their health. Uninstall removes only Guarana-owned
   artifacts and preserves foreign files.
5. **Advisor handoff.** When opted-in primary work is blocked or an observed
   failure/retry makes lack of progress clear, the primary can dispatch one
   native Task to the configured advisor with bounded task/state/attempt/failure
   context. The advisor returns recommendations and limitations only; it cannot
   edit or advance parent workflow state. The primary resumes and owns all
   workflow transitions. Repeated identical failure does not create an
   unbounded advisor loop: a runtime Task hook rejects another identical
   consultation in the same parent session, and a fresh opt-in command resets
   the consultation budget.
6. **Failure behavior.** If the advisor is unconfigured, unavailable, or denied,
   the flow reports that condition clearly and the primary continues or asks
   the user; it never claims a recommendation was obtained.
7. **Validation.** Focused CLI/API/plugin/UI tests, `npm test`, `npm run build`,
   `npm run check-cli`, and `npm run specs:validate` pass; project/global command
   and profile behavior is checked in OpenCode where supported; independent
   verification records criterion-level evidence before validation is claimed.
8. **OpenCode catalog in CLI.** `guarana advisor models [provider]` lists the
   OpenCode model IDs available for providers connected in OpenCode; optional
   provider filtering works. Results contain provider/model IDs and display
   names only, never authentication data. OpenCode missing, no connected
   providers, or command errors produce a clear diagnostic without breaking
   manual model configuration.
9. **Dashboard model choices.** The Models view shows selectable/searchable
   provider and model options from the same OpenCode catalog for both primary
   and advisor settings, indicates which providers are connected, and retains
   manual model-ID entry. Catalog load/empty/error states are accessible and do
   not expose credentials.
10. **Catalog discovery tests.** Tests prove only OpenCode-connected providers
    are included, models are filtered by provider, unsupported/malformed CLI
    output and missing OpenCode fail safely, CLI/API return no credentials, and
     dashboard selection writes the corresponding model/provider settings.
11. **OpenCode model ID round-trip.** IDs with provider-specific subpaths and
     `~` are accepted from discovery, saved through CLI and dashboard settings,
     and written unchanged to the generated agent profile. Catalog entries from
     disconnected providers are ignored before model-ID validation; malformed
     IDs for connected providers and whitespace/control characters remain rejected.
12. **Searchable provider/model controls.** In both primary and advisor sections,
    the provider selector and model selector each support search by connected
    provider/model ID or display name. Choosing a result fills the exact provider
    and model IDs; custom provider/model entry remains possible. Combobox keyboard
    behavior covers typing, arrows, Enter and Escape, with accessible names,
    expanded/active state, and live result counts.
13. **Single searchable variant input.** Selecting a model loads its variant keys
    from OpenCode metadata into one editable/searchable variant input per role
    (for example, a datalist). Users can choose a listed key or type a custom
    value. Leave the field empty to use OpenCode's model default; do not show a
    separate “OpenCode default” option or a second stacked variant input. Lookup
    errors do not block settings; saved values reach the generated profile
    unchanged.
14. **Models page redesign.** The page has a clear introduction and visibly
    distinct Primary/Advisor work areas, with search, provider, model, and variant
    controls grouped in a deliberate hierarchy. Rework the page layout, spacing,
    and input styling to fit the ledger identity (existing palette/type, hairline
    rules, flat surfaces; no generic rounded-card grid). At a 375px viewport the
    layout stacks without horizontal overflow; focus and reduced-motion behavior
    remain accessible.

## Design direction — advisor Models page

- **Palette:** reuse aril, seed-ink, hairline, guarana red, leaf, and amber tokens;
  add no unrelated accent color.
- **Type:** retain the dashboard's Space Grotesk headings and IBM Plex Mono IDs;
  keep model IDs easy to scan without making all labels shout in uppercase.
- **Layout:** a compact, left-aligned page introduction/status strip, then two
  peer Primary/Advisor rule-ledger sections on wide screens and a single stacked
  column on mobile. Each role orders a searchable provider combobox, a model
  combobox filtered by provider, one searchable/editable variant input with
  model-specific suggestions, then manual ID fallback and aligned status text.
- **Principles:** make the provider itself searchable (not just the model list).
  Keep both role searches independent; expose arrow/Enter/Escape behavior and
  custom provider/model fallback. The memorable element is the two precise
  searchable model work areas, not a decorative card. Variant suggestions come
  from the selected model's OpenCode metadata; an empty value means use default.

## Status

The original advisor flow and connected model catalog (criteria 1–10) passed
independent verification. Criteria 11–14 also passed: fixture-backed exact
profile round-trip, both-role searchable controls, keyboard/pointer-selectable
model-specific variants in one editable input, custom and blank values, lookup
failure fallback, and rendered 375px/1280px layout. Full tests, dashboard build,
CLI mirror check, and specs validation passed after the final UI implementation.

## Implementation summary

- CLI settings and generated command/profile lifecycle: `cli/commands/advisor.js`,
  `cli/lib/advisor-settings.js`, `cli/lib/advisor-profiles.js`, `cli/lib/paths.js`,
  and `cli/commands/plugin.js`.
- Native advisor handoff, bounded prompt contract, CLI profile refresh, and
  child-session isolation: `cli/lib/advisor-profiles.js`,
  `cli/commands/advisor.js`, `plugin/guarana-orchestrator.js`, and the CLI plugin
  bundle copy.
- Dashboard project settings/API: `dashboard/server/routes/models.js`,
  `dashboard/server/app.js`, and `dashboard/server/app.test.js`.
- Dashboard Models form and responsive presentation: `dashboard/web/src/App.jsx`,
  `dashboard/web/src/components/Models.jsx`, `Sidebar.jsx`, `style.css`, and
  `Models.test.mjs`.
- Final variant-control correction: Primary and Advisor each use exactly one
  editable/searchable variant input with OpenCode-backed suggestions; empty means
  model default, with no separate default choice or duplicate input. Worker-code
  `ses_ee2333c4fffeb0Bpo8tP67A7im` added one-input/custom/stored-value coverage;
  focused UI test and dashboard build passed.
- Focused CLI, profile, plugin, route, and UI tests were added or extended.
- Worker-code `ses_ee2807e88ffeEdcANnuFKqrOfi` implemented exact model-ID
  round-trip through catalog, CLI, dashboard API, and profile (focused tests
  36/36).
- Worker-code `ses_ee26f6195ffea2ykLS6B07xpUY` added per-role searchable catalogs
  and selectable OpenCode variants with manual fallback; focused UI test 1/1 and
  dashboard build passed. Final independent verification is pending.
- User review required a deeper redesign and a provider selector that is itself
  searchable. Worker-code `ses_ee23e5a8dffeYlGf3jy2Cvqlyo` rebuilt the Models
  hierarchy with Primary/Advisor peer sections and keyboard-searchable provider
  and model comboboxes; focused UI tests/build passed.
- Worker-code `ses_ee2333c4fffeb0Bpo8tP67A7im` removed the variant select plus
  second input and the explicit “OpenCode default” option, leaving one editable
  OpenCode-suggested variant input per role. Focused UI test and dashboard build
  passed; final independent verification remains pending.
- Primary-context visual review found that the first redesign still made search
  and variant affordances too easy to miss. Refined the Models view with clearer
  sentence-case labels, search guidance and live result counts, a balanced
  provider/model layout, more legible inputs, and a distinct save action while
  preserving the ledger palette and flat rule-ledger structure. Variant guidance
  states that an empty value uses the model default; no visible default option is
  rendered.
- Focused test passed after assertion updates: `node --test
  dashboard/web/src/components/Models.test.mjs` (1/1). A Playwright Vite smoke
  using mocked model APIs exercised provider/model selection by typing and
  ArrowDown/Enter, selected `openrouter/~anthropic/claude-fable-latest`, entered
  `xhigh`, and captured the exact `PUT /api/models` payload. It measured no
  horizontal overflow at 375px (document width 375) and two role columns at
  1280px. This does not replace independent real OpenCode/profile verification.
- Integrated repo checks passed after the visual refinement: `npm test` (255/255),
  `npm run build` (dashboard built and CLI mirrors synchronized),
  `npm run check-cli`, and `npm run specs:validate` (120 Markdown files, 18
  feature specs, 26 ADRs, 183 local links).

## Connected OpenCode model catalog implementation

- Shared catalog discovery, CLI `guarana advisor models [provider]`, and
  dashboard `GET /api/models/catalog`: `cli/lib/opencode-model-catalog.js`,
  `cli/commands/advisor.js`, `dashboard/server/routes/models.js`, and the shared
  source/CLI module resolver. The helper invokes `opencode auth list` and
  `opencode models` without a shell and returns metadata only.
- Model selectors for both primary and advisor: `dashboard/web/src/components/Models.jsx`;
  catalog error/empty/loading states do not block manual IDs.
- Focused worker-code checks: catalog/CLI/API tests 30/30; Models UI test 1/1;
  bundle sync/check and diff-check passed. Independent verification is pending.

## Independent verification attempt 1 — FAIL

- Spec structure validator: PASS (`node bin/guarana.js specs validate . --json`,
  `ok: true`, no issues).
- Criterion 1: FAIL — incomplete settings suppress command/profile creation, so
  invoking the optional flow cannot show the required setup instruction.
- Criterion 2: PASS — project/global CLI settings, per-field precedence,
  validation, and safe writes verified.
- Criterion 3: PASS — project dashboard API/UI, effective global fallback,
  validation/conflict behavior, and responsive/accessibility evidence verified.
- Criterion 4: FAIL — global command/profile paths did not honor the isolated
  `XDG_CONFIG_HOME`; installed OpenCode did not discover the global artifacts.
- Criterion 5: FAIL — one-consultation-per-blocker limit existed only as prompt
  wording; no runtime guard prevented repeated consultation on unchanged failure.
- Criterion 6: FAIL — incomplete model configuration generated no command, so
  the primary could not fail soft with an actionable setup message.
- Criterion 7: FAIL pending repairs because the isolated global OpenCode profile
  discovery check failed. The verifier's other commands passed: `npm test`
  (229/229), `npm run build`, `npm run check-cli`, `npm run specs:validate`, and
  `git diff --check`.
- Independent worker-verify session `ses_ee37a5681ffexfq5P5xkQPFFTM` returned
  overall FAIL. Exact criterion evidence and OpenCode CLI results are in its
  report; repairs and a fresh verification are required.
- Worker-debug `ses_ee372e4b3ffeXAzyVtvWk3fute` classified the three root causes
  as unclassified (the matrix had no matching confirmed signal). It recommended
  XDG-aware OpenCode roots, an always-present setup command, and a native
  `tool.execute.before` dispatch guard keyed by session and blocker context. Its
  known-issues append was denied; the primary backfilled
  `.specs/state/known-issues.md`.

## Repair implementation — complete before final verification

- Global OpenCode plugin, command, and agent paths now share the XDG config root
  and preserve the `~/.config` fallback.
- An incomplete configuration keeps a setup-only `/guarana-advisor` command
  with actionable CLI instructions; it is not bound to a model-less primary and
  does not substitute or execute the submitted task.
- Native `task` dispatch to `guarana-advisor` now has a `tool.execute.before`
  runtime gate for repeated normalized prompts within a parent session, with
  fresh-command/new-evidence reset and call-ID deduplication across duplicate
  plugin instances. Other Task workers are not gated.
- Worker-code repair session `ses_ee36f1b82ffeqNdbN56yiSVAzI` reported focused
  tests 44/44, `npm run check-cli`, and `git diff --check` passing; full
  integrated results are captured in final verification attempt 3.

## Independent verification attempt 2 — FAIL

- Criteria 1, 2, 4, 5, and 6: PASS. OpenCode 1.18.35 recognized the setup-only
  and configured project/global commands and agents under isolated
  `XDG_CONFIG_HOME`; the runtime Task guard and worker isolation passed; CLI
  configuration, fallback, safe lifecycle, and fail-soft behavior passed.
- Criterion 3: FAIL — canonical dashboard API/UI passes, but the packaged CLI
  dashboard route imports `../../../cli/lib/advisor-settings.js` and
  `../../../cli/lib/advisor-profiles.js`, resolving to nonexistent
  `cli/cli/lib/*` paths from `cli/dashboard/server/routes/models.js`.
- Criterion 7: FAIL as a consequence of the packaged dashboard import. The
  verifier also attempted `node --test cli/dashboard/server/app.test.js`, which
  exited 1 with `ERR_MODULE_NOT_FOUND: express` in the mirrored CLI tree.
- Independent worker-verify `ses_ee363e493ffeU0RmtH8bFl99DX`: spec validator
  PASS (113 Markdown, 18 features, 21 ADRs, 170 links); `npm test` PASS
  (236/236); `npm run build`, `npm run check-cli`, `npm run specs:validate`, and
  `git diff --check` PASS. Full outputs are in the verifier report.
- Repair the packaged route dependency resolution and re-run criterion 3 and
  7 before recording final validation.
- Worker-debug `ses_ee3525ab0ffe8ONnmUqOeLkk6x` confirmed the mirror-depth error
  and classified it as unclassified. It recommended resolving the shared modules
  from the canonical or bundled relative location based on which exists, without
  duplicating settings/profile logic. The direct mirrored test's missing
  `express` was due to running before `cli/commands/web.js` provisions the
  declared server dependency; no separate packaging defect was confirmed. The
  debug agent's append was denied; the primary recorded the finding in
  `.specs/state/known-issues.md`.
- Worker-code `ses_ee35012beffe33vBS3qHJy9G10` added a shared-module resolver
  used by both dashboard trees; canonical and bundled route tests passed 13/13
  each, along with `npm run sync-cli`, `npm run check-cli`, and
  `git diff --check`. The subsequent full integrated checks and independent
  verification are recorded in attempt 3 below.

## Independent verification attempt 3 — PASS

All seven acceptance criteria passed in independent worker-verify session
`ses_ee34bd63fffedhz1AzXY8VJ3NQ`:

1. **Opt-in execution:** setup-only and configured `/guarana-advisor` commands
   were discovered by OpenCode; configured command uses the primary agent/model,
   and ordinary default model routing remains unset/unchanged.
2. **CLI settings:** global/project set/read/clear, optional variants,
   invalid-input preservation, and per-field project precedence passed.
3. **Dashboard:** canonical and synchronized CLI `/api/models` GET/PUT passed
   (13/13 each after provisioning declared server dependencies); project writes,
   global fallback, validation, profile refresh, keyboard/focus controls, and
   375px single-column responsive rules were verified. Both routes resolve the
   same shared `cli/lib` settings/profile modules.
4. **Managed artifacts:** XDG-aware global and project command/agent/plugin
   discovery, status, update, and uninstall passed; foreign files were preserved.
5. **Advisor handoff:** first native Task dispatch passes, duplicate unchanged
   blocker is gated across duplicate plugin copies, changed context/new command
   may consult, and ordinary workers/parent workflow remain isolated. Advisor
   permissions and prompt are read-only/advisory.
6. **Failure behavior:** incomplete settings provide setup instructions without
   task execution; unavailable/denied/failed advisor paths are honest and
   fail-soft.
7. **Validation:** required full checks and packaged OpenCode checks passed.
   No provider/model call was made.

Exact command outcomes:

- `node bin/guarana.js specs validate . --json` — PASS, `ok: true`, 113 files,
  18 feature specs, 21 ADRs, 170 links.
- `npm test` — PASS, 237/237 tests, 44 suites, 0 failures.
- `npm run build` — PASS; dashboard built and CLI bundle synchronized.
- `npm run check-cli` — PASS, `CLI bundle matches canonical sources.`
- `npm run specs:validate` — PASS, 113 Markdown, 18 feature specs, 21 ADRs,
  170 local links.
- `git diff --check` — PASS.
- With declared dependencies provisioned, `node --test
  cli/dashboard/server/app.test.js` — PASS, 13/13.

The verifier noted a non-failing Vite WebSocket port warning and a Node module
type warning during tests. Neither affected test outcomes.

## Connected model catalog independent verification attempt 1 — FAIL

- Spec structure gate: PASS (`node bin/guarana.js specs validate . --json`),
  115 Markdown files, 18 feature specs, 22 ADRs, 176 links.
- Criterion 8: FAIL — isolated OpenCode 1.18.35 `auth list` emitted a bordered
  provider row `● OpenAI api`; `opencode-model-catalog.js` treated the status
  marker/display name as a provider ID and returned malformed provider data.
  Thus the catalog helper's synthetic fixtures do not match actual CLI output.
- Criterion 9: FAIL as a consequence: the catalog error leaves the dashboard
  without the connected model choices even though manual fields remain usable.
- Criterion 10: FAIL — no regression fixture covers OpenCode's actual bordered
  authentication-table format. The mirrored dashboard app test also imports
  `../../cli/lib/opencode-model-catalog.js`, which resolves to nonexistent
  `cli/cli/lib/*` in the CLI mirror (13/14 tests passed).
- The original criteria 1–6 showed no regression; criterion 7's packaged test
  gate is not green until the mirrored test import is repaired.
- Independent worker-verify `ses_ee317856fffebu46MRxIR8ssM4`: `npm test` PASS
  (244/244), `npm run build`, `npm run check-cli`, `npm run specs:validate`
  (115 Markdown, 18 features, 22 ADRs, 176 links), and `git diff --check` PASS;
  focused CLI catalog tests 5/5 and canonical dashboard tests 15/15 PASS; the
  mirrored dashboard suite failed 13/14.
- No user's auth data was inspected; the incompatible output came from an
  isolated temporary OpenCode configuration with dummy credentials. No provider
  model call or remote catalog refresh was made.
- Worker-debug `ses_ee30cd381ffe9bmqnrxjtzSube` classified both issues as
  unclassified: handle the `●` glyph and normalize provider display names before
  catalog intersection; resolve the mirrored test's helper import through the
  shared module resolver. Its known-issues append was denied; the primary
  backfilled `.specs/state/known-issues.md`.
- Worker-code `ses_ee30790beffeJAOyeC3zEsibLL` added provider-label normalization
  for status/table rows and fixed the mirrored app-test resolver import. It
  reported catalog tests 6/6, canonical/mirrored app tests 14/14 each, CLI sync,
  check, and diff-check passing; independent verification remains pending.

## Connected model catalog independent verification attempt 2 — FAIL

- Spec structure gate: PASS (`node bin/guarana.js specs validate . --json`),
  115 Markdown files, 18 feature specs, 22 ADRs, 176 links.
- Criterion 8: FAIL — with an isolated OpenCode 1.18.35 dummy-auth fixture,
  `auth list` emitted a bordered table with ANSI-colored rows for `● OpenAI api`
  and `● GitHub Copilot oauth`. The helper still rejects the header/footer and
  ANSI escapes as malformed provider output; both `guarana advisor models` and
  its provider-filtered form returned `[]` with a malformed-data error.
- Criterion 9: FAIL as a consequence: canonical and CLI mirror routes use the
  same helper, so the real-format discovery error leaves both selectors without
  connected model options. Manual IDs, save behavior, and UI accessibility remain
  available.
- Criterion 10: FAIL — current fixtures cover simplified status/bordered rows
  but not the actual ANSI-colored output and credentials header/footer that
  reproduces the failure.
- Original criterion 7's packaged test gate: PASS after the mirror resolver fix;
  the mirrored dashboard test now passes 14/14.
- Independent worker-verify `ses_ee3017d86ffeLzNHVsn410YHJa`: `npm test` PASS
  (245/245), build/check-cli/specs/diff-check PASS; catalog 6/6, canonical app
  14/14, mirrored app 14/14, UI 1/1. Isolated actual OpenCode CLI smoke still
  fails due to output formatting. No real user auth data, provider call, or
  remote catalog refresh was used.
- Worker-debug `ses_ee2fb8f2cffe7Sle4K5B5Lq3SM` classified the remaining failure
  as unclassified: strip ANSI escapes after raw size/secret checks but before
  table/header/cell parsing, and add a fixture matching the isolated CLI output.
  The worker's known-issues append was denied; the primary recorded it in
  `.specs/state/known-issues.md`.
- Worker-code `ses_ee2f8bc36ffe5EgCCTGnsw1HCh` added ANSI CSI stripping, Unicode
  table/header/cell parsing, and credential checks both before and after
  normalization. It reported catalog/CLI/canonical API tests 33/33,
  `check-cli`, and `git diff --check` passing; independent verification pending.
- Worker-debug `ses_ee2ecf44effeRh4VGjsGvsH2ug` confirmed the remaining failure
  is unclassified: known auth table chrome (`Credentials <path>`, standalone
  borders, and `N credentials` footer) must be skipped by anchored patterns, but
  unknown provider rows must still fail closed. Its fixture lacked these rows;
  preserve raw and ANSI-stripped secret checks. Its known-issues append was
  denied; the primary recorded this diagnosis in `.specs/state/known-issues.md`.

## Connected model catalog independent verification attempt 3 — FAIL

- Structural/spec and full root checks passed. `npm test` passed 247/247;
  build, check-cli, specs validation, and diff-check passed. Catalog tests 8/8,
  canonical app/UI 15/15, and CLI mirror app 14/14 passed after dependency
  provisioning.
- Criterion 8: FAIL — isolated OpenCode 1.18.35 output includes ANSI-colored
  provider rows plus a `Credentials <path>` header, standalone `│` lines, and a
  `2 credentials` footer. The parser rejects these before invoking
  `opencode models`, so both global and provider-filtered catalog commands return
  no models. Dummy credentials remained private; no provider/model was called.
- Criterion 9: FAIL as a consequence because the live catalog stays unavailable;
  selection/manual fallback and UI accessibility subchecks pass.
- Criterion 10: FAIL because the current ANSI fixture omits the credentials
  header, standalone border lines, and count footer.
- Original criterion 7 regression gate: PASS; the mirrored app test passes 14/14.
  Original criteria 1–6 have no observed functional regression.
- Independent worker-verify `ses_ee2f57ed4ffefr1vqVeOdX5Z8y`: overall FAIL due to
  criteria 8–10. Isolated CLI output and exact checks are in the verifier report.
- Worker-debug `ses_ee2ecf44effeRh4VGjsGvsH2ug` confirmed the remaining failure
  is unclassified: ignore only anchored `Credentials <path>`, border, and
  `N credentials` wrapper rows, while unknown provider rows remain fail-closed.
  Its known-issues append was denied; the primary recorded the diagnosis.
- Worker-code `ses_ee2ea499cffesK1D8S14KqtLV9` implemented that narrow skip and
  added the full auth-table fixture. It reported catalog/CLI/canonical+mirror
  API tests 47/47, `check-cli`, and `git diff --check` passing; independent
  verification is pending.

## Connected model catalog independent verification attempt 4 — FAIL

- Spec gate: PASS (`node bin/guarana.js specs validate . --json`), 115 files,
  18 feature specs, 22 ADRs, 176 links.
- Criteria 8–9: FAIL — OpenCode 1.18.35's actual table places `Credentials
  <path>` after a leading `┌` and `2 credentials` after `└`; the parser's anchored
  wrapper patterns expect unbordered lines, so it rejects provider output before
  `opencode models` is invoked. Catalog CLI/API return no connected models.
- Criterion 10: FAIL — the fixture has the header/footer without the actual
  leading box-corner characters. The verifier captured this discrepancy.
- Original criterion 7: PASS; mirrored dashboard suite is 14/14. Full root tests
  (247/247), build, check-cli, specs validation, diff-check, canonical app/UI, and
  mirrored app suites passed.
- Independent worker-verify `ses_ee2e4f323ffefr1vqVeOdX5Z8y`: overall FAIL for
  criteria 8–10. It used isolated dummy credentials; no actual user auth or
  provider call was made.
- Worker-debug `ses_ee2d97969ffeupcUbyaA4198t0` classified the box-corner prefix
  mismatch as unclassified and recommended removing only leading/trailing table
  corner decoration before matching anchored wrapper rows. Keep raw/sanitized
  secret scans and fail-closed unknown rows; add `┌`/`└` to the fixture. Its
  known-issues update was denied and was backfilled by the primary.
- Worker-code `ses_ee2d72211ffecQvKTu3JykRLON` strips only box-drawing
  decoration at line edges before matching recognized auth wrappers. Its exact
  fixture proves the helper reaches `opencode models`, returns connected
  OpenAI/GitHub models, filters providers, and still rejects unknown rows and
  secrets. Catalog/CLI/canonical+mirror API tests passed 47/47, `check-cli`, and
  `git diff --check`; independent verification is pending.

## Connected model catalog independent verification attempt 5 — FAIL

- Spec gate passed. Isolated OpenCode 1.18.35 CLI smoke now proves catalog
  behavior: authenticated OpenAI/GitHub models were returned, disconnected
  Anthropic was excluded, and provider filtering worked without leaking dummy
  auth values.
- Criteria 8 and 9: PASS — actual CLI output parses, catalog/API return only
  connected models, and both primary/advisor selectors and manual fallback work.
- Criterion 10: FAIL — the regression fixture uses a fully boxed table where
  each provider cell is enclosed in vertical borders. Captured OpenCode output
  has standalone border rows and provider rows that are not individually boxed;
  the fixture therefore does not prove the exact production format although the
  isolated CLI smoke passes.
- Original criterion 7: PASS; mirrored app is 14/14. Full checks passed:
  `npm test` 247/247, build, check-cli, specs, diff-check, catalog 8/8, canonical
  app/UI 15/15, and mirrored app 14/14 after dependency provisioning.
- Independent worker-verify `ses_ee2d2c47dffei0Y2qWorbFWzDf`: overall FAIL only
  on criterion 10 fixture fidelity. No real auth data or provider/model call was
  used.
- Worker-debug `ses_ee2c6ccefffeBhyfFoBjgwphkb` classified the fixture mismatch
  as unclassified: change only the fixture to match actual standalone border rows
  and unboxed provider rows, retaining assertions for connected/disconnected
  providers, filtering, and secret safety. Its known-issues append was denied;
  the primary recorded the diagnosis.
- Worker-code `ses_ee29b2962ffeLaqTZMWM4nz0VS` updated only the catalog
  regression fixture to the captured standalone separators/unboxed provider
  rows; CLI catalog tests passed 8/8 and `git diff --check` passed. Production
  model discovery code is unchanged in this slice.

## Connected model catalog independent verification attempt 6 — PASS

Independent worker-verify `ses_ee29073ddffeJLQyalwccEqndE` passed criteria
8–10 and the original packaged criterion 7:

- **Criterion 8 — PASS:** OpenCode 1.18.35, isolated HOME/XDG data/config and
  dummy auth produced ANSI-colored `auth list` output. After sanitization, the
  fixture matched its credentials header, standalone separators, unboxed OpenAI
  and GitHub Copilot rows, and count footer. The advisor CLI returned only
  connected OpenAI/GitHub models, excluded disconnected Anthropic, honored the
  provider filter, and exposed no credential-like values.
- **Criterion 9 — PASS:** Canonical and CLI-mirrored catalog APIs returned the
  same connected model options. Both role selectors, provider/model assignment,
  editable manual IDs, empty/error states, accessibility, focus styling, and
  responsive single-column CSS at narrow width passed tests/source inspection.
- **Criterion 10 — PASS:** The test fixture now matches captured standalone
  separators and unboxed rows; connected/disconnected filtering, provider
  filtering, unknown-row fail-closed behavior, credential sanitization, UI
  assignment, and shared source/mirror resolution passed.
- **Original criterion 7 — PASS:** full test/build/bundle/spec gate and mirrored
  dashboard app suite passed. Original criteria 1–6 have no observed regression.
- No real user auth was inspected; no provider inference call or remote catalog
  refresh was made.

Exact command outcomes:

- `node bin/guarana.js specs validate . --json` — PASS, `ok: true`, 115 files,
  18 feature specs, 22 ADRs, 176 links.
- `npm test` — PASS, 247/247 tests across 44 suites.
- `npm run build` — PASS; Vite built and synchronized the CLI bundle.
- `npm run check-cli` — PASS, `CLI bundle matches canonical sources.`
- `npm run specs:validate` — PASS, 115 Markdown, 18 feature specs, 22 ADRs,
  176 local links.
- `git diff --check` — PASS.
- `node --test cli/lib/opencode-model-catalog.test.js` — PASS, 8/8.
- `node --test dashboard/server/app.test.js dashboard/web/src/components/Models.test.mjs`
  — PASS, 15/15; `node --test cli/dashboard/server/app.test.js` — PASS, 14/14.
  The mirror app dependency was provisioned with the declared server package.
- After final tracker/change records were written, `npm run specs:validate`
  passed with 116 Markdown files, 18 feature specs, 22 ADRs, and 180 local links;
  `git diff --check` also passed.

## OpenCode model-ID round-trip implementation

- Worker-code `ses_ee2807e88ffeEdcANnuFKqrOfi` updated catalog and settings
  validation to preserve OpenCode model IDs containing `~` and nested `/`, and
  filters disconnected catalog providers before checking their model IDs.
- The observed ID `openrouter/~anthropic/claude-fable-latest` now round-trips
  through discovery, CLI settings, dashboard API save, and generated primary
  agent profile unchanged.
- Focused catalog/CLI/API tests passed 36/36; `npm run check-cli` and
  `git diff --check` passed. Independent verification is pending.

## Search and variant UI implementation

- Worker-code `ses_ee2717d01ffeP7uWayBrUilZOU` added an on-demand variants API
  that reads the selected model's OpenCode verbose metadata and returns enabled
  variant keys only; its focused catalog/API tests passed 13/13.
- Worker-code `ses_ee26f6195ffea2ykLS6B07xpUY` added a per-role model search,
  catalog selection, and model-specific variant selector in the existing flat
  ledger form. Manual model/variant entry and non-blocking lookup failures remain
  available. Focused UI test 1/1 and dashboard build passed.
- Source review and independent verification of criteria 11–13 remain pending.
- User correction: remove the duplicate variant controls and visible OpenCode
  default option. Worker-code `ses_ee2333c4fffeb0Bpo8tP67A7im` replaced them with
  one editable variant input per role, with OpenCode suggestions via datalist;
  blank uses the default, and manual/stored variants are preserved. Focused UI
  test and dashboard build passed.

## Model-ID/UI follow-up independent verification attempt 1 — FAIL (evidence gap)

- Criterion 11: FAIL — code and automated tests cover the OpenRouter tilde-ID
  round-trip, but verifier `ses_ee26c865effe6e0kXbIABt0vzP` did not run the
  requested isolated OpenCode CLI→settings→generated-profile smoke.
- Criterion 12: FAIL — search/filter, manual entry, labels, focus, and responsive
  CSS are covered by UI tests; verifier did not perform a 375px rendered/overflow
  check.
- Criterion 13: FAIL — helper/UI tests cover verbose variant metadata, defaults,
  and custom values, but verifier did not exercise the isolated OpenCode verbose
  model command and its variant payload.
- Base suite remained green: `npm test` 255/255, build/check-cli/specs/diff-check
  passed; focused catalog/settings/API/UI tests 42/42; mirrored app passed 16/16
  after Express dependency provisioning.
- This is a verification-evidence gap, not a reproduced implementation failure.
  Repeat independent verification with explicit host-format and 375px checks;
  do not claim criteria 11–13 validated until those proofs are present.
- Worker-debug `ses_ee263ad87ffeE2jDPO1IMT4F5p` diagnosed a workflow transition
  mismatch: UI code was added after returning to `verifying`, so `code_complete`
  was illegal. It classified the process issue as unclassified and recommended
  restoring the coding→verifying lifecycle before a fresh verifier run; its
  known-issues append was denied and backfilled by primary.

## Model-ID/UI follow-up independent verification attempt 2 — FAIL (evidence gap)

- Criteria 11 and 13: FAIL — worker-verify `ses_ee25d6649ffe1U79F8m3KOW3xY` did
  not run the isolated OpenCode CLI→settings→generated-profile smoke or actual
  `opencode models <provider> --verbose` variant lookup. Automated
  catalog/settings/API tests pass, but the host-format round-trip is not yet
  proven.
- Criterion 12: FAIL — search/manual-entry/labels/focus and responsive CSS tests
  pass, but no browser was installed and no rendered 375px overflow measurement
  was captured.
- Base suite remained green: `npm test` 255/255, build/check-cli/specs/diff-check
  and mirrored app 16/16 passed; focused catalog/settings/API/UI tests 42/42.
- Independent worker-verify `ses_ee25d6649ffe1U79F8m3KOW3xY` returned FAIL for
  missing direct evidence, not a reproduced product defect. Rerun with the host
  and viewport procedures explicitly completed.
- Worker-debug `ses_ee268b26effeSfG9cB2z2Co45C` classified the missing CLI and
  viewport proof as unclassified rather than a confirmed product bug. It
  recommends rerunning independent verification with isolated OpenCode CLI
  round-trip/verbose-variant checks and an actual 375px rendered overflow check.
  Its known-issues append was denied; primary backfilled the entry.

## Model-ID/UI follow-up independent verification attempt 2 — FAIL (evidence gap)

- Criteria 11 and 13: FAIL — verifier `ses_ee25d6649ffe1U79F8m3KOW3xY` did not
  run the requested isolated OpenCode CLI → settings → generated-profile smoke
  or actual `opencode models <provider> --verbose` variant lookup. Automated
  catalog/settings/API tests pass, but the host-format chain remains unproven.
- Criterion 12: FAIL — search/manual-entry/labels/focus and responsive CSS tests
  pass, but this environment has no browser/renderer and no actual 375px overflow
  measurement was captured.
- Base suite remained green: `npm test` 255/255, build/check-cli/specs/diff-check
  and mirrored app 16/16 passed; focused catalog/settings/API/UI tests 42/42.
- Independent worker-verify session `ses_ee25d6649ffe1U79F8m3KOW3xY` returned
  FAIL for missing evidence, not a reproduced product defect. No real provider
  call or repository source change occurred.

## Models redesign independent verification — FAIL (one defect, one evidence gap)

- Criterion 11: PASS — isolated fixture-backed discovery/settings/profile proof
  retained `~anthropic/claude-fable-latest` and variant `xhigh` unchanged.
  OpenCode itself is unavailable on this host; no real auth data was read.
- Criterion 12: FAIL — independent Chromium verification found that after
  selecting a model, typing a new query without blurring the focused input does
  not reopen the list (`aria-expanded=false`). Worker-debug
  `ses_ee213bcccffek2QM4TmHYVkJW9` traced this to the model input change handler
  not restoring active state and recommended setting index -1 plus a
  select-then-type rendered regression test.
- Criterion 13: partial/evidence gap — one variant input per role, model-specific
  suggestions, manual entry, blank-default semantics, and lookup-error fallback
  were observed; headless Chromium did not demonstrate selecting a native
  datalist suggestion. Worker-debug recommends retaining the datalist absent a
  reproduced product failure; obtain suitable independent selection proof.
- Criterion 14: PASS — independent screenshots at 375px and 1280px show the
  redesigned ledger layout; measured document/body widths were 375/375 and
  1280/1280, with mobile stacking, desktop peer columns, visible focus, and
  reduced-motion handling. Screenshots are `/tmp/opencode/models-independent-
  375.png` and `models-independent-1280.png`.
- Independent worker-verify `ses_ee21be264ffeL4qKTmo7vUcl3z` returned FAIL.
  Repo checks were green before this discovery: `npm test` 255/255, build,
  `check-cli`, and specs validation. Fix criterion 12, obtain criterion 13
  selection evidence, then independently reverify; do not close criteria 11–14
  yet.
- Fix: worker-code `ses_ee21216ceffeGwVdnvVwTST3kg` resets the model combobox
  active index to -1 when a new query is typed, reopening results after a prior
  selection without requiring blur. Focused test `node --test
  dashboard/web/src/components/Models.test.mjs` passed (1/1). The available SSR
  harness cannot dispatch React input events, so the regression assertion checks
  the state transition in the event path; fresh independent Chromium verification
  of select→type→select and datalist suggestion selection remains required.
- Fresh independent worker-verify `ses_ee2108fb7ffeSOXgqI0JuCwNPK` passed criterion
  12 in Chromium for both roles, including select→type without blur, live result
  counts, active descendant, Escape, ArrowDown and Enter. Criterion 13 remains
  open because native datalist suggestions were present but were not selected by
  the verifier's headless keyboard interaction; manual custom entry and empty
  advisor variant were preserved in the save payload. Criterion 11/14 evidence
  from its preceding run remains valid. Scope is re-planned to expose a selectable
  listbox while retaining exactly one editable variant input.
- Worker-code `ses_ee20d276cffe3QAWNHWX21mTee` implemented that listbox on the
  existing input: choices filter by typed prefix and support pointer/arrow/Enter
  selection, Escape, focus cleanup, and live result counts. The native datalist
  and any separate default/custom field are removed. Primary-context Playwright
  selected `medium` from fixture model metadata and saved it unchanged alongside
  a manual Advisor variant after simulated 503 lookup failure; the focused Models
  test passed (1/1). Fresh independent verification of criteria 12–13 and full
  repo checks remain.
- Worker-debug `ses_ee2021084ffeWZFyew2rPaY29P` classified the latest verifier
  result as an unclassified evidence-procedure gap, not a product defect. The
  focused rerun must choose a model before requesting suggestions, capture a
  selected suggestion in the settings PUT, save a blank variant after a simulated
  503, and measure 375px overflow while the suggestion list remains open. No code
  change is indicated unless this procedure reproduces a behavior defect.
- Follow-up independent worker-verify `ses_ee201259effeMQMvQZ5qoTWdot` stopped
  before rendering the Models form because its fresh Vite setup omitted common
  dashboard API fixture responses. It captured no browser interactions, PUT
  payloads, or viewport result and reported no product behavior. Re-run with the
  full fixture contract already used by the dashboard smoke: `/api/models`,
  `/api/models/catalog`, `/api/telemetry/summary`, `/api/specs/state`,
  `/api/specs/tracker`, `/api/workflow/current`, `/api/memory/summary`,
  `/api/decisions/pending`, `/api/skills`, and `/api/telemetry/stream` SSE.
- Worker-debug `ses_ee1fef82bffe3Ev2FklFk439Bl` classified this as an
  unclassified verification-procedure failure, confirmed the missing common API
  fixture responses, and recommended a fresh verifier run with that full contract.
  No product code change is indicated unless the corrected run reproduces an issue.
- Primary-context diagnostic of the temporary complete-fixture harness captured
  the first Primary selected-variant PUT exactly. After choosing Advisor OpenAI /
  GPT-6 Luna, receiving the simulated 503, entering a custom value, and clicking
  Save, no second PUT reached the route within 2.5s (button remained enabled; no
  alert). This is not yet classified as a product defect; worker-debug diagnosis
  is required before deciding on code changes.
- Worker-debug `ses_ee1f53218ffekoUraq6DEAlHZe` classified the save symptom as
  unclassified; source inspection found no expected path that suppresses the PUT,
  and the reproduction was not independently confirmed. Instrument the form's
  native submit event and route handler PUT count, then inspect before changing
  product code.
- Follow-up worker-debug on `ses_ee1f53218ffekoUraq6DEAlHZe` found that the
  second browser action produced no click/submit event on current-node listeners,
  despite a connected/enabled button under the pointer. The prior listeners were
  attached to stale nodes, so this does not confirm a product defect. Next use
  document-level capture listeners to record trusted click/submit targets before
  changing any application code.
- Independent worker-verify `ses_ee1f11a97ffe0XioqPMDXisKV6` captured the exact
  Primary `medium` PUT with trusted document-level click/submit events. Its 375px
  screenshot was after selection (menu closed), and it captured no Advisor custom
  or blank PUT; it did not run a fresh-page Advisor test. This remains an evidence
  gap, not a confirmed product failure. Repeat list-open measurement before
  selection and test Advisor saves on a fresh page.
- Worker-debug `ses_ee1ed7c6effei58IUWoCDrQRq3` classified these remaining gaps
  as unclassified verification evidence, not product behavior. Fresh-page proof
  should measure/screenshot with the list open before choosing, capture the
  selected Primary PUT, then exercise Advisor 503/custom/blank saves with trusted
  document events and captured PUT payloads.
- Independent worker-verify `ses_ee1ec9296ffePpmXosBwzDH5VF` stopped before
  rendering because Vite was started with `configFile:false`, omitting the React
  plugin and causing `React is not defined`. It captured no API/UI evidence and
  reported no product behavior. Rerun with `dashboard/web/vite.config.js` loaded;
  the previous required three fresh-page checks remain.
- Worker-debug `ses_ee1ea0cddffe3X9jq8KzRpigTN` classified this as unclassified
  verification setup, not product failure; rerun with the project's Vite config
  enabled, then continue the three pending fresh-page checks.
- Independent worker-verify `ses_ee1e9091effedglTLhByYGvalT` inspected the
  reference fixture and ran specs validation but did not execute any requested
  browser case; it issued no criterion-level browser evidence. Criteria 13/14
  remain unverified. A fresh verifier must complete the 375px open-list screenshot,
  selected-value PUT, Advisor 503/custom save, and blank/default save.
- Worker-debug `ses_ee1e7f4defferm29JD6IGTdGwv` classified the non-execution as
  an unclassified process/evidence gap and recommends a fresh worker-verify run
  using the working Vite config and full mock API fixture. No product-code change
  is indicated without a reproduced behavior defect.
- Split independent worker-verify runs `ses_ee1e6ee4dffe624fElgPqOoKIx` and
  `ses_ee1e6ee15ffeinE0rha1S78htG` used the React Vite config and complete common
  fixtures. Primary selected `medium` and captured the exact model/variant PUT,
  but timed out before open-menu 375px evidence. Advisor confirmed the 503 and
  manual/default copy, but a trusted click hit `<main>` instead of the Save button;
  no PUT was captured, and its blank case was not run. No product behavior is
  established by these incomplete actions. Diagnose the actual button hit target,
  then repeat the viewport/save cases with explicit element bounds and scroll.
- Fresh independent Primary worker-verify `ses_ee1e2db60ffeGH8aQHUxT2iabO` passed:
  it selected `medium`, captured the exact OpenRouter PUT, and measured 375px with
  the list open (document/body 375; controls within viewport; screenshot recorded).
  Advisor worker-verify `ses_ee1e2db2bffexrC5F4NV4gM6sF` confirmed the simulated
  503 status on two fresh pages, but the reported Save y-coordinates remained
  below the viewport and trusted clicks hit `<html>`; no submit/PUT or blank/custom
  persistence was established. These are inconclusive click/scroll observations,
  not confirmed product failures. Re-run Advisor cases by checking viewport-relative
  bounds after `scrollIntoViewIfNeeded()` and using the locator's trusted click.
- Worker-debug `ses_ee1e17db4ffepA9xZi6cAKIdhL` classified the Advisor result as
  incomplete offscreen hit-target evidence, not a product defect. On a fresh page,
  scroll Save into view, assert viewport-relative bounds, capture trusted click/
  submit and custom PUT after the 503, then repeat for blank/default. Primary
  open-list 375px evidence has already passed independently.
- Worker-debug `ses_ee1e3c8e6ffeSYyF74vJHdx4tc` classified the Advisor no-PUT
  signal as an unclassified verifier hit-target/setup issue: trusted click landed
  on `<main>`, not Save. On a fresh page, inspect button bounds/scroll, scroll
  `.models-save` into view, capture document click/submit and route PUT; separately
  measure with the variant list open at 375px and run the blank save.
- Fresh independent Primary worker-verify `ses_ee1e2db60ffeGH8aQHUxT2iabO` passed:
  it selected `medium`, captured the exact OpenRouter PUT, and measured 375px with
  the list open (document/body 375; controls within viewport; screenshot recorded).
- Fresh independent Advisor worker-verify `ses_ee1e0d49dffenGYBtWTP6bhneS` passed
  on two fresh pages: OpenAI variants lookup returned 503, custom `custom-r` was
  saved unchanged, and blank/default save omitted `advisor.variant`. Both saves
  were trusted clicks/submits with `.models-save` inside viewport and no page
  errors. The run covered two variant fields and no explicit default option.
- Criterion 11 exact provider model ID and variant persisted through fixture-backed
  settings/profile generation in prior independent proof; real OpenCode/auth was
  unavailable. Criterion 12 both-role search and select→type behavior passed in
  independent Chromium; criterion 14 also passed prior desktop 1280px two-column
  measurement. These proofs plus the fresh Primary/Advisor runs close criteria
  11–14. Run full repo checks/build synchronization before final completion.
- Independent worker-verify `ses_ee2052a68ffejjBigk3U6ajqgP` confirmed listbox
  filtering, ARIA active/selected state, ArrowDown/Enter, pointer selection,
  Escape, manual values, exactly two variant inputs, and 375px document width
  375. Overall remained FAIL for evidence gaps: selected variant was not captured
  in the save payload; OpenAI 503 and blank/default save were not exercised; the
  375px measurement was taken after the list closed. No product defect was
  reported. Rerun focused independent checks with the model selected before
  triggering variant lookup, capture each PUT payload, and measure with the
  suggestion list still open.

## Final Models UX verification — PASS (2026-10-08)

- Criterion 11 — PASS: fixture-backed settings/profile proof preserves
  `openrouter/~anthropic/claude-fable-latest` and `xhigh` unchanged. OpenCode/auth
  is unavailable on this host; no real credentials were inspected.
- Criterion 12 — PASS: independent Chromium confirmed provider/model search and
  exact selection in both Primary and Advisor, including select→type→select
  without blur, result/active state, ArrowDown/ArrowUp/Enter/Escape.
- Criterion 13 — PASS: independent Primary run selected `medium` from OpenRouter
  metadata and captured it unchanged in the settings PUT. Separate Advisor pages
  confirmed OpenAI lookup 503 remains non-blocking, saved `custom-r`, and saved
  blank with `advisor.variant` omitted. One listbox-backed variant input per role;
  no explicit default option.
- Criterion 14 — PASS: independent Chromium measured 375px with the suggestion
  list open (document/body width 375; all form controls fit); prior independent
  desktop 1280px check confirmed two role columns, ledger styling, focus, and
  reduced-motion behavior.
- Independent sessions: criteria 11/profile `ses_ee21be264ffeL4qKTmo7vUcl3z`;
  criterion 12 `ses_ee2108fb7ffeSOXgqI0JuCwNPK`; Primary/open-list
  `ses_ee1e2db60ffeGH8aQHUxT2iabO`; Advisor 503/custom/blank
  `ses_ee1e0d49dffenGYBtWTP6bhneS`.
- Integrated validation: focused Models UI test 1/1; `npm test` 255/255;
  dashboard build and CLI synchronization passed; `npm run check-cli` passed;
  `npm run specs:validate` and `git diff --check` final results are recorded in
  `.specs/changes/2026-10-08-advisor-models-variant-listbox.md`.

## Advisor runtime execution proof follow-up — VALIDATED (2026-10-08)

Decision: [ADR-027 — Advisor runtime execution proof](../../decisions/ADR-027-advisor-runtime-execution-proof.md).

### Confirmed runtime facts

- The user wants to confirm that Advisor Task execution uses the configured
  provider/model and selected variant, rather than infer it from the agent name.
- The user chose the dashboard Models page and approved separate configured vs
  runtime-observed values; absent variant telemetry must be shown as not reported.
- Generated OpenCode advisor profiles contain the configured model and optional
  `variant`; the Task dispatch hook currently validates the advisor agent name and
  consultation budget only.
- Prior telemetry could record provider/model IDs when token data was present but
  did not associate model events with an Advisor child session or record variant.
- OpenCode v1.18.35 source confirms the Task tool selects the Advisor agent's
  model; its SessionPrompt resolves the agent's configured variant against the
  selected model's variants and records the resolved variant on the child message.

### Accepted implementation contract

- Correlate each dispatched `guarana-advisor` Task to its child session without
  storing its prompt or credentials.
- On completed assistant `message.updated` from agent `guarana-advisor`, store only
  actual `providerID`, `modelID`, `variant` when present, child/parent session IDs,
  timestamp, and outcome; do not store prompts, credentials, token text, or output.
- Dashboard Models displays current configured Advisor provider/model/variant
  separately from the last observed completed Advisor execution. Compare actual
  message metadata to configuration without treating configuration as runtime
  evidence. If `variant` is missing, render “runtime did not report variant.”
- `GET /api/models/runtime` returns the latest sanitized execution or an explicit
  no-execution result; the Models view refreshes it through the existing telemetry
  SSE tick.
- Tests prove parent/child correlation, exact model/variant capture, missing-field
  handling, and no prompt/credential leakage.

### Implementation status

- Worker-code `ses_ee1b32987ffe46Um0Dt95RYCXx` added a bounded/deduplicated
  `advisor-execution` telemetry event for completed Advisor assistant messages;
  it captures actual provider/model/variant metadata and correlates the child with
  the parent session created by native Task, without persisting prompt/output or
  credentials.
- `GET /api/models/runtime` returns only the newest sanitized Advisor execution
  or an explicit empty result. Dashboard Models displays configured and observed
  values separately, distinguishes runtime errors/loading/no-run, marks absent
  variants as not reported, and refreshes on telemetry SSE updates.
- Focused telemetry/API/Models tests passed 33/33; `npm test` passed 259/259;
  dashboard build/CLI synchronization, `npm run check-cli`, `npm run specs:validate`
  (final counts in the runtime-proof change record), and `git diff --check` passed.
- Independent worker-verify `ses_ee1a78643ffeTDB1oMY2PqtjLS` passed criteria 1–3
  for telemetry sanitization/correlation, latest runtime API, and dashboard states.
- Independent worker-verify `ses_ee1a0759fffeX2fsAzVTzrRuN1` passed criterion 4
  from tagged OpenCode v1.18.35 source: Task picks the configured agent model,
  SessionPrompt resolves the supported agent variant, and the child assistant
  carries provider/model/variant in message metadata. No live provider call was
  made; proof is source-path verification plus fixture-driven event tests.
- Runtime-proof change record: `.specs/changes/2026-10-08-advisor-runtime-proof.md`.
- A subsequent worker-verify attempt `ses_ee19b5082ffeMOTneSfcFBpbnW` did not
  complete rendered evidence: its first fixture did not match `/api/models`, and
  its retry looked for Vite from the wrong package path. No page assertion ran, so
  no product defect was reported. Repeat with Vite resolved from the `dashboard`
  package, use the established full route fixture, and capture 375px screenshot/
  bounds, configured-vs-observed labels, missing-variant state, and error state.
- Fresh independent worker-verify `ses_ee1937079ffespVrM5TQ0uW15h` passed the
  rendered 375px runtime panel: configured and observed `openai / gpt-6-luna /
  xhigh` appeared separately with a match state; missing variant rendered “Runtime
  did not report variant” without claiming a match; HTTP 503 rendered runtime
  evidence unavailable rather than no execution. Document/body widths were 375px
  in all three cases, with no page errors. Screenshot:
  `/tmp/opencode/advisor-runtime-375.png`. These are API-fixture browser checks,
  not a live provider inference.
- First live-test attempt found stale project telemetry/orchestrator plugins;
  `guarana plugin install --project` refreshed them and `plugin status --project`
  then reported all artifacts up to date. After OpenCode reload, a fresh native
  Advisor Task completed in child session `ses_ee18381a9ffe1ZVwyYLf4B7FVu`, parent
  `ses_ee39ce5c0ffeA5wDL8irBmzskV`. Telemetry recorded completed events with
  observed `providerID=openai`, `modelID=gpt-5.6-luna`, `variant=xhigh`, matching
  the configured Advisor profile. Multiple assistant turns in the same child
  emitted events with the same runtime metadata. This confirms OpenCode child
  message metadata, not separate provider-side attestation.
- Final `.specs` validation passed: 123 Markdown files, 18 feature specs, 27 ADRs,
  and 193 local links; CLI bundle check and `git diff --check` passed.
- Worker-debug `ses_ee197771effe42D1C5BejJ9B53` classified this as unclassified
  verifier setup. It specified the correct Vite resolver (`createRequire` rooted
  at `dashboard/package.json`, then load `dashboard/web/vite.config.js`) and the
  `/api/models` envelope including both roles' field-source maps. No code change
  is indicated; rerun with full common dashboard routes, and test runtime-fetch
  failure separately from a completed execution whose status is `error`.
