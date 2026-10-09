# Change — Advisor Models searchable inputs and variant suggestions

**Status:** VALIDATED · 2026-10-08

Redesigned the dashboard Models page so provider and model searches are
discoverable and each role has one editable variant input with explicit,
model-specific selectable suggestions. The same input accepts custom values;
empty remains OpenCode's model default.

## Implementation

- `dashboard/web/src/components/Models.jsx` — searchable Provider/Model
  comboboxes, result counts, select-then-search recovery, and one keyboard/pointer
  selectable variant listbox attached to the editable input.
- `dashboard/web/src/style.css` — flatter ledger hierarchy, clearer role groups
  and input affordances, listbox states, and responsive layout.
- `dashboard/web/src/components/Models.test.mjs` — one-input/default/manual
  assertions, keyboard boundaries, model search recovery, and UI structure.
- `cli/dashboard/web/dist/` — production dashboard bundle synchronized by build.
- Decision and acceptance criteria: [ADR-025](../decisions/ADR-025-models-page-search-redesign.md),
  [ADR-026](../decisions/ADR-026-single-variant-input.md),
  [advisor-flow criteria 11–14](../features/orchestrator/advisor-flow.md).

## Independent evidence

- Criterion 11 — fixture-backed profile round-trip preserved
  `openrouter/~anthropic/claude-fable-latest` and `xhigh` exactly in settings and
  the generated advisor profile. OpenCode/auth was unavailable on this host; no
  real credentials were read.
- Criterion 12 — independent Chromium confirmed provider/model search and
  selection for both Primary and Advisor, including a second model query after
  selection without blur, keyboard navigation, active/result state, Escape, and
  exact IDs.
- Criterion 13 — independent Primary run selected `medium` from OpenRouter model
  metadata and captured the exact PUT. Fresh Advisor runs exercised OpenAI lookup
  HTTP 503, saved custom variant `custom-r`, then saved blank with
  `advisor.variant` omitted. Exactly one variant input per role remains; no
  explicit default option is rendered.
- Criterion 14 — with the suggestion list open at 375px, independent Chromium
  measured document/body widths of 375px and confirmed all controls within the
  viewport. Prior independent desktop evidence measured 1280px and two role
  columns. Focus and reduced-motion behavior are covered.

## Validation

- `node --test dashboard/web/src/components/Models.test.mjs` — PASS (1/1).
- `npm test` — PASS (255/255).
- `rtk npm run build` — PASS; dashboard built and CLI mirrors synchronized.
- `rtk npm run check-cli` — PASS; CLI bundle matches canonical sources.
- `rtk npm run specs:validate` — PASS (121 Markdown files, 18 feature specs,
  26 ADRs, 188 local links).
- `rtk git diff --check` — PASS.

Independent sessions: model-search/variant verifier
`ses_ee2108fb7ffeSOXgqI0JuCwNPK`; Primary/open-list verifier
`ses_ee1e2db60ffeGH8aQHUxT2iabO`; Advisor 503/custom/blank verifier
`ses_ee1e0d49dffenGYBtWTP6bhneS`; fixture-backed ID/profile verifier
`ses_ee21be264ffeL4qKTmo7vUcl3z`.
