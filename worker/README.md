# Your Love Element Worker

Cloudflare Worker backend for the paid report automation flow.

## Endpoints

- `POST /api/readings` stores the 10 free answers and returns `reading_id`.
- `POST /api/create-checkout` creates a Lemon Squeezy checkout for an existing reading.
- `POST /api/webhooks/lemon-squeezy` records and verifies Lemon Squeezy order webhooks.
- `POST /api/readings/:reading_id/paid-signals` stores the 8 paid answers.
- `POST /api/jobs/process` processes one queued report generation job.
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

## Optional Variables

- `SITE_URL` defaults to `https://yourloveelement.com`
- `SUPPORT_EMAIL` defaults to `support@yourloveelement.com`
- `FROM_EMAIL` should be `Your Love Element <reports@yourloveelement.com>` once Resend is verified
- `OPENAI_MODEL` is currently configured as `gpt-5.5`

Plaintext runtime variables are managed in `wrangler.toml` so GitHub deployments do not overwrite Dashboard edits with stale values. Secrets still live only in Cloudflare Worker runtime secrets.

The GitHub Pages frontend sets `window.YLE_API_BASE_URL` to `https://your-love-element-api.goodrambo2013.workers.dev` before loading `script.js` on both `/` and `/full-report/`.

## Confirmed Lemon Squeezy Flow

The production checkout is intentionally created by the Worker, not by a static Lemon Squeezy product link. Keep this shape unless the payment architecture is changed deliberately:

1. `POST /api/readings` stores the free answers and returns a `reading_id`.
2. `POST /api/create-checkout` receives that `reading_id`.
3. The Worker creates a Lemon Squeezy checkout with `checkout_data.custom.reading_id`.
4. The Worker sets redirect and receipt links to `/full-report/?reading_id=...`.
5. Lemon Squeezy sends `order_created` and `order_refunded` events to `/api/webhooks/lemon-squeezy`.
6. The webhook verifies the `X-Signature` with `LEMON_SQUEEZY_WEBHOOK_SECRET`.
7. Payment and paid answers are joined by `reading_id`; report generation should only happen once both are present.

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
- `POST /api/test-email` requires `Authorization: Bearer <JOB_RUNNER_SECRET>`.

Use `POST /api/test-email` or a full report E2E to verify actual Resend delivery.

## Report Delivery

Report emails are sent as branded HTML transactional emails with:

- element-specific hero banners from `SITE_URL/assets/elements/{element}-banner.jpg`
- a personalized emotional summary
- styled report sections
- `30-Day Guidance` as timed checkpoint cards
- reply-to support routing

PDF attachments are intentionally deferred until a reliable PDF rendering path is chosen.
