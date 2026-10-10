# Project State

Last updated: 2026-10-09 (deterministic `.specs` record command planned)

## Per-skill status
| Skill | Status |
|---|---|
| guarana:plan | SHIPPED |
| guarana:build | SHIPPED |
| guarana:code | VALIDATED — design/refactoring guidance update |
| guarana:verify | SHIPPED |
| guarana:remember | SHIPPED |
| guarana:debug | SHIPPED (optional, trigger-only) |
| guarana:measure | SHIPPED (optional, trigger-only) |
| guarana CLI | VALIDATED — update output polish |
| guarana dashboard | VALIDATED — live Activity and Advisor history view |
| guarana memory | **FINAL GATE PASSED** + hardening batch applied |
| guarana orchestrator | **SPECIFIED → IMPLEMENTED → VALIDATED** |
| Guarana native worker dispatch | **VALIDATED** |
| Guarana release readiness | **VALIDATED** |
| Guarana 1.0.0 candidate preparation | **VALIDATED** |
| Guarana automatic skill creation | **VALIDATED** |
| Guarana skill routing clarity | **VALIDATED** |
| Guarana optional model advisor | **VALIDATED** — UI criteria 11–14 and ADR-027 runtime proof |

## Current step
VALIDATED: User-requested global update and plugin install are complete; independent worker-verify PASS confirms the global 1.1.0 skill suite, current global plugins, and healthy engines. Advisor settings remain incomplete, running OpenCode needs restart, and the read-only project check still reports its memory plugin stale; project scope was untouched. No code/configuration changes or release are claimed.

## Previous validated correction — Activity root selection
**Activity root-selection correction (2026-10-08) — VALIDATED.** `rootSessionFrom()` filters child sessions, chooses an observed busy/running root first, and otherwise uses greatest `end`/last activity rather than start order. Advisor call lookup remains scoped to that root's `parentSessionID`. Focused Activity tests pass 2/2. Independent worker-verify `ses_ee14cc5aaffexxrn2km3Um7Tuf` passed Chromium 375×812 with helper roots and an Advisor child ordered ahead of the actual root; it showed the busy root, correct Advisor call/model, root-only memory/events, modal history/Escape/backdrop/focus behavior, and no overflow. Screenshot: `/tmp/opencode/activity-root-fix-375.png`. Full suite/build/CLI/spec checks passed; see `.specs/changes/2026-10-08-activity-root-selection.md`.
**Dashboard real-time Activity view (2026-10-08) — VALIDATED.** The `#/now` route is labeled Activity; paired root/Advisor work areas, workflow flow, safe recent activity, root-injected memory, and Advisor history modal are independently verified. Runtime instrumentation supplies busy/session and Advisor dispatch/completion evidence; Models remains configuration-only. Worker-verify `ses_ee1646f18ffe9eLPHP4MpHYGNx` passed rendered 375px checks, root selection when the child is newer, busy status, memory filtering, modal Escape/backdrop close and focus restoration, no raw error display, and no overflow. `npm test` 264/264, build/sync, check-cli, specs validation, and diff check pass. Proof: `.specs/changes/2026-10-08-live-activity-view.md`.

## Previous task — Advisor runtime proof (validated)
**Advisor runtime proof (2026-10-08) — VALIDATED with live child execution.** After refreshing project plugins and reloading OpenCode, a native Advisor Task returned child session `ses_ee18381a9ffe1ZVwyYLf4B7FVu`. Telemetry contains completed `advisor-execution` events linked to parent `ses_ee39ce5c0ffeA5wDL8irBmzskV`, with observed `providerID=openai`, `modelID=gpt-5.6-luna`, `variant=xhigh`; these match project configuration. The child emitted multiple completed assistant turns, each recording the same model/variant. Independent 375px panel, telemetry/API/source tests, full suite/build/check-cli/spec checks pass. No provider-side attestation beyond OpenCode child message metadata is claimed.

## Previous task — Advisor Models UI/variant follow-up (validated)
**Advisor Models UI/variant follow-up (2026-10-08) — VALIDATED.** Primary/Advisor provider/model searches and one editable variant listbox per role are independently verified. Primary selected `medium` into the exact OpenRouter model and saved it unchanged; Advisor model lookup 503 remained non-blocking, custom `custom-r` saved, and blank omitted the variant. At 375px the open list has no overflow; 1280px retains two role columns. Criteria 11–14 passed; fixture-backed profile proof preserves exact IDs/variants. Real OpenCode/auth is unavailable on this host. Full suite/build/check-cli/spec validation pass; final proof is `.specs/changes/2026-10-08-advisor-models-variant-listbox.md`.
**Earlier harness diagnostic (superseded):** A temporary primary-context harness initially showed no second PUT after its first save; worker-debug `ses_ee1f53218ffekoUraq6DEAlHZe` found the element listeners were stale, so this did not establish a product defect.
**Earlier verifier attempts (superseded by the PASS evidence above):** Sessions `ses_ee1f11a97ffe0XioqPMDXisKV6`, `ses_ee1ec9296ffePpmXosBwzDH5VF`, `ses_ee1e2db2bffexrC5F4NV4gM6sF`, and related worker-debug sessions had incomplete screenshot, fixture, or hit-target evidence. The completed Primary and Advisor runs recorded below supersede those attempts.

