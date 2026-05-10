# Your Love Element Project Handoff

Last updated: 2026-05-10

## 2026-05-10 Confirmed Lemon Squeezy Launch Setup

Lemon Squeezy approval has passed and the production checkout flow is now active.

Confirmed production setup:

- Lemon Squeezy store: `Your Love Element`
- Lemon Squeezy Store ID: `365266`
- Product: `Your Love Element: Full Relationship Report`
- Price: `$9.99`
- Product type: digital product / personalized report
- Tax category: Digital Goods or Services
- Homepage CTA: `Unlock full report`
- Production Worker origin: `https://your-love-element-api.goodrambo2013.workers.dev`
- Production site origin: `https://yourloveelement.com`
- Production frontend commit that enabled checkout: `6ad9464 Enable Lemon Squeezy checkout frontend`

Cloudflare Worker runtime variables/secrets now include:

- `LEMON_SQUEEZY_API_KEY` as Secret
- `LEMON_SQUEEZY_STORE_ID` as Secret, value `365266`
- `LEMON_SQUEEZY_VARIANT_ID` as Secret
- `LEMON_SQUEEZY_WEBHOOK_SECRET` as Secret

Lemon Squeezy webhook setup:

- Callback URL: `https://your-love-element-api.goodrambo2013.workers.dev/api/webhooks/lemon-squeezy`
- Signing secret: same value as Cloudflare Worker secret `LEMON_SQUEEZY_WEBHOOK_SECRET`
- Enabled events:
  - `order_created`
  - `order_refunded`
- Do not enable subscription or license-key events for the current product. The current product is a one-time digital report purchase, not a subscription or license product.

Lemon Squeezy product configuration notes:

- `Media`: use `assets/hero-soulmate-report.png` or another polished product image.
- `Files`: leave empty. This product is a personalized generated report, not a fixed download file.
- `Links`: leave empty unless intentionally adding a fallback. The production checkout link is created dynamically by the Worker.
- `Variants`: keep the single `$9.99` variant unless intentionally launching a new price/package.
- `Confirmation modal` should send customers back to finish the deeper report signals:
  - Title: `Your full report is ready to refine`
  - Message: `Thank you for your order. To complete your personalized relationship report, please answer the 8 deeper signals on the next page. Your full report will be delivered by email after your answers are received.`
  - Button text: `Complete your report`
  - Button link: `https://yourloveelement.com/full-report/`
- `Email receipt` should also point customers back to the deeper signals:
  - Thank you note: `Thank you for ordering your full relationship report. To complete your personalized report, please answer the 8 deeper relationship signals using the button below. After your answers are received, your full report will be generated and delivered to your email.`
  - Button text: `Complete your report`
  - Button link: `https://yourloveelement.com/full-report/`

Confirmed technical flow:

1. User completes the free 10-question reading on `/`.
2. `script.js` calls `POST /api/readings` and stores the returned `reading_id` in browser storage.
3. User clicks `Unlock full report`.
4. Frontend calls `POST /api/create-checkout` with the `reading_id`.
5. Worker creates a Lemon Squeezy checkout using `LEMON_SQUEEZY_STORE_ID` and `LEMON_SQUEEZY_VARIANT_ID`.
6. Worker attaches `checkout_data.custom.reading_id`.
7. Worker sets the checkout redirect and receipt links to `https://yourloveelement.com/full-report/?reading_id=...`.
8. Lemon Squeezy checkout opens.
9. After payment, Lemon Squeezy sends `order_created` to `/api/webhooks/lemon-squeezy`.
10. Worker verifies the `X-Signature` with `LEMON_SQUEEZY_WEBHOOK_SECRET`.
11. Worker reads `meta.custom_data.reading_id`, customer email, order id, product id, variant id, and payment status.
12. Worker updates the Supabase `readings` row to `paid`.
13. Customer returns to `/full-report/?reading_id=...`.
14. Customer submits the 8 deeper paid signals.
15. Worker stores paid answers and the database trigger queues report generation once both payment and paid answers are present.

Confirmed production checks run on 2026-05-10:

