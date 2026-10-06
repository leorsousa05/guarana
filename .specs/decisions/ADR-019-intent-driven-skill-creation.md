# ADR-019 — Intent-driven generated skills

**Status:** Accepted (2026-10-05) · append-only

## Context

The memory plugin already instructs the model to preserve durable knowledge.
Reusable specialized procedures need a durable, executable format that OpenCode
can discover, plus a way to distinguish generated skills from Guarana's bundled
suite and user-authored skills in the dashboard.

## Decision

1. The model may create a skill automatically when a user message establishes a
   clearly reusable specialized procedure. One-off task instructions remain
   ephemeral; decisions and response preferences remain memories.
2. The model chooses scope: project-specific practices go to
   `<project>/.opencode/skills/<name>/SKILL.md`; reusable practices that apply
   across projects go to `~/.agents/skills/<name>/SKILL.md`.
3. Generated files use OpenCode SKILL.md frontmatter and a Guarana-generated
   metadata marker. Creation validates content and secrets, checks for
   duplicates, and never overwrites existing skills.
4. The dashboard lists only Guarana-generated skills in separate Global and
   Project tabs. Listing is read-only; creation remains an assistant action.
   The dashboard binds to loopback because its API exposes private global skill
   content.

## Alternatives considered

- Save all specific instructions as memories — rejected: memories preserve
  knowledge but do not provide the structured procedural instructions of a skill.
- Require a separate user command or approval for every skill — rejected: the
  requested experience is intent-driven automatic creation, like memory capture.
- Include all discovered skills in the new dashboard list — rejected: this would
  mix Guarana-generated skills with the bundled suite and unrelated user skills.

## Consequences

- The assistant must use a conservative reusable-workflow threshold and choose
  scope deliberately.
- Skills are available through normal OpenCode discovery after creation and are
  inspectable from the dashboard without editing them there.
- Project skills follow project version-control policy; global skills remain in
  the user's private OpenCode skill directory.
- The web dashboard is reachable only from the local machine.
