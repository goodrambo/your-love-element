---
status: accepted
date: 2026-05-05
reviewed: 2026-07-12
---

# 0002 — Worker Boundary and Dynamic Checkout

## Decision

The browser talks only to the Cloudflare Worker, never directly to Supabase. The Worker creates Lemon Squeezy checkout dynamically and attaches `reading_id` so payment can join the free reading and paid signals.

## Consequences

- Supabase product tables remain service-role-only behind RLS.
- Static Lemon Squeezy links are not valid for the main funnel.
- Local preview mode must not call the production Worker.
- A change to this boundary requires security review, new tests, and a superseding ADR.
