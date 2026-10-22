# Change — Versioned known-issue status updates

**Status:** VALIDATED · 2026-10-20

## Outcome

The fixed-file `guarana specs record` handoff implements schema-v2 known-issue status updates while preserving schema-v1 task handoffs. Status-only v2 updates target only the known-issues record; combined v2 task and issue writes are atomic. The feature is independently verified and VALIDATED, not SHIPPED. The real `.specs/state/known-issues.md` was unchanged.

## Implementation files

- `cli/lib/spec-record.js`
- `cli/commands/specs.js`
- `cli/command-metadata.js`
- `cli/commands/specs.test.js`
- `skills/guarana/skills/specs/SKILL.md`
- `cli/skills/guarana/skills/specs/SKILL.md`

## Verification

- Independent `worker-verify`: overall PASS for all 9/9 acceptance criteria.
- Validation gate before and after independent review: `guarana specs validate . --json` — PASS, `ok:true`, 193 files, 0 issues.
- Independent focused specs tests — PASS, 27/27; the exact command was not supplied.
- Independent `npm test` — PASS, 563/563; `npm run check-cli` — PASS; `git diff --check` — PASS.
- Worker-code self-check: focused specs tests PASS, 63/63 (exact command not supplied); `npm test` PASS, 563/563; `npm run check-cli` and `git diff --check` PASS.
- Independent criterion proof covers v1 output compatibility; v2 status-only and combined behavior; v1 CLI HEAD rejection of v2 before record mutations in disposable fixtures; exact-H2 and last exact Status-line targeting; history, CRLF, and unrelated-byte preservation; invalid/no-write, rollback, idempotency, and output behavior; canonical/CLI skill mirror parity; Node >=22; and no dependency or version change.
- No actual status change was made to `.specs/state/known-issues.md`.

No commit, push, tag, npm publish, release, or shipping occurred.
