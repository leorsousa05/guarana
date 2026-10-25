# Dashboard Memory Index/Map switch — 2026-10-24

**Status: VALIDATED, not SHIPPED.** Fresh independent `worker-verify` returned overall PASS for all three acceptance criteria.

## Validated behavior

- The accessible native-button `Memory display` group defaults to Memory map. Map mode retains the existing layout and behavior.
- Memory index mode hides only the bubble map, expands the filtered record index to full width, and retains selected details and relationship controls beneath it.
- The mounted graph retains filters, query, scope, relation, selection, Network/Neighborhood mode, and graph data. Selecting an index record updates selected details and the map bubble when returning to map mode.
- Four top-level Memory tabs and their semantics remain unchanged; no API route, backend, data, schema, or privacy changes were made.

## Verification

- Criterion 1 PASS: default Map, accessible toggle, full-width index, map hidden/restored, and details retained.
- Criterion 2 PASS: Space-key switching and visible focus; filters/query/scope and Neighborhood mode retained; index selection synchronized to details and selected map bubble; 375px browser layout had no overflow. Type/relationship filter persistence was source-confirmed from controlled state in the mounted component.
- Criterion 3 PASS: top-level tabs, map, record/privacy/relationship and API contracts preserved; no API route changes and no deployment claim.
- `node --test dashboard/web/src/components/Memory.test.mjs` — PASS 14/14.
- `npm test` — PASS 619/619; nonfatal Vite WebSocket port 24678-in-use and Node module-type warnings.
- `npm run build` — PASS, including dashboard bundle and CLI sync; `npm run check-cli` — PASS; `git diff --check` — PASS. Pre-record `npm run specs:validate` — PASS (219 Markdown files, 85 feature specs, 39 ADRs, 244 links, 0 issues). The verifier did not rerun build because it writes generated assets.
- Browser report: `guarana-memory-index-map-switch.json` (mode 0600; aggregate-only synthetic UI/API fixtures), PASS at 1440px and 375px. It records default Map, keyboard switching/focus, index expansion/map hiding, retained details and filter/mode/selection state, selected-bubble synchronization, no document/body overflow, and no page errors. Screenshots: `guarana-memory-index-375.png`, `guarana-memory-map-375.png`, and corresponding 1440px files. The report and screenshots were temporary local synthetic-fixture evidence and are not included in the repository.
- Tablet was not specifically browser-tested. Browser fixtures were synthetic; no live API behavior is claimed.

No deployment or shipping occurred.

## Final post-record validation

Final post-record validation after all task records were written: `npm run specs:validate` — PASS: 220 Markdown files, 85 feature specs, 39 ADRs, 245 local links, 0 issues; `npm run check-cli` — PASS; `git diff --check` — PASS.
