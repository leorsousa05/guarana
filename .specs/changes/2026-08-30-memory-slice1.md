# Change: memory Slice 1 — engine + CLI

**Date:** 2026-08-30
**Feature:** [memory](../features/memory/memory.md) · Slice 1 of 4
**Stop reason:** condition-met (worker-verify PASS, final gate)

## What shipped
- `memory/` engine (ESM, zero deps): `vault.js` (init/export/import/config, `.gitignore` automation), `graph.js` (node/edge CRUD + schema validation, JSONL), `search.js` (structural filters + TF-IDF + pluggable embedding provider seam, confirmed-only), `security.js` (secret detection/redaction), `capture.js` (tool-call → draft atom, projectHash).
- `guarana memory init | status | search | export | import | prune` (`cli/commands/memory.js`, CJS → ESM dynamic import with repo-root/bundled resolver).
- Bundle wiring: `memory` → `cli/memory` in sync/check scripts; `memory/*.test.mjs` in `npm test` glob.

## Proofs
- `npm test` 46/46 PASS (incl. 20 engine tests).
- `npm run check-cli` PASS.
- Worker-verify gates: 3 rounds. Gate 1 FAIL (`sk-abc123def456` leak) → fixed `{16,}`→`{8,}`. Gate 2 FAIL (`ghp_16charstringxx` leak) → fixed `{20,}`→`{8,}` + full pattern-minimum audit. Gate 3 PASS: adversarial sweep 10/10 secrets rejected-or-redacted, 3/3 benign prose untouched, criteria 1–7 all independently reproduced.

## Not shipped (next slices)
- Slice 2: OpenCode capture plugin (`plugin/guarana-memory.js`, event hooks).
- Slice 3: 4 `memory_*` custom tools + draft→confirmed review workflow.
- Slice 4: automatic graph compaction (supernodes).