- `GET /api/health` returned `{"ok":true}`.
- `GET /api/health/supabase` returned `ok: true`.
- `GET /api/health/email` returned `ok: true`.
- `POST /api/readings` successfully created test reading `2d89c736-8b4d-4811-bb03-ab3715095bf5`.
- `POST /api/create-checkout` successfully returned a Lemon Squeezy checkout URL for that reading.
- Live `https://yourloveelement.com/` contains `Unlock full report` and `window.YLE_API_BASE_URL`.
- Live `https://yourloveelement.com/full-report/` contains `window.YLE_API_BASE_URL`.

Do-not-change guardrails:

- Do not replace the homepage CTA with a static Lemon Squeezy checkout link. The Worker-created checkout is required because it attaches `reading_id` to `checkout_data.custom`.
- Do not remove `window.YLE_API_BASE_URL` from `index.html` or `full-report/index.html`; without it the static site falls back to local-only storage and checkout automation stops.
- Do not rename `reading_id` in Lemon Squeezy custom data unless `worker/src/index.js`, webhook handling, and frontend redirect handling are updated together.
- Do not upload a fixed product file in Lemon Squeezy unless the business model changes. The current delivery model is personalized generation after payment plus deeper answers.
- Do not change webhook events away from `order_created` and `order_refunded` without updating `handleLemonSqueezyWebhook`.
- Do not move the paid 8-question form before checkout. The confirmed product flow is free preview first, payment second, deeper signals third, email delivery last.

## 2026-05-06 Production E2E Check

- Confirmed GitHub `main` is now at latest commit `1cd9e26a6bddc0bcbeed99faffd20aaf9cbf0015`.
- Confirmed GitHub Pages is built from `main` root and the latest Pages deployment succeeded on 2026-05-06 13:05 UTC.
- Confirmed production site and element banner assets are live:
  - `https://yourloveelement.com/`
  - `https://yourloveelement.com/assets/elements/fire-banner.jpg`
  - `https://yourloveelement.com/assets/elements/water-banner.jpg`
- Ran a new production E2E report test using `fire` as the free-answer element:
  - reading id: `78e460b1-12b5-4e86-9dc5-d7450d078b78`
  - queued job id: `04e9f641-9fe8-4293-803e-06db1cd748b9`
  - final reading status: `delivered`
  - final job status: `succeeded`
  - email message id: `2b91dffe-b507-4946-b993-240281e2dc6e`
- Verified generated production report data:
  - `emotional_summary` is present.
  - `thirty_day_guidance` is a string with Day 1, Day 3, Day 7, Day 14, Day 21, and Day 30 checkpoints.
  - `report_html` does not contain `[object Object]`.
  - `report_text` does not contain `[object Object]`.
- Important note: `report_html` stored in Supabase is the standalone report HTML and does not include the email banner. The banner is applied only in the delivery email template through `elementBannerUrl(siteUrl, element)`. For the tested reading, the production input element was `fire`, so the email template path resolves to `https://yourloveelement.com/assets/elements/fire-banner.jpg`.
- Historical note: Lemon Squeezy checkout initially returned a generic `Internal server error` before the production Lemon Worker secrets were configured. This was resolved on 2026-05-10; `/api/create-checkout` now returns a Lemon Squeezy checkout URL in production.
- Local Worker email revision after reviewing the delivered email:
  - Banner image now renders at its natural 16:9 ratio instead of using `object-fit: cover`, so the top image should no longer be cropped.
  - `30-Day Guidance` prompt now asks each checkpoint for a specific goal, concrete practice, and observable progress signal, with 35-60 words per node.
- The email revision was committed and pushed:
  - commit: `1cd9e26 Improve report email banner and guidance`
  - GitHub Pages build for `1cd9e26` completed successfully on 2026-05-06 14:41 UTC.
- Ran a fresh production E2E after `1cd9e26`:
  - reading id: `b43373f3-9576-4a3a-bf33-ea3d27821c45`
  - queued job id: `b486b97a-b967-4e70-ac8a-2f9d52d87ef4`
  - final reading status: `delivered`
  - final job status: `succeeded`
  - email message id: `a8f553f2-280e-4032-95cb-517797b035fc`
  - tested element: `water`
  - `thirty_day_guidance` now uses the new practical format: `Goal`, `Practice`, and `Notice` in each Day checkpoint.
  - `report_html` and `report_text` still do not contain `[object Object]`.
  - Because the new 30-Day prompt format appeared in production output, the updated Worker code path is confirmed live.
