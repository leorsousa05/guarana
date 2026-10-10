# Changes Ledger

A change is recorded here ONLY after its validation passes. One dated file per validated feature.

Entry format: date · feature · what validated / failed / re-opened · proof path · next action.

## Records

### 2026-10-09 — global Guarana runtime update
- [Global runtime update handoff](2026-10-09-global-guarana-update-handoff.md) — global 1.1.0 skill suite, plugins, engines, and worker profiles refreshed; independent worker-verify PASS; Advisor restart/settings and stale project-plugin caveats preserved; no code or release claim

### 2026-10-08 — CLI and coding-skill refinements
- [CLI update presentation](2026-10-08-cli-update-presentation.md) — terminal-aware completion summary, project/global runtime refresh tests, and independent verification PASS (3/3)
- [Code design/refactoring guidance](2026-10-08-code-design-guidance.md) — context-driven design-pattern selection and bounded refactoring; independent verification PASS (5/5)
- [Optional model advisor flow](2026-10-08-optional-model-advisor-flow.md) — CLI/dashboard model settings, opt-in primary/advisor command, bounded read-only Task handoff, XDG-aware artifacts, and independent verification PASS (7/7)
- [OpenCode connected-model catalog](2026-10-08-connected-model-catalog.md) — authenticated provider/model discovery in advisor CLI/dashboard; actual OpenCode auth output, canonical/mirrored APIs, and independent verification PASS
- [Advisor Models variant listbox](2026-10-08-advisor-models-variant-listbox.md) — searchable provider/model controls, one accessible selectable variant input per role, blank/default and custom values, responsive proof; independent criteria 11–14 PASS
- [Advisor runtime execution proof](2026-10-08-advisor-runtime-proof.md) — sanitized child-message provider/model/variant telemetry, parent correlation, and configured-versus-observed Dashboard Models display; source/API/UI verified, fresh loaded-plugin smoke pending
- [Live Activity view](2026-10-08-live-activity-view.md) — current root/Advisor work areas, workflow and injected memory, safe live activity, accessible Advisor history modal; independent 375px browser and full suite PASS
- [Activity root-session selection](2026-10-08-activity-root-selection.md) — prefers the observed busy root over newer-start idle helper sessions and scopes Advisor status by parent; independent regression browser and full suite PASS
- [Advisor consultation reason](2026-10-08-advisor-consultation-reason.md) — bounded Task-description reason in Activity/history; source/tests/full suite and live reason capture PASS

### 2026-10-07 — 1.0.0 release candidate
- [1.0.0 release candidate](2026-10-07-release-candidate-1.0.0.md) — local version metadata, audit-clean dashboard locks, packed CLI and provider-backed OpenCode 1.18.35 smoke; unpublished and untagged

### 2026-10-07 — native Task worker dispatch
- [Native Task worker dispatch](2026-10-07-native-task-worker-dispatch.md) — installed worker-code/verify/debug profiles, retained Task event/session evidence, parent-state isolation, project/global safety; independent verification PASS (6/6)

### 2026-10-07 — skill routing clarity
- [Skill routing clarity](2026-10-07-skill-routing-clarity.md) — distinct state-resume/memory-graph triggers, active-body and optional-skill routing regression coverage, OpenCode model behavior smoke; independent verification PASS (5/5 criteria)

### 2026-10-05 — automatic skill creation
- [Automatic skill creation and dashboard inventory](2026-10-05-automatic-skill-creation.md) — global/project skill capture, protected native storage, dashboard tabs, and independent verification PASS
- [Skill trigger guidance](2026-10-05-skill-trigger-guidance.md) — explicit reusable-procedure signals, no-create boundaries, memory distinction, and focused regression assertions

### 2026-10-05 — dashboard skill-scope counts
- [Dashboard skill-scope counts](2026-10-05-dashboard-skill-scope-counts.md) — API-backed Global/Project tab counts, preserved keyboard/responsive ledger behavior, synchronized bundles, and independent verification PASS

### 2026-10-03 — explicit spec lifecycle writes
- [Spec lifecycle writes](2026-10-03-spec-lifecycle-writes.md) — plan prompt requirements and installed skill synchronization; full suite 189/189, CLI bundle check PASS

### 2026-08-21 — suite build (7 skills)
- [plan](2026-08-21-plan.md) · [cold-start](2026-08-21-plan-coldstart.md) · [cold-start v2](2026-08-21-plan-coldstart-v2.md)
- [build](2026-08-21-build.md)
- [code](2026-08-21-code.md)
- [verify](2026-08-21-verify.md)
- [remember](2026-08-21-remember.md)
- [debug](2026-08-21-debug.md) · [measure](2026-08-21-measure.md)
- [features layout](2026-08-21-features-layout.md)
- [human final gate](2026-08-21-human-gate.md) — all 7 skills HUMAN-VERIFIED / CLOSED

### 2026-08-21 — CLI + dashboard
- [CLI](2026-08-21-cli.md)
- [dashboard design](2026-08-21-dashboard-design.md) · [dashboard](2026-08-21-dashboard.md)
- [dashboard bugfix](2026-08-22-dashboard-bugfix.md)

### 2026-10-02 — release readiness
- [1.0 release readiness](2026-10-02-release-readiness.md) — Node 22/24 support, reproducible npm package, OpenCode smoke, license, changelog, and known-issue cleanup

### 2026-08-30/31 — persistent memory
- [Slice 1](../features/memory/memory.md) engine + CLI — [2026-08-30-memory-slice1.md](2026-08-30-memory-slice1.md)
- [Slice 2](2026-08-30-memory-slice2.md) capture plugin
- [Slice 3](2026-08-30-memory-slice3.md) tools + review
- [Slice 4](2026-08-30-memory-slice4.md) compaction
- [Slice 5](2026-08-30-memory-slice5.md) web view
- [Slice 6](2026-08-31-memory-slice6.md) workflow integration + guarana:memory skill
- [Hardening batch](2026-08-31-memory-hardening.md) — telemetry ok-flag, atomic writes, provider allowlist, unicode tokenizer, maxNodes, CLI tests

## Status
Memory feature closed: 6/6 slices VALIDATED, final gate PASSED, hardening batch applied (112/112 tests, check-cli PASS). Pending: push `main` + human close of the hardening batch.
