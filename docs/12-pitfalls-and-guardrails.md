# Pitfalls And Guardrails

Last updated: 2026-05-13

This file is the "read this before changing anything important" list.

## 1. Do Not Send Purchase From Frontend

Problem:

- frontend checkout click is not payment
- users can abandon checkout
- payment can fail

Correct behavior:

```text
Purchase only from verified Lemon Squeezy order_created webhook through Meta CAPI.
```

## 2. Do Not Use Static Lemon Squeezy Links For Main Funnel

Problem:

- static checkout cannot reliably attach `reading_id`
- payment cannot be joined to free answers
- paid report fulfillment breaks

Correct behavior:

```text
Worker creates checkout and sets checkout_data.custom.reading_id.
```

## 3. Never Move Delivered Readings Backward

High-risk regression:

```text
delivered -> paid
delivered -> paid_answers_submitted
delivered -> checkout_created
```

Why it is dangerous:

- can enqueue another job
- can send another report email
- can confuse support and analytics

Guarded statuses:

```text
generating
report_generated
delivered
failed
```

## 4. Duplicate Email Risk

This project already hit a duplicate-email risk around retries.

Keep:

```text
Idempotency-Key: full-report/{reading.id}
```

Keep logic that:

- reuses stored report on retry
- skips send if reading already delivered with `email_message_id`
- treats already-delivered cleanup as job success

## 5. Duplicate Webhooks

Lemon Squeezy can retry webhooks.

Keep:

- `webhook_events` table
- unique provider/external event id index
- duplicate-return logic
- signature verification

Do not patch reading repeatedly for already-processed events.

## 6. Queue Concurrency

Cloudflare cron/manual processing can overlap.

Keep:

- conditional claim of queued job
- one active job per reading index
- status transition to `running`

Do not process jobs without claiming them.

## 7. Payment And Paid Answers Can Arrive In Either Order

Users can:

- pay first, then submit paid answers
- submit paid answers when payment is delayed or link mismatch occurs

The database trigger handles the join when both exist.

Do not assume order of arrival.

## 8. RLS Must Stay Service-Role Only

Frontend should not directly access Supabase.

Keep:

- RLS enabled
- no anon/authenticated policies
- service_role-only access

If future products need user accounts, design a separate access model intentionally.

## 9. Meta Account Restrictions Are Not Always Copy Problems

This project was temporarily restricted for account integrity / suspected automation.

Do not respond by:

- creating new Business Manager
- using personal ad account to bypass restriction
- changing domain/Pixel to evade enforcement
- repeatedly submitting many variants

Correct response:

- appeal
- verify business assets
- keep setup stable
- relaunch clean after approval

## 10. Meta AI Creative Features Add Variables

For first paid tests, keep off:

- AI image generation
- creative enhancement
- text rewriting
- translation
- CTA enhancement

Use them only in separate creative tests after baseline is known.

## 11. Personal Attribute Ad Copy Risk

Avoid copy that implies the viewer has a personal trait/problem.

Avoid:

```text
Still single?
Tired of being hurt?
Why do you attract the wrong people?
```

Use neutral framing:

```text
Take a private relationship reading.
Start with a free preview.
Explore your love element.
```

## 12. Cookie Notice Must Match Behavior

Current tracking is not gated by the cookie notice.

So the notice uses:

```text
Got it
```

Do not add `Essential only` / `Allow all` unless tracking actually respects the choice.

## 13. AI Text In Images Is Risky

AI-generated image text is unreliable and can create:

- wrong words
- policy-sensitive claims
- illegible ad creative

Use AI for base visuals and add ad text separately.

## 14. Share Card Quality

The final share-card approach uses fixed templates plus canvas overlay.

Do not return to drawing full watercolor art in canvas; it looked lower quality.

## 15. Report Prompt Changes Require E2E

If changing:

- scoring weights
- required sections
- model prompt
- email rendering
- normalization

Then run a fresh paid-report E2E and verify delivered email.

Old delivered emails do not prove new Worker code is live.

## 16. Support Needs Traceability

Always preserve:

- `reading_id`
- checkout id
- Lemon order id/number
- webhook events
- report job id
- Resend email id

These are how customer support investigates delivery and payment issues.

## 17. Low Ticket Means CPA Discipline

Product price:

```text
$9.99
```

Cold paid traffic can become unprofitable quickly.

Use first campaigns to validate:

- hook
- funnel completion
- purchase tracking
- checkout trust

Then scale carefully.

## 18. First-Party Analytics Is Diagnostic, Not Purchase Truth

Keep first-party event records free of IP, user agent, email, full URL/query, referrer, reading/order/customer id, answers, and report content. Hash the random tab-session UUID before storage, dedupe stages, expire rows after 180 days, and reject frontend `Purchase`.

Bots can still imitate browser events. Use these counts to diagnose the funnel, but use only verified Lemon webhook/Supabase state for the purchase goal.