- Worker email health check updated and deployed:
  - commit: `36e1864 Fix email health check for sending key`
  - `/api/health/email` is now configuration-only, not a Resend `/domains` API check.
  - Reason: current Resend key is a Sending access key. It can send email successfully, but may return 401 for account/domain reads.
  - Production verification now returns `ok: true`, `delivery_check: configuration_only`, `from_email_domain: yourloveelement.com`, and `support_email_domain: yourloveelement.com`.
  - Actual delivery should be verified with protected `POST /api/test-email` or a full report E2E.

## Confirmed Deployment Workflow

- This project has an existing Cloudflare/GitHub deploy integration for the Worker.
- For changes under `worker/src/index.js` or `worker/wrangler.toml`, the confirmed workflow is:
  1. Run `node --check worker/src/index.js`.
  2. Commit the relevant files.
  3. Push to `origin main`.
  4. Let the existing Cloudflare GitHub deploy run the Worker deploy, equivalent to `npx wrangler deploy --config worker/wrangler.toml` on Cloudflare's side.
  5. Verify `https://your-love-element-api.goodrambo2013.workers.dev/api/health`.
- Do not assume local `wrangler` or `npx` is available in Codex. In this workspace it was not available.
- Do not treat GitHub Pages deployment alone as proof that Worker code changed. GitHub Pages confirms static site/assets only; Worker behavior should be verified through Worker endpoints or a fresh E2E test.
- Plaintext Worker vars belong in `worker/wrangler.toml`; otherwise Cloudflare/GitHub deploy may overwrite Dashboard-only plaintext edits.
- Worker secrets remain only in Cloudflare Dashboard/runtime secrets and should not be committed:
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `RESEND_API_KEY`
  - `OPENAI_API_KEY`
  - `JOB_RUNNER_SECRET`
  - `LEMON_SQUEEZY_API_KEY`
  - `LEMON_SQUEEZY_STORE_ID`
  - `LEMON_SQUEEZY_VARIANT_ID`
  - `LEMON_SQUEEZY_WEBHOOK_SECRET`

## 2026-05-05 Automation Progress

- Supabase MCP server `supabase-your-love-element` is available in Codex.
- Confirmed target Supabase project ref: `nmwhaiimnuywnjlvobde`.
- Applied Supabase migrations to the target project only:
  - `create_paid_report_schema`
  - `harden_paid_report_functions`
  - `revoke_public_rls_auto_enable`
- Created product tables:
  - `readings`
  - `webhook_events`
  - `report_generation_jobs`
- Created status enums:
  - `reading_status`
  - `report_job_status`
- RLS is enabled on all product tables. Only `service_role` has direct table policies.
- Supabase security advisor currently reports no lints.
- Added Cloudflare Worker backend scaffold in `worker/`:
  - `POST /api/readings`
  - `POST /api/create-checkout`
  - `POST /api/webhooks/lemon-squeezy`
  - `POST /api/readings/:reading_id/paid-signals`
  - `POST /api/jobs/process`
- Added progressive frontend wiring in `script.js`.
  - If `window.YLE_API_BASE_URL` is unset, the static site keeps working and stores answers locally as a fallback.
  - Once the Worker is deployed, set `window.YLE_API_BASE_URL` to the Worker origin so the frontend writes to the backend.

## 2026-05-06 Email And Delivery Setup

- Cloudflare Email Routing is enabled for `yourloveelement.com`.
- Active inbound forwarding addresses:
  - `support@yourloveelement.com`
  - `reports@yourloveelement.com`
- Catch-all routing is disabled.
- DNS currently includes Cloudflare Email Routing MX records:
  - `route1.mx.cloudflare.net`
  - `route2.mx.cloudflare.net`
  - `route3.mx.cloudflare.net`
- Cloudflare Email Routing TXT records are present for SPF and DKIM.
- Recommended transactional email identity:
  - From: `Your Love Element <reports@yourloveelement.com>`
  - Reply-To / support: `support@yourloveelement.com`
