# Change — Dashboard Activity OpenCode running status

**Status: VALIDATED — local source behavior and aggregate-only runtime integration; not SHIPPED.**

## Outcome

The additive `GET /api/opencode/active-subagents` endpoint uses bounded `execFile` calls with an explicit project working directory to query authenticated public OpenCode session projections. It counts only distinct explicit parent-linked agent sessions whose matching active-map state is busy or running, and returns only `{available,runningCount}` or `{available:false,runningCount:0}`. Raw output, errors, identifiers, and other session data are not exposed or stored.

Activity treats a valid OpenCode count, including zero, as authoritative and uses the existing telemetry count only as fallback. If OpenCode reports a positive count without telemetry details, Activity displays an accurate `role=status` notice without fabricated rows. Existing telemetry rows, details, completed history, and API contracts remain intact.

## Independent verification and checks

- Fresh independent `worker-verify` overall PASS for criteria 1–5.
- `node --test dashboard/server/routes/opencode.test.js dashboard/web/src/components/Activity.test.mjs` — PASS 13/13.
- `npm test` — PASS 617/617; nonfatal Vite WebSocket port-in-use warnings.
- `npm run build` — PASS; Dashboard build and canonical-to-CLI bundle sync completed. `npm run check-cli` — PASS; CLI bundle matches canonical sources.
- `git diff --check` — PASS.
- Independent runtime integration observed only sanitized `{available:true,runningCount:1}` while its native Task was active; no identifiers or raw output were disclosed.
- Browser report `guarana-activity-opencode-running-status-375.json` (mode 0600, aggregate-only) — PASS at 375×812: count 1, accessible active notice, no false empty notice, no fabricated session tree/detail, named Activity landmark, no document/body overflow, and zero page errors. This report was temporary local synthetic-fixture evidence and is not included in the repository.
- Pre-record `npm run specs:validate` — PASS: 211 Markdown files, 81 features, 39 ADRs, 240 links, 0 issues.

## Boundary

This closes local source behavior and the bounded runtime/browser proof only; it is not a global deployment or shipping claim. No plugin/profile/install/reload/restart action or raw telemetry capture occurred. The separate Activity lifecycle telemetry/deployment record and its TASKED/BLOCKED status are unchanged.
