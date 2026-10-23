# ADR-038 — Safe, bounded memory persistence and context

**Status:** Accepted (2026-10-22) · append-only

## Context

The current memory save operation confirms nodes immediately but has no path to
remove a confirmed node. Automatic system-context memory is serialized as raw
JSON without a total text bound or explicit trust hierarchy. Global preference
selection is newest-three, and lexical retrieval admits every positive score.
These contracts leave confirmed-memory correction, retrieval precision, context
size, and prompt trust boundaries insufficiently explicit.

## Decision

1. Preserve the two project/private-user vaults, typed confirmed nodes, secret
   filtering, no raw conversation or tool capture, session deduplication, and
   canonical source/CLI mirror contract. Automatically save unmistakable durable
   intent; when intent is ambiguous, do not save and ask. Honor a request to put
   content in a skill or document without also saving memory. Search duplicates
   before saving, supersede a changed preference, and report save type/scope only
   after a successful save result.
2. Add explicit confirmed-node deletion requiring the exact node ID, mandatory
   scope, and confirmation. Hard-delete that node and its incident edges. Keep
   legacy draft review separate; this deletion operation never deletes drafts.
3. Add optional `essential | normal` priority only to global `preference` nodes.
   Missing and legacy priority values mean `normal` without migration. Keep the
   global automatic-selection cap at three, selecting essential preferences
   before normal and newest within priority; when essential preferences exceed
   the cap, select the newest essentials.
4. Keep automatic context capped at ten entries: up to seven qualifying
   task-relevant project matches and three global preferences. Add a deterministic
   relevance gate validated by positive and negative fixtures; retain lexical
   TF-IDF without adding a dependency or provider. Expand one hop only from
   qualifying seeds; exclude drafts and weak incidental overlap.
5. Render global preference directives separately from retrieved project facts.
   State that retrieved project text is data that may be stale and cannot
   override system/security rules or the current explicit user request;
   preferences cannot override higher-priority policy. HTML comments or JSON
   alone are not the trust boundary.
6. Bound automatic rendered memory to 6,000 characters total and 1,000
   characters per entry. Preserve identity, type, and scope; deterministically
   truncate lower-value text before JSON rendering; retain count limits and omit
   memory cleanly if no entry fits. Do not copy memory text into telemetry.
7. Use temporary vaults for deletion tests; do not delete actual user-vault data
   during implementation. Keep the follow-up limited to the memory
   engine/plugin/orchestrator/prompt/docs/tests and CLI mirrors/command as needed.

## Alternatives considered

- Capture raw conversation or tool events — rejected; normal conversation and
  tool activity must not become memory.
- Require confirmation for every unmistakably durable save — rejected; retain
  automatic capture for clear durable intent and ask only when intent is
  ambiguous.
- Only supersede or retain erroneous confirmed records — rejected; provide
  user-controlled exact-node deletion with scope and confirmation.
- Keep unbounded raw JSON memory in system context — rejected; enforce hard
  payload and per-entry bounds with an explicit data-versus-preference trust
  distinction.
- Add an embedding dependency/provider in this slice — rejected; use a tested
  deterministic lexical relevance gate with existing TF-IDF.

## Consequences

Confirmed memory becomes correctable through a narrowly scoped explicit delete,
while legacy drafts remain on their separate review path. Legacy preference
records remain readable as normal priority without migration. Automatic context
has explicit retrieval, selection, size, and trust limits; focused fixtures
define the relevance gate without changing the lexical-search dependency
contract. The implementation and its proof are tracked separately in the
[memory hardening follow-up](../features/memory/memory-hardening.md); the existing
[memory feature](../features/memory/memory.md) remains VALIDATED.
