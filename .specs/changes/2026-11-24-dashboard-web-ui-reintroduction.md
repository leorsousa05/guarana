# Dashboard web UI reintroduction

**Date:** 2026-11-24
**Status:** VALIDATED, not SHIPPED.

## Candidate and scope

Candidate worktree: `/home/arch/Projects/active/guarana`, branch `main`, HEAD
`469da6bcce9464263056afdd2439f1b101cf74d6`, dirty/uncommitted at handoff. This
record makes no commit, push, release, or SHIPPED claim.

The accepted reintroduction covers the complete eight-screen local-only
dashboard: Overview, Activity, Runs, Specs, Workflow, Memory, Skills, and
Settings. Project roots are server-side allowlisted and represented in the
browser by opaque IDs and safe names, never browser-provided paths. Settings
retain the independent ADR-033 Web, Workflow, and Advisor contracts. The scope
excludes a generic CLI runner and administrative controls. Responsive
accessibility and prevention of the large-telemetry refresh incident are part
of the validated scope.

## Primary gates

- `npm test` — PASS, 854/854; the full suite emitted only nonfatal Vite HMR
  port-in-use warnings.
- `npm run build` — PASS.
- `npm run check-cli` — PASS.
- `npm pack --dry-run --json` — inventory-only PASS, 145 files, no
  `node_modules`.
- `npm run specs:validate` — PASS: 265 Markdown files, 105 features, 48 ADRs,
  303 links, 0 issues.
- `git diff --check` — PASS.
- No retired package, release, or OpenCode-host smoke was run.

## Independent verification

Fresh native `worker-verify` returned overall PASS for criteria 1–6. Firefox
157.0.1 with geckodriver 0.37.1 on Linux exercised the actual CLI-served local
bundle with synthetic temporary projects. The final run covered all eight
routes at 1440×900. An earlier same-candidate independent browser run covered
all eight routes at 375×812 and 1440×900; the final correction was server-only,
with no UI changes. Browser checks covered overflow, keyboard focus,
empty/loading/error states, and absence of page or console errors. Current
report: `/tmp/opencode/dashboard-reverify-criteria.json`.

Decision review Accept and Reject each POSTed the exact path returned by GET,
returned HTTP 200, and removed pending rows 2→1→0. Six malicious decision
requests returned HTTP 400; path-bearing registration returned HTTP 400;
path-as-project-ID returned HTTP 404. Only selected synthetic-project decision
files changed; the other project and outside/symlink targets remained
unchanged. Project/Global Settings save, source, clear, and isolation checks
passed. No real project/global data or external service was accessed.

Telemetry remained bounded and the browser run made no SSE request. Tests cover
the 28,347,021-byte fixture, cache reuse, append/rewrite recovery, and
single-flight behavior.

## Confirmed Specs decision-path defect

The browser reproduced HTTP 400 for Specs Accept before the fix: the pending
GET path was already relative to the selected project root, while POST
`resolveAllowed` rooted it again under `.specs/decisions` or
`.specs/features/guarana`. The fix matches the exact selected-project
allowlisted directory prefix and resolves only the remainder, retaining bare
basename compatibility and rejection of absolute, traversal, outside,
symlink, and non-Markdown paths. Regression coverage round-trips exact GET
paths for Accept/Reject, verifies pending removal and project isolation, and
the canonical server is synchronized to the CLI bundle. Independent browser
reverification passed; the issue is recorded as resolved and unclassified in
the failure-mode matrix.

No commit, push, release, or shipping action is authorized or claimed by this
validation record.
