# Dashboard Memory Map hide index sidebar — 2026-10-24

**Status: VALIDATED, not SHIPPED.** Fresh independent `worker-verify` returned overall PASS on all acceptance criteria.

## Validated behavior

- In Memory map mode, `.mem-graph-index` has `hidden`, removing it from visual and accessibility exposure. The map and selected details/relationship area use the full workbench width and stack.
- The Memory display toggle remains available. Index mode shows full-width filtered records and selected details/relationship controls.
- `MemoryGraph` remains mounted; filters, selection, Network/Neighborhood mode, and graph data persist across display switching.
- Existing top-level tabs, map interactions, global read-only behavior, relationship rules, and API behavior are unchanged. No API, backend, data, schema, or privacy changes were made.

## Verification

- Fresh independent `worker-verify` overall PASS on all criteria. It first reported “FAIL — preservation evidence gap only” because the earlier validated `.specs/features/dashboard/memory-index-map-switch.md` was untracked and had no Git baseline. After new evidence, the fresh final verification returned overall PASS.
- Bounded preservation claim: PASS that the prior toggle record was left unchanged during this follow-up, based on its mtime/ctime of 2026-10-24 12:21:17 -0300, the follow-up spec creation mtime/ctime of 12:57:20, and non-overlapping worker handoffs that list no modifications to the prior record. The prior file remains untracked, so no byte-for-byte comparison with HEAD or a historical Git version was possible. The prior toggle record remains VALIDATED and was not edited.
- Focused `node --test dashboard/web/src/components/Memory.test.mjs` — PASS 14/14. Root `npm test` — PASS 619/619, with nonfatal Vite port 24678-in-use and Node module-type warnings.
- Primary `npm run build` — PASS, including Dashboard build and CLI sync. Independent verifier did not rerun build under its read-only constraint. `npm run check-cli` — PASS. Pre-closeout `npm run specs:validate` — PASS (221 Markdown files, 86 feature specs, 39 ADRs, 245 local links, 0 issues). The independent verifier reran focused tests, root suite, check-cli, specs validation with the same counts, and `git diff --check`; all passed. Primary `git diff --check` also passed.
- Browser report `guarana-memory-map-hide-index-sidebar.json` (aggregate synthetic UI/API fixtures only) — PASS at 1440px and 375px. It verifies the index is absent from the accessibility tree in Map mode, map/details full width, Index mode remains available and full width, keyboard switching, filters/selection/Neighborhood retention and synchronization, no overflow, and zero page errors. Screenshots: `guarana-memory-map-no-index-{375,1440}.png`, `guarana-memory-map-no-index-selected-{375,1440}.png`, and `guarana-memory-index-{375,1440}-sidebar-followup.png`. The report and screenshots were temporary local synthetic-fixture evidence and are not included in the repository. Tablet-specific browser proof was not captured.
- Changed source paths: `dashboard/web/src/components/MemoryGraph.jsx`, `dashboard/web/src/style.css`, and `dashboard/web/src/components/Memory.test.mjs`. The stylesheet also contains unrelated pre-existing Activity/Overview modifications; only Memory rules are attributed to this feature.

No deployment or shipping occurred.