- Resend should be configured in the existing Resend account, not a separate account.
- Use a dedicated Resend API key for this product and store it only in Cloudflare Worker runtime secrets as `RESEND_API_KEY`.
- Cloudflare Worker runtime variables/secrets should include:
  - `RESEND_API_KEY` as a secret
  - `FROM_EMAIL=Your Love Element <reports@yourloveelement.com>`
  - `SUPPORT_EMAIL=support@yourloveelement.com`
- Do not store Resend or Supabase secrets in Cloudflare build-process variables unless a build step explicitly needs them.
- Plaintext Worker variables are managed in `worker/wrangler.toml`. Editing plaintext runtime variables only in the Cloudflare Dashboard may be overwritten by the next GitHub deployment.
- Current `worker/wrangler.toml` plaintext variables should include:
  - `SITE_URL=https://yourloveelement.com`
  - `SUPABASE_URL=https://nmwhaiimnuywnjlvobde.supabase.co`
  - `SUPPORT_EMAIL=support@yourloveelement.com`
  - `FROM_EMAIL=Your Love Element <reports@yourloveelement.com>`
  - `OPENAI_MODEL=gpt-5.5`
- Report delivery email has been upgraded from raw report HTML to a branded transactional email:
  - opening reassurance and personalization
  - element-specific report banner image from `/assets/elements/{element}-banner.jpg`
  - styled report sections
  - `30-Day Guidance` rendered as timed checkpoints: Day 1, Day 3, Day 7, Day 14, Day 21, Day 30
  - clear support/reply path
- Element banner assets:
  - `assets/elements/wood-banner.jpg`
  - `assets/elements/fire-banner.jpg`
  - `assets/elements/earth-banner.jpg`
  - `assets/elements/metal-banner.jpg`
  - `assets/elements/water-banner.jpg`
- PDF attachment is not implemented yet. Resend supports attachments and inline images, but reliable PDF generation needs a dedicated renderer or service before enabling it in production.

## Current Live Site

- Production domain: https://yourloveelement.com/
- GitHub repo: https://github.com/goodrambo/your-love-element
- GitHub Pages source: `main` branch, root directory
- Custom domain file: `CNAME`
- HTTPS is enforced through GitHub Pages
- DNS is managed in Cloudflare with GitHub Pages A/AAAA records and `www` CNAME

## Current Product Direction

Your Love Element is a mobile-first H5-style relationship reading product.

The core funnel:

1. User completes a free 10-question reading.
2. Site shows a free preview report.
3. Paid full report is positioned at `$9.99`.
4. After Lemon Squeezy checkout, user returns to `/full-report/?reading_id=...`.
5. User completes 8 deeper relationship signals.
6. Future implementation generates/delivers the full report.

## Confirmed Paid Product Flow

The recommended product flow is:

1. User completes the free 10-question reading on `/`.
2. Site reveals a free preview report and explains what the full report adds.
3. User clicks `Unlock full report` and pays `$9.99` through Lemon Squeezy.
4. Lemon Squeezy sends the user a confirmation email with the post-purchase link.
5. User returns to `https://yourloveelement.com/full-report/?reading_id=...`.
6. User completes the 8 deeper paid signals.
7. Site collects:
   - Lemon Squeezy order identifier or checkout identifier
   - purchaser email
   - free 10-question answers, if available from browser storage
   - paid 8-question answers
   - submission timestamp
8. Backend or form service verifies that the order exists and is paid.
9. Report is generated from the combined 18 signals.
10. User receives the full report by email.

Recommended MVP delivery:

- Do not show the full paid report instantly on the static `/full-report/` page.
- After the paid 8-question form is submitted, show a confirmation state:
  - `Your answers were received. Your full report will be delivered to your email.`
- Deliver the first version manually or semi-manually by email within a clear window, such as `within 24 hours`.
- Attach or link to a polished report in one of these formats:
  - PDF attachment
  - private hosted HTML report link
  - email body with the full report content

Recommended long-term delivery:

- Replace manual generation with an automated backend flow.
- Use Lemon Squeezy webhooks to store paid orders.
- Use a report-generation service to create the report immediately after paid-signal submission.
- Send the report automatically through transactional email.
- Optionally show an on-page `Your report is ready` view after generation.

Important product decision:

