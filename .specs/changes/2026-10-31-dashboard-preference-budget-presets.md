# Change — Dashboard preference-injection budget presets

**Status: VALIDATED — not SHIPPED.**

## Outcome

Dashboard Settings presents the preference-injection budget choices as Automatic (unset), Less (1024), Medium (4096), and More (8192). Existing non-preset integers appear as `Custom (N)`, while integer configuration, API, and CLI behavior remains unchanged. Global Automatic unsets the value; Project Automatic clears the project override and inherits Global. The effective value/source and clear-to-inherit behavior remain visible.

The Project Automatic regression test writes a project-scope draft after clearing 1024 and uses the actual workflow settings writer/reader to confirm that no project memory override remains and that effective Global is 6144 with source `global`.

## Independent verification and checks

- Fresh independent `worker-verify` overall PASS, criteria 1–6.
- `node --test dashboard/web/src/components/Settings.test.mjs` — PASS 7/7.
- `npm test` — PASS 707/707; nonfatal Vite WebSocket port-in-use and Node module-type warnings.
- `npm run build` — PASS, 60 modules; canonical and CLI assets synced. `npm run check-cli` — PASS.
- Pre-record `node bin/guarana.js specs validate . --json` — PASS: 254 files, 100 feature specs, 46 ADRs, 292 links, 0 issues.
- `git diff --check` — PASS.
- The verifier did not claim real-browser interaction; its proof was component source/SSR and tests.

## Boundary

This slice is VALIDATED, not SHIPPED. No release, version, commit, or push changes are included in this closeout.
