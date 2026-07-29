# Backend Worker Implementation

Last updated: 2026-05-13

## Main Files

- `worker/src/index.js`
- `worker/wrangler.toml`
- `worker/README.md`

Worker name:

```text
your-love-element-api
```

Production API:

```text
https://your-love-element-api.goodrambo2013.workers.dev
```

## Endpoints

```text
POST /api/readings
POST /api/create-checkout
GET  /api/readings/:reading_id/status
POST /api/webhooks/lemon-squeezy
POST /api/readings/:reading_id/paid-signals
POST /api/jobs/process
POST /api/test-email
POST /api/analytics/events
GET  /api/admin/growth-metrics
GET  /api/health
GET  /api/health/supabase
GET  /api/health/email
GET  /api/health/meta
```

## Required Secrets

```text
SUPABASE_SERVICE_ROLE_KEY
LEMON_SQUEEZY_API_KEY
LEMON_SQUEEZY_STORE_ID
LEMON_SQUEEZY_VARIANT_ID
LEMON_SQUEEZY_WEBHOOK_SECRET
OPENAI_API_KEY
RESEND_API_KEY
JOB_RUNNER_SECRET
META_CAPI_ACCESS_TOKEN
```

## Runtime Variables

Configured in `worker/wrangler.toml`:

```text
SITE_URL = https://yourloveelement.com
SUPABASE_URL = https://nmwhaiimnuywnjlvobde.supabase.co
SUPPORT_EMAIL = support@yourloveelement.com
FROM_EMAIL = Your Love Element <reports@yourloveelement.com>
OPENAI_MODEL = gpt-5.5
META_PIXEL_ID = 4282306195342317
META_GRAPH_API_VERSION = v25.0
```

`SUPABASE_URL` is a non-secret endpoint. Service-role credentials and provider tokens remain Worker secrets.

## Scheduled Job

Cloudflare Cron:

```text
*/5 * * * *
```

The scheduled handler processes up to 3 queued report generation jobs per run.

Manual recovery endpoint:

```text
POST /api/jobs/process
Authorization: Bearer <JOB_RUNNER_SECRET>
```

## Reading Creation

Endpoint:

```text
POST /api/readings
```

Function:

```text
createReading()
```

Behavior:

- validates required free answers
- inserts a `readings` row
- sets status to `previewed`
- returns `reading_id`

## Checkout Creation

Endpoint:

```text
POST /api/create-checkout
```

Function:

```text
createCheckout()
```

Behavior:

- requires a valid `reading_id`
- validates delivery email
- blocks duplicate checkout for statuses already in paid/report progress
- creates Lemon Squeezy checkout
- injects `reading_id` into checkout custom data
- sets redirect and receipt link to `/full-report/?reading_id=...`
- updates reading to `checkout_created`

Guardrail:

Do not use static Lemon Squeezy product links for this funnel unless replacing the payment architecture. The dynamic checkout is how the system connects payment to a reading.

## Lemon Squeezy Webhook

Endpoint:

```text
POST /api/webhooks/lemon-squeezy
```

Function:

```text
handleLemonSqueezyWebhook()
```

Behavior:

- reads raw request body
- verifies `X-Signature` with `LEMON_SQUEEZY_WEBHOOK_SECRET`
- records webhook payload in `webhook_events`
- dedupes by `provider + external_event_id`
- finds `reading_id` from webhook custom data
- updates order metadata on reading
- sets payment status
- sends Meta CAPI `Purchase` for verified `order_created`

Guardrails:

- duplicates should return safely
- CAPI failure should not fail the Lemon webhook
- a late or duplicate webhook must not move delivered/generating states backward

## Paid Signals

Endpoint:

```text
POST /api/readings/:reading_id/paid-signals
```

Function:

```text
submitPaidSignals()
```

Behavior:

- validates required paid answers
- blocks locked statuses
- stores paid answers
- sets status to `paid_answers_submitted` if order exists
- database trigger queues report job when payment and paid answers are both present

Locked statuses:

```text
generating
report_generated
delivered
failed
```

## Report Queue Processor

Functions:

- `processReportQueue()`
- `processNextQueuedReportJob()`

Behavior:

1. selects one queued job due now
2. conditionally claims it by updating `status=queued` to `running`
3. updates reading to `generating`
4. generates or reuses stored report
5. updates reading to `report_generated`
6. sends report email
7. marks reading `delivered`
8. marks job `succeeded`

Retry behavior:

- max attempts default: 3
- failed non-terminal job returns to `queued`
- terminal failure marks job and reading failed
- if retry discovers reading already delivered, job becomes `succeeded` without sending again

## Meta CAPI Purchase

Function:

```text
sendMetaPurchaseEvent()
```

Only called from verified Lemon Squeezy `order_created`.

Payload uses:

- event name: `Purchase`
- event id: `lemon_squeezy_order_created:{webhook_id/order_id}`
- hashed email: `user_data.em`
- hashed reading id: `user_data.external_id`
- value/currency from order payload with `$9.99 USD` fallback
- `action_source: website`
- `event_source_url` pointing to `/full-report/?reading_id=...`

## Report Email

Function:

```text
sendReportEmail()
```

Provider:

```text
Resend
```

Idempotency:

```text
Idempotency-Key: full-report/{reading.id}
```

Email content is produced by:

- `buildReportEmail()`
- `normalizeReportSections()`
- `renderEmailSection()`
- `renderTimelineSection()`

## Health Checks

Use these to verify runtime configuration:

```text
GET /api/health
GET /api/health/supabase
GET /api/health/email
GET /api/health/meta
```

Use `POST /api/test-email` to test actual Resend delivery.

## Growth Scorecard

`GET /api/admin/growth-metrics` requires `Authorization: Bearer <JOB_RUNNER_SECRET>` before any Supabase request. It accepts a 1-90 day closed Asia/Taipei range, calls the service-role-only `get_growth_scorecard` RPC, and returns aggregate counts, fulfillment rates, and the verified-purchaser streak. Successful responses are private/no-store and have no browser CORS.

The endpoint exposes no customer-, order-, reading-, session-, answer-, webhook-, or report-level values. Its gross USD value is explicitly an estimate based on the fixed `$9.99` list price; settled revenue and acquisition economics remain provider data. Once both scorecard migrations are applied, it merges verified Lemon/Supabase state with aggregate first-party session stages and sanitized UTM breakdowns.

## First-Party Funnel Ingestion

`POST /api/analytics/events` is a public browser endpoint with strict production-origin, 4 KiB body, UUID, page, event-name, and UTM allowlists. The Worker SHA-256 hashes the random tab-session UUID before a service-role insert. It ignores all unrecognized input fields and rejects frontend `Purchase`.

The endpoint must stay failure-isolated from the reading and paid flows. Never add email, IP, user agent, full URL/query, referrer, reading/order/customer IDs, answers, or report content to the event record.
