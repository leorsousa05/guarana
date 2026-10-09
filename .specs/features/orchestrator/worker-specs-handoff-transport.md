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

<!-- guarana:record:start -->
Status: VALIDATED
Proof: worker-verify ses_edeb32bcbffeHSEERdwatPetis — PASS (5/5); worker-specs ses_edeaaec9cffeSuAoIrNNj7X7dV denied unrelated node -e command after restart; worker-specs ses_edeaab7e6ffe4R1DhX3VPPdnSp allowed exact file record command returned ok:true; three paths changed; validator ok:true; handoff removed; npm test — PASS (276/276); npm run check-cli — PASS; npm run specs:validate — PASS (133 Markdown, 22 features, 30 ADRs, 208 links); git diff --check — PASS; project/global profiles current and canonical skills synchronized
Change: none
<!-- guarana:record:end -->
