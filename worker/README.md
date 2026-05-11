# Your Love Element Worker

Cloudflare Worker backend for the paid report automation flow.

## Endpoints

- `POST /api/readings` stores the 10 free answers and returns `reading_id`.
- `POST /api/create-checkout` creates a Lemon Squeezy checkout for an existing reading.
- `POST /api/webhooks/lemon-squeezy` records and verifies Lemon Squeezy order webhooks.
- `POST /api/readings/:reading_id/paid-signals` stores the 8 paid answers.
- `POST /api/jobs/process` manually processes one queued report generation job.
- `POST /api/test-email` sends one protected Resend test email.

## Required Worker Secrets

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `LEMON_SQUEEZY_API_KEY`
- `LEMON_SQUEEZY_STORE_ID`
- `LEMON_SQUEEZY_VARIANT_ID`
- `LEMON_SQUEEZY_WEBHOOK_SECRET`
- `OPENAI_API_KEY`
- `RESEND_API_KEY`
- `JOB_RUNNER_SECRET`
- `META_CAPI_ACCESS_TOKEN` (required only for server-side Meta `Purchase` events)

## Optional Variables

- `SITE_URL` defaults to `https://yourloveelement.com`
- `SUPPORT_EMAIL` defaults to `support@yourloveelement.com`
- `FROM_EMAIL` should be `Your Love Element <reports@yourloveelement.com>` once Resend is verified
- `OPENAI_MODEL` is currently configured as `gpt-5.5`
- `META_PIXEL_ID` is configured as `4282306195342317`
- `META_GRAPH_API_VERSION` defaults to `v25.0`
- `META_TEST_EVENT_CODE` can be set temporarily while testing Conversions API events in Meta Events Manager

Plaintext runtime variables are managed in `wrangler.toml` so GitHub deployments do not overwrite Dashboard edits with stale values. Secrets still live only in Cloudflare Worker runtime secrets.

The GitHub Pages frontend sets `window.YLE_API_BASE_URL` to `https://your-love-element-api.goodrambo2013.workers.dev` before loading `script.js` on both `/` and `/full-report/`.

## Scheduled Report Delivery

`worker/wrangler.toml` configures a Cloudflare Cron trigger to run every 5 minutes. The Worker `scheduled` handler processes up to 3 queued report generation jobs per run.

Keep the protected `POST /api/jobs/process` endpoint for manual recovery and debugging. Normal production delivery should not rely on a human or external script calling it.

## Confirmed Lemon Squeezy Flow

The production checkout is intentionally created by the Worker, not by a static Lemon Squeezy product link. Keep this shape unless the payment architecture is changed deliberately:

1. `POST /api/readings` stores the free answers and returns a `reading_id`.
2. `POST /api/create-checkout` receives that `reading_id`.
3. The Worker creates a Lemon Squeezy checkout with `checkout_data.custom.reading_id`.
4. The Worker sets redirect and receipt links to `/full-report/?reading_id=...`.
5. Lemon Squeezy sends `order_created` and `order_refunded` events to `/api/webhooks/lemon-squeezy`.
6. The webhook verifies the `X-Signature` with `LEMON_SQUEEZY_WEBHOOK_SECRET`.
7. Payment and paid answers are joined by `reading_id`; report generation should only happen once both are present.
8. If `META_CAPI_ACCESS_TOKEN` is configured, the verified `order_created` webhook sends a server-side Meta Conversions API `Purchase` event.

## Meta Conversions API Purchase Tracking

The Worker sends `Purchase` only from the verified Lemon Squeezy `order_created` webhook. Do not send `Purchase` from the frontend checkout click; that would count people who opened checkout but never paid.

Runtime behavior:

