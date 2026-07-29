# Paid-Flow End-to-End Test

This test creates production-like external state and may incur a charge or send email. Run it only with explicit authorization and an approved test method.

Verify in order:

1. Complete all 10 free answers and reveal the preview.
2. Create Worker checkout and confirm `reading_id` custom data.
3. Complete an approved Lemon Squeezy test or low-value purchase.
4. Confirm the verified webhook marks payment without duplicate processing.
5. Open `/full-report/?reading_id=...`, complete all eight paid signals, and confirm the form locks appropriately.
6. Wait for cron or use the protected recovery endpoint intentionally.
7. Confirm exactly one report email, final reading status `delivered`, one succeeded active job, and stored email ID.
8. If tracking is in scope, confirm one server-side Meta `Purchase` with no frontend Purchase.

Record only non-sensitive identifiers or redacted evidence in project state. Never store keys, full payloads, customer answers, or personal email addresses.
