# ADR-051 — Standalone documentation site and Pages delivery

**Status:** Accepted (2026-11-26) · implementation pending · append-only

## Context

Guarana needs a Portuguese (Brazil) public landing page and documentation
experience. The accepted implementation scope is a separate React/Vite static
app in `docs-site/`, deployed automatically from `main` through a distinct
GitHub Actions workflow. The repository is
https://github.com/leorsousa05/guarana.git, so the Vite base path is
`/guarana/` and the static build output is `docs-site/dist`.

The existing Dashboard is a local operational app, not a public documentation
site. A Pages workflow does not yet exist. GitHub Pages may need to be enabled
with GitHub Actions in repository settings before a later deployment.

## Decision

Keep the public documentation site isolated in `docs-site/` as a React/Vite
static app, and use a separate GitHub Actions workflow to build it and publish
only its static artifact to GitHub Pages from `main`. Keep the Vite base at
`/guarana/`. The implementation task does not perform an external deployment;
repository Pages configuration remains a possible maintainer action.

## Alternatives considered

- Reuse the local Dashboard — rejected because it is an operational app, not a
  public documentation site.
- Publish plain Markdown only — rejected because the accepted scope calls for
  a React landing page and documentation experience.
- Upload Pages content manually — rejected because automatic deployment from
  `main` was explicitly accepted.

## Consequences

Documentation delivery is separate from the operational Dashboard, existing CI,
and root package configuration. The Pages workflow must use only the
permissions needed for artifact publication and deploy only the built site.
Until implementation and any required repository Pages setting are complete,
no live deployment is implied.

## Implementation checkpoint (2026-11-26)

The standalone PT-BR documentation site and separate Pages workflow are
implemented and independently verified (worker-verify overall PASS 5/5).
`npm run build --prefix docs-site` passed with Vite 6.4.6, and the configured
`/guarana/` assets returned HTTP 200 in a local production preview. Firefox
157.0.1 checks at CSS viewports 375×812 and 1440×900 passed the no-overflow,
visible skip-link, keyboard navigation, and named-navigation checks. The
workflow triggers only on pushes to `main`, builds `docs-site`, uploads only
`docs-site/dist`, and uses the stated least permissions. No push or external
deployment was performed; remote Pages configuration/state was not checked.

This append-only checkpoint supersedes only the implementation-pending status;
the accepted architecture decision above remains unchanged.
