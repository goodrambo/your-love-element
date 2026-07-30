# Meta Ads Launch — Historical Record Through 2026-06-05

> This is a dated campaign record, not current Ads Manager state. Revalidate account status, campaign status, policy, API versions, and metrics before acting.

Last updated: 2026-06-05

## Current Status

Initial Meta setup:

- Sales objective
- Website conversion location
- Dataset: `Your Love Element`
- Event: `Purchase`
- Campaign: `YLE_Meta_USEN_CPA-Purchase_Launch_202605`
- Ad set: `USEN_Broad_22-44_Purchase`
- First ad: `A_PrivateReading_4x5`

Account issue:

- Meta initially restricted the business/ad account for account integrity / suspected automation.
- This was not primarily a copy violation.
- Appeal was approved on 2026-05-13.
- Advertising restriction was removed.

2026-06-05 landing funnel note:

- Meta ads can deliver, but early traffic mostly visited without starting the free reading.
- The homepage was updated to reduce first-step friction: clearer free-preview hero copy, mobile width fixes, shorter cookie notice, and answer-tap auto-advance in the free quiz.
- This did not change the active `Purchase` optimization event, Pixel/Dataset ID, CAPI setup, checkout events, or backend Purchase sender.
- `quiz_start` now fires on first answer selection, so use it for post-2026-06-05 funnel readout but do not compare it directly with older `quiz_start` counts.
- New diagnostic event: `landing_cta_click`.

## 2026-05-14 To 2026-05-20 First Paid Readout

Observed in Meta Ads Manager for the date range `2026-05-14` to `2026-05-20`:

```text
Campaign: YLE_Meta_USEN_LR-Purchase_20260515
Status: Active
Objective / optimization: Sales / Purchase
Daily budget shown: NT$1,000
Spend: NT$969
Results: 0 purchases
Impressions: 722
Reach: 588
Approx frequency: 1.23
Approx CPM: NT$1,342
```

```text
Campaign: YLE_Meta_USEN_LR-DeliveryCheck_Traffic_20260514
Status: Active
Objective / optimization: Traffic / Landing page views
Daily budget shown: NT$1,300
Spend: NT$1,342
Results: 133 landing page views
Cost per landing page view: NT$10
Impressions: 6,155
Reach: 5,984
Approx frequency: 1.03
Approx CPM: NT$218
Approx LPV / impression rate: 2.16%
```

Interpretation:

- Delivery had recovered: the Traffic / LPV campaign spent and generated landing page views.
- Traffic / LPV quality should not be treated as purchase intent. This campaign can validate account delivery and page loading, but it is structurally likely to find people who click rather than people who buy.
- The Purchase campaign had too little delivery to prove or disprove product-market fit. However, the approximate CPM was high and the campaign did not produce a purchase signal.
- `133` landing page views with `0` purchases is weak but not statistically conclusive for a cold $9.99 digital product. At a `0.5%` to `1%` LPV-to-purchase rate, this sample could still reasonably produce zero purchases.
- If future traffic reaches `500` to `1,000` quality landing page views with zero purchases, treat the primary issue as offer trust, page clarity, checkout friction, or audience-message fit rather than normal early variance.

Working diagnosis after one week with no purchases:

- Budget was likely over-weighted toward Traffic / LPV relative to Purchase.
- Cold traffic may have been curious but not purchase-intent qualified.
- The first landing interaction probably leaked users before the free preview / checkout path.
- The report value, delivery mechanism, sample content, and trust cues need to be explicit before checkout.
- Purchase tracking and Lemon Squeezy checkout should still be tested end-to-end with a real or test purchase whenever delivery metrics look normal but purchases stay at zero.

Recommended next readout:

- Reduce Traffic / LPV to diagnostic budget only, or pause it once delivery health is confirmed.
- Run Purchase as the main learning campaign, but do not scale from zero purchases.
- Add or rotate sales-intent creative variants that show the report outcome more clearly instead of only positioning the product as a free quiz.
- Track the full funnel: `Landing page views`, `ViewContent`, `landing_cta_click`, `quiz_start`, `preview_revealed`, `InitiateCheckout`, `checkout_created`, `Purchase`.
- Judge the 2026-06-05 landing funnel changes separately because `quiz_start` moved earlier in the interaction.

## First Campaign Setup

Campaign:

```text
Objective: Sales
Buying type: Auction
Campaign budget: small daily test budget
Bid strategy: highest volume / max conversions
```

Ad set:

