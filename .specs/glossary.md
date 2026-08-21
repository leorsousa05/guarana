# Guarana — Glossary

- **Inner loop** — the agent's Perceive → Think → Act → Observe cycle within a single run (ReAct shape; reflection, plan-and-execute, and tree-of-thought variants).
- **Outer loop** — the supervisor that wraps a whole run as one step: decides when to run, what state it keeps, how to verify, and when to stop.
- **ReAct** — interleaved reasoning and acting: each action is preceded by an explicit thought and followed by an observation.
- **Reflection** — a post-step or post-run self-critique whose output is written to memory and used to adjust subsequent behavior.
- **Verification split** — the structural rule that the implementer and the verifier are separate agents/contexts; the writer of a change never approves it.
- **Frame / Run / Verify / Record** — the four stages of `guarana:build`: Frame (load state, set goal + budget), Run (execute the inner loop), Verify (independent gate), Record (persist stop reason, proofs, state).
- **Trigger types** — heartbeat (run on each turn), cron/budget (run on schedule or budget threshold), goal-driven (run until a verifiable condition holds).
- **Hard cap** — a machine-enforced ceiling (tokens, iterations, wall-clock) that terminates a run regardless of progress.
- **Verifiable condition** — a checkable predicate (test passes, file exists, diff applies) that defines "done". Never a judgment call.
- **Independent verifier** — the separate context (worker-verify, then the human) that evaluates the verifiable condition without having produced the work.
- **Stop reason** — the mandatory logged cause of every run termination (condition-met, hard-cap, budget-exhausted, error, human-abort).
- **Progressive disclosure** — only the suite index is always loaded; full skill bodies load only when their trigger fires.
- **Subagent budget** — the per-worker token/wall-clock ceiling, enforced individually, recorded in ADR-005.
- **Guarana namespace** — the `guarana:*` prefix that owns all seven skill names; final and never renamed.
