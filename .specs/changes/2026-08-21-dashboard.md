# Change: guarana dashboard — 2026-08-21

**Spec:** [features/dashboard/dashboard.md](../features/dashboard/dashboard.md)
**Status:** SHIPPED — human final gate accepted 2026-08-21

## What changed
- `plugin/guarana-telemetry.js` — OpenCode plugin, stdlib only (`node:fs`, `node:path`). Hooks `tool.execute.after`, `message.part.updated`, `event` (session.created/idle/error/compacted, todo.updated). Appends JSONL to `.specs/state/telemetry/events.jsonl`; never throws (verified against 32 garbage payloads).
- `.specs/state/telemetry/events.jsonl` — 15-event fixture across 2 sessions (demo data).
- `dashboard/` — npm workspaces; `server/` (Express, port 4200, `GUARANA_DASH_PORT` override; endpoints `/api/telemetry/summary`, `/api/telemetry/events`, `/api/specs/tracker`, `/api/specs/state`; serves built frontend) + `web/` (React+Vite, Runs and Specs tabs, 5s polling).

## Verification
- worker-verify round 1: 5/6 PASS; criterion 2 FAIL — `event(null)` threw on destructure (line 128).
- worker-code fix: one-line null guard; audited other hooks for the same pattern (none).
- worker-verify round 2: criterion 2 PASS. **Feature verdict: PASS.**

## Usage
- Plugin: copy/symlink `plugin/guarana-telemetry.js` into `.opencode/plugins/` of a project (or `~/.config/opencode/plugins/` globally).
- Dashboard: `cd dashboard && npm install && npm run build && npm start` from the repo root → http://localhost:4200.
