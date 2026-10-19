# ADR-033 — Dashboard web settings contract

**Status:** Accepted (2026-10-19) · append-only

## Context

The dashboard needs persistent appearance, refresh, and server-launch preferences
available across the dashboard UI and `guarana web`. Advisor and workflow
preferences already have separate storage contracts, and their behavior and files
must remain unchanged. Web preferences need independent global defaults,
project overrides, visible effective sources, and safe editing without migrating
existing files.

## Decision

1. Store web preferences in global
   `$XDG_CONFIG_HOME/guarana/web.json` (falling back to
   `~/.config/guarana/web.json`) and project `.guarana/web.json`. Resolve each
   field project-over-global with built-in defaults, and treat each JSON file as
   a validated partial. Do not migrate or modify existing configuration files.
2. Use the reversible internal shape
   `{ appearance: { theme, startPage }, refresh: { intervalSeconds }, server: { port, open } }`.
   Defaults are `light`, `overview`, `5`, `4200`, and `true`, respectively;
   theme is `light|dark`, refresh choices are 5/15/30 seconds, port is an
   integer from 1 through 65535, and open is boolean.
3. The Settings UI can edit Global or Project scope, defaults its editor to
   Project, labels effective values and their sources, and clears project fields
   to inheritance. Its API derives configuration paths only from the server
   root and environment, validates scope and partial JSON strictly, and writes
   only the selected scope atomically. Invalid or malformed settings fail
   without destructive overwrite.
4. `guarana web` reads effective settings from its current working directory
   and global configuration. Per-run `--port`, `--open`, and `--no-open`
   override saved preferences. Simultaneous `--open` and `--no-open` is
   rejected; existing unknown-argument behavior remains unless a focused test
   requires otherwise.
5. Theme and refresh changes apply immediately. Startup page applies on the
   next load only when there is no explicit URL hash; a deep link takes
   precedence. Port and auto-open apply on the next `guarana web` invocation.
   Live data endpoints use the selected refresh interval; existing slower
   settings/config endpoints remain at 15 seconds.
6. Preserve Advisor behavior and separate `advisor.json` storage, including
   project-only editing in the existing Models UI and global inheritance/source
   display. Preserve separate `workflow.json` storage and allow Global/Project
   editing in Settings with project-over-global resolution and clear-to-inherit.
   Do not change the global Advisor profile installation flow or add runtime
   dependencies.

## Alternatives considered

- Put web preferences in `advisor.json` or `workflow.json` — not selected; the
  accepted contract preserves both existing settings files and introduces
  separate `web.json` storage.
- Migrate existing configuration files — rejected; the new web settings use
  their own partial files and require no migration.

## Consequences

- Dashboard and CLI share a durable, scoped web-settings contract while their
  existing Advisor and workflow settings remain isolated.
- The API must validate both the scope and each partial before an atomic write;
  malformed values cannot replace valid files.
- Saved launch preferences affect future `guarana web` invocations, while
  explicit per-run flags retain precedence.
- A browser-capable independent proof is required before overall validation:
  render Settings at 375px and exercise actual save and clear/inheritance
  interactions. No test-only browser tooling may be added without separate
  approval.
