# New Product Playbook

Last updated: 2026-05-13

Use this when launching the next low-ticket personalized digital product.

## Phase 1 - Product Definition

Define:

- product name
- target customer
- emotional promise
- free preview value
- paid unlock value
- price
- delivery method
- refund/support policy
- disclaimer boundaries

Recommended offer shape:

```text
Free quiz/diagnostic
  -> personalized preview
  -> low-ticket paid full report
  -> email delivery
```

Before building, write:

- checkout headline
- short description
- what's included
- delivery note
- refund note
- support email

## Phase 2 - Funnel Design

Map:

```text
traffic source
landing page
free questions
preview result
paid unlock
checkout
post-purchase questions
generation
delivery
support
```

Decide:

- which answers are free
- which answers are paid
- what preview shows
- what full report adds
- what event marks activation
- what event marks purchase

## Phase 3 - Technical Scaffold

Reuse architecture:

```text
Static frontend
Cloudflare Worker
Supabase
Lemon Squeezy
OpenAI
Resend
Meta/analytics
```

Create:

- homepage
- result preview
- post-checkout page
- Worker API
- Supabase schema
- checkout product
- webhook endpoint
- email template
- legal/support pages

## Phase 4 - Database Pattern

Create:

- primary records table
- webhook events table
- generation jobs table
- status enum
- job status enum
- RLS service-role-only policies
- trigger that queues generation when payment and required paid inputs exist
- unique webhook idempotency index
- one active job per record index

## Phase 5 - Backend Pattern

Implement endpoints:

```text
POST /api/records
POST /api/create-checkout
GET  /api/records/:id/status
POST /api/webhooks/payment-provider
POST /api/records/:id/paid-inputs
POST /api/jobs/process
GET  /api/health/*
```

Keep:

- signature verification
- idempotent webhook processing
- idempotent email sending
- retry-safe generation
- no frontend purchase event

## Phase 6 - AI Report Pattern

Do not ask the model to invent everything.

Use:

```text
answers
  -> deterministic scoring/profile
  -> structured model prompt
  -> normalized sections
  -> stored JSON/text/HTML
  -> email rendering
```

For each product, define:

- dimensions
- scoring labels
- required sections
- tone rules
- forbidden claims
- disclaimer

## Phase 7 - Tracking

Set up:

- Pixel/dataset
- browser events
- server-side purchase event
- UTM scheme
- health endpoint
- test events

Minimum funnel events:

```text
PageView
ViewContent
quiz_start
preview_revealed
InitiateCheckout
checkout_created
paid_inputs_submitted
Purchase
```

Only send `Purchase` from verified payment webhook.

## Phase 8 - Visual System

Create:

- hero image
- social preview
- product/report mockup
- 5-10 organic launch posts
- share-card templates if the product has results
- ad base images in 4:5, 1:1, 9:16

Rules:

- generate base visuals without text
- add ad text manually
- QA all crops
- keep style premium and legible
- avoid exaggerated claims

## Phase 9 - Legal And Trust

Must have:

- Contact
- Privacy
- Terms
- Refund
- support email
- clear price
- clear delivery promise
- disclaimer boundary

These improve:

- customer confidence
- payment trust
- ad review trust
- support readiness

## Phase 10 - Launch Checklist

Before paid traffic:

- health endpoints pass
- checkout works
- webhook verified
- report delivered
- no duplicate email on retry
- Pixel browser events verified
- CAPI Purchase verified
- legal pages live
- support email works
- mobile UX checked
- share card checked

## Phase 11 - Paid Acquisition

Start simple:

```text
1 campaign
1 broad ad set
1-3 clean ads
no AI creative enhancement
no text rewriting
no personal-attribute copy
```

Judge after real delivery and spend, not immediately after publishing.

If platform blocks ads:

- appeal
- do not evade
- run organic/search/creator alternatives meanwhile

## Phase 12 - First Optimization Readout

After enough data:

Check:

- spend
- delivery
- outbound CTR
- CPC
- landing page views
- quiz start rate
- preview reveal rate
- checkout start rate
- purchase rate
- paid input completion
- support issues
- comments/policy risk

Decide:

- keep winner
- add variants
- improve landing page
- improve offer
- fix checkout friction
- pause and rework angle

## Phase 13 - Documentation Habit

For every new product, keep:

- product blueprint
- architecture overview
- platform setup
- tracking setup
- launch kit
- pitfalls/guardrails
- incident log

Write the docs while building. The value is not just memory; it is launch speed for the next product.
