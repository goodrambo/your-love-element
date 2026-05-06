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
- `OPENAI_MODEL` defaults to `gpt-4.1-mini`

The GitHub Pages frontend should set `window.YLE_API_BASE_URL` to the deployed Worker origin once the Worker route is live.

## Health Checks

- `GET /api/health` checks that the Worker is deployed.
- `GET /api/health/supabase` checks runtime Supabase configuration and REST access.
- `GET /api/health/email` checks runtime Resend configuration and API reachability without exposing secrets.
- `POST /api/test-email` requires `Authorization: Bearer <JOB_RUNNER_SECRET>`.

## Report Delivery

Report emails are sent as branded HTML transactional emails with:

- a hero image from `SITE_URL/assets/hero-soulmate-report.png`
- a personalized emotional summary
- styled report sections
- reply-to support routing

PDF attachments are intentionally deferred until a reliable PDF rendering path is chosen.
