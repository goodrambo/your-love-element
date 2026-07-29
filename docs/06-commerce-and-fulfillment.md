# Commerce And Fulfillment

Last updated: 2026-05-13

## Commerce Provider

Provider:

```text
Lemon Squeezy
```

Store id:

```text
365266
```

Product:

```text
Your Love Element: Full Relationship Report
```

Price:

```text
$9.99 USD
```

Copy source:

```text
lemon-squeezy-product-copy.md
```

## Why Checkout Is Created By Worker

Static product links cannot reliably attach the user's free reading to the payment.

The Worker creates checkout dynamically so it can include:

```text
checkout_data.custom.reading_id
```

That `reading_id` is the key that joins:

- free answers
- checkout session
- Lemon order
- paid answers
- generated report
- delivered email

## Checkout Flow

```text
User reveals free preview
  -> enters delivery email
  -> frontend POST /api/create-checkout
  -> Worker validates reading and email
  -> Worker creates Lemon checkout
  -> Worker stores checkout id/url
  -> frontend redirects to Lemon Squeezy
```

Checkout return/receipt URL:

```text
https://yourloveelement.com/full-report/?reading_id=...
```

## Payment Webhook Flow

```text
Lemon Squeezy order_created
  -> POST /api/webhooks/lemon-squeezy
  -> Worker verifies signature
  -> Worker records webhook event
  -> Worker dedupes external event id
  -> Worker updates reading with order metadata
  -> Worker sends Meta CAPI Purchase
  -> Supabase trigger may queue report job if paid answers already exist
```

Refund event:

- `order_refunded` can move payment state to refund-related handling.
- It should not cause duplicate report generation.

## Paid Signal Flow

After payment, the user answers 8 deeper questions on:

```text
/full-report/?reading_id=...
```

Frontend checks:

```text
GET /api/readings/:reading_id/status
```

Then submits:

```text
POST /api/readings/:reading_id/paid-signals
```

If payment is verified, status becomes:

```text
paid_answers_submitted
```

Supabase trigger queues the report job.

## Fulfillment Flow

```text
queued report_generation_job
  -> Cloudflare cron picks it up
  -> Worker claims the job
  -> Worker sets reading generating
  -> OpenAI report generated
  -> report stored
  -> Resend email sent
  -> reading marked delivered
```

Expected customer message:

```text
Most reports arrive within a few minutes.
```

## Email Delivery

Provider:

```text
Resend
```

From:

```text
Your Love Element <reports@yourloveelement.com>
```

Reply/support:

```text
support@yourloveelement.com
```

The email includes:

- element-specific banner image
- relationship signal profile
- report sections
- 30-day guidance as checkpoint cards
- disclaimer
- support contact

## Customer Support Cases

Support should be prepared for:

- duplicate charge
- failed checkout
- checkout paid but no report link
- report email not received
- wrong email entered
- report generation failed
- refund request

Support investigation should use:

- checkout email
- Lemon order id/order number
- reading id from URL
- Supabase `readings`
- `webhook_events`
- `report_generation_jobs`
- Resend email message id

## Refund Policy Shape

Because this is a personalized digital report:

- refund eligibility can depend on whether report was generated/delivered
- duplicate charges, failed delivery, and technical issues should be reviewed promptly

Pages already exist:

- `/refund/`
- `/terms/`
- `/privacy/`
- `/contact/`

## Fulfillment Guardrails

- Do not generate reports before both payment and paid answers exist.
- Do not send report emails without idempotency key.
- Do not move delivered readings backward.
- Do not let duplicate webhooks enqueue duplicate jobs.
- Do not block Lemon webhook success because Meta CAPI failed.
- Do not expose Supabase service key or webhook secrets to frontend.
