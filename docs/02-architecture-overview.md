# Architecture Overview

Last updated: 2026-05-13

## System Shape

`Your Love Element` is intentionally simple at the surface and more careful behind the scenes:

```text
Static site on GitHub Pages
  -> Cloudflare Worker API
  -> Supabase service-role REST calls
  -> Lemon Squeezy checkout + webhooks
  -> OpenAI report generation
  -> Resend transactional email
  -> Meta Pixel + CAPI tracking
```

The frontend never talks to Supabase directly. It only calls the Worker.

## Static Frontend

Files:

- `index.html`
- `full-report/index.html`
- `script.js`
- `styles.css`
- `assets/`

Responsibilities:

- render landing page
- collect free 10-question answers
- build free preview client-side
- save free answers through Worker
- create Lemon checkout through Worker
- render paid 8-signal page
- verify payment state before paid answers can be submitted
- generate and share preview cards
- send frontend Meta events

## Worker Backend

Files:

- `worker/src/index.js`
- `worker/wrangler.toml`

Responsibilities:

- validate API requests
- write and read Supabase data
- create Lemon Squeezy checkout
- verify Lemon Squeezy webhook signatures
- send server-side Meta `Purchase`
- accept paid signals
- process queued report-generation jobs
- call OpenAI
- send report emails through Resend
- expose health endpoints

## Database

Supabase tables:

- `readings`
- `webhook_events`
- `report_generation_jobs`

Security:

- RLS enabled.
- Only `service_role` can access product tables.
- Frontend cannot read or write database tables directly.

## Payment

Payment provider:

- Lemon Squeezy

Important architecture decision:

- Checkout is created dynamically by the Worker.
- Static product links are not used for the main funnel.
- `reading_id` is attached to checkout custom data so payment can be joined back to the user's reading.

## AI Generation

Model:

- Worker variable `OPENAI_MODEL = gpt-5.5`

Generation flow:

1. Worker computes deterministic scoring profile from free + paid answers.
2. Worker passes scoring profile and answers into an OpenAI Chat Completions request.
3. Worker requires structured JSON.
4. Worker normalizes sections.
5. Worker stores `report_json`, `report_text`, and `report_html`.
6. Worker sends branded HTML email.

## Email

Provider:

- Resend

Sender:

```text
Your Love Element <reports@yourloveelement.com>
```

Support email:

```text
support@yourloveelement.com
```

Important guardrail:

- `sendReportEmail` uses `Idempotency-Key: full-report/{reading.id}`.
- This protects against duplicate report emails on Worker retry.

## Tracking

Frontend:

- Meta Pixel base loads from `assets/meta-pixel-base.js`.
- `script.js` sends funnel events.

Server:

- Worker sends `Purchase` through Meta Conversions API from verified Lemon Squeezy webhook only.

Main events:

- `PageView`
- `ViewContent`
- `quiz_start`
- `preview_revealed`
- `InitiateCheckout`
- `checkout_created`
- `paid_signals_submitted`
- `Purchase`

## State Machine

Reading statuses:

```text
previewed
checkout_created
paid
paid_answers_submitted
generating
report_generated
delivered
failed
```

Job statuses:

```text
queued
running
succeeded
failed
cancelled
```

The most important system rule:

```text
Never move a delivered or generating reading backward.
```

This prevents duplicate report generation and duplicate email delivery.

## External Platform Inventory

- GitHub Pages: static website hosting.
- Cloudflare Workers: backend API and cron job runner.
- Supabase: database and RLS.
- Lemon Squeezy: checkout, order webhooks, refunds.
- OpenAI: report generation.
- Resend: transactional email.
- Meta: Pixel, Conversions API, paid ads.
- Google Fonts: frontend typography.
