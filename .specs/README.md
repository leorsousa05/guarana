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

| guarana CLI | **SHIPPED** | [spec](features/guarana/cli.md) | [2026-08-21](changes/2026-08-21-cli.md) |
| guarana dashboard | **SHIPPED** | [spec](features/guarana/dashboard.md) | [2026-08-21](changes/2026-08-21-dashboard.md) |

**DONE:** all 7 skills specified, audited, implemented, validated (worker-verify PASS per skill), shipped.
**HUMAN FINAL GATE PASSED 2026-08-21** — evidence in `../human-gate-validation.md`; 4 observations accepted as reconciled. All 7 skills: **HUMAN-VERIFIED / CLOSED**. Build closed.
**NEXT:** none. Optional future work: description trigger-optimization pass; npm publish of the CLI. Plan skill received a cold-start addendum 2026-08-21 (AC4, worker-verify PASS).
**BLOCKED:** nothing.

## Index
- [project.md](project.md) — build contract, hard truths, Rule 0
- [architecture.md](architecture.md) — progressive disclosure, subagent topology, budgets
- [conventions.md](conventions.md) — naming, vague-word ban, proof-before-commit
- [glossary.md](glossary.md) — terms
- [state/](state/) — [project-state](state/project-state.md) · [known-issues](state/known-issues.md)
- [features/guarana/](features/guarana/) — [overview](features/guarana/overview.md) + 7 specs + [proofs/](features/guarana/proofs/) + [audits/](features/guarana/audits/)
- [decisions/](decisions/) — ADR-001…006 (append-only)
- [changes/](changes/) — validated change ledger
- [archive/](archive/) — superseded artifacts
- Runtime suite: `../skills/guarana/` · Knowledge: `../docs/reference/`
