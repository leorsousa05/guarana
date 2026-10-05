# Releasing Guarana

This checklist is the release gate for a published Guarana version. Publishing
and tagging remain explicit maintainer actions.

## Support contract

- Node.js **22 or newer**. CI exercises Node 22.x and 24.x.
- OpenCode's **latest stable release**. Older OpenCode versions are not in the
  support contract unless they are separately validated.
- Record the exact output of `opencode --version` in the release record.

## Automated gate

Run from a clean checkout with Node 22 or 24:

```bash
npm ci --prefix dashboard
npm ci --prefix dashboard/server
npm run audit
npm test
npm run build
npm run check-cli
npm run specs:validate
npm run smoke:pack
```

`smoke:pack` creates the npm archive, rejects any `node_modules` paths, installs
that archive into an isolated npm prefix, and exercises CLI install, list,
plugin health, dashboard dependency bootstrap/API response, and uninstall. The
archive must include `LICENSE`, `CHANGELOG.md`, and this release guide.

## OpenCode host smoke test

For each release candidate, use the latest stable OpenCode in a clean temporary
project and user configuration:

1. Record `opencode --version`.
2. Install Guarana from the candidate tarball with `guarana install --project`.
3. Run `opencode debug config` and confirm the three Guarana plugins are loaded.
   Run `opencode debug skill` and confirm `guarana:plan` is discoverable.
4. Start a fresh OpenCode session; confirm the automatic planning workflow and
   Guarana memory tools load, then complete a small task and verify state persists.
5. Run `guarana plugin status --project` and `guarana web --no-open`.
6. Run `guarana uninstall --project` and confirm the installed skill and plugins
   are removed.

Record the exact OpenCode version and pass/fail evidence in the release notes.
When OpenCode is installed locally, `GUARANA_OPENCODE_SMOKE=1 npm run smoke:pack`
automates the resolved-config and project-skill discovery checks against the
packed candidate.

## Publish

1. Move the validated changes from `CHANGELOG.md`'s Unreleased section into the
   release heading.
2. Update the root package version and the README version badge together.
3. Re-run the automated gate and inspect `npm pack --dry-run --json`.
4. Publish the package and create the matching Git tag only after the host smoke
   test is recorded.