- Email should be the primary delivery channel because it creates a durable receipt, reduces risk if the user closes the browser, and works well with Lemon Squeezy's checkout email flow.
- The on-page confirmation should be treated as a backup/status experience, not the only place where the paid result appears.
- The paid report should only be generated after both conditions are true:
  - payment is verified
  - the 8 deeper signals are submitted

## Full Automation Architecture

The current GitHub Pages site is static, so it cannot securely store answers, verify payments, call AI generation, or send email by itself. Full automation requires a small backend plus a database.

Recommended stack:

- Frontend: current GitHub Pages static site
- Backend/API: Cloudflare Workers
- Database: Supabase Postgres
- Payment: Lemon Squeezy checkout + webhooks
- Report generation: OpenAI API or another LLM API
- Transactional email: Resend, Postmark, SendGrid, or similar

Current infrastructure context:

- Supabase account already exists and is used for other projects.
- Cloudflare account already exists, but Cloudflare Workers has not been used yet.
- Recommended next backend choice is Cloudflare Workers because the domain/DNS is already in Cloudflare and the API surface for this product can stay small.
- A new Supabase project has been created for this product.
- Project ref: `nmwhaiimnuywnjlvobde`
- Codex MCP config has been added globally:
  - name: `supabase-your-love-element`
  - URL: `https://mcp.supabase.com/mcp?project_ref=nmwhaiimnuywnjlvobde`
- Current session could not see the newly added MCP server without restarting/reloading Codex, so the next session should verify that the Supabase MCP tools are available before making database changes.
- Do not use or modify other Supabase projects.

Recommended automated flow:

1. Free quiz is completed on `/`.
2. Frontend sends the 10 free answers to backend:
   - endpoint: `POST /api/readings`
   - backend creates a `reading_id`
   - database stores `reading_id`, free answers, and `status = previewed`
3. User clicks `Unlock full report`.
4. Frontend calls backend:
   - endpoint: `POST /api/create-checkout`
   - payload includes `reading_id`
5. Backend creates a Lemon Squeezy checkout link with:
   - `checkout_data.custom.reading_id`
   - optional `checkout_data.email` if collected before checkout
   - redirect URL: `/full-report/?reading_id=...`
6. User completes Lemon Squeezy payment.
7. Lemon Squeezy sends `order_created` webhook to backend.
8. Backend verifies webhook signature, reads `meta.custom_data.reading_id`, purchaser email, order id, and payment status.
9. Backend updates the reading:
   - `status = paid`
   - `order_id = ...`
   - `customer_email = ...`
10. User lands on `/full-report/?reading_id=...`.
11. User completes the 8 paid signals.
12. Frontend sends paid answers to backend:
   - endpoint: `POST /api/readings/:reading_id/paid-signals`
13. Backend checks that:
   - the reading exists
   - payment is verified
   - paid answers are present
14. Backend generates the report from the combined 18 answers.
15. Backend saves generated report content and `status = report_generated`.
16. Backend sends the report to the purchaser email through transactional email.
17. Backend updates `status = delivered` and stores the email provider message id.

Recommended state machine:

- `previewed` - free answers saved
- `checkout_created` - Lemon Squeezy checkout link created
- `paid` - Lemon Squeezy webhook confirms payment
- `paid_answers_submitted` - 8 deeper signals submitted
- `generating` - report generation is running
- `report_generated` - report saved
- `delivered` - email sent
- `failed` - generation or delivery failed and needs retry

Important implementation detail:

- The backend should trigger report generation whenever both required inputs are available:
  - verified payment
  - submitted paid answers
- This makes the flow resilient if the webhook arrives before the user submits paid answers, or if the user submits paid answers before the webhook is processed.

Recommended database tables:

- `readings`
  - `id`
  - `free_answers_json`
  - `paid_answers_json`
  - `customer_email`
  - `lemon_squeezy_order_id`
  - `status`
  - `report_html`
  - `report_text`
  - `email_message_id`
  - `created_at`
  - `updated_at`
- `webhook_events`
  - `id`
  - `provider`
  - `event_name`
  - `external_event_id`
  - `payload_json`
  - `processed_at`

Answer collection decision:

- Do not rely only on browser localStorage for paid product delivery.
- Browser storage is useful as a fallback for preserving answers during the same session, but the authoritative copy must live in the backend database.
- The `reading_id` is the bridge between:
  - free quiz answers
  - Lemon Squeezy payment
  - paid 8-question answers
  - generated report
  - email delivery

