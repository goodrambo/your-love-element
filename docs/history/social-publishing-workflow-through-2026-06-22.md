# Your Love Element Social Publishing Workflow — Historical Archive

> Archived on 2026-07-12. Dated schedules, asset paths, tracking assumptions, and “current” labels below describe earlier sessions and must not be used without fresh validation. Evergreen policy now lives in `docs/runbooks/SOCIAL_PUBLISHING.md`.

Last updated: 2026-06-22

## Current Goal

Create early trust and traffic for Your Love Element on Facebook and Instagram before paid ads scale.

Short-term content strategy:

- Use text-free, high-quality visual posts.
- Put all sales copy, links, and hashtags in the caption.
- Publish the same post to Facebook Page and Instagram.
- Keep captions positioned as reflective relationship insight and entertainment, not deterministic fortune-telling.
- Drive traffic to `https://yourloveelement.com/`.
- Use Reels as the primary reach driver for the next promotion phase, while keeping static posts for trust, profile quality, and saveable brand presence.

## Current Social Accounts

- Facebook Page: `Your Love Element`
- Facebook URL: `https://www.facebook.com/profile.php?id=61589573879581`
- Instagram account: created and linked to the Facebook Page by the user.

## Current Asset Package

Social asset library index:

- `assets/social/README.md`

Static image package:

- Image folder: `assets/social/fresh-posts/`
- Zip package: `assets/social/your-love-element-fresh-posts.zip`
- Posting schedule and captions: `assets/social/fresh-posts/POSTING_SCHEDULE.md`

The package contains 9 newly generated, text-free images:

1. `day-01-private-love-reading.png`
2. `day-02-wood-love-element.png`
3. `day-03-fire-love-element.png`
4. `day-04-water-love-element.png`
5. `day-05-earth-love-element.png`
6. `day-06-metal-love-element.png`
7. `day-07-future-partner-archetype.png`
8. `day-08-pattern-to-release.png`
9. `day-09-thirty-day-love-reset.png`

Each image is square PNG, `1254 x 1254`, with no text or watermark.

Previous content packages were intentionally removed because they were not aligned with the desired brand direction:

- Removed `assets/social/posts/`
- Removed `assets/social/photo-posts/`
- Removed previous social-post zip packages
- Removed previous social-generation scripts

Keep the profile/cover assets:

- `assets/social/fb-profile.png`
- `assets/social/fb-cover.png`
- `assets/social/ig-profile.png`

Reels package for the current promotion phase:

- Video folder: `assets/social/reels/`
- Zip package: `assets/social/reels/your-love-element-reels-pack.zip`
- Upload captions: `assets/social/reels/POSTING_CAPTIONS.md`
- Visual preview sheet: `assets/social/reels/reels-contact-sheet.jpg`
- Renderer script: `assets/social/reels/render_reels.py`

The Reels package contains 8 ready-to-upload vertical MP4s:

1. `reel-01-calm-is-information.mp4`
2. `reel-02-spark-and-peace.mp4`
3. `reel-03-five-elements-in-love.mp4`
4. `reel-04-things-i-stopped-calling-love.mp4`
5. `reel-05-private-love-reading.mp4`
6. `reel-06-no-face-love-reset.mp4`
7. `reel-07-no-face-body-knows.mp4`
8. `reel-08-no-face-safe-love-prompt.mp4`

Each Reel is `1080 x 1920`, H.264 MP4, 9:16 vertical, with a silent audio track so music can be added inside Facebook/Instagram.

Recommended first 4 Reels:

```text
1 | reel-07-no-face-body-knows.mp4
2 | reel-06-no-face-love-reset.mp4
3 | reel-04-things-i-stopped-calling-love.mp4
4 | reel-05-private-love-reading.mp4
```

Rationale:

- `07` and `06` have the least AI-portrait feel and lead with emotional resonance.
- `04` tests relationship-pattern pain without sounding accusatory.
- `05` explains the product only after a few warmer Reels have built context.

Latest all-English Meta daily pack:

