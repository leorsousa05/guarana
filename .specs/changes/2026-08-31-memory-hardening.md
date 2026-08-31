# 2026-08-31 — memory hardening & enhancement batch

Source: reviewed the memory engine, plugin, installer, and CLI after the final gate closed; applied robustness/security/usability improvements. All verified by worker-verify (independent) with `npm test` 112/112 and `npm run check-cli` PASS.

## Changes

1. **Telemetry now flags tool failures (fixes the bug that masked the deploy issue).**
   `plugin/guarana-telemetry.js` `resultError()` detects error results whether the tool output is an object `{error}`, a nested `{ output|result }`, or a JSON-string result from a custom tool. Previously a `memory_*` tool returning `{"error":…}` (string) was recorded as `ok:true` — so the "memory engine not available" failure was invisible to telemetry. Now `ok:false` + `error`.

2. **Atomic JSONL writes.** `writeJsonl` (`memory/vault.js`) writes to a same-dir temp file then `rename()`s over the target, preventing torn/partial writes on the read-modify-write paths (updateNode, removeNode, compact, import, prune). Appends (addNode/addEdge) remain append-only.

3. **Embedding provider allowlist (security).** `embeddingProvider` no longer resolves via arbitrary `import()` of a config-controlled path (which could stage code from `config.json`). `memory/search.js` only imports ids in the `EMBEDDING_PROVIDERS` allowlist; anything else falls back to TF-IDF. Test forces a marker-drop provider module and asserts it is never imported.

4. **Unicode/multilingual tokenizer.** `memory/search.js` keeps letters/digits in any script (`\p{L}`/`\p{N}`) and folds diacritics, so PT queries like "resolucao" match "resolução". Search text now also indexes `input/output/decision/rejectedAlternatives` for better recall.

5. **Vault growth guard.** Config gains `maxNodes` (default 20000, `null` disables); `guarana memory status` prints a compaction/prune warning when exceeded.

6. **CLI command tests.** New `cli/commands/memory.test.js` (faithful end-to-end via `spawnSync` of `bin/guarana.js`): init idempotency, status + breakdown + maxNodes warning, search confirmed-only + folded-unicode matching, review confirm/discard, export/import, compact/prune. Registered in the `npm test` glob in `package.json`.

7. **Plaintext-at-rest caveat documented** in `exportVault` metadata + spec note; test asserts a vault written via `memory_save_decision` exports without raw secrets.

## Files
- `plugin/guarana-telemetry.js` (+ test)
- `memory/vault.js`, `memory/search.js` (+ tests in `memory/memory.test.mjs`)
- `cli/commands/memory.js`, `cli/commands/memory.test.js` (new)
- `package.json` (test glob)
- bundle re-synced (`npm run sync-cli`); engine re-deployed (`guarana plugin install`)

## Verification
- `npm test` → 112 pass / 0 fail
- `npm run check-cli` → PASS
- Manual CLI smoke: folded PT search, maxNodes warning, draft exclusion all confirmed.