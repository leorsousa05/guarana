---
name: guarana:skill-authoring
description: Use when creating or maintaining reusable Guarana skills.
---

# guarana:skill-authoring

Maintain reusable OpenCode skills through Guarana's guarded skill tools. This skill is for explicit skill authoring and review; ordinary task learning is captured by the separate post-task reviewer.

## When to use

- Create a durable, reusable domain or workflow skill.
- Review or improve a Guarana-generated skill.
- Choose a topical category or project/global scope.

Do not use it for one-off tasks, temporary criteria, generic advice, or manual skills owned by another tool.

## Procedure

1. Call `skill_list` across both scopes. It returns name, category, scope, description, and revision metadata—not full bodies.
2. Compare existing names and descriptions semantically. Call `skill_read` only for likely matches; never load all skill bodies.
3. If a generated skill already covers the workflow, prefer `skill_update` using its exact `expectedRevision`. The engine rejects stale revisions and manual skills.
4. Create only when the procedure is distinct and likely to help in future tasks. Avoid micro-skills for individual screens, routes, or task details.
5. Select category by subject, independently of scope:
   - `development`: coding, testing, debugging, verification.
   - `automation`: workflows, orchestration, telemetry operations.
   - `research`: evidence discovery and analysis.
   - `integrations`: external services and APIs.
   - `memory`: durable knowledge, skill, and memory management.
   - `general`: portable guidance that fits no narrower category.
6. Choose `project` for repository-specific architecture, tools, or conventions; choose `global` only for portable procedures useful across projects.
7. Write the complete concise procedure through `skill_create` or `skill_update`, including its category. Never copy raw prompts, transcripts, secrets, credentials, or private data.
8. Read the result back with `skill_read` and verify its name, category, scope, description, and body. Report only a verified write.

## Quality bar

A useful skill states its trigger and counter-trigger, gives checkable steps, names expected evidence, and explains relevant limits. Prefer extending an existing skill over duplicating it. Keep durable user preferences in memory rather than duplicating them as skill rules.

## Pitfalls

- Category describes the topic; scope describes where the skill applies.
- `skill_list` is metadata-only. A body is loaded only by a targeted `skill_read` call.
- Never update a manual or mismatched skill, and never bypass a stale revision conflict.
- A requested skill change is explicit maintenance; automatic end-of-task learning uses `guarana_learning_review` instead.