```text
Conversion location: Website
Dataset: Your Love Element
Conversion event: Purchase
Performance goal: maximize conversions
Cost per result goal: none for first test
Audience: United States, English, broad, recommended age 22-44
Placements: Advantage+ placements
```

Ad:

```text
Name: A_PrivateReading_4x5
Format: single image/video
CTA: Learn More
Creative enhancements: off
AI image generation: off
Translation: off
Text rewriting: off
```

## First Ad Copy

Primary text:

```text
Take a private 10-question love reading inspired by the Five Elements. Reveal a free preview, then unlock the full report only if it feels useful.
```

Headline:

```text
Discover your love element
```

Description:

```text
Free preview first. Full report $9.99.
```

URL:

```text
https://yourloveelement.com/?utm_source=meta&utm_medium=paid_social&utm_campaign=202605_cpa_purchase_launch&utm_content=a_private_reading_4x5&utm_term=broad
```

## Other Primary Text Variants

Variant 2:

```text
Discover your love element with a quick private reading. Your free preview includes a relationship profile, partner archetype, and next-step signal.
```

Variant 3:

```text
A reflective love reading for chemistry, consistency, timing, and the pattern to release. Start with the free preview before unlocking the full report.
```

Variant 4:

```text
Answer 10 private questions and receive a personalized love element preview. The full report adds compatibility signals, timing themes, and a 30-day guide.
```

Variant 5:

```text
Your Love Element blends romantic archetypes, emotional patterns, and Five Element symbolism into a private relationship reading. Start free.
```

## Policy-Safe Copy Rules

Use:

- private reading
- reflective
- inspired by
- free preview
- optional full report
- relationship insight
- partner archetype
- pattern to release

Avoid:

- "Are you single?"
- "Tired of being abandoned?"
- "Why do you attract avoidant men?"
- "Your ex was wrong about you."
- guaranteed soulmate
- exact date prediction
- therapy/diagnosis language

Reason:

Meta is sensitive to personal attributes and exploitative emotional claims.

## Creative Enhancement Decision

For first clean test, disable:

- AI image generation
- image enhancement
- text overlay automation
- CTA enhancement
- translation
- text improvement
- multi-advertiser ads

Reason:

- keeps test variables clean
- avoids accidental policy-sensitive copy/image changes
- makes first result easier to interpret

## Restriction Incident

Meta showed:

```text
This account's creation or usage appears to involve automated features that violate account integrity rules.
```

Restriction effects included:

- cannot create or run ads
- cannot use or share ad audiences
- cannot use Meta Pixel
- cannot use app SDK events
- cannot boost posts
- cannot manage business ad assets/people

Interpretation:

- account/business trust issue
- not necessarily ad copy itself

Likely contributing factors:

- new business assets
- new Page/IG/Pixel/ad account
- TWD account targeting US
- new digital product with spiritual/relationship positioning
- rapid setup and first conversion campaign

Resolution:

- appeal submitted
- appeal approved
- restriction removed on 2026-05-13

## Appeal Message Used

```text
Our business, Your Love Element, is a single legitimate digital product brand. We manually created one Sales campaign in Meta Ads Manager to promote a private relationship reading and a $9.99 digital report.

We did not use bots, scripts, automated account creation, bulk ad creation tools, or any tool that simulates human activity. The campaign, ad set, creative, copy, budget, and website destination were all reviewed and created manually.

The website includes clear product information, pricing, privacy policy, terms, refund policy, contact information, and verified purchase tracking through Meta Pixel and Conversions API.

Please review this restriction again and restore our business advertising access.
```

## Relaunch After Appeal

Do:

- resume same campaign/ad account if possible
- keep same Pixel/dataset
- keep same domain
- keep one broad ad set
- run original A ad first
- start 72-hour readout only after impressions/spend begin

Do not:

- create new Business Manager
- create new ad account
- use personal FB ad account to bypass restriction
- switch Pixel/domain to evade review
- repeatedly resubmit many variants
- enable AI creative features immediately

## 72-Hour Readout

Judge only after spend begins and the ad has had time to deliver.

Look at:

- spend
- delivery status
- outbound CTR
- CPC outbound
- landing page views
- `ViewContent`
- `landing_cta_click`
- `quiz_start`
- `preview_revealed`
- `InitiateCheckout`
- `checkout_created`
- `Purchase`
- cost per Purchase
- comments/policy issues

First-pass decisions:

- keep A running
- add B/C creative variants
- adjust daily budget
- pause and rework the angle

Do not scale from one purchase without checking event quality and funnel order.
