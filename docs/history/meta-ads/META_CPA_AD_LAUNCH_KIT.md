# Your Love Element - Meta CPA Purchase Launch Kit

Last updated: 2026-05-12

## Goal

Run a first Meta paid test for `Your Love Element` with the Sales objective and `Purchase` as the conversion event.

Product:

- `Your Love Element: Full Relationship Report`
- Price: `$9.99`
- Funnel: Meta ad -> free 10-question reading -> personalized preview -> email checkout -> Lemon Squeezy payment -> 8 deeper signals -> report delivered by email
- Measurement: Meta Pixel browser events are active, and server-side CAPI `Purchase` is active through Lemon Squeezy webhook.

Primary launch KPI:

- Target CPA: `$6-8`
- Learning ceiling: allow up to `$10-12` CPA only while validating early signal quality
- Hard warning: because the product is only `$9.99`, cold Meta traffic can easily become unprofitable. Treat the first test as message-market and purchase-tracking validation, not immediate scale.

## Campaign Setup

Campaign:

- Objective: `Sales`
- Conversion location: `Website`
- Performance goal: `Maximize number of conversions`
- Conversion event: `Purchase`
- Attribution: keep account default unless there is a strong reason to change
- Campaign name: `YLE_Meta_USEN_CPA-Purchase_Launch_202605`

Bid strategy:

- Recommended first 72 hours: use highest-volume delivery while reporting against the `$6-8` CPA target. This gives Meta enough room to find early purchase patterns.
- If a strict CPA control is required from day one: use `Cost per result goal` around `$9-10`. Expect underdelivery if the goal is below what the auction can find.
- Do not use bid cap in the first test.

Ad sets:

1. `USEN_Broad_22-44_Purchase`
   - Geo: United States first. Add Canada, UK, Australia only if budget can support it.
   - Language: English.
   - Age: 22-44.
   - Gender: All, unless existing data proves a narrower buyer.
   - Targeting: broad.
   - Placements: Advantage+ placements, but provide placement-specific creative for Feed and Stories/Reels.

2. `USEN_InterestSoft_22-44_Purchase`
   - Use only if budget allows a second ad set.
   - Keep it broad enough; avoid tiny stacked interest sets.
   - Possible interest themes: astrology, personality test, self-care, relationships, journaling, tarot, spirituality.
   - Keep all copy policy-safe; do not imply the viewer has a specific relationship status or emotional problem.

3. `Retarget_14D_CheckoutPreview_Purchase`
   - Launch only after there is enough traffic.
   - Audiences: site visitors 14D, `preview_revealed`, `InitiateCheckout`, `checkout_created`.
   - Exclude purchasers.
   - Creative should be direct: remind people the full report is optional and delivered by email.

## Creative Principles

- Lead with the free personalized preview. The purchase happens after curiosity and trust.
- Keep the ad image uncluttered. Let Meta's primary text carry the explanation.
- Use mystical/editorial visuals, but keep claims grounded: "inspired by", "reflective", "personal insight", "optional report".
- Avoid hard claims like "find your soulmate", "predict the exact date", "guaranteed love", or therapeutic advice.
- Avoid personal-attribute hooks like "Still single?", "Tired of being abandoned?", "Why do you attract avoidant men?", or "Your ex was wrong about you."
- Preferred CTA: `Learn More` for cold traffic. Test `Shop Now` only on direct-offer or retargeting ads.

## First Test Ad Matrix

### Ad A - Private Reading Hook

Use when:

- Cold broad audience.
- Best first creative because it makes the quiz feel low-pressure.

Creative:

- Format: static image, 4:5 feed plus 9:16 story crop.
- Source: `assets/hero-soulmate-report.png` or `assets/social/fresh-posts/day-01-private-love-reading.png`.
- Visual direction: dark editorial desk, parchment report, five-element tokens, warm candle light, one clear focal point.
- Overlay text: `Discover your love element`
- Small line: `Free 10-question preview`

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

CTA:

```text
Learn More
```

Landing URL:

```text
https://yourloveelement.com/?utm_source=meta&utm_medium=paid_social&utm_campaign=202605_cpa_purchase_launch&utm_content=a_private_reading_4x5&utm_term=broad
```

### Ad B - Future Partner Portrait

Use when:

- Testing curiosity around the paid report's most emotionally desirable section.

Creative:

