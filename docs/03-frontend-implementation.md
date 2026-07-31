# Frontend Implementation

Last updated: 2026-07-12

## Main Files

- `index.html`: homepage, hero, 10-question reading, free preview, direct Five Elements answers, paid sample, FAQ, and site links.
- `five-elements-love-compatibility/index.html`: indexable editorial pillar guide covering the five relationship patterns, compatibility dynamics, limitations, source citation, and FAQ.
- `how-it-works/index.html`: indexable methodology page covering inputs, deterministic preview logic, paid-report AI use, safeguards, privacy boundary, limitations, and FAQ.
- `full-report/index.html`: post-checkout paid signal form.
- `script.js`: shared frontend behavior for homepage and full-report page.
- `styles.css`: responsive visual system.
- `assets/runtime-config.js`: production API selection and localhost offline-preview guard.
- `assets/tracking-config.js`: central Meta Pixel id.
- `assets/meta-pixel-base.js`: early Pixel base loader.

Search-discovery files:

- `robots.txt`: allows crawling and points to the production XML sitemap.
- `sitemap.xml`: lists every indexable page and excludes the `noindex` paid completion page.
- `scripts/test/seo.test.mjs`: checks metadata uniqueness, heading structure, sitemap/noindex alignment, robots discovery, structured-data types, content-cluster links, and methodology disclosures.

## Homepage Responsibilities

The homepage does more than marketing. It is the start of the transaction:

1. Display product promise.
2. Collect 10 free answers.
3. Validate every quiz step.
4. Generate a preview in-browser.
5. Persist free answers through the Worker.
6. Enable checkout after preview is revealed.
7. Generate share card.
8. Track funnel events.

## Free Quiz Flow

Key frontend functions in `script.js`:

- `initQuiz()`
- `validateStep()`
- `getFreeAnswers()`
- `revealPreview()`
- `saveFreeAnswers()`
- `startCheckout()`

Important storage keys:

```text
yle-reading-id
yle-free-answers
yle-cookie-consent
yle-paid-answers
```

The first-party funnel uses two `sessionStorage` keys, not persistent customer storage:

```text
yle-analytics-session-id
yle-analytics-attribution
```

The random session UUID is sent only to the Worker and is hashed before database storage. Analytics never receives quiz answers, email, reading/order ids, full URL/query, or referrer.

The free preview is generated client-side from answer mappings:

- `elementCopy`
- `qualityProfiles`
- `buildPortraitText()`

The authoritative free answers are saved server-side by:

```text
POST /api/readings
```

## Checkout Trigger

The checkout button calls `startCheckout()`.

Validation before checkout:

- preview must be revealed
- delivery email must be valid
- free answers must be saved or saveable

Then frontend calls:

```text
POST /api/create-checkout
```

Payload:

```json
{
  "reading_id": "...",
  "email": "customer@example.com"
}
```

The Worker returns `checkout_url`, and the frontend redirects the user to Lemon Squeezy.

Local safety behavior:

- Only `yourloveelement.com` and `www.yourloveelement.com` receive the production API base.
- Localhost and other preview hosts keep `YLE_API_BASE_URL` empty.
- Offline preview can exercise the free result locally, but checkout is blocked with a visible status message and cannot write a production reading.

## Paid Signal Page

Page:

```text
full-report/index.html
```

Key functions:

- `initPaymentStatus()`
- `initPaidQuiz()`
- `getPaidAnswers()`
- `completePaidSignals()`

The page reads `reading_id` from:

1. `?reading_id=...`
2. local storage fallback

Before the paid form can be submitted, it checks:

```text
GET /api/readings/:reading_id/status
```

The form is locked when:

- no reading id exists
- payment is not verified
- report is already delivered
- reading is failed
- paid answers were already submitted
- status is generating/report_generated/delivered/failed

Paid answers are submitted through:

```text
POST /api/readings/:reading_id/paid-signals
```

## Share Card

The free preview share card uses a hybrid approach:

- fixed high-quality bitmap templates
- deterministic canvas text overlay

Templates:

```text
assets/share-templates/wood.png
assets/share-templates/fire.png
assets/share-templates/earth.png
assets/share-templates/metal.png
assets/share-templates/water.png
```

Canvas output:

```text
1080 x 1350
```

Key functions:

- `loadShareTemplate()`
- `drawShareCardDynamicCopy()`
- `prepareShareCard()`
- `shareCardImage()`
- `downloadShareCard()`

Design decision:

- Do not redraw the full watercolor card in canvas.
- Keep AI/artwork in fixed templates.
- Use canvas only for dynamic copy.

Native share payload intentionally sends:

```text
files + title + text
```

The text contains a fixed, privacy-safe referral URL tagged only with `utm_source=share_card`, `utm_medium=referral`, `utm_campaign=organic_share`, and `utm_content=result_card`. It never puts answers, element, email, session, reading, order, or customer identifiers in the URL. The payload does not send a separate `url` field because some share targets prioritize URL previews and drop the image.

## Frontend Tracking

Pixel id:

```text
4282306195342317
```

Loaded through:

- `assets/tracking-config.js`
- `assets/meta-pixel-base.js`
- additional compatibility code in `script.js`

Frontend events:

- `PageView`
- `ViewContent`
- `quiz_start`
- `preview_revealed`
- `InitiateCheckout`
- `checkout_created`
- `paid_signals_submitted`
- share-card custom events

The same allowlisted custom stages are sent to the privacy-minimized first-party Worker endpoint on production only. `page_view` and `view_content` are added for the landing-session denominator. Frontend `Purchase` remains forbidden.

Attribution:

`script.js` reads and attaches:

- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_content`
- `utm_term`

## Cookie Notice

Current behavior:

- informational notice
- single `Got it` action
- tracking is not gated by consent

Guardrail:

- Do not reintroduce `Essential only` / `Allow all` buttons unless tracking behavior is redesigned to respect them.

## UX Guardrails

- Checkout stays disabled until free preview is revealed.
- Paid signals stay locked until verified payment is connected.
- Delivered or failed readings show terminal states.
- Validation is step-by-step to avoid incomplete records.
- Share-card generation failures should not block checkout.
