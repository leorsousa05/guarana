# Guarana — Project Contract

## What guarana is
Guarana is an installable AI skill suite for OpenCode that implements the PCI/Rx-Act paradigm of **AI Loop Engineering**: the disciplined design of an agent's inner loop (Perceive → Think → Act → Observe) and the outer loop that supervises whole runs. The project contains only `skills/guarana/` (the runtime suite) and this `.specs/` ledger (the single system of record).

## Project goal
Give any OpenCode agent a rigorously-specified, progressively-disclosed skill suite that makes agent runs stoppable, verifiable, and memorable — with all state on disk, never in context.

## Definition of "done" for the suite
- All 7 skills (5 core + 2 optional) written to OpenCode's skill schema and validated.
- Every acceptance criterion in every feature spec mapped to a written proof.
- `.specs/README.md` shows every skill at SHIPPED.
- The human final gate has accepted the suite.

## The skills
**Core (always available):** `guarana:plan`, `guarana:build`, `guarana:code`, `guarana:verify`, `guarana:remember`.
**Optional (loaded ONLY on trigger):** `guarana:debug` (fires only when a test fails or a run misbehaves), `guarana:measure` (fires only when tuning cost or reading telemetry).

## Build order (single-threaded, hard rule)
plan → build → code → verify → remember → debug → measure. Never start skill N+1 before skill N validates.

## Hard truths (encoded everywhere)
1. Stopping is checked by machinery, never by iterators. "Done" is a verifiable condition, never "looks complete".
2. The verifier is a SEPARATE agent from the implementer (verification split).
3. Memory is on disk, not in context. Only files survive between runs.
4. ALWAYS log the stop reason on every run; without it health can't be diagnosed.
5. If a result can't fail the loop's gate, the loop can't tell success from failure.

## Proof-before-commit rule
Every proof file entry is written BEFORE the commit slice for its task. Proofs are never retro-generated; committed proofs are never altered — only appended.

## ASK-first contract (Rule 0)
Before any build work, the agent must collect and record Rule-0 answers (repo, runtime, conventions, verifier, budgets, acceptance gate); unanswered items are recorded as ADRs and work proceeds only after the record exists.