**Acceptance:** Criteria 11–14 in `.specs/features/orchestrator/advisor-flow.md`: exact ID round-trip; searchable provider/model controls; one editable variant input per role with model-specific OpenCode suggestions and custom manual values; no duplicate input or explicit default option; accessible 375px ledger layout and independent proof. Base criteria 1–10 remain validated.

**Scope:** Rework Models page UX: searchable provider/model comboboxes, clear role hierarchy, exactly one searchable/editable variant input per role with an accessible OpenCode-backed suggestion list and custom values, tests, ADR-025/026 and proof/change. Preserve ledger palette/type/hairline rules, credential boundary, ordinary chats, and advisor runtime.

**Browser smoke:** Playwright against Vite with mocked API selected OpenRouter model `~anthropic/claude-fable-latest`, variant `xhigh`, and OpenAI `gpt-6-luna`; captured exact save payload. At 375px: document width 375, no overflow, two variant inputs total, no explicit default choice, all form controls within viewport. At 1280px the two role sections render side by side. Screenshots: `/tmp/opencode/models-redesign-375.png` and `/tmp/opencode/models-redesign-1280.png`. This is implementation smoke only, not real OpenCode/profile verification.

**Pending writes:** Independent verification of `worker-specs` remains pending. The previously pending Advisor reason live capture is validated in `.specs/changes/2026-10-08-advisor-consultation-reason.md`. Release/tag decision remains separate.

**Previous checkpoint:** `guarana update` CLI presentation (2026-10-08) validated; proof in `.specs/changes/2026-10-08-cli-update-presentation.md`.

## Previous checkpoint — Guarana 1.0.0 candidate (2026-10-07)
Validated before this task: the post-bootstrap-fix release gate, final archive, provider-backed smoke, plugin/status/dashboard checks, and uninstall passed. Independent worker-verify `ses_ee737f1aaffeL1oEwBUZ1AeEs8` passed five release criteria. Candidate remains local, unpublished, and untagged. Detailed evidence is in `.specs/features/release/release-candidate-1.0.0-smoke.jsonl` and `.specs/changes/2026-10-07-release-candidate-1.0.0.md`.

## Checkpoint
- Models page-wide UX/UI/DX overhaul is VALIDATED as of 2026-10-09.
- Goal: Record the final independent verification of the Models page overhaul.
- Independent worker-verify passed all nine criteria, including live Playwright/Chromium proof at 375x812; the earlier criterion-8 failure is superseded while its history remains in the feature record.
- The provider/model mismatch guard and event-level regression coverage are complete. A different project Provider without an explicit project Model blocks save; same-provider inherited Model is allowed; catalog selection or manual-ID confirmation clears the guard. No API change was made.
- Browser proof confirms 375px document/body width, 351px content scroll/client widths for the Models sections and discovery areas, stacked grids, no clipped Models descendants, visible keyboard focus, polite status announcement, and reduced-motion behavior. Global navigation's horizontal scrolling is intentional; page content does not overflow.
- Detailed proof and check outcomes: `changes/2026-10-09-models-page-overhaul.md`. Shipping was not confirmed; status is VALIDATED, not SHIPPED.
- Budget: ADR-005 defaults.

## Proofs that exist
Task-1 proofs for all 7 skills in `.specs/features/guarana/proofs/`; all acceptance criteria mapped; worker-verify PASS on every skill. CLI acceptance: 6/6 checks PASS (recorded in changes/2026-08-21-cli.md). Release readiness evidence is in `changes/2026-10-02-release-readiness.md`; 1.0.0 candidate evidence and revalidation follow-up are in `changes/2026-10-07-release-candidate-1.0.0.md` and `features/release/release-candidate-1.0.0-smoke.jsonl`. Spec lifecycle write proof: `changes/2026-10-03-spec-lifecycle-writes.md`. Automatic skill-creation proof: `changes/2026-10-05-automatic-skill-creation.md`, `changes/2026-10-05-skill-trigger-guidance.md`, and validated routing clarity in `changes/2026-10-07-skill-routing-clarity.md`. Native Task worker dispatch proof is in `changes/2026-10-07-native-task-worker-dispatch.md` and `features/orchestrator/subagent-dispatch-smoke.jsonl`. Dashboard skill-scope count proof: `changes/2026-10-05-dashboard-skill-scope-counts.md`.

## BLOCKED
Final 1.0.0 candidate is validated; publishing/tagging remains a separate maintainer action. Budget numbers remain ADR-005 defaults pending human override (deferred Rule-0 item, recorded).
