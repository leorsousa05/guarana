# ADR-001 — Project root name is guarana

**Status:** Accepted (2026-08-21) · append-only

## Context
The suite needs a stable root identity used by the namespace, paths, and all specs.

## Decision
The project name is **guarana** — final. It names the suite (`skills/guarana/`), the namespace (`guarana:*`), and the ledger feature (`.specs/features/guarana/`). Never renamed.

## Tradeoffs
- A fixed name removes a whole class of rename churn across proofs, ADRs, and specs.
- Cost: the name is arbitrary; meaning must be carried by docs, not the name.

## Rule-0 record
Rule-0 answers collected 2026-08-21: markdown-only skill repo consumed by OpenCode itself; runtime = OpenCode on this machine; verifier = layered (worker-verify technical gate, human final gate); budgets = three separate (per-run, per-subagent, main-thread) with defaults proposed here and recorded in ADR-005, human may override; deferred answers permitted and recorded, build proceeds.
