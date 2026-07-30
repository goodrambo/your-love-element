---
status: accepted
date: 2026-05-11
reviewed: 2026-07-12
---

# 0003 — Server-Only Meta Purchase

## Decision

Send Meta `Purchase` only from a signature-verified Lemon Squeezy `order_created` webhook through Conversions API. A checkout click or redirect is not proof of payment.

## Consequences

- Frontend code may send diagnostic and funnel events but must never send `Purchase`.
- Meta failure must not fail payment confirmation or report fulfillment.
- Event IDs remain idempotent and customer identifiers are normalized and hashed.
