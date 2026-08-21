# Failure Modes

The canonical matrix behind guarana:debug. Each mode: symptom, detection signal, defusal.

## Runaway
Iterations grow without convergence. **Signal:** token/iteration count approaching the hard cap with the condition unmet. **Defusal:** enforce the hard cap, log `hard-cap`, re-Frame with a sharper verifiable condition.

## Oscillation
The run flips between states A and B. **Signal:** the same edit applied then reverted (diff ping-pong). **Defusal:** freeze the decision, write both options + a decision criterion to disk, escalate to the human if none exists.

## Context loss
The agent contradicts earlier decisions after silent truncation. **Signal:** checkpoint mismatch on restore. **Defusal:** stop, restore from disk, resume from checkpoint — never from recall.

## Unbounded transient retry
The same call retried against flaky errors forever. **Signal:** N identical calls with identical errors. **Defusal:** cap retries (default 2), then `stop_reason: error` + known-issues entry. (See Madaan et al. 2023 on the limits of unguided self-correction.)

## Loop-as-terrier
Re-applying an action that already failed, like a terrier returning to the same hole. **Signal:** the same failing patch/command ≥ 2 times with the same failure. **Defusal:** forbid the identical action; require a changed hypothesis before retry; if none exists, stop.

## Meta-rule
A failure matching no mode is recorded `status: unclassified` and escalated. Never invent a fix for an unclassified failure silently.
