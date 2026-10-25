# Change — Dashboard Activity late lifecycle metadata

**Current status:** VALIDATED — source/fixture slice only. Actual live Activity behavior remains unverified; global plugin install and reload are pending authorization. Not SHIPPED.

## Outcome

Late Task-child lifecycle metadata is merged into the child identified by its actual session identity without allowing an older idle status to replace newer running status. V2 `data` busy-to-metadata and legacy `properties` running-to-metadata fixtures pass end-to-end through telemetry recording into `summarize`. The result retains actual parent, agent, status, and `statusTs` and emits no metadata status. Metadata projection excludes event IDs, decoy IDs, title, prompt, output, and reasoning, and unidentified updates are skipped. Canonical and CLI telemetry and summary tests match. No UI or API schema change was made.

## Independent verification and checks

- Independent `worker-verify` PASS 13/13 for the source/fixture slice, including criterion 10's V2 and legacy end-to-end fixtures and canonical/CLI summary ordering.
- `node --test plugin/guarana-telemetry.test.mjs dashboard/server/lib/telemetry.test.js cli/dashboard/server/lib/telemetry.test.js dashboard/web/src/components/Activity.test.mjs` PASS 59/59.
- `npm test` PASS 612/612; nonfatal WebSocket port-in-use warnings occurred.
- `npm run build` PASS, including dashboard bundle and CLI sync; `npm run check-cli` PASS.
- `npm run specs:validate` passed before this record update: 208 Markdown, 0 issues. `git diff --check` PASS.
- Final post-record validator result from primary: `npm run specs:validate` PASS — 209 Markdown files, 80 feature specs, 39 ADRs, 239 local links, 0 issues.

## Runtime and deployment boundary

This validates checkout source and fixtures only. No raw runtime capture, global install, or restart occurred. The actual runtime envelope and global Activity behavior remain unresolved and unverified; global install/reload requires authorization. This slice is VALIDATED, not SHIPPED.