- Folder: `assets/social/meta-20260614-daily-pack/`
- Zip package: `assets/social/meta-20260614-daily-pack/your-love-element-meta-20260614-daily-pack.zip`
- Schedule/copy: `assets/social/meta-20260614-daily-pack/POSTING_COPY_AND_SCHEDULE.md`
- Upload checklist: `assets/social/meta-20260614-daily-pack/UPLOAD_CHECKLIST.csv`
- Reels: `assets/social/meta-20260614-daily-pack/reels/`
- Carousels: `assets/social/meta-20260614-daily-pack/carousels/`

The 2026-06-14 pack covers `2026-06-14` through `2026-06-20` and includes one Reel plus one 5-image carousel per day. It is all English, aligned to the English landing page, and has no public-facing dates, weekdays, `Day` labels, or Reel scene counters on the rendered creatives.

Latest Reels-only pack:

- Folder: `assets/social/meta-20260622-reels-pack/`
- Zip package: `assets/social/meta-20260622-reels-pack/your-love-element-meta-20260622-reels-pack.zip`
- Schedule/copy: `assets/social/meta-20260622-reels-pack/POSTING_COPY_AND_SCHEDULE.md`
- Meta Business Suite schedule: `assets/social/meta-20260622-reels-pack/META_BUSINESS_SUITE_SCHEDULE.csv`
- Upload checklist: `assets/social/meta-20260622-reels-pack/UPLOAD_CHECKLIST.csv`
- Reels: `assets/social/meta-20260622-reels-pack/reels/`
- QA sheets: `assets/social/meta-20260622-reels-pack/qa/`
- Renderer: `assets/social/meta-20260622-reels-pack/render_reels_pack.py`
- Package index: `assets/social/README.md`

The 2026-06-22 pack covers `2026-06-22` through `2026-06-28` and includes two Reels per day, total `14` Reels. It is all English, Reels-only, and has no public-facing dates, weekdays, `Day` labels, internal post numbers, or Reel scene counters on the rendered creatives.

Filename convention for this pack:

- Use `YYYYMMDD-01-topic.mp4` for the first Reel of the date.
- Use `YYYYMMDD-02-topic.mp4` for the second Reel of the date.
- The date/part number is for upload matching only and must not appear inside the rendered video frames.
- Keep `POSTING_COPY_AND_SCHEDULE.md`, `META_BUSINESS_SUITE_SCHEDULE.csv`, `UPLOAD_CHECKLIST.csv`, QA sheets, and the zip package aligned to those exact filenames.

Current caption/UTM convention:

- Use the same caption for Facebook and Instagram.
- Use one shared Reel URL with `utm_source=meta` for the combined Meta Business Suite post.
- `META_BUSINESS_SUITE_SCHEDULE.csv` should have one row per Reel with platform `Instagram Reels + Facebook Reels`.
- Use platform-specific `facebook` / `instagram` UTMs only if the user explicitly asks to split captions or schedule rows by platform.

Current reusable production direction:

- Keep the content structure from the 2026-06-22 pack for the next Reels batch: 14 Reels, two per day, `18.0s`, four readable beats, strong first-frame hook, final soft CTA, shared IG/FB caption.
- Keep the filename structure `YYYYMMDD-01-topic.mp4` / `YYYYMMDD-02-topic.mp4` so upload assets and captions cannot drift.
- Keep the weekly mix of emotional pattern hooks, Five Element curiosity hooks, saveable prompts, trust-building product clarity, and preview-first CTA.
- Future batches should vary the video style rather than repeating the exact same blurred-photo-panel treatment. Good directions include text-message UI, objects-on-desk cinematic, minimal editorial typography, distinct Five Elements palettes, and no-face natural textures.

Previous notes and archives:

- Social planning notes are under `assets/social/notes/`.
- Older phase 2 draft renders are under `assets/social/archive/phase2-drafts/`.
- Do not publish archived drafts unless they are explicitly reviewed again.

## Manual Publishing Workflow

Recommended static image first run:

1. Open `assets/social/fresh-posts/POSTING_SCHEDULE.md`.
2. Publish one post per day at `20:30` Taiwan time.
3. Upload the matching image for that day to both Facebook and Instagram.
4. Copy the matching `Caption + Hashtags` block as-is.
5. After posting, check that the link in the caption works.
6. Pin Day 1 or Day 7 if the account needs a stronger first impression.

Recommended sequence:

