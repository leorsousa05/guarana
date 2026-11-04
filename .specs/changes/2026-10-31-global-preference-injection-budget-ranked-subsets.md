# Change — Global preference injection budget: priority-ranked subsets

**Status: VALIDATED — not SHIPPED.**

## Outcome

Global preference injection now considers complete eligible records in priority order: direct before related before superseded, then essential before normal and newest before older. Each record is included whole only when it fits the effective budget; oversized records are omitted without truncation and later candidates are still considered. Notices report included and omitted counts, with no-fit and no-budget behavior that does not emit preference content when none can be injected.

Dashboard Settings presets are Automatic (unset), Less (8192), Medium (32768), and More (65536); custom integer values remain preserved. Model-context minimum/fallback, trust and eligibility safeguards, one-hop boundaries, and session deduplication remain intact. The corrected Settings copy is present in the rebuilt Dashboard and CLI assets. No storage/schema/API/CLI setting contract change is included.

## Independent verification and checks

- Fresh independent `worker-verify` overall PASS, all 11 criteria. It also verified that a skipped record remains unclaimed and can be injected by a later transform in the same session, using a synthetic temporary vault.
- `npm test` — PASS 710/710; nonfatal Vite WebSocket port-in-use and Node module-type warnings.
- `npm run build` — PASS, 60 modules and CLI sync; `npm run check-cli` — PASS.
- Pre-record `npm run specs:validate` — PASS: 256 Markdown files, 100 features, 47 ADRs, 295 links, zero issues.
- `git diff --check` — PASS.
- Tests used temporary/synthetic fixtures only; no real vault was accessed or mutated. No real-browser interaction was performed.

## Boundary

This follow-up and the related Settings-copy issue are VALIDATED, not SHIPPED. No commit, push, version, or release action is claimed. The earlier same-date `2026-10-31-dashboard-preference-budget-presets.md` remains the historical validated receipt for its original preset slice.
