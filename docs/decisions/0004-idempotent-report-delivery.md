---
status: accepted
date: 2026-05-10
reviewed: 2026-07-12
---

# 0004 — Idempotent Report Delivery and Monotonic State

## Decision

Payment and all eight paid signals must both exist before report generation. Queue jobs are conditionally claimed, stored reports are reused on retry, and Resend receives `Idempotency-Key: full-report/{reading.id}`.

Statuses `generating`, `report_generated`, `delivered`, and `failed` must not be moved backward by checkout, webhook, or paid-signal handlers.

## Consequences

Changes to queue processing, status transitions, report normalization, or email sending require Worker verification and a fresh, explicitly authorized E2E before production safety can be claimed.
