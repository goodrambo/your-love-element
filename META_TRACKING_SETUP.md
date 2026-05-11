# Meta Tracking Setup

Last updated: 2026-05-12

## What Is Already Configured In The Site

The website now has default Meta Pixel support for ad measurement.

- Pixel code loads by default for ad measurement.
- The cookie notice is informational and does not gate tracking.
- Pixel ID is centralized in `assets/tracking-config.js`.
- The base pixel loads in the page `<head>` through `assets/meta-pixel-base.js`.
- The site sends:
  - `PageView`
  - `ViewContent` on the homepage
  - custom `quiz_start`
  - custom `preview_revealed`
  - standard `InitiateCheckout`
  - custom `checkout_created`
  - custom `paid_signals_submitted`
- Events include UTM parameters from the landing URL when present:
  - `utm_source`
  - `utm_medium`
  - `utm_campaign`
  - `utm_content`
  - `utm_term`

Do not send `Purchase` from the frontend. Payment happens in Lemon Squeezy, so reliable purchase tracking comes from the Lemon Squeezy webhook through Meta Conversions API.

Current confirmed Pixel/Dataset ID:

```text
4282306195342317
```

Confirmed production state:

- Browser Pixel events are active.
- Server-side CAPI `Purchase` is active.
- `META_CAPI_ACCESS_TOKEN` is configured in Cloudflare Worker secrets.
- `/api/health/meta` returns `ok: true`.

## Step 1: Create The Meta Pixel / Dataset

1. Open Meta Events Manager.
2. Click `Connect data`.
3. Choose `Web`.
4. Create or select the dataset/pixel for `Your Love Element`.
5. Choose `Meta Pixel only` for this first setup.
6. Choose manual code setup.
7. Copy the Pixel/Dataset ID.

Official Meta setup reference:

- `https://www.facebook.com/help/messenger-app/952192354843755/`

## Step 2: Add The Pixel ID To The Site

Open:

```text
assets/tracking-config.js
```

Replace the empty string with the Pixel/Dataset ID from Meta:

```js
window.YLE_META_PIXEL_ID = "123456789012345";
```

Keep it as a string.

## Step 3: Deploy The Site

Deploy the static site after updating `assets/tracking-config.js`.

The pages already load this config file before `script.js`:

- `/`
- `/full-report/`
- `/contact/`
- `/privacy/`
- `/terms/`
- `/refund/`

## Step 4: Test In Events Manager

1. In Meta Events Manager, open the dataset/pixel.
2. Go to `Test events`.
3. Enter `https://yourloveelement.com/`.
4. Open the site from Meta's test flow.
5. Confirm `PageView` appears. You do not need to click the cookie notice first.
6. Confirm `ViewContent` appears on the homepage.
7. Start the free reading and answer the first question.
8. Confirm `quiz_start` appears.
9. Finish the free reading.
10. Confirm `preview_revealed` appears.
11. Enter a delivery email and click checkout.
12. Confirm `InitiateCheckout` and `checkout_created` appear.

For the paid form:

1. After a real or test checkout redirects to `/full-report/?reading_id=...`, keep the test events page open.
2. Complete the 8 deeper signals.
3. Confirm `paid_signals_submitted` appears.

## Step 5: Create Custom Conversions

In Events Manager, create custom conversions for:

- `preview_revealed`
- `checkout_created`
- `paid_signals_submitted`

Recommended early optimization:

- First traffic campaign: optimize for landing page views or `ViewContent`.
- After enough data: optimize for `preview_revealed`.
- After checkout starts happen reliably: optimize for `InitiateCheckout` or `checkout_created`.
- Server-side `Purchase` is now connected through Lemon Squeezy webhook and can be used once enough purchase data exists.

## Step 6: Keep Organic Links Tagged

Use UTM links in captions so website traffic can be separated by platform and post.

Example:

```text
https://yourloveelement.com/?utm_source=instagram&utm_medium=organic_social&utm_campaign=launch_9day&utm_content=day02_wood_love_element
```

This does not replace Meta Pixel. UTM links explain where the click came from; Pixel events explain what the visitor did after arriving. The site now passes UTM parameters into Meta event parameters when they exist in the URL.

## Guardrails

- Do not send `Purchase` from frontend JavaScript.
- Keep `Purchase` tied to verified Lemon Squeezy `order_created` webhooks.
- Do not commit `META_CAPI_ACCESS_TOKEN`; keep it as a Cloudflare Worker secret.
- Keep `META_TEST_EVENT_CODE` unset in normal production traffic.
- Do not remove `/api/health/meta`; it is the safe way to confirm runtime Meta config without exposing secrets.
- Do not reintroduce consent buttons unless the tracking behavior is updated to truly respect them.
- Treat Pixel Helper auto-detected `SubscribedButtonClick` as noise unless intentionally promoted to a campaign metric.
