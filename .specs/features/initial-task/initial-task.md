# Feature spec: Initial task

**Status:** SPECIFIED
**Date:** 2026-09-27

## Goal
Store durable memory with its correct decision, bug, or solution type and connect related records through explicit semantic links.

## Request context
An audit found that the decision-only save tool could not represent bugs or create graph relationships, leaving useful records isolated.

## Acceptance criteria
1. The memory API saves decisions, bugs, and solutions with the requested node type.
2. A solution can link to its bug with a `fixes` edge, and task-context retrieval returns both nodes.
3. Workflow completion alone creates no memory node.

## Definition of done
The active guarana workflow reaches verification with recorded proof.