```text
Day 1 | 20:30 | FB + IG | Private love reading
Day 2 | 20:30 | FB + IG | Wood love element
Day 3 | 20:30 | FB + IG | Fire love element
Day 4 | 20:30 | FB + IG | Water love element
Day 5 | 20:30 | FB + IG | Earth love element
Day 6 | 20:30 | FB + IG | Metal love element
Day 7 | 20:30 | FB + IG | Future partner archetype
Day 8 | 20:30 | FB + IG | Pattern to release
Day 9 | 20:30 | FB + IG | 30-day love reset
```

Recommended Reels first run:

1. For the current pack, open `assets/social/meta-20260622-reels-pack/POSTING_COPY_AND_SCHEDULE.md`.
2. Upload one Reel at a time to both Instagram Reels and Facebook Reels through Meta Business Suite.
3. Add platform-native music/audio during upload if appropriate.
4. Use the matching shared `IG/FB caption` block as-is.
5. Use `META_BUSINESS_SUITE_SCHEDULE.csv` for the 2026-06-22 through 2026-06-28 twice-daily schedule.
6. Track profile visits, link clicks, quiz starts, and preview completions by `utm_content`.

Current Reels schedule:

```text
2026-06-22 | 12:30 | FB Reels + IG Reels | 20260622-01-signal-before-story.mp4
2026-06-22 | 20:30 | FB Reels + IG Reels | 20260622-02-preview-before-pay.mp4
2026-06-23 | 12:30 | FB Reels + IG Reels | 20260623-01-calm-is-chemistry-too.mp4
2026-06-23 | 20:30 | FB Reels + IG Reels | 20260623-02-mixed-signals-cost-focus.mp4
2026-06-24 | 12:30 | FB Reels + IG Reels | 20260624-01-element-you-reach-for.mp4
2026-06-24 | 20:30 | FB Reels + IG Reels | 20260624-02-pattern-was-protection.mp4
2026-06-25 | 12:30 | FB Reels + IG Reels | 20260625-01-soft-standard-clarity.mp4
2026-06-25 | 20:30 | FB Reels + IG Reels | 20260625-02-map-not-prophecy.mp4
2026-06-26 | 12:30 | FB Reels + IG Reels | 20260626-01-save-before-unclear-moment.mp4
2026-06-26 | 20:30 | FB Reels + IG Reels | 20260626-02-listen-then-choose.mp4
2026-06-27 | 12:30 | FB Reels + IG Reels | 20260627-01-after-contact-signal.mp4
2026-06-27 | 20:30 | FB Reels + IG Reels | 20260627-02-full-report-optional.mp4
2026-06-28 | 12:30 | FB Reels + IG Reels | 20260628-01-five-elements-check-in.mp4
2026-06-28 | 20:30 | FB Reels + IG Reels | 20260628-02-quiet-answer-first.mp4
```

## Caption Guardrails

Use:

- `Discover your Love Element`
- `Take the free preview`
- `Relationship insight`
- `Emotional clarity`
- `A reflective love reading`
- `For personal insight and entertainment`

Avoid:

- `Are you single?`
- `Why can't you find love?`
- `You will meet your soulmate soon`
- `This predicts your future partner`
- Any claim that implies guaranteed outcomes or knowledge of a user's private emotional state.

Reason: Meta ad and content review can be sensitive around personal attributes, relationship status, emotional hardship, and deterministic claims.

## Tracking Needed Before Serious Paid Promotion

Current social posts are organic/manual and use plain links.

Before paid promotion, add tracking:

- UTM links per platform and post, for example:
  - `https://yourloveelement.com/?utm_source=instagram&utm_medium=organic_social&utm_campaign=launch_9day&utm_content=day01_private_love_reading`
  - `https://yourloveelement.com/?utm_source=facebook&utm_medium=organic_social&utm_campaign=launch_9day&utm_content=day01_private_love_reading`
- GA4 or another analytics layer.
- Meta Pixel / Dataset, respecting the existing cookie consent state.
- Conversion events:
  - `quiz_start`
  - `preview_revealed`
  - `checkout_click`
  - `checkout_created`
  - `paid_signals_submitted`
  - `report_delivered`

Important: the current cookie consent only stores user preference. If analytics or pixels are added, they must respect that stored preference and the privacy policy should be updated.

