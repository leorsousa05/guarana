# .specs — Guarana System of Record

The single source of truth for the guarana build. Memory is on disk, not in context (ADR-004). Restore order every run: this file → `state/project-state.md` → `decisions/*` → current feature spec.

## Master tracker
Status pipeline: SPECIFIED → TASKED → IMPLEMENTED → VALIDATED → SHIPPED

| Skill | Status | Proof | Change |
|---|---|---|---|
| guarana:plan | **SHIPPED** | [proofs](features/guarana/proofs/plan-proofs.md) | [2026-08-21](changes/2026-08-21-plan.md) · [cold-start](changes/2026-08-21-plan-coldstart.md) · [cold-start v2](changes/2026-08-21-plan-coldstart-v2.md) · [adaptive discovery](changes/2026-09-28-adaptive-requirements-discovery.md) |
| guarana:build | **SHIPPED** | [proofs](features/guarana/proofs/build-proofs.md) | [2026-08-21](changes/2026-08-21-build.md) |
| guarana:code | **SHIPPED** | [proofs](features/guarana/proofs/code-proofs.md) | [2026-08-21](changes/2026-08-21-code.md) |
| guarana:verify | **SHIPPED** | [proofs](features/guarana/proofs/verify-proofs.md) | [2026-08-21](changes/2026-08-21-verify.md) |
| guarana:remember | **SHIPPED** | [proofs](features/guarana/proofs/remember-proofs.md) | [2026-08-21](changes/2026-08-21-remember.md) |
| guarana:debug (optional) | **SHIPPED** | [proofs](features/guarana/proofs/debug-proofs.md) | [2026-08-21](changes/2026-08-21-debug.md) |
| guarana:measure (optional) | **SHIPPED** | [proofs](features/guarana/proofs/measure-proofs.md) | [2026-08-21](changes/2026-08-21-measure.md) |

| guarana CLI | **SHIPPED** | [spec](features/cli/cli.md) | [2026-08-21](changes/2026-08-21-cli.md) · [specs validator](changes/2026-09-28-specs-validator.md) |
| guarana dashboard | **VALIDATED** | [spec](features/dashboard/dashboard.md) · [skill scope counts](features/dashboard/skill-scope-counts.md) | [2026-08-21](changes/2026-08-21-dashboard.md) · [bugfix](changes/2026-08-22-dashboard-bugfix.md) · [injected-memory brain](changes/2026-09-28-memory-injection-view.md) · [deduplicated injection](changes/2026-09-28-memory-injection-dedup.md) · [global memory graph](changes/2026-09-28-global-memory-graph.md) · [UX pass](changes/2026-09-28-dashboard-ux-pass.md) · [layout refinement](changes/2026-09-28-dashboard-layout.md) · [graph stability](changes/2026-09-28-memory-graph-stability.md) · [Specs and Workflow layout](changes/2026-09-28-specs-workflow-layout.md) · [compact Specs and interactive Workflow](changes/2026-09-28-specs-modal-workflow-phases.md) · [cross-instance memory injection](changes/2026-09-28-memory-injection-cross-instance.md) · [skill scope counts](changes/2026-10-05-dashboard-skill-scope-counts.md) |
| guarana memory | **ALL 6 SLICES VALIDATED (6/6)** · **FINAL GATE PASSED** | [spec](features/memory/memory.md) | [1](changes/2026-08-30-memory-slice1.md) · [2](changes/2026-08-30-memory-slice2.md) · [3](changes/2026-08-30-memory-slice3.md) · [4](changes/2026-08-30-memory-slice4.md) · [5](changes/2026-08-30-memory-slice5.md) · [6](changes/2026-08-31-memory-slice6.md) · [typed links](changes/2026-09-27-memory-typed-links.md) · [completion memory](changes/2026-09-27-no-completion-memory.md) · [intent capture](changes/2026-09-28-intent-driven-memory.md) |
| guarana orchestrator | **SPECIFIED → IMPLEMENTED → VALIDATED** | [spec](features/orchestrator/orchestrator.md) | [2026-08-31](changes/2026-08-31-orchestrator.md) · [automatic bootstrap](changes/2026-09-09-automatic-workflow.md) · [spec lifecycle writes](changes/2026-10-03-spec-lifecycle-writes.md) |
| Guarana release readiness | **VALIDATED** | [spec](features/release/release-readiness.md) | [2026-10-02](changes/2026-10-02-release-readiness.md) |
| Guarana automatic skill creation | **VALIDATED** | [spec](features/skills/automatic-skill-creation.md) | [ADR-019](decisions/ADR-019-intent-driven-skill-creation.md) · [2026-10-05](changes/2026-10-05-automatic-skill-creation.md) |

**DONE:** all 7 skills specified, audited, implemented, validated (worker-verify PASS per skill), shipped. Memory feature **6/6 slices validated**; intent-driven project/global capture and session-deduplicated injection are implemented and verified. The `guarana specs validate` deterministic `.specs` check is implemented. Automatic orchestrator **implemented + validated** — always-on state machine (`idle/planning/building/coding/verifying/debugging/completed`), automatic plugin installation, idempotent `.specs`/memory bootstrap, bounded confirmed-memory injection, auto-routes verify-fail → debug → re-verify, explicit `guarana:*` still forces a step; dashboard Workflow and memory-injection views added. Spec lifecycle writes are explicit in the plan skill and always-on workflow prompt; source and CLI skill bundles are synchronized and the installed global skill was refreshed (2026-10-03). Release readiness is validated: clean npm package smoke, Node 22/24 tests/builds, zero dashboard audit findings, CI workflow, MIT license, changelog, and OpenCode 1.18.34 plugin/skill discovery smoke. Automatic reusable-skill creation with assistant-selected global/project scope and a scoped dashboard Skills view is validated. Dashboard skill-scope counts are implemented and independently validated; reusable dashboard change instructions are in `.opencode/skills/dashboard-change-process/SKILL.md`.
**HUMAN FINAL GATE PASSED 2026-08-21** — evidence in `../human-gate-validation.md`; 4 observations accepted as reconciled. All 7 skills: **HUMAN-VERIFIED / CLOSED**. Build closed.
**NEXT:** Run the provider-backed fresh-session smoke from `RELEASING.md` on the 1.0.0 candidate before publishing/tagging.
**BLOCKED:** nothing.

## Index
- [project.md](project.md) — build contract, hard truths, Rule 0
- [architecture.md](architecture.md) — progressive disclosure, subagent topology, budgets
- [conventions.md](conventions.md) — naming, vague-word ban, proof-before-commit
- [glossary.md](glossary.md) — terms
- [state/](state/) — [project-state](state/project-state.md) · [known-issues](state/known-issues.md)
- [features/](features/) — [overview](features/overview.md) + [guarana/](features/guarana/) (7 specs + [proofs/](features/guarana/proofs/) + [audits/](features/guarana/audits/)) + [cli/](features/cli/) + [dashboard/](features/dashboard/) + [orchestrator/](features/orchestrator/) + [release/](features/release/) + [skills/](features/skills/)
- [decisions/](decisions/) — ADR-001…019 (append-only)
- [changes/](changes/) — validated change ledger
- [archive/](archive/) — superseded artifacts
- Release process: `../RELEASING.md` · Changelog: `../CHANGELOG.md` · Runtime suite: `../skills/guarana/` · Knowledge: `../docs/reference/`
