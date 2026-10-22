# Feature spec: Worker-specs Handoff Transport

**Status: VALIDATED**

## Goal

Let `worker-specs` pass schema-v1 JSON to the deterministic specs writer while
keeping Bash restricted.

## Assumptions and boundaries

- Do not use heredoc or stdin shell redirection.
- Use the single fixed temporary JSON path
  `.specs/state/worker-specs-handoff.json`.
- Edit permission allows that one handoff path.
- Bash allows only the exact invocation
  `node bin/guarana.js specs record --file .specs/state/worker-specs-handoff.json`
  and the equivalent `guarana ...` invocation.
- The command validates and removes the handoff on completion.
- Arbitrary shell remains denied.

## Acceptance criteria

1. `specs record --file <fixed-path>` reads JSON only from that exact
   project-relative path. It rejects alternate, absolute, traversal, and
   symlink paths, as well as malformed data, before updating records. The
   handoff is cleaned up after the command whether the data is accepted or
   rejected.
2. The generated worker profile allows editing only the fixed handoff JSON in
   addition to its existing Markdown paths. Bash is default-deny, with only the
   exact file invocation allowed.
3. The `worker-specs` skill writes JSON to the fixed handoff path using edit,
   invokes the file CLI, and checks the JSON result.
4. Tests cover valid file update and removal; invalid JSON, no writes, and
   cleanup; unsafe paths and symlinks; permission generation; and denial of
   unrelated Bash.
5. Canonical and CLI bundles are synchronized; project and global generated
   profiles are refreshed; and full tests, `check-cli`, specs validation, and
   `diff-check` pass.

## Accepted follow-up: truthful Edit-denial reporting

### Supplied incident context

A user reported that worker-specs registered part of a result and later saw
`Permission denied: edit` during remaining documentation edits. The denied path
and the `guarana specs record` result were not supplied. The canonical worker
procedure uses the fixed handoff file and `guarana specs record --file ...`;
the generated profile keeps Edit and Bash deny-by-default with explicit
allowlists; and the recorder writes through filesystem APIs and emits JSON.
The wording is consistent with an OpenCode Edit-tool authorization denial, but
the actual denied path, whether the CLI returned `ok:true`, and whether any CLI
filesystem rollback failed are unknown. The incident root cause remains
unresolved.

### Requirements and boundaries

- Preserve deny-by-default; do not broaden path permissions without exact
  evidence identifying the denied path.
- Report the exact denied operation and path, whether `specs record` ran, and
  its `ok` and `changed` result when available.
- If the CLI returned `ok:true`, stop manual edits to recorder-owned fields,
  report its changed paths as committed, and describe a later Edit denial
  separately.
- If the CLI did not run or returned `ok:false`, report the blocker and
  available result without claiming committed writes, complete rollback, or
  zero changes beyond the evidence; do not retry via another tool or path.

### Acceptance criteria

1. For an Edit denial, the worker's report identifies the exact denied
   operation/path and states whether `specs record` ran; when it ran, the report
   includes its observed `ok` and `changed` result.
2. Given `specs record` returned `ok:true`, the worker makes no further manual
   edits to recorder-owned fields, lists the reported changed paths as
   committed, and treats any later Edit denial as a separate event.
3. Given `specs record` did not run or returned `ok:false`, the worker reports
   only the observed blocker/result and makes no unsupported claim of committed
   writes, complete rollback, or zero changes; it does not retry using another
   tool or path.
4. Permission generation remains deny-by-default and no path permission is
   broadened without exact evidence identifying the denied path.
5. The reported incident remains root-cause unresolved unless its exact denied
   path and recorder result are established by evidence.

Historical baseline proof (not proof of this follow-up): worker-verify
`ses_edeb32bcbffeHSEERdwatPetis` PASS (5/5); unrelated `node -e` denied after
restart; exact file-record command returned `ok:true`, changed three paths,
validator `ok:true`, and removed the handoff; `npm test` PASS (276/276),
`npm run check-cli` PASS, `npm run specs:validate` PASS (133 Markdown, 22
features, 30 ADRs, 208 links), and `git diff --check` PASS; project/global
profiles current and canonical skills synchronized.

## Accepted follow-up: semantic narrative supersession

### Supplied source facts

The canonical `worker-specs` procedure says the recorder owns mechanical
tracker, checkpoint, status, and receipt fields while the worker retains
semantic requirements, acceptance, and factual proof. It also says to preserve
existing semantic text and only supply creation content for new features. The
recorder updates tracker rows, project-state `Current step`/`Pending writes`,
feature status/receipt, and v2 known-issue status; it does not rewrite arbitrary
narrative in existing features, ADRs, changes, or README files. The generated
worker profile is deny-by-default with selected `.specs` path categories, and
project root `README.md` is outside this worker's allowed scope.

