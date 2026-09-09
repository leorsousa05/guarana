# .specs — Guarana System of Record

The single source of truth for the guarana build. Memory is on disk, not in context (ADR-004). Restore order every run: this file → `state/project-state.md` → `decisions/*` → current feature spec.

## Master tracker
Status pipeline: SPECIFIED → TASKED → IMPLEMENTED → VALIDATED → SHIPPED

| Skill | Status | Proof | Change |
|---|---|---|---|
| guarana:plan | **SHIPPED** | [proofs](features/guarana/proofs/plan-proofs.md) | [2026-08-21](changes/2026-08-21-plan.md) · [cold-start](changes/2026-08-21-plan-coldstart.md) · [cold-start v2](changes/2026-08-21-plan-coldstart-v2.md) |
| guarana:build | **SHIPPED** | [proofs](features/guarana/proofs/build-proofs.md) | [2026-08-21](changes/2026-08-21-build.md) |
| guarana:code | **SHIPPED** | [proofs](features/guarana/proofs/code-proofs.md) | [2026-08-21](changes/2026-08-21-code.md) |
| guarana:verify | **SHIPPED** | [proofs](features/guarana/proofs/verify-proofs.md) | [2026-08-21](changes/2026-08-21-verify.md) |
| guarana:remember | **SHIPPED** | [proofs](features/guarana/proofs/remember-proofs.md) | [2026-08-21](changes/2026-08-21-remember.md) |
| guarana:debug (optional) | **SHIPPED** | [proofs](features/guarana/proofs/debug-proofs.md) | [2026-08-21](changes/2026-08-21-debug.md) |
| guarana:measure (optional) | **SHIPPED** | [proofs](features/guarana/proofs/measure-proofs.md) | [2026-08-21](changes/2026-08-21-measure.md) |

| guarana CLI | **SHIPPED** | [spec](features/cli/cli.md) | [2026-08-21](changes/2026-08-21-cli.md) |
| guarana dashboard | **SHIPPED** | [spec](features/dashboard/dashboard.md) | [2026-08-21](changes/2026-08-21-dashboard.md) · [bugfix](changes/2026-08-22-dashboard-bugfix.md) |
| guarana memory | **ALL 6 SLICES VALIDATED (6/6)** · **FINAL GATE PASSED** | [spec](features/memory/memory.md) | [1](changes/2026-08-30-memory-slice1.md) · [2](changes/2026-08-30-memory-slice2.md) · [3](changes/2026-08-30-memory-slice3.md) · [4](changes/2026-08-30-memory-slice4.md) · [5](changes/2026-08-30-memory-slice5.md) · [6](changes/2026-08-31-memory-slice6.md) |
| guarana orchestrator | **SPECIFIED → IMPLEMENTED → VALIDATED** | [spec](features/orchestrator/orchestrator.md) | [2026-08-31](changes/2026-08-31-orchestrator.md) · [automatic bootstrap](changes/2026-09-09-automatic-workflow.md) |

**DONE:** all 7 skills specified, audited, implemented, validated (worker-verify PASS per skill), shipped. Memory feature **closed** — 6/6 slices + deployability fix + human final gate PASSED. Automatic orchestrator **implemented + validated** — always-on state machine (`idle/planning/building/coding/verifying/debugging/completed`), automatic plugin installation, idempotent `.specs`/memory bootstrap, bounded confirmed-memory injection, completion recording, auto-routes verify-fail → debug → re-verify, explicit `guarana:*` still forces a step; dashboard Workflow panel added.
**HUMAN FINAL GATE PASSED 2026-08-21** — evidence in `../human-gate-validation.md`; 4 observations accepted as reconciled. All 7 skills: **HUMAN-VERIFIED / CLOSED**. Build closed.
**NEXT:** commit + push orchestrator batch (dashboard Workflow panel, orchestrator engine/plugin deployed).
**BLOCKED:** nothing.

## Index
- [project.md](project.md) — build contract, hard truths, Rule 0
- [architecture.md](architecture.md) — progressive disclosure, subagent topology, budgets
- [conventions.md](conventions.md) — naming, vague-word ban, proof-before-commit
- [glossary.md](glossary.md) — terms
- [state/](state/) — [project-state](state/project-state.md) · [known-issues](state/known-issues.md)
- [features/](features/) — [overview](features/overview.md) + [guarana/](features/guarana/) (7 specs + [proofs/](features/guarana/proofs/) + [audits/](features/guarana/audits/)) + [cli/](features/cli/) + [dashboard/](features/dashboard/) + [orchestrator/](features/orchestrator/)
- [decisions/](decisions/) — ADR-001…010 (append-only)
- [changes/](changes/) — validated change ledger
- [archive/](archive/) — superseded artifacts
- Runtime suite: `../skills/guarana/` · Knowledge: `../docs/reference/`
