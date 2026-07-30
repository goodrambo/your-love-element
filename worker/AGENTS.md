# Worker Rules

- Root `AGENTS.md` remains in force.
- Preserve signature verification, webhook deduplication, conditional queue claim, monotonic report statuses, stored-report reuse, and the Resend idempotency key.
- `Purchase` may originate only from a verified Lemon `order_created` webhook; Meta failure must not block fulfillment.
- Never log secrets, unhashed customer identifiers, full answers, or generated private report content.
- Worker or paid-flow changes require JS syntax checks and the relevant tests; prompt, scoring, normalization, or email changes also require a fresh authorized E2E before production safety is claimed.
