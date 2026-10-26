# Global preference injection budget — 2026-10-25

Change scope: complete lossless injection of confirmed active global preferences under the configured effective token budget, with whole-payload fail-closed overflow behavior and an explicit no-usable-budget notice. The byte-length comparison is an estimate, not exact tokenization or remaining-context measurement.

Validation details: [feature record](../features/memory/global-preference-injection-budget.md) and [ADR-044](../decisions/ADR-044-configurable-preference-injection-budget.md).

Status: VALIDATED, not SHIPPED. Fresh independent `worker-verify` returned overall PASS with criteria 1–7 each PASS. Focused worker reports: prompt/serializer 63/63; plugin system-transform 48/48; workflow settings core 47/47; CLI 8/8; Dashboard API 33/33; Settings UI 4/4.

The initial `npm test` had 656 passed and one README CLI usage parity failure. `worker-debug` identified the README omission; `worker-code` added the two metadata-exact budget set/clear forms and inheritance text. `node --test cli/command-metadata.test.js` passed, and corrected `npm test` passed 657/657. `npm run build` passed (production Dashboard Vite build and CLI sync); `npm run check-cli` passed (bundle matches canonical); pre-record `npm run specs:validate` passed with 242 Markdown files, 95 feature specs, 44 ADRs, and 273 local links; `git diff --check` passed. The independent verifier first passed specs validation and returned overall PASS after inspecting the feature and proof sources.

Synthetic fixtures only; no actual vault contents were inspected or changed. No commit, push, deployment, release, or shipping occurred. Separate Memory architecture work remains TASKED.
