# Releasing Guarana

This checklist describes the ordinary release checks for a published Guarana
version. Publishing and tagging remain explicit maintainer actions.

## Support contract

- Node.js **22 or newer**. CI exercises Node 22.x and 24.x.
- Guarana targets OpenCode's plugin API. Package, release, and OpenCode-host
  smoke testing is retired; this release process does not claim host smoke
  validation.

## Retired smoke tests — do not run

All Guarana package/release/OpenCode-host smoke tests are retired. They **MUST
NOT** be run or reintroduced as development, CI, or release gates. This includes
`npm run smoke:pack`, packed CLI lifecycle or dashboard-startup tests, and
latest-stable OpenCode host/manual-workflow smoke tests. Historical receipts and
transcripts remain historical evidence only, not instructions or future gates.

## Ordinary release checks

Run the ordinary checks from a clean checkout with Node 22 or 24:

```bash
npm ci --prefix dashboard
npm ci --prefix dashboard/server
npm run audit
npm test
npm run build
npm run check-cli
npm run specs:validate
```

CI runs the audit, tests, build, CLI parity check, and specs validation on Node
22.x and 24.x. Do not add smoke tests to these checks.

## Package-content inventory (not a smoke test)

Inspect the package file inventory without installing or executing the tarball:

```bash
npm pack --dry-run --json
```

Confirm the inventory includes `LICENSE`, `CHANGELOG.md`, and `RELEASING.md`,
and contains no `node_modules` paths. This is package-content inspection only;
it does not exercise the packed CLI and is **not a smoke test**.

## Publish

1. Move the validated changes from `CHANGELOG.md`'s Unreleased section into the
   release heading.
2. Update the root package version and the README version badge together.
3. Re-run the ordinary release checks and inspect the package-content inventory
   above. Do not run or add any retired smoke test.
4. Publishing the package and creating the matching Git tag remain explicit
   maintainer actions after the ordinary checks and inventory inspection.
