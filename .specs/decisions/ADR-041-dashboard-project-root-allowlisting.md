# ADR-041 — Dashboard project root allowlisting

**Status:** Accepted (2026-10-25) · append-only

## Context

The Dashboard currently derives project data from its server process root. The
approved follow-up adds explicit project switching and a project-only legacy
Memory Drafts review surface. Project roots are filesystem authority, so a
browser-provided path must not determine what the server reads or writes.

## Decision

1. Retain the server's known current `process.cwd()` as the default and implicit
   fallback project. Keep an explicit persistent per-user allowlist in XDG
   configuration for project roots that may be selected. The `Add this project`
   action registers only that server's known current root; to register another
   root, start `guarana web` inside that project and register it there.
2. Canonical roots remain server-side. The browser stores the selected project
   locally and receives/sends only opaque project IDs and safe names, never
   canonical paths. Resolve every project-scoped API request's ID server-side
   against the allowlist. Unknown or stale IDs are not filesystem paths and do
   not silently select another registered project.
3. Unregister removes only an allowlist entry and never deletes project files
   or project settings. The process current root remains the implicit fallback.
   A removed or stale saved selection fails closed and is visibly reset to the
   current project (reversible UI assumption).
4. Apply selection to project-scoped telemetry, runs, activity/OpenCode root,
   Specs/decisions, project Memory, workflow settings, and project
   Skills/Models/settings. Global settings and global Memory remain global.
5. Keep the Dashboard loopback-only. The allowlist narrows selectable roots but
   is not authentication.
6. Add the Drafts tab using the existing drafts/review APIs for project drafts
   only. Preserve the existing four Memory tabs, display only intent, type,
   timestamp/date, and tags, and provide Confirm/Discard without field editing
   or global-draft review. Warn that Discard irreversibly deletes the draft and
   its edges; project switching reloads drafts and binds actions to the selected
   project.

## Alternatives considered

- Accept arbitrary filesystem paths from the browser — rejected because it
  would grant the browser overbroad local filesystem scope.
- Keep one process root as the sole selectable project with no registration —
  rejected because it cannot provide the approved explicit project switching.
  The chosen design retains that root as the default/fallback and permits only
  explicitly registered roots.

## Consequences

- Project selection is an allowlisted server-side resolution, not a browser
  path capability. A stale ID cannot be reinterpreted as a path or as another
  project's identity.
- Project-scoped dashboard operations follow the selected root; global settings
  and global Memory retain their existing scope.
- Draft review remains project-only and uses existing API behavior. The
  irreversible effect of Discard is disclosed before action.
- Loopback-only operation remains unchanged and is not represented as
  authentication.
