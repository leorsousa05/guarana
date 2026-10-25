# Change — Dashboard Settings connected provider/model catalog loading

**Status: VALIDATED — source-validated; not SHIPPED.**

## Outcome

The Dashboard Settings catalog now parses the whitespace-aligned OpenCode auth listing while retaining the older bordered and glyph formats, maps `OpenCode Console` to provider ID `opencode`, and preserves exact connected provider/model IDs while excluding disconnected `ollama`. The catalog API retains the `{models,error}` schema and connected-provider metadata/privacy boundary. Primary and Advisor selectors use the catalog options and retain manual entry plus loading, error, and empty fallbacks.

Sanitized live `discoverModels({cwd:repoRoot})` returned 473 models from `openai`, `opencode`, and `openrouter`, with `error:null`. No raw auth output or credentials were retained.

## Independent verification and checks

- Fresh independent `worker-verify` overall PASS for all six criteria.
- Focused `node --test dashboard/server/app.test.js dashboard/web/src/components/Models.test.mjs cli/lib/opencode-model-catalog.test.js` — PASS 46/46.
- `npm test` — PASS 623/623; nonfatal Vite WebSocket port-in-use and Node module-type warnings.
- `npm run build` — PASS; Dashboard production build and CLI sync. `npm run check-cli` — PASS; bundle matches.
- `npm run specs:validate` — PASS: 229 Markdown files, 90 feature specs, 39 ADRs, 250 links, 0 issues. The independent verifier ran this before implementation review.
- `git diff --check` — PASS.
- Criterion review passed whitespace-aligned and old auth formats; provider alias and exact connected IDs; catalog schema and metadata privacy; Primary/Advisor selector sources/options and manual/loading/error/empty fallback tests; and sanitizer/privacy regression.
- Browser interaction was unavailable because browser automation was unavailable. The independent verifier instead reviewed component source, SSR, and selector/manual-fallback tests; no browser interaction is claimed.

## Boundary

This is source validation only. No release, publication, shipping, commit, push, or version change occurred.
