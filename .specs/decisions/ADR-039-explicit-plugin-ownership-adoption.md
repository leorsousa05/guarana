# ADR-039 — Explicit plugin ownership adoption

**Status:** Accepted (2026-10-23) · append-only

## Context

Plugin install and uninstall preflight deliberately reject a tracked plugin
whose current bytes differ from its manifest hash. `--plugins-only` does not
bypass that guard. Existing marker-based legacy adoption applies only to
untracked plugin files, leaving no CLI recovery route for a recognized,
user-modified tracked plugin that must be reconciled. The known global
orchestrator plugin is a regular tracked target with its expected
plugin-specific marker, but its current bytes are stale versus the recorded
hash. Live recovery or installation is not authorized in this documentation
phase.

## Decision

1. Add the explicit offline command `guarana plugin adopt <plugin-file>
   --accept-current [--project]`. It acts on exactly one of the three
   allowlisted Guarana plugin filenames in the selected scope. Arbitrary paths,
   bulk targets, and implicit adoption are excluded. The required
   `--accept-current` option is the user's explicit acknowledgment of an
   ownership transition.
2. Require a valid existing manifest with exactly one valid tracked entry for
   the selected plugin, an existing regular non-symlink target, a recognized
   plugin-specific Guarana marker, and target bytes whose SHA-256 differs from
   the tracked hash. Reject without writes if acknowledgment is absent, the
   plugin is unknown, the manifest/entry is absent or invalid/duplicated, the
   current hash already matches, the target is missing/symlink/non-regular, or
   the marker is absent.
3. On success, update only the selected entry's SHA-256 in the selected install
   manifest. Do not write, replace, or delete plugin bytes, and do not alter any
   other manifest group or entry. Use a single-target manifest transaction that
   rolls back on ordinary filesystem errors.
4. Keep normal install/uninstall preflight unchanged and strict about byte/hash
   ownership. After explicit adoption, ordinary install may proceed through the
   unchanged guard. This command is not a general force-install or force-delete
   path. The capability is offline for now and does not authorize live
   installation, restart, or Task execution.

## Alternatives considered

- Implicitly adopt a tracked mismatch whenever its marker is recognized —
  rejected because it would transfer ownership without the user's explicit
  acknowledgment.
- Add a broad force flag, accept arbitrary paths, or adopt multiple targets —
  rejected because recovery is deliberately bounded to one allowlisted plugin
  and one manifest entry.
- Weaken ordinary install/uninstall preflight to accept a hash mismatch —
  rejected because that would remove the existing byte-ownership protection
  outside an explicit adoption action.
- Continue refusing all tracked mismatches with no reconciliation command —
  rejected because it leaves no supported offline path to reconcile the known
  marked global plugin and then use the existing strict install guard.

## Consequences

The user must explicitly accept the current bytes before the manifest records
their hash as owned. Adoption preserves plugin content and every unrelated
manifest entry; malformed or unsafe state fails closed, and ordinary filesystem
errors must not leave a partial manifest write. The existing install/uninstall
ownership rule remains unchanged. Implementation acceptance requires CLI
help/README documentation, reject/no-write coverage, exact single-entry update
and preservation proofs, rollback coverage, and an isolated standard-install
fixture. The accepted design and its pending implementation are tracked in the
[orchestrator intent/provenance follow-up](../features/orchestrator/intent-provenance-safety.md).
