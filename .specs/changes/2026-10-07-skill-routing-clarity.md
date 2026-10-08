# Change 2026-10-07 — skill routing clarity

## Change

Sharpened the Guarana index and skill descriptions so `remember` points to
project-state/checkpoint restoration and `memory` points to durable graph
knowledge. Made the index's router-versus-procedure boundary explicit. Added
regression assertions for this distinction, debug injection after a verification
failure, and measure's telemetry-only native-skill routing outside workflow
states. Preserved responsibility-driven skill lengths.

## Verification

- `node --test orchestrator/workflow.test.js` — PASS, 33/33.
- `npm test` — PASS, 204/204 tests across 43 suites.
- `node --test cli/orchestrator/workflow.test.js cli/orchestrator/prompt.test.js` — PASS, 34/34.
- `npm run build` — PASS; production build and CLI bundle synchronization.
- `npm run check-cli` — PASS; canonical and CLI bundle match.
- `npm run specs:validate` — PASS, 104 Markdown files, 15 feature specs, 19 ADRs, 151 local links.
- Five `opencode run --pure --format json` checks with the current skill files attached returned the expected `remember`, `memory`, `debug`, `measure`, and `neither` choices. The exact scenarios, returned text, command form, and prose-change rationale are recorded in the feature spec's **Implementation and validation evidence** section.
- Independent `opencode run --pure --format json` review of the feature spec, change record, canonical/CLI skill copies, and canonical/CLI tests — PASS, 5/5 acceptance criteria. The verifier separately confirmed the exact model-output evidence, scripted-test boundaries, prose-change rationale, and bundle parity.