- Format: static image, 4:5.
- Source: `assets/social/fresh-posts/day-07-future-partner-archetype.png`.
- Visual direction: refined illustrated partner portrait inside a report; avoid making it look like a dating app.
- Overlay text: `Future partner portrait`
- Small line: `Start with a free preview`

Primary text:

```text
A private relationship reading for the partner qualities, pace, and patterns that may fit your next chapter. Start with a free preview.
```

Headline:

```text
Your future partner portrait
```

Description:

```text
Personalized report by email.
```

CTA:

```text
Learn More
```

Landing URL:

```text
https://yourloveelement.com/?utm_source=meta&utm_medium=paid_social&utm_campaign=202605_cpa_purchase_launch&utm_content=b_partner_portrait_4x5&utm_term=broad
```

### Ad C - Pattern To Release

Use when:

- Testing a more reflective/pain-aware angle without using negative personal attributes.

Creative:

- Format: static image or carousel.
- Source: `assets/social/fresh-posts/day-08-pattern-to-release.png`.
- Visual direction: calm parchment, element seal, a subtle report page with highlighted section.
- Overlay text: `The pattern to release`
- Small line: `A private love reading`

Primary text:

```text
Chemistry, consistency, timing, and the pattern to release: Your Love Element turns a quick quiz into a polished relationship report.
```

Headline:

```text
See the pattern to release
```

Description:

```text
10 questions. Free preview.
```

CTA:

```text
Learn More
```

Landing URL:

```text
https://yourloveelement.com/?utm_source=meta&utm_medium=paid_social&utm_campaign=202605_cpa_purchase_launch&utm_content=c_pattern_release_4x5&utm_term=broad
```

### Ad D - Direct Offer

Use when:

- Testing price transparency and buyer intent.
- Good for retargeting after people already saw the free preview.

Creative:

- Format: static image, 4:5 or 1:1.
- Source: homepage paid report sample/email preview, `assets/elements/earth-banner.jpg`, or `assets/social-preview.png`.
- Visual direction: premium email/report mockup with clear delivery expectation.
- Overlay text: `$9.99 full report`
- Small line: `Preview free before checkout`

Primary text:

```text
Answer 10 questions, preview your love element, then unlock the full personalized relationship report for $9.99. Delivered by email.
```

Headline:

```text
Full love report: $9.99
```

Description:

```text
Start with a free preview.
```

CTA:

```text
Shop Now
```

Landing URL:

```text
https://yourloveelement.com/?utm_source=meta&utm_medium=paid_social&utm_campaign=202605_cpa_purchase_launch&utm_content=d_direct_offer_4x5&utm_term=retargeting
```

### Ad E - 30-Day Guide

Use when:

- Testing the practical value angle instead of pure mysticism/curiosity.

Creative:

- Format: story/reels first, then feed crop.
- Source: `assets/social/fresh-posts/day-09-thirty-day-love-reset.png`.
- Visual direction: elegant checklist/report page, soft paper, element motifs.
- Overlay text: `30-day love guide`
- Small line: `Included in the full report`

Primary text:

```text
A calmer love chapter can start with one private reading. Get your element profile, partner archetype, and optional 30-day guide.
```

Headline:

```text
A private love reading
```

Description:

```text
Preview free. Unlock if useful.
```

CTA:

```text
Learn More
```

Landing URL:

```text
https://yourloveelement.com/?utm_source=meta&utm_medium=paid_social&utm_campaign=202605_cpa_purchase_launch&utm_content=e_30day_guide_9x16&utm_term=broad
```

## Carousel Concept

Name:

```text
YLE_Carousel_5Signals_1x1
```

Format:

- 5 cards
- 1080 x 1080
- Consistent parchment/watercolor system
- Use minimal text per card

Card 1:

- Visual: hero report table
- Text: `Discover your love element`
- Headline: `Start free`

Card 2:

- Visual: partner portrait
- Text: `Partner portrait`
- Headline: `See the pattern`

Card 3:

- Visual: element seal/cards
- Text: `Five Element profile`
- Headline: `Your signal`

Card 4:

- Visual: report page/checklist
- Text: `Compatibility map`
- Headline: `Go deeper`

Card 5:

- Visual: email/report delivery
- Text: `$9.99 full report`
- Headline: `Unlock report`

Carousel primary text:

```text
Start with a free relationship preview. If it feels useful, unlock the full Five Element-inspired report with partner portrait, compatibility map, and 30-day guidance.
```

## Story/Reels Static Sequence

