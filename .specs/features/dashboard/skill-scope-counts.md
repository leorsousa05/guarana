# Feature spec: dashboard skill-scope counts

**Status:** VALIDATED (2026-10-05)

## Goal

Show users how many Guarana-generated skills are available in each scope before they switch between the Skills view's Global and Project tabs.

## Evidence and requirements

- The screen is `dashboard/web/src/components/Skills.jsx` and polls `/api/skills`.
- The API returns `global` and `project` arrays from the generated-skill engine; it intentionally excludes user-authored skills.
- Both tabs already use accessible tab semantics and the shared arrow-key handler.
- The user requires preserving the ledger visual style, keyboard navigation, and responsive layout; rebuilding the bundle and running tests and validators are part of completion.
- The UI may derive counts from the existing response; no API contract change is required.

## Scope and assumptions

- Add each scope's current array length to its tab label (for example, `Global (2)` and `Project (0)`). Keep the count text part of the existing button label, not a new control.
- Keep existing empty states, loading/error handling, roles, selected state, and keyboard behavior.
- Use existing ledger typography, colors, borders, and responsive behavior; no new visual token or card surface.
- Also create a project skill `dashboard-change-process` capturing the repeatable inspection, implementation, and verification procedure requested by the user.
- Do not change `/api/skills` response shape or generated-skill filtering.

## Acceptance criteria

1. The Global tab label includes the number of entries in `data.global`; the Project tab label includes the number in `data.project`, including zero.
2. The counts update when a new `/api/skills` poll result arrives, without changing API behavior or list content.
3. The existing `tablist`/`tab`/`tabpanel` semantics, selection state, focus behavior, and ArrowLeft/ArrowRight/Home/End handling remain functional.
4. At 375px viewport width, the Skills view remains usable without introducing page-level horizontal overflow; counts retain the current ledger styling.
5. `.opencode/skills/dashboard-change-process/SKILL.md` exists with valid frontmatter and documents screen/API inspection first, ledger styling, keyboard accessibility, responsive layout, bundle regeneration, tests, and validators.
6. `npm test`, `npm run build`, `npm run check-cli`, and `npm run specs:validate` pass; generated bundle output is synchronized.

## Verification proof

Independent worker-verify passed all six criteria:

1. `dashboard/web/src/components/Skills.jsx:12-26,41` derives counts from the successful API arrays; `Skills.test.mjs:33-38` asserts `Global (2)` and `Project (0)`.
2. `Skills.jsx:12-14,50-70` omits counts for loading and errors; `Skills.test.mjs:40-47` covers loading, network failure, and API error. The API route remains `dashboard/server/routes/skills.js:4-8`; API shape/filtering tests remain at `dashboard/server/app.test.js:279-307`.
3. `Skills.jsx:17-40` preserves tab roles, ARIA relationships, selection, roving focus, and the shared key handler; `dashboard/web/src/components/common.jsx:14-30` handles ArrowLeft/ArrowRight/Home/End.
4. Existing tab CSS remains natural-width flex at `dashboard/web/src/style.css:817-835`; at 375px, the responsive main content leaves approximately 351px (`style.css:1669-1675`). No layout CSS was added for counts.
5. `.opencode/skills/dashboard-change-process/SKILL.md:1-7,13-31` has valid frontmatter and covers screen/API inspection, ledger styling, keyboard support, 375px layout, bundle, tests, and validators.
6. Focused test: 1 passed, 0 failed. `npm test`: 201 passed, 0 failed across 43 suites. `npm run build`: 51 modules transformed; dashboard and CLI bundles synchronized. `npm run check-cli`: canonical bundle match. `npm run specs:validate`: 102 Markdown files, 15 feature specs, 19 ADRs, and 146 local links; PASS after the change record was added.

Build output references match in `dashboard/web/dist/index.html:13-14` and `cli/dashboard/web/dist/index.html:13-14`.
