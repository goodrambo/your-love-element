# Supabase Database

Last updated: 2026-05-13

## Project

Supabase project ref:

```text
nmwhaiimnuywnjlvobde
```

MCP/server label used in earlier setup:

```text
supabase-your-love-element
```

## Migration Files

Apply in order:

```text
supabase/migrations/202605050001_create_paid_report_schema.sql
supabase/migrations/202605050002_harden_paid_report_functions.sql
supabase/migrations/202605050003_revoke_public_rls_auto_enable.sql
supabase/migrations/202605060001_grant_service_role_paid_report_tables.sql
supabase/migrations/202607290001_add_growth_scorecard_function.sql  # retained, known parser-invalid, do not apply
supabase/migrations/202607290002_add_growth_scorecard_function.sql  # superseding scorecard migration
supabase/migrations/202607300001_add_first_party_funnel_events.sql
```

The `202607290001` production attempt failed during parsing before any object was created. It remains checksum-protected as history; use `202607290002` instead and then apply `202607300001`.

## Tables

### readings

Authoritative state for a user's reading.

Stores:

- free answers
- paid answers
- customer email
- Lemon Squeezy checkout/order metadata
- payment status
- generated report HTML/text/JSON
- Resend email message id
- checkout URL
- error state
- lifecycle timestamps

Important columns:

```text
id
status
free_answers_json
paid_answers_json
customer_email
lemon_squeezy_checkout_id
lemon_squeezy_order_id
report_html
report_text
report_json
email_message_id
generation_attempts
```

### webhook_events

Audit and idempotency table for Lemon Squeezy webhooks.

Stores:

- provider
- event name
- external event id
- reading id
- payload
- received/processed timestamps
- processing error

### report_generation_jobs

Queue table for report generation and email delivery.

Stores:

- reading id
- job status
- attempts / max attempts
- lock metadata
- last error
- schedule timestamps

### funnel_events

Privacy-minimized first-party session stages. Stores only a UUID event id, SHA-256 session hash, allowlisted event/page, sanitized UTM labels, and receipt timestamp. A unique session/event/page index removes duplicate stages. No browser or authenticated role can read or write the table directly.

`funnel_event_maintenance` contains one retention timestamp. An after-insert statement trigger claims maintenance at most once per day and removes funnel events older than 180 days.

## Enums

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

Report job statuses:

```text
queued
running
succeeded
failed
cancelled
```

## Triggers

### set_updated_at

Keeps `updated_at` fresh on update.

### enqueue_report_generation_job_when_ready

Runs after `readings` insert/update on:

- `status`
- `lemon_squeezy_order_id`
- `paid_answers_json`

Queues a report generation job when:

```text
lemon_squeezy_order_id is not null
paid_answers_json is not null
status in ('paid', 'paid_answers_submitted')
```

This is the core join point between payment and paid answers.

## Constraints

Important constraints:

- customer email shape check
- generation attempts nonnegative
- paid statuses must have Lemon Squeezy order id
- paid-answer statuses must have paid answers
- delivered readings must have `email_message_id`

These make it harder for bugs to create impossible paid/report states.

## Indexes And Idempotency

Important unique indexes:

```text
readings_lemon_squeezy_order_id_key
readings_lemon_squeezy_checkout_id_key
webhook_events_provider_external_event_id_key
report_generation_jobs_one_active_per_reading_key
```

Why they matter:

- duplicate webhook cannot create duplicate processing
- one reading cannot have multiple active jobs
- checkout/order ids cannot attach to multiple readings

## RLS And Access Model

All product tables have RLS enabled.

Only `service_role` has policies:

```text
Service role can manage readings
Service role can manage webhook events
Service role can manage report generation jobs
```

Frontend rule:

```text
GitHub Pages frontend must not call Supabase directly.
```

Backend rule:

```text
Cloudflare Worker uses SUPABASE_SERVICE_ROLE_KEY.
```

## Security Hardening

Applied hardening:

- function search path pinned to `public, pg_temp`
- public execute revoked on exposed helper when present
- anon/authenticated revoked from product tables
- service_role explicit grants added

## Aggregate Growth Scorecard

`get_growth_scorecard(start_date, end_date)` returns one Asia/Taipei aggregate row per day for the protected Worker admin endpoint. It calculates preview, checkout, verified non-refunded purchaser/order, refund, paid-signal, delivery, and failure counts. Purchaser deduplication happens inside PostgreSQL using Lemon customer identity with order identity fallback; neither value is returned.

Execution is revoked from `public`, `anon`, and `authenticated` and granted only to `service_role`. The function returns no customer email, reading/order/customer identifiers, answers, webhook payloads, or report content.

`get_first_party_funnel_scorecard(start_date, end_date)` returns aggregate session-stage counts by date, page, and sanitized UTM labels. It never returns session hashes or event rows. It is also executable only by `service_role`.

## New Product Reuse

For the next product, reuse this pattern:

```text
primary user record table
webhook_events table
generation_jobs table
status enum
job status enum
RLS service_role only
unique webhook idempotency index
one active job per record index
trigger that queues only when payment + required inputs are both present
```
