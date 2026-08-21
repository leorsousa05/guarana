# Proofs — guarana:verify

Append-only. Proofs written BEFORE commit slices; committed proofs never altered.

## Task 1 — Draft verify/SKILL.md (2026-08-21)
- **AC1 (three guards + rationales):** body lines 11–13 define Hard caps (prevents runaway), Verifiable conditions (prevents "looks complete"), Independent verifier (prevents self-approval bias). PASS.
- **AC2 (falsifiability test):** gate step 2 rejects criteria whose failure would be undetectable, with the example "output looks reasonable" rejected. PASS.
- **AC3 (split refusal):** "If the diff under review was produced in THIS context, REFUSE and reroute to a fresh worker-verify. No exceptions." (`grep -n REFUSE` → line 16.) PASS.
- worker-verify verdict: PASS (fresh context; the verifying context did not author the body).
