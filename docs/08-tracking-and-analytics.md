# Tracking And Analytics

Last updated: 2026-07-30

## Measurement Sources

- Lemon webhook and Supabase reading state are authoritative for verified purchases, refunds, and fulfillment.
- The first-party Worker endpoint records privacy-minimized session stages and sanitized UTM labels for daily funnel diagnosis.
- Meta remains the source for ad delivery, spend, attributed events, CAC, and ROAS.

Never substitute a frontend or first-party checkout event for a verified purchase.

## First-Party Funnel

Production landing and full-report pages send allowlisted stages to `POST /api/analytics/events`. A random UUID lasts only for the current tab session and is SHA-256 hashed by the Worker before storage. One event/page stage is counted once per hashed session.

Stored fields are limited to event id, session hash, event name, `landing`/`full_report`, sanitized `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, and receipt time. The event record contains no IP, user agent, email, full URL/query, referrer, reading/order/customer id, answers, webhook payload, or report content and expires after 180 days.

The protected growth scorecard merges these session-stage aggregates with authoritative verified purchases. The first-party endpoint does not accept `Purchase`.

## Meta Dataset

Dataset / Pixel:

```text
Your Love Element
```

Pixel id:

```text
4282306195342317
```

## Frontend Pixel Files

```text
assets/runtime-config.js
assets/tracking-config.js
assets/meta-pixel-base.js
script.js
```

`runtime-config.js` distinguishes the production domain from local/preview hosts. `tracking-config.js` exposes the Pixel id only in production:

```js
window.YLE_META_PIXEL_ID = window.YLE_RUNTIME_MODE === "production"
  ? "4282306195342317"
  : "";
```

`meta-pixel-base.js` loads Pixel in the document head and sends early `PageView`.

`script.js` sends Meta and first-party product funnel events and attaches UTM data when present.

Localhost and non-production preview hosts do not load Meta Pixel or send first-party production funnel events.

## Browser Events

Standard:

```text
PageView
ViewContent
InitiateCheckout
```

Custom:

```text
landing_cta_click
quiz_start
preview_revealed
checkout_created
paid_signals_submitted
share_card_generated
share_card_shared
share_card_link_shared
share_card_downloaded
```

## Event Definitions

As of 2026-06-05:

- `landing_cta_click`: diagnostic custom event fired when a homepage hero CTA is clicked. It helps distinguish visitors who saw/clicked the first-viewport offer from visitors who only loaded the page.
- `quiz_start`: custom event fired when the visitor first selects a free-reading answer. Earlier versions fired this later, after the first answer plus the `Continue` button. Treat pre-2026-06-05 and post-2026-06-05 `quiz_start` counts as different definitions.
- `preview_revealed`: custom event fired after all 10 free-reading questions are complete and the preview is revealed.
- `InitiateCheckout`: standard event fired after the frontend successfully creates a Lemon Squeezy checkout.
- `checkout_created`: custom event fired alongside successful checkout creation.
- `Purchase`: server-side CAPI event fired only by the Worker after a verified Lemon Squeezy `order_created` webhook.

Do not use `landing_cta_click` as the main optimization event unless the ads strategy is intentionally changed. It is primarily a diagnostic step between `ViewContent` and `quiz_start`.

## Server Events

Server-side `Purchase` is sent by the Worker through Meta Conversions API.

Source:

```text
verified Lemon Squeezy order_created webhook
```

Important:

```text
Do not send Purchase from frontend JavaScript.
```

Reason:

- frontend checkout click means intent, not payment
- Lemon Squeezy payment can fail or be abandoned
- only verified webhook proves purchase

## CAPI Runtime

Worker variables/secrets:

```text
META_PIXEL_ID = 4282306195342317
META_GRAPH_API_VERSION = v25.0
META_CAPI_ACCESS_TOKEN = secret
META_TEST_EVENT_CODE = optional temporary test value
```

Health check:

```text
GET /api/health/meta
```

## CAPI Purchase Payload

Worker sends:

- `event_name: Purchase`
- `action_source: website`
- `event_source_url: https://yourloveelement.com/full-report/?reading_id=...`
- `event_id: lemon_squeezy_order_created:{webhook_id/order_id}`
- `user_data.em`: hashed email
- `user_data.external_id`: hashed reading id
- `custom_data.currency`
- `custom_data.value`
- `custom_data.order_id`
- product metadata

Idempotency:

- Meta event id prevents duplicate counting when possible.
- webhook_events table prevents duplicate processing.

## UTM Parameters

Frontend reads:

```text
utm_source
utm_medium
utm_campaign
utm_content
utm_term
```

Meta launch URL example:

```text
https://yourloveelement.com/?utm_source=meta&utm_medium=paid_social&utm_campaign=202605_cpa_purchase_launch&utm_content=a_private_reading_4x5&utm_term=broad
```

Use consistent naming so Ads Manager and internal logs can be compared.

Organic share-card referrals use one fixed URL:

```text
https://yourloveelement.com/?utm_source=share_card&utm_medium=referral&utm_campaign=organic_share&utm_content=result_card
```

The URL deliberately excludes the reader's element, answers, email, session, reading, order, and customer identifiers. Referral impact is evaluated only from aggregate landing/funnel counts after natural visits occur.

## Recommended Ads Manager Columns

```text
Amount spent
CPM
Reach
Frequency
Outbound clicks
Outbound CTR
CPC outbound
Landing page views
ViewContent
landing_cta_click
quiz_start
preview_revealed
InitiateCheckout
checkout_created
Purchase
Cost per Purchase
Purchase conversion value
ROAS
```

## Funnel Interpretation

If:

```text
landing page views / ViewContent but no landing_cta_click
```

Then inspect:

- landing page first viewport
- page load speed
- ad promise mismatch
- tracking load issue

If:

```text
landing_cta_click but no quiz_start
```

Then inspect:

- first-question clarity
- mobile quiz visibility
- cookie notice obstruction
- answer-tap auto-advance behavior

If:

```text
quiz_start but no preview_revealed
```

Then inspect:

- quiz length
- question friction
- validation issue
- mobile UI

If:

```text
preview_revealed but no InitiateCheckout
```

Then inspect:

- paid offer clarity
- price framing
- trust copy
- email field friction

If:

```text
InitiateCheckout / checkout_created but no Purchase
```

Then inspect:

- Lemon checkout page
- payment methods
- price objection
- customer trust
- checkout errors

If:

```text
Purchase but no paid_signals_submitted
```

Then inspect:

- Lemon redirect
- receipt link
- full-report payment verification UX
- user confusion after checkout

## Testing

Browser events:

- Meta Events Manager Test Events
- Meta Pixel Helper

Server events:

1. Set temporary `META_TEST_EVENT_CODE`.
2. Complete a test or real Lemon purchase.
3. Confirm server `Purchase`.
4. Remove `META_TEST_EVENT_CODE` after testing.

## Guardrails

- Keep CAPI access token as Worker secret.
- Do not commit secrets.
- Do not send frontend Purchase.
- Do not change `quiz_start` timing again without noting the reporting break.
- Do not remove `/api/health/meta`.
- Do not make cookie buttons imply choices that tracking does not respect.
- Do not change event names without updating ads/reporting docs.
- Do not add personal fields, full URLs, referrers, device fingerprints, answers, or reading/order identifiers to first-party events.
- Keep first-party ingestion failure-isolated and origin/size/allowlist validated.
