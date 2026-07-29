# Third Party Platforms

Last updated: 2026-07-12

This file lists every important external platform used by `Your Love Element`, what it is used for, and what to preserve for future products.

## GitHub

Used for:

- source control
- GitHub Pages static frontend deployment
- Cloudflare deploy integration source

Current deployment habit:

```text
commit -> push to origin/main -> frontend/Worker deploys through connected services
```

Preserve:

- clear commit history
- docs updated with product-significant changes
- no secrets committed

## GitHub Pages

Used for:

- static website hosting
- custom domain hosting for `https://yourloveelement.com`

Serves:

- `index.html`
- `full-report/index.html`
- legal pages
- static assets
- social/ad images

Important:

- `assets/runtime-config.js` gives only the production domain a Worker API base; local/preview hosts remain offline
- frontend does not call Supabase directly
- legal pages support ad review and checkout trust

## Cloudflare Workers

Used for:

- backend API
- checkout creation
- webhook handling
- report generation queue processor
- cron job
- health checks

Worker:

```text
your-love-element-api
```

Production URL:

```text
https://your-love-element-api.goodrambo2013.workers.dev
```

Cron:

```text
*/5 * * * *
```

Secrets stored here:

- Supabase service role key
- Lemon Squeezy API key
- Lemon webhook secret
- OpenAI API key
- Resend API key
- Meta CAPI token
- job runner secret

Do not expose Worker secrets to frontend.

## Cloudflare DNS / Custom Domain

Used indirectly for:

- `yourloveelement.com`
- Worker API domain

Current frontend domain:

```text
https://yourloveelement.com
```

Important:

- keep canonical URL stable
- avoid changing domain during Meta review or early paid tests
- CNAME file exists in repo

## Supabase

Used for:

- reading records
- payment state
- webhook audit/idempotency
- report queue
- generated report storage
- email delivery state

Project ref:

```text
nmwhaiimnuywnjlvobde
```

Tables:

- `readings`
- `webhook_events`
- `report_generation_jobs`

Access model:

- Worker uses service role
- frontend has no direct table access
- RLS is enabled
- anon/authenticated are intentionally not granted access

## Lemon Squeezy

Used for:

- digital product checkout
- payment processing
- order webhook
- refund lifecycle

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

Important:

- Worker creates checkout dynamically
- checkout custom data includes `reading_id`
- webhook endpoint verifies signature
- order_created triggers payment state update and CAPI Purchase
- static product link is not used for the main funnel

## Resend

Used for:

- transactional full-report email delivery
- test email endpoint

From:

```text
Your Love Element <reports@yourloveelement.com>
```

Support:

```text
support@yourloveelement.com
```

Important:

- use `Idempotency-Key: full-report/{reading.id}`
- email message id is stored in Supabase
- report email is the customer-facing fulfillment artifact

## OpenAI

Used for:

- paid report generation

Current Worker variable:

```text
OPENAI_MODEL = gpt-5.5
```

Architecture:

- Worker computes deterministic scoring profile first
- OpenAI receives structured prompt and scoring context
- output is normalized into report sections
- raw scoring stays internal

Important:

- do not expose raw score table to customer
- do not rely on model alone for business logic
- run full paid-report E2E after prompt/rendering changes

## Meta

Used for:

- Pixel browser tracking
- Conversions API server-side `Purchase`
- paid acquisition testing

Dataset / Pixel:

```text
Your Love Element
4282306195342317
```

Browser events:

- `PageView`
- `ViewContent`
- `quiz_start`
- `preview_revealed`
- `InitiateCheckout`
- `checkout_created`
- `paid_signals_submitted`

Server event:

- `Purchase` from verified Lemon Squeezy webhook only

Ad campaign:

```text
YLE_Meta_USEN_CPA-Purchase_Launch_202605
```

Important incident:

- Meta initially restricted the business/ad account for account integrity / suspected automation.
- Appeal passed on 2026-05-13.
- Do not bypass Meta restrictions with a personal ad account or new Business Manager.

## Google Fonts

Used for:

- frontend typography

Fonts:

```text
Inter
Playfair Display
```

Loaded in:

```text
index.html
```

Design role:

- Manrope for UI/body copy
- Fraunces for romantic/editorial headings

## Browser / QA Tooling

Used during development:

- local static server with `python3 -m http.server 8000`
- production API and Pixel disabled on localhost by `assets/runtime-config.js`
- headless Chrome screenshots
- temporary QA scripts under `/private/tmp`

Known QA scripts from earlier passes:

```text
/private/tmp/yle_share_qa.py
/private/tmp/yle_share_payload_qa.py
```

They verified:

- free quiz flow
- share card panel visibility
- generated share card dimensions
- native share payload shape

## Platform Setup Order For Future Products

Recommended order:

1. GitHub repo and static frontend.
2. Custom domain and legal pages.
3. Supabase schema.
4. Cloudflare Worker with health checks.
5. Lemon Squeezy product and webhook.
6. Resend sender/domain.
7. OpenAI report generation.
8. Meta Pixel and CAPI.
9. End-to-end checkout/report delivery.
10. Paid ads only after tracking and legal pages are verified.