## Pages and Assets

Main pages:

- `/` - homepage and free 10-question reading
- `/contact/` - contact/support page
- `/privacy/` - privacy policy
- `/terms/` - terms of service
- `/refund/` - refund policy
- `/full-report/` - prepared post-checkout 8-question paid signal flow

Important files:

- `index.html` - homepage/free reading
- `script.js` - free quiz, paid quiz, cookie consent
- `styles.css` - all site styles
- `full-report/index.html` - paid 8-question flow
- `lemon-squeezy-product-copy.md` - Lemon Squeezy product copy
- `paid-report-sample.md` - paid report sample draft
- `assets/logo-mark.svg` - site logo
- `assets/lemon-squeezy-store-icon.png` - Lemon Squeezy store icon
- `assets/social-preview.png` - Open Graph/social preview image

## Confirmed Decisions

- Free reading stays at 10 questions.
- Paid full report adds 8 extra questions.
- Paid 8 questions happen after checkout, not before checkout.
- Price is `$9.99`.
- CTA is live as `Unlock full report` and should continue to use the Worker-created checkout flow.
- `/full-report/` is intentionally not in the main nav yet.
- Clean URLs are preferred:
  - `/privacy/`, not `/privacy.html`
  - `/contact/`, not `/contact.html`
  - logo links should go to `/`, not `index.html`
- Footer should be centered and professional:
  - customer support email: `support@yourloveelement.com`
  - copyright: `© 2026 Your Love Element. All rights reserved.`
- Cookie consent currently only stores user preference; no analytics/pixels are loaded yet.

## Free 10 Questions

Current free reading signals:

1. Current love-life state
2. What the user wants to understand
3. Magnetic partner quality
4. Relationship element style
5. Likely meaningful meeting field
6. Pull-away pattern
7. Secure relationship feeling
8. Compliment/mirror signal
9. Trusted romantic pace
10. Birthday month/day

The free preview currently outputs:

- Future partner portrait
- Element profile
- Mini analysis:
  - recognition sign
  - meeting signal
  - pattern to release
  - next step

## Paid 8 Questions

Current `/full-report/` paid signal flow:

1. When you start liking someone, what happens inside you first?
2. In past relationships, which pattern has shown up most?
3. What kind of reassurance matters most to you?
4. How do you usually handle conflict?
5. Which partner energy would feel most healing now?
6. What are you no longer willing to accept?
7. What would make you trust love faster?
8. What kind of 30-day guidance would help you most?

These are intended to refine:

- attachment pattern
- past pattern
- reassurance need
- conflict style
- partner energy
- boundaries
- trust signal
- 30-day guidance

## Current Report Logic

The current free preview is a front-end rules-based composition, not AI generation.

Important behavior:

- `quality` selects the main archetype:
  - `Emotional steadiness` -> `The Grounded Visionary`
  - `Creative ambition` -> `The Magnetic Builder`
  - `Warm intelligence` -> `The Gentle Strategist`
  - `Playful confidence` -> `The Bright Companion`
- `element` selects element copy.
- `status`, `intent`, `setting`, `block`, `secure`, and `pace` are inserted into the partner portrait and mini analysis text.

Known limitation:

- It does not generate a unique report for every possible answer permutation.
- Next recommended upgrade is a scoring model:
  - archetype score
  - element score
  - attachment score
  - pace/readiness score
  - boundary score
  - compatibility style score

## Lemon Squeezy Setup

Payment approval has passed and production checkout is active.

Prepared product:

- Product name: `Your Love Element: Full Relationship Report`
- Price: `$9.99`
- Product type: digital product / personalized report
- Store icon: `assets/lemon-squeezy-store-icon.png`
- Product copy: `lemon-squeezy-product-copy.md`
- Fallback post-purchase redirect: `https://yourloveelement.com/full-report/`
- Runtime post-purchase redirect created by Worker: `https://yourloveelement.com/full-report/?reading_id=...`

Completed production setup:

