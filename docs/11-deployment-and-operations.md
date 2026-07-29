# Deployment And Operations

Last updated: 2026-05-13

## Hosting

Frontend:

```text
GitHub Pages
https://yourloveelement.com
```

Backend:

```text
Cloudflare Worker
https://your-love-element-api.goodrambo2013.workers.dev
```

Database:

```text
Supabase
Project ref: nmwhaiimnuywnjlvobde
```

## Deployment Flow

Confirmed path:

```text
commit -> push to origin/main -> GitHub Pages / Cloudflare integration deploys
```

Worker local `wrangler deploy` was not the confirmed path in this workspace. Use commit/push unless local wrangler auth is intentionally set up.

## Before Deploying Worker Changes

Run:

```text
node --check worker/src/index.js
```

Then:

1. commit changes
2. push to `origin main`
3. wait for Cloudflare/GitHub deploy
4. verify Worker health

## Health Checks

Worker:

```text
https://your-love-element-api.goodrambo2013.workers.dev/api/health
```

Supabase:

```text
https://your-love-element-api.goodrambo2013.workers.dev/api/health/supabase
```

Email config:

```text
https://your-love-element-api.goodrambo2013.workers.dev/api/health/email
```

Meta config:

```text
https://your-love-element-api.goodrambo2013.workers.dev/api/health/meta
```

Protected growth scorecard after its migration and Worker route are deployed:

```text
GET /api/admin/growth-metrics?days=45
Authorization: Bearer <JOB_RUNNER_SECRET>
```

Apply the growth-scorecard migration before deploying the Worker. Verify an unauthenticated `401` before an authorized aggregate-only `200`; do not expose or log the bearer secret.

## Email Test

Endpoint:

```text
POST /api/test-email
Authorization: Bearer <JOB_RUNNER_SECRET>
```

Use this or a full report E2E to verify actual Resend delivery.

## Full E2E Test

Use when changing:

- checkout
- webhook
- paid signals
- report generation prompt
- email rendering
- queue processor
- Meta CAPI purchase

Flow:

1. Complete free reading.
2. Reveal preview.
3. Enter email.
4. Create checkout.
5. Complete test/real Lemon purchase.
6. Return to `/full-report/?reading_id=...`.
7. Verify payment status unlocks paid form.
8. Submit 8 paid signals.
9. Wait for queue/cron or manually process job.
10. Confirm report email delivery.
11. Confirm Supabase status is `delivered`.
12. Confirm no duplicate job/email.
13. Confirm Meta `Purchase` if relevant.

## Secrets

Secrets must remain in platform secret stores:

- Cloudflare Worker secrets
- Lemon Squeezy dashboard
- Supabase project settings
- Resend dashboard
- Meta Events Manager / access token setup

Never commit:

- `SUPABASE_SERVICE_ROLE_KEY`
- `LEMON_SQUEEZY_API_KEY`
- `LEMON_SQUEEZY_WEBHOOK_SECRET`
- `OPENAI_API_KEY`
- `RESEND_API_KEY`
- `JOB_RUNNER_SECRET`
- `META_CAPI_ACCESS_TOKEN`

## Legal Pages

Existing static pages:

```text
/privacy/
/terms/
/refund/
/contact/
```

These support:

- ad review trust
- checkout confidence
- refund/support flow
- privacy disclosure

Do not remove them from navigation/footer.

## Operational Monitoring

Routine checks:

- Worker health endpoints
- Supabase recent failed readings
- queued/running/failed jobs
- Lemon webhook delivery status
- Resend email delivery
- Meta Events Manager
- Ads Manager delivery/rejection status
- protected aggregate purchaser streak and paid-signal delivery rates

Critical table checks:

```text
readings where status = 'failed'
report_generation_jobs where status in ('queued', 'running', 'failed')
webhook_events where processing_error is not null
readings where lemon_squeezy_order_id is not null and paid_answers_json is null
readings where paid_answers_json is not null and lemon_squeezy_order_id is null
```

## Recovery Scenarios

Payment succeeded, paid answers missing:

- customer may not have completed `/full-report/`
- resend receipt/full-report link
- verify reading id

Paid answers submitted, payment not verified:

- user may be on wrong link
- check Lemon order custom data
- ask for checkout email/order number

Job failed:

- inspect `last_error`
- fix root cause
- requeue if safe
- avoid duplicate email if already delivered

Email sent but status not delivered:

- check Resend idempotency key and message id
- if email side effect succeeded, update reading carefully
- do not resend blindly