Use this as a simple 6-8 second vertical video or as separate story cards.

Frame 1:

```text
Discover your love element
```

Frame 2:

```text
Answer 10 private questions
```

Frame 3:

```text
Reveal a free preview
```

Frame 4:

```text
Unlock the full report only if it feels useful
```

Frame 5:

```text
Partner portrait, patterns, timing, 30-day guide
```

Frame 6:

```text
Start free reading
```

Design notes:

- 1080 x 1920.
- Keep logo and key text away from the top and bottom UI zones.
- Use large type, 5-8 words per frame.
- Use gentle page-turn, candle flicker, or element-card motion if making a video.

## Static Asset Export List

Produce these first:

```text
meta-cpa-a-private-reading-feed-1080x1350.png
meta-cpa-a-private-reading-story-1080x1920.png
meta-cpa-b-partner-portrait-feed-1080x1350.png
meta-cpa-c-pattern-release-feed-1080x1350.png
meta-cpa-d-direct-offer-feed-1080x1350.png
meta-cpa-carousel-01-love-element-1080x1080.png
meta-cpa-carousel-02-partner-portrait-1080x1080.png
meta-cpa-carousel-03-element-profile-1080x1080.png
meta-cpa-carousel-04-compatibility-map-1080x1080.png
meta-cpa-carousel-05-full-report-1080x1080.png
```

Existing project assets to reuse:

```text
assets/hero-soulmate-report.png
assets/social-preview.png
assets/social/fresh-posts/day-01-private-love-reading.png
assets/social/fresh-posts/day-07-future-partner-archetype.png
assets/social/fresh-posts/day-08-pattern-to-release.png
assets/social/fresh-posts/day-09-thirty-day-love-reset.png
assets/share-templates/wood.png
assets/share-templates/fire.png
assets/share-templates/earth.png
assets/share-templates/metal.png
assets/share-templates/water.png
```

## Image Generation Prompts

Use these only for new text-free base visuals. Add ad text later in design software so typography stays accurate.

### Prompt 1 - Private Reading Desk

```text
Use case: ads-marketing
Asset type: Meta ad base image, no text
Primary request: Create a premium editorial still life for a private Five Element-inspired love reading.
Scene/backdrop: Dark warm desk, parchment report, hand-drawn partner portrait, five small element tokens, candle glow, dried botanicals, subtle gold accents.
Subject: A refined relationship report that feels personal, romantic, mysterious, and trustworthy.
Composition: Leave clean negative space on the upper-left third for later text overlay. Keep one clear focal point on the report.
Style: Cinematic product photography mixed with elegant illustrated report details; warm amber, parchment, jade, rose, and gold palette.
Constraints: No readable text, no logos, no watermarks, no tarot cards, no occult symbols that feel heavy or frightening, no exaggerated fantasy.
```

### Prompt 2 - Future Partner Portrait

```text
Use case: ads-marketing
Asset type: Meta ad base image, no text
Primary request: Create a refined future partner portrait page inside a personalized relationship report.
Scene/backdrop: Open paper report with an elegant pencil portrait, five element marks as small abstract tokens, soft candlelight, premium stationery.
Subject: The idea of a future partner archetype, shown through a tasteful illustrated portrait and report layout.
Composition: Portrait centered-right, calm negative space on left for headline overlay.
Style: Premium parchment, editorial, romantic, emotionally grounded, not cheesy.
Constraints: No readable text, no logos, no claims, no dating app interface, no photoreal real-person identity.
```

### Prompt 3 - Pattern To Release

```text
Use case: ads-marketing
Asset type: Meta ad base image, no text
Primary request: Create an elegant visual metaphor for releasing an old relationship pattern.
Scene/backdrop: Parchment report page, a soft brush circle, five element watercolor marks, one ribbon or thread gently untied.
Subject: Calm self-reflection, clarity, and emotional release.
Composition: Keep central object simple and leave bottom area clean for CTA overlay.
Style: Warm paper, rose, teal, gold, quiet editorial lighting.
Constraints: No readable text, no broken hearts, no crying person, no dramatic breakup imagery, no therapeutic or medical framing.
```

## Traditional Chinese Copy For Future Localization

Use only if the landing page is localized into Traditional Chinese. Do not run Chinese ads to the current English-only landing page unless deliberately testing bilingual friction.

### Variant 1

Primary text:

```text
從 10 題私人戀愛測驗開始，看見你的 Love Element、關係節奏與未來伴侶輪廓。先看免費預覽，覺得有幫助再解鎖完整報告。
```

Headline:

```text
找出你的戀愛元素
```

Description:

```text
免費預覽，完整報告 $9.99。
```

### Variant 2

Primary text:

```text
一份受五行靈感啟發的私人關係閱讀，幫你整理吸引力、相處節奏、相容訊號與下一步。先從免費預覽開始。
```

Headline:

```text
你的未來伴侶輪廓
```

Description:

```text
10 題開始，Email 收報告。
```

## First 72-Hour Readout

Check after enough spend, not every few hours.

Healthy early signals:

- Landing page loads and `PageView`, `ViewContent`, `quiz_start`, `preview_revealed`, `InitiateCheckout`, and `Purchase` continue firing.
- Outbound CTR is not collapsing.
- Quiz start rate from landing visitors is healthy.
- `preview_revealed` appears before checkout events, proving the funnel is being used as intended.
- At least one purchase arrives through CAPI before scaling decisions.

Pause or revise if:

- Spend reaches `1.5-2x` target CPA with no checkout starts.
- Spend reaches `2-3x` target CPA with checkout starts but no purchases.
- Outbound CTR is weak and CPC is high across all creatives.
- Comments show confusion about whether the free preview is really free or whether the report is entertainment/reflective insight.

Scale only if:

- Purchase CPA is at or below the target range for at least 2-3 days.
- The winning creative has clean comments and no policy risk.
- Funnel events match expected order and no duplicate purchase events appear.

## Reporting Columns

Use these columns in Ads Manager:

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
quiz_start
preview_revealed
InitiateCheckout
checkout_created
Purchase
Cost per Purchase
Purchase conversion value
ROAS
```

## Source Notes

- Meta positions the Sales objective around driving purchases and conversion events.
- Meta creative guidance emphasizes strong visuals, clear messaging, multiple placements, and simple photo ads with less text.
- Meta Conversions API is relevant because this project sends server-side `Purchase` from verified Lemon Squeezy webhooks.
- Current common Meta asset specs: Feed `1080x1350` or `1080x1080`, Stories/Reels `1080x1920`, Carousel `1080x1080`.

## Launch Log

### 2026-05-12 - First Meta CPA Purchase Ad Submitted

Campaign:

```text
YLE_Meta_USEN_CPA-Purchase_Launch_202605
```

Ad set:

```text
USEN_Broad_22-44_Purchase
```

Confirmed ad set settings:

- Conversion location: `Website`
- Dataset: `Your Love Element`
- Conversion event: `Purchase`
- Performance goal: maximize conversions
- Cost per result goal: none
- Attribution mode: standard
- Creative enhancements: off for first test
- Audience: United States, English, broad audience, recommended age range `22-44`
- Placements: Advantage+ placements

First submitted ad:

```text
A_PrivateReading_4x5
```

Primary text used:

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

CTA:

```text
Learn More
```

Landing URL:

```text
https://yourloveelement.com/?utm_source=meta&utm_medium=paid_social&utm_campaign=202605_cpa_purchase_launch&utm_content=a_private_reading_4x5&utm_term=broad
```

Submission state seen in Ads Manager:

- Ad status: processing
- Spend: `NT$0`
- Result column: `Purchase (Website)`

Decision:

- Leave the campaign untouched for the first 72 hours unless the ad is rejected, tracking breaks, or spend is clearly going somewhere unintended.
- Do not enable Meta AI image generation, creative enhancement, translation, or text rewriting during this first clean test.
- Next review target: `2026-05-15`.

### 2026-05-13 - Meta Appeal Approved

Status update from Meta:

- Appeal passed.
- Advertising account / business restriction was removed.
- The original 72-hour performance readout was not valid because the campaign was interrupted by account-level restriction before normal delivery could begin.

Restart guidance:

- Resume from the existing campaign/ad set if possible; do not create a new Business Manager, new ad account, new Pixel, or new domain.
- Keep the first relaunch clean: one broad ad set, original `A_PrivateReading_4x5`, no AI image generation, no creative enhancement, no translation, and no text rewriting.
- Confirm delivery status changes from account restriction / processing to active delivery before judging performance.
- Start the 72-hour readout window only after spend and impressions begin.
- If the campaign cannot resume cleanly, duplicate the original ad inside the same campaign/ad account and keep the same Pixel, event, audience, budget, and UTM structure.