1. Product created in Lemon Squeezy.
2. Copy from `lemon-squeezy-product-copy.md` used for the product.
3. Product media configured.
4. Confirmation modal points to `/full-report/` as fallback.
5. Email receipt points to `/full-report/` as fallback.
6. Worker secrets configured in Cloudflare.
7. Lemon webhook configured for `order_created` and `order_refunded`.
8. Homepage CTA changed from `Join early access` to `Unlock full report`.
9. Frontend pages set `window.YLE_API_BASE_URL` before loading `script.js`.
10. Production `/api/create-checkout` verified to return a Lemon Squeezy checkout URL.

## Design/Layout Decisions

- Site should feel premium, intimate, and mobile-first.
- Avoid making it look like a generic landing page.
- Homepage hero is the main app experience, not a marketing-only hero.
- Preview report layout has been iterated several times.
- Current preferred structure:
  - centered preview heading
  - left column: long partner portrait + compressed free preview summary
  - right column: mini analysis + refinement explanation + paid CTA
- `Your free preview includes` should stay compact, not a large empty card.
- Future partner portrait should be longer than the first MVP version, but the free preview should not give away the full paid report depth.

## Commercial/Legal Pages

Added:

- Contact
- Privacy Policy
- Terms of Service
- Refund Policy

Important caveat:

- These are practical first drafts, not legal advice.
- Update them once final delivery, refund, data handling, and payment processes are finalized.

## Cookie Consent

Current behavior:

- Shows a cookie consent popup.
- Options:
  - `Essential only`
  - `Allow all`
- Stores choice in localStorage key: `yle-cookie-consent`
- Includes a localStorage safety fallback for browsers/private modes where storage may fail.

Important future task:

- If analytics, Meta pixel, Google tag, or tracking scripts are added, they must respect the stored consent choice.

## DNS / GitHub Pages Notes

Cloudflare DNS should include:

- `@` A records:
  - `185.199.108.153`
  - `185.199.109.153`
  - `185.199.110.153`
  - `185.199.111.153`
- Optional but currently recommended `@` AAAA records:
  - `2606:50c0:8000::153`
  - `2606:50c0:8001::153`
  - `2606:50c0:8002::153`
  - `2606:50c0:8003::153`
- `www` CNAME:
  - `goodrambo.github.io`

All Cloudflare records should stay DNS only / gray cloud for GitHub Pages.

## Gotchas / Things We Already Hit

- GitHub CLI token was invalid at first; re-auth was required with `gh auth login`.
- Local `.git` writes sometimes required escalated permissions.
- GitHub Pages custom domain showed DNS success before HTTPS checkbox was ready.
- HTTPS was eventually enabled successfully through GitHub API.
- GitHub Pages builds often showed `building` for a while even after files were pushed; latest build endpoint eventually showed `built`.
- Static clean URLs require folder-based pages:
  - `privacy/index.html`
  - `terms/index.html`
  - `refund/index.html`
  - `contact/index.html`
- Pages inside subfolders need relative asset paths like `../assets/logo-mark.svg`, `../styles.css`, and `../script.js`.
- Quick Look converted `social-preview.svg` to a square image, so `social-preview.png` was generated separately at proper `1200x630`.
- The free preview logic currently depends on DOM IDs in `index.html`; changing IDs requires updating `script.js`.
- `script.js` is shared by homepage, legal pages, and `/full-report/`, so feature initializers need to guard against missing DOM nodes.

## Immediate Next Tasks

Recommended next session order:

1. Build a scoring model for free + paid answers.
2. Decide final full report structure and output format:
   - browser page
   - PDF
   - email delivery
   - hybrid
3. Run a real low-value production purchase or Lemon Squeezy test purchase, if available, to verify `order_created` webhook end to end.
4. Confirm the paid report email is delivered after both payment and 8 deeper signals are present.
5. Add stricter order verification before allowing `/full-report/` to submit/generate if needed.
6. Update Terms/Refund/Privacy based on actual delivery timing and refund behavior.
7. Test social previews with live URL after major copy/image changes.

## Useful Commands

Check JS:

```bash
node --check script.js
```

Run local static server:

```bash
python3 -m http.server 8765
```

Check GitHub Pages build:

```bash
gh api repos/goodrambo/your-love-element/pages/builds/latest
```

Check Pages config:

```bash
gh api repos/goodrambo/your-love-element/pages
```