- `META_CAPI_ACCESS_TOKEN` is a Cloudflare Worker secret and must not be committed.
- `META_PIXEL_ID` is a non-secret Worker variable.
- The purchase event uses `event_id = lemon_squeezy_order_created:{webhook_id/order_id}` for idempotency.
- Customer email is normalized, SHA-256 hashed, and sent as `user_data.em`.
- `reading_id` is SHA-256 hashed and sent as `user_data.external_id`.
- `value` and `currency` are read from the Lemon Squeezy order payload when available, with a `$9.99 USD` fallback.
- Meta failures are logged but do not fail the Lemon webhook, so payment confirmation and report delivery stay reliable.

To test in Meta Events Manager:

1. In Events Manager, open the dataset and go to `Test events`.
2. Copy the current server `test_event_code`.
3. Temporarily set Worker secret/variable `META_TEST_EVENT_CODE` to that value.
4. Complete a real or test Lemon Squeezy purchase.
5. Confirm `Purchase` appears under server events.
6. Remove or rotate `META_TEST_EVENT_CODE` after testing so production events are not marked as test traffic.

Production Lemon Squeezy store id is `365266`. Store id, variant id, API key, and webhook secret are Cloudflare Worker Secrets.

## Confirmed Deployment Flow

The confirmed deployment path for this repo is commit and push to `main`. Cloudflare is connected to GitHub and deploys the Worker from `worker/wrangler.toml`.

Use this flow after changing `worker/src/index.js` or `worker/wrangler.toml`:

1. Run `node --check worker/src/index.js`.
2. Commit the Worker changes.
3. Push to `origin main`.
4. Wait for the Cloudflare/GitHub deploy integration to publish the Worker.
5. Verify `https://your-love-element-api.goodrambo2013.workers.dev/api/health`.
6. For email template or prompt changes, run a fresh report E2E because old delivered emails cannot prove the new Worker code is live.

Do not rely on local `wrangler deploy` from Codex unless `wrangler`/`npx` is actually available and authenticated. In this workspace, local `npx wrangler deploy` was not available; the working path was commit + push.

GitHub Pages deploys the static site and assets. Worker code changes are validated through the Worker URL, not by the Pages build alone.

## Health Checks

- `GET /api/health` checks that the Worker is deployed.
- `GET /api/health/supabase` checks runtime Supabase configuration and REST access.
- `GET /api/health/email` checks runtime email configuration without exposing secrets. It is configuration-only because Resend Sending access keys can send email but may not have permission to read account domains.
- `GET /api/health/meta` checks whether Meta CAPI runtime settings are present without exposing secrets.
- `POST /api/test-email` requires `Authorization: Bearer <JOB_RUNNER_SECRET>`.

Use `POST /api/test-email` or a full report E2E to verify actual Resend delivery.

## Report Delivery

Report emails are sent as branded HTML transactional emails with:

- element-specific hero banners from `SITE_URL/assets/elements/{element}-banner.jpg`
- a personalized emotional summary
- styled report sections
- `30-Day Guidance` as timed checkpoint cards
- reply-to support routing

## Duplicate Email Prevention

Full report delivery must remain idempotent. A real purchase showed that cron retries can send duplicate emails if the Resend side effect succeeds but the later database updates do not complete cleanly.

Current guardrails:

- `sendReportEmail` sends `Idempotency-Key: full-report/{reading.id}` to Resend.
- If a queued job loads a reading already marked `delivered` with `email_message_id`, the Worker marks the job `succeeded` and does not send again.
- If a report was already generated, retries reuse stored `report_json`, `report_text`, and `report_html` instead of generating a new report.
- Do not remove these checks when changing `processNextQueuedReportJob`, cron behavior, or the Resend payload.

If duplicate full report emails reappear, inspect:

- duplicate `report_generation_jobs` rows for the same `reading_id`
- jobs that retried after Resend succeeded but before `email_message_id` was written
- Resend responses/errors around the duplicate timestamps
- whether the idempotency key was changed or omitted

PDF attachments are intentionally deferred until a reliable PDF rendering path is chosen.
