# Change — Dashboard Activity OpenCode active worker details

**Status: VALIDATED — fresh independent worker-verify overall PASS for criteria 1–5; not SHIPPED.**

## Outcome

`GET /api/opencode/active-subagents` preserves `{available,runningCount}` and additively returns bounded active `workers`. The server filters distinct explicitly parent-linked sessions in matching `busy`/`running` state with conservative agent identity, projects valid created/updated times and at most 20 safe matching telemetry events, and uses random process-local UUID selection keys while keeping raw IDs in memory only. Titles, prompts, messages, outputs, reasoning, event payloads, errors, and private fields are not exposed.

Activity adds selectable OpenCode active-worker rows and selected metadata/timeline details, or a truthful empty state. It preserves aggregate authority/fallback, telemetry tree/history, Advisor behavior, and styling/accessibility. The terminal selected-detail eligibility fix lets completed history open when no active panel is visible, while nonterminal/active details remain gated so authoritative zero continues to suppress stale active detail.

## Independent verification and checks

- Fresh final independent `worker-verify` overall PASS for criteria 1–5, including two completed-history browser scenarios.
- `node --test dashboard/server/routes/opencode.test.js dashboard/web/src/components/Activity.test.mjs` — PASS 17/17.
- `npm test` — PASS 619/619; nonfatal Vite WebSocket port-in-use and Node module-type warnings.
- `npm run build` — PASS; Dashboard bundle built and CLI synced. `npm run check-cli` — PASS and independently rerun. `git diff --check` — PASS.
- Browser report `guarana-activity-opencode-active-details-375.json` (mode 0600, aggregate-only synthetic-fixture evidence) — PASS at 375x812. It confirms two active-worker rows, keyboard selection and visible focus, safe activity rows and honest no-activity state, opaque keys and allowlisted API fields without raw IDs/private sentinels, and no horizontal overflow or page errors. This report was temporary local synthetic-fixture evidence and is not included in the repository.
- Browser proof also confirms completed detail opens with no active child and zero count, and at authoritative zero while stale active detail is suppressed before click; events and the zero notice remain visible, without private payload, overflow, or page errors.
- Pre-record `npm run specs:validate` — PASS: 213 Markdown, 82 feature specs, 39 ADRs, 241 links, 0 issues. The `specs record` transaction also validated successfully with 213 files and 0 issues.
- Post-record `npm run specs:validate` — PASS after all record writes: 214 Markdown files, 82 feature specs, 39 ADRs, 242 local links, 0 issues. `git diff --check` — PASS.

## Boundary

This is synthetic-fixture/browser and code evidence, not live Task integration for per-agent details, deployment, or shipping. No plugin/profile/install/reload/restart, raw capture, or user-data export occurred. The completed-history selection issue is resolved narrowly; broader Activity lifecycle telemetry/deployment work remains separate and pending.