An external report described partial recorder updates and stale narrative, but
did not supply the exact denied operation/path, active profile/version, or
recorder JSON `ok`/`changed` result. These facts establish a procedure ambiguity,
not the incident's permission root cause or a reproducible product failure.

### Requirements and boundaries

- When supplied confirmed facts explicitly supersede prose in an existing
  mutable `.specs` record, update only the affected semantic narrative with
  Edit, preserve unrelated and historical text, and do not expect the recorder
  to perform that narrative update.
- Keep recorder-owned tracker rows/status/proof receipts, project-state
  `Current step`/`Pending writes`, feature status/receipt, and known-issue status
  exclusively on the `specs record` path; do not edit those fields manually.
- Keep root `README.md` outside worker-specs authority and permissions. ADRs
  remain append-only and are added only for durable decisions with material
  alternatives. Do not rewrite historical change or verification evidence.
- If an artifact is outside scope or permission is denied, stop and report; do
  not broaden or bypass permissions.
- Preserve exact-path denial reporting: report the exact denied operation/path,
  observed recorder-run status, and exact `ok`/`changed` values when available;
  make no unsupported inference or retry/substitute write.
- Keep the external incident root cause unresolved until its exact denied path,
  active profile/version, and recorder JSON result are supplied. Do not add a
  known-issue entry based only on this report.

### Acceptance criteria

1. Given confirmed supplied facts that explicitly supersede prose in an
   existing mutable `.specs` record, worker-specs uses Edit to change only the
   affected semantic narrative and preserves unrelated and historical text;
   the recorder is not relied on to rewrite that narrative.
2. Tests and guidance reserve tracker/status/proof receipt formatting,
   project-state `Current step`/`Pending writes`, feature status/receipt, and
   known-issue status for `specs record`, with no manual edits to those fields.
3. The generated worker profile remains deny-by-default; root `README.md` stays
   outside worker-specs authority and permissions; ADRs remain append-only and
   material-alternative-gated; historical change/verification evidence is not
   rewritten.
4. For an out-of-scope artifact or Edit denial, the worker stops and reports
   rather than broadening or bypassing permissions. The exact-path denial
   reporting contract remains intact, with no unsupported inference, retries,
   or substitute writes.
5. Regression coverage checks the semantic-narrative guidance and unchanged
   deny-by-default/root-README exclusion. No `cli/lib/agents.js` allowlist or
   recorder source changes are in scope.
6. The external incident root cause remains unresolved pending the exact denied
   path, active profile/version, and recorder JSON result; no known-issue entry
   is created from the supplied report alone.

<!-- guarana:record:start -->
Status: VALIDATED
Proof: Independent worker-verify overall PASS 6/6 for this procedure correction only.; skills/guarana/skills/specs/SKILL.md:93-98 directs Edit of only semantic narrative explicitly superseded by supplied confirmed facts in an existing mutable .specs record, preserves unrelated and historical text, and states the recorder does not rewrite arbitrary narrative; the CLI mirror is byte-identical.; skills/guarana/skills/specs/SKILL.md:88-98,141,150,154,195-212 reserves mechanical tracker/checkpoint/status/receipt, currentStep/pendingWrites, and known-issue status to specs record.; skills/guarana/skills/specs/SKILL.md:25-30,102-106 keeps ADRs append-only and new only for durable decisions with material alternatives, root README.md outside worker-specs scope, historical change/verification evidence protected, and requires stopping and reporting on out-of-scope or denied edits without bypass.; Denial/result reporting remains explicit at skills/guarana/skills/specs/SKILL.md:110-118,167-170.; cli/lib/agents.test.js:83-118 asserts generated-profile guidance and root README exclusion; cli/lib/agents.js has no diff and the deny-by-default allowlist is unchanged. Canonical and CLI skill hashes are identical.; node bin/guarana.js specs validate . --json: ok:true, 195 files, 72 feature specs, 35 ADRs, 214 links, no issues.; node --test cli/lib/agents.test.js: 4 passed, 0 failed; npm run check-cli: PASS, bundle matches canonical; git diff --check: PASS.; Only this correction's changed files are the canonical skill, CLI mirror, and cli/lib/agents.test.js. Separate pre-existing cli/lib/spec-record.js and cli/commands/specs.test.js diffs are not attributed to it; whole-worktree recorder semantics are not certified. Betteraba was not accessed or edited; its exact denied operation/path, active profile/version, and recorder JSON ok/changed remain unknown, and its permission root cause is unresolved. No known issue is justified.
Change: none
<!-- guarana:record:end -->