## Automation Options To Evaluate

### Option A: Meta Business Suite Scheduling

Best near-term option.

Pros:

- No custom API work.
- Supports Facebook and Instagram scheduling from the official Meta UI.
- Lower risk than building a custom publisher before content-market fit is known.

Cons:

- Manual upload and scheduling.
- Harder to programmatically vary UTM links and captions unless prepared ahead of time.

Recommended use:

- Schedule the first 9 posts manually in Meta Business Suite.
- Add UTM links manually before scheduling.
- Use the first run to learn which visual/caption themes are worth automating.

### Option B: Custom Meta Graph API Publisher

Use only after the organic workflow is stable.

Likely requirements:

- Facebook Page connected to Instagram Professional account.
- Instagram must be a Business or eligible Professional account.
- Meta Developer app.
- Page access token with required permissions.
- App review if publishing beyond app admins/testers.
- Secure secret storage, likely Cloudflare Worker Secrets.
- Publicly accessible image URLs, likely GitHub Pages assets, Cloudflare R2, or another static asset host.

Likely Facebook Page publishing flow:

1. Get a Page access token for the Page.
2. Publish a Page photo post with image URL and caption/message.
3. Store the returned post id and timestamp.

Likely Instagram publishing flow:

1. Host image publicly.
2. Create an Instagram media container with `image_url` and `caption`.
3. Publish the media container.
4. Store the returned media id and timestamp.

Known implementation notes:

- Instagram API publishing commonly expects media to be available at a public URL.
- For API publishing, export images to JPG if PNG compatibility becomes an issue.
- Direct API scheduling should be handled by our own scheduler, such as a Cloudflare Worker cron, rather than assuming Instagram's API supports native scheduled publishing.
- Publishing automation should not use a personal Facebook profile; it should publish to the Facebook Page and connected Instagram account.

Official Meta references to check when implementation begins:

- Instagram Content Publishing: `https://developers.facebook.com/docs/instagram-api/guides/content-publishing/`
- Facebook Pages API: `https://developers.facebook.com/docs/pages-api/`
- Page photos endpoint: `https://developers.facebook.com/docs/graph-api/reference/page/photos/`
- `pages_manage_posts` permission: `https://developers.facebook.com/docs/permissions/reference/pages_manage_posts/`
- `instagram_content_publish` permission: `https://developers.facebook.com/docs/permissions/reference/instagram_content_publish/`

The docs and app-review UI change frequently, so verify current permission names, app mode requirements, and supported media formats immediately before building.

## Proposed Automation Architecture

If custom automation is justified:

1. Create a structured content manifest.
   - `date`
   - `platforms`
   - `image_path`
   - `caption`
   - `utm_url`
   - `status`
   - `facebook_post_id`
   - `instagram_media_id`
   - `published_at`
2. Host finalized post images at stable public URLs.
3. Build a protected publisher endpoint or cron job.
4. Store Meta credentials only as secrets.
5. Dry-run posts first to a test Page / test Instagram account if possible.
6. Log every publish attempt and API error.
7. Only move to production auto-publishing after one full manual schedule succeeds.

Potential storage choices:

- Simple static manifest in repo for the first version.
- Supabase table if scheduled publishing needs a dashboard or status tracking.
- Cloudflare R2 for image hosting if the repo should not carry large social assets long term.

## Metrics To Review After First 9 Posts

Collect manually from Facebook/Instagram:

- Reach
- Impressions
- Profile visits
- Link clicks
- Saves
- Shares
- Comments
- Follows
- Best-performing visual theme
- Best-performing caption angle
- For Reels specifically:
  - 3-second views
  - average watch time
  - retention / completion rate if shown
  - audio/music used
  - cover frame used

Collect from website analytics after tracking is added:

- Sessions from `facebook` and `instagram`
- Free quiz starts
- Free preview completions
- Checkout clicks
- Purchases
- CAC if boosted/paid

Decision rule:

- If organic posts get profile visits but weak link clicks, tighten CTA and bio link.
- If link clicks happen but quiz completion is weak, improve homepage above-the-fold clarity.
- If free previews complete but checkout clicks are weak, improve paid CTA and report value proof.
- If checkout clicks happen but purchases are weak, test pricing, trust copy, and paid report sample.
