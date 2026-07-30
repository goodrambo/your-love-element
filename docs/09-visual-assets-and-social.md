# Visual Assets And Social

Last updated: 2026-07-12

## Visual Positioning

The product visual style is:

- premium parchment
- watercolor / hand-drawn report details
- Five Element tokens
- warm candle/editorial lighting
- romantic but not cheesy
- mystical but not frightening
- refined serif typography
- gold, rose, jade, parchment, warm dark neutrals

Avoid:

- heavy occult symbols
- cheap fortune-telling look
- cluttered AI text
- overly dark/illegible images
- guaranteed soulmate visual language

## Main Assets

Hero:

```text
assets/hero-soulmate-report.png
```

Social preview:

```text
assets/social-preview.png
```

Element banners:

```text
assets/elements/wood-banner.jpg
assets/elements/fire-banner.jpg
assets/elements/earth-banner.jpg
assets/elements/metal-banner.jpg
assets/elements/water-banner.jpg
```

Social, ad, and demo deliverables are not runtime assets. The June 2026 packs, profiles, renderers, drafts, ZIPs, and QA output were preserved under:

```text
artifacts/archive/2026-07-12/assets/social/
```

They are historical, not a current publishing queue. For new work, restore only the required source, generate into `artifacts/`, and use `docs/runbooks/SOCIAL_PUBLISHING.md`.

Share templates:

```text
assets/share-templates/wood.png
assets/share-templates/fire.png
assets/share-templates/earth.png
assets/share-templates/metal.png
assets/share-templates/water.png
```

## Share Card Architecture

Final implementation:

```text
fixed bitmap template + deterministic canvas text overlay
```

Why:

- AI-generated text is unreliable.
- Pure canvas art looked lower quality.
- Fixed templates preserve premium look.
- Canvas overlay handles dynamic archetype and description.

Share card size:

```text
1080 x 1350
```

Important code:

```text
drawShareCardDynamicCopy()
drawShareCopyVeil()
prepareShareCard()
shareCardImage()
```

Decision:

- QR code intentionally excluded.
- Mobile-to-mobile sharing benefits more from embedded URL text than QR.
- URL is present in share text and card footer.

## Native Share Behavior

Payload:

```text
files + title + text
```

No separate `url` field for image share.

Reason:

- some share targets prioritize URL preview and drop the image if `url` is included

Fallback:

- file share if supported
- text/link share if file share unsupported
- download if Web Share unavailable

## Historical Social Posting Plan

The earlier nine-day schedule and later June Reels packages are archived. Publication completion and performance are currently unknown; do not reuse their dates or call them current.

Historical nine-day themes:

1. Private love reading
2. Wood love element
3. Fire love element
4. Water love element
5. Earth love element
6. Metal love element
7. Future partner archetype
8. Pattern to release
9. 30-day love reset

## Ad Asset Export Targets

Recommended first ad exports:

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

## Image Generation Prompt Pattern

For new ad base images, generate text-free base visuals and add copy later in design software.

Prompt skeleton:

```text
Use case: ads-marketing
Asset type: Meta ad base image, no text
Primary request: Create a premium editorial still life for a private Five Element-inspired love reading.
Scene/backdrop: Dark warm desk, parchment report, hand-drawn partner portrait, five small element tokens, candle glow, dried botanicals, subtle gold accents.
Subject: A refined relationship report that feels personal, romantic, mysterious, and trustworthy.
Composition: Leave clean negative space for later text overlay.
Style: Cinematic product photography mixed with elegant illustrated report details; warm amber, parchment, jade, rose, and gold palette.
Constraints: No readable text, no logos, no watermarks, no heavy occult symbols, no exaggerated fantasy.
```

## QA Checklist For Images

Before using an image in product or ads:

- no broken hands/faces
- no unreadable fake text in important areas
- no accidental policy-sensitive symbols
- enough negative space for overlay
- crops work in 4:5, 1:1, and 9:16 when needed
- product object is clear in first 1 second
- text remains readable on mobile
- no false guarantee implied by the image

## New Product Reuse

For future products:

1. Generate a premium hero image.
2. Generate social preview.
3. Create 5-10 organic launch images.
4. Create share-card templates if the product has a personal result.
5. Add deterministic text overlay for dynamic result cards.
6. Keep ad image text editable outside AI generation.
