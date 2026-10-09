# ADR-030 — Isolate human-readable spec updates

**Status:** Accepted (2026-10-09) · append-only

## Context

The plan and always-on workflow prompts require the primary conversation to read
and edit several overlapping `.specs` documents at each lifecycle checkpoint.
This consumes the main context and repeats file inspection and patch work.

## Decision

1. Add a hidden native Task worker, `worker-specs`, generated from a dedicated
   canonical procedure and installed with the other Guarana workers.
2. The primary retains ownership of requirements, acceptance, verification, and
   workflow transitions. It sends a compact factual handoff; the worker owns
   reading and editing human-readable `.specs` records and returns changed paths
   with validation status.
3. The worker records only supplied facts and exact proof, preserving unrelated
   content. Its skill body stays in the child profile, outside primary-context
   injection.
4. The primary confirms the reported write and validation through the worker
   result and the deterministic specs validator, without re-reading full records.

## Alternatives considered

- Keep manual primary-context edits — rejected because it preserves the reported
  context and repeated-patch cost.
- Generate every record with a deterministic CLI template — deferred because
  task-specific requirements and acceptance criteria require semantic input.
- Promise lower aggregate token use — rejected as unverifiable; this decision
  targets primary-context load, as explicitly accepted by the user.

## Consequences

- Native Task dispatch adds an isolated context, but keeps full spec text out of
  the main conversation.
- Plan, lifecycle, and verification procedures must supply enough compact facts
  for the worker to write accurately.
- Worker generation, installation, and workflow-routing tests protect the split.
