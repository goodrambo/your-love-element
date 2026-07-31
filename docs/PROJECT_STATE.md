---
kind: current
status: active
last_verified: 2026-07-31
review_after: 2026-08-05
evidence: local source inspection and automated checks; desktop/mobile offline browser smoke; GitHub runtime releases through 110435e with successful Actions/Pages runs; read-only production HTTP/browser probes; Search Console sitemap submission and URL inspection; project-scoped Supabase aggregate queries
---

# Project State

This is the only current-state snapshot. It describes what is verified now and marks unknowns explicitly.

## Executive snapshot

- Product: English Five Element-inspired relationship reading; free 10-question preview, optional `$9.99 USD` full report.
- Production topology: GitHub Pages -> Cloudflare Worker -> Supabase / Lemon Squeezy / OpenAI / Resend, plus Meta Pixel and CAPI.
- Production site: `https://yourloveelement.com` returned HTTP 200 on 2026-07-31.
- Public GitHub `main` includes image-discovery release merge `110435efc3afb1f97adffdf3a5df1a0ae81648ee` (`Improve homepage image discovery (#7)`) after CI and Pages deployment succeeded on 2026-07-31. The performance release remains merge `e270c6fff16f7e9050a1ac0fe1faa080e5618ebc`; the conversion release remains merge `c468bf74071aa57ea77d20ca5204ad521e9dd1e8`.
- Local `main` was fast-forwarded to the verified image-discovery release.

## Verified production state

Read-only checks through 2026-07-31 confirmed:

- GitHub `harness` run `30502992951` and Pages build/deployment run `30502992303` completed successfully for release merge `0de5835`. The documentation-only follow-up `558a7e1` also passed Harness run `30503346309` and Pages run `30503345639`.
- Production serves the new homepage title and cache revision, the Five Elements guide, and the methodology/limitations page. The two content pages have their intended canonical URLs; the guide exposes `Article` and `FAQPage` structured data; all three pages had no horizontal overflow or browser console warnings/errors in the release verification.
- Production `robots.txt` references `https://yourloveelement.com/sitemap.xml`; the sitemap includes both new content URLs.
- Worker `/api/health`: `ok: true`.
- Supabase health: configuration present, REST reachable, sample query succeeded.
- Email health: Resend key and sender/support domains configured. This is configuration-only and does not prove current delivery.
- Meta health: CAPI access token, Pixel ID `4282306195342317`, and Graph API `v25.0` configured; test-event code is off.
- The protected growth scorecard route is deployed: an unauthenticated request returns HTTP 401. Its positive bearer-secret path passed the dedicated integration test but was not called in production because the secret was not exposed to this session.
- The analytics route is deployed: an untrusted origin returns HTTP 403 and frontend `Purchase` returns HTTP 400 before storage. A project-scoped aggregate collected on 2026-07-31 closed the first baseline day, 2026-07-30, at `3` unique landing sessions with matching `page_view`/`view_content` events and `1` full-report page-view session, without returning hashes or identifiers. CTA, quiz, preview, checkout, verified purchaser/order, refund, delivery, and failure counts were all `0`.
- Supabase production has service-role-only `get_growth_scorecard`, `funnel_events`, `funnel_event_maintenance`, and `get_first_party_funnel_scorecard` after the corrected migrations were applied on 2026-07-30. RLS is enabled and `anon`/`authenticated` execute is denied.
- Public GitHub repository and production Pages are reachable; merge `e270c6f` is the latest fully verified runtime deployment. Harness run `30593389598` and Pages run `30593389276` completed successfully. The homepage now serves the 1672 x 941 hero artwork as a 112,840-byte WebP instead of the 2,268,306-byte PNG for both visible uses, a 95.0% reduction. Production desktop `1440 x 1000` and mobile `390 x 844` browser smoke loaded both images at their natural dimensions with no horizontal overflow or console warnings/errors; the four Worker health endpoints remained HTTP 200 and the unauthenticated scorecard remained HTTP 401.
- Image-discovery merge `110435e` aligned the homepage WebPage/Product JSON-LD and image sitemap with that deployed WebP. Harness run `30596444920` and Pages run `30596444514` succeeded. Read-only production source and desktop/mobile browser smoke confirmed `dateModified` 2026-07-31, matching WebP URLs, one H1, no horizontal overflow, hidden mobile navigation, and no console warnings/errors; the four Worker health endpoints remained HTTP 200 and the unauthenticated scorecard remained HTTP 401.

Fresh production proof is still required for actual email delivery, payment/webhook behavior, report content, and Meta event receipt after any related deployment.

## Implemented product capabilities

- Free preview flow and element-specific share cards.
- Dynamic Worker-created Lemon Squeezy checkout carrying `reading_id`.
- Payment verification before the eight paid signals are accepted.
- Supabase state machine, webhook deduplication, queue claim, and service-role-only access.
- Deterministic relationship scoring plus structured OpenAI report generation.
- Cron-based report processing and branded Resend HTML email delivery.
- Retry/idempotency protections, including `Idempotency-Key: full-report/{reading.id}`.
- Browser funnel tracking and server-only Meta `Purchase` from a verified Lemon webhook.
- Protected aggregate growth scorecard plus privacy-minimized first-party page, funnel-stage, and sanitized UTM measurement.
- A deterministic local scorecard adapter converts the two service-role-only aggregate RPC row sets into the evaluator contract, merges landing/full-report and UTM counts, requires every closed commerce day, and rejects sensitive or unknown fields instead of inventing missing zeros.
- A shared golden fixture now passes through both the protected Worker scorecard route and local adapter, requiring identical source/privacy/limitations, range, goal/streak, totals, days, and deterministic attribution ordering; both paths reject non-object, missing, or unknown RPC aggregate fields, while the Worker also fails closed on incomplete commerce rows and duplicate or out-of-range funnel attribution rows so data loss cannot be misreported as zero activity.
- Legal, privacy, refund, and contact pages.
- Codex growth-control heartbeat uses phased cadence: hourly while bootstrap/high-impact work remains, every four hours only after seven complete aggregate days exist and the ready high-impact queue has stayed empty for 24 hours, and daily at 08:30 Asia/Taipei after the first qualifying 10-purchaser day starts the streak. Each run must deliver one non-repetitive verified implementation, test, decision, release, production verification, or rollback result; public health probes are only a safety gate.
- Project and external-account isolation are machine-checked before work. The allowlist is the exact filesystem/Git root, automation `yle`, Supabase ref `nmwhaiimnuywnjlvobde`, GitHub remote `goodrambo/your-love-element`, Cloudflare Worker `your-love-element-api` plus zone `yourloveelement.com`, and Resend domain/addresses under `yourloveelement.com`. Other repositories, sibling projects, automations, Supabase projects, Cloudflare assets, Resend domains/messages, and account-level bulk operations are denied.

## Published brand and search release

PR [#1](https://github.com/goodrambo/your-love-element/pull/1) was approved, changed from draft to ready for review, and merged to `main` on 2026-07-30. The published release contains:

- New Fraunces/Manrope visual system and revised layout.
- Clearer 60-second free-preview positioning.
- Answer-tap auto-advance and earlier `quiz_start` semantics.
- Diagnostic `landing_cta_click` event.
- Updated logo and Lemon Squeezy icon assets.
- Expanded documentation and the Harness introduced on 2026-07-12.
- An initial SEO/GEO/AEO content cluster with a comprehensive Five Elements love and compatibility guide, a transparent methodology/limitations page, answer-first homepage definitions, stronger internal linking, expanded schema, updated sitemap dates, and automated search-discovery regression checks.
- A dependency-free aggregate growth decision evaluator converts scorecard/provider inputs into rolling 3/7/14-day metrics, milestone variance, one primary constraint, one pre-registered action, and experiment continue/promote/stop status. It rejects customer-level or secret-shaped input keys and remains local until aggregate production data is available.
- A machine-validated standing-authority contract records the user's 2026-07-30 authorization for the two measurement migrations, measurement-only Worker deployment, and verified low-risk measurement/conversion/SEO Git push and frontend deployment for the exact allowlisted assets. Off-site/social publishing, customer messaging, paid-flow E2E, Meta/Lemon actions, and paid media remain denied, with paid caps fixed at `$0`. The decision CLI intersects claimed live access with this policy so input data cannot authorize its own external action.

## Published conversion audit

- A fresh English-language buyer review on 2026-07-30 completed the free 10-question Earth path at desktop `1440 x 1000` and mobile `390 x 844`, checked Back/validation behavior, generated the preview/share card, exercised the preview-to-offer jump, and confirmed the local paid page stayed locked.
- Local changes remove the empty mobile navigation shell, give missing month/day distinct validation messages without premature errors, shorten repetitive generated preview copy to 123 words for the audited path, put the paid offer before sharing tools, add a visible result-to-offer jump, clarify one-time USD price/Lemon Squeezy checkout/delivery timing, improve email-field semantics, and relabel the informational cookie UI as a notice.
- Local SEO regression coverage now requires every editorial FAQ question and answer in JSON-LD to exactly match the visible page; the two existing schema-copy drifts were corrected without changing rendered content.
- All eight local routes had one H1, no horizontal overflow, no broken sourced images, no unlabeled form controls, and no browser console warnings/errors. The API base stayed blank and the local server received no API request. This is the offline-preview evidence for the subsequently published PR #2 release; current production proof is recorded below.

These changes passed Harness checks and a fresh local browser smoke on 2026-07-30 at desktop and `390 x 844` mobile sizes. The test covered the homepage plus both editorial pages, completed all 10 questions, generated the Earth preview and `1080 x 1350` share card, confirmed the download success state, found no horizontal overflow or console warnings/errors, and verified `/full-report/` stays payment-locked. The local runtime API base was blank and the local server received no API request. PR #2 then passed both PR checks, merged to `main`, and deployed through GitHub Pages. Read-only production desktop/mobile smoke confirmed the cache revision, offer order/copy, accessible required email field, hidden mobile nav shell, no horizontal overflow or console warnings/errors, and exact visible/JSON-LD FAQ parity on both editorial pages. Paid-flow E2E remains unproved and was not part of this release verification.

## Operational history, not current claims

- Last documented successful paid-flow E2E: 2026-05-06.
- Last documented ad readout: 2026-05-14 through 2026-05-20, `133` landing-page views and `0` purchases.
- Last dated social packages covered 2026-06-14 through 2026-06-28. Whether every item was published and how it performed is unknown.
- Historical media and campaign records are under `artifacts/archive/2026-07-12/` and `docs/history/`.

## Current risks and unknowns

- The published redesign and search content have user visual/brand/editorial approval plus local and production browser proof. Organic impact still cannot be assessed until Search Console accumulates query and indexing data.
- Search Console accepted `https://yourloveelement.com/sitemap.xml` on 2026-07-30, read it successfully, and discovered seven URLs. The new guide and methodology URLs are both `Discovered - currently not indexed` with no crawl time yet; this is pending crawler/indexing evidence, not a release failure and not a claim of organic visibility.
- Local offline-preview isolation is browser-confirmed for the homepage and `/full-report/`; future frontend changes invalidate the recorded digest and require another smoke test.
- The deployed aggregate scorecard plus first-party funnel collector have a narrow digest waiver after 6/6 auth/privacy/aggregation tests passed; the separate decision evaluator passes 11/11 access, reliability, fulfillment, conversion, economics, traffic, experiment, privacy/window, and standing-authority tests. Production gates confirmed Pages assets, four Worker health endpoints, auth rejection, event rejection, successful allowlisted browser ingestion, both production pages, and no browser warnings/errors. The paid-flow E2E remains `SKIPPED`, not deployment proof.
- Email health does not prove a new email can be delivered.
- The complete conversion funnel, settled revenue, ad state, and social publishing completion remain unknown. The first-party landing/full-report baseline began successfully on 2026-07-30. The first complete closed day had `3` landing sessions, `0` CTA clicks, and `0` verified purchasers; the current 10-purchaser streak is therefore `0` days. The evaluator classifies the present primary constraint as `observability` because only one of the required seven closed days exists; it did not authorize a conversion conclusion or customer-facing experiment from this sample.
- The in-app Browser is signed in to Supabase, Cloudflare, Resend, and Google Search Console; the `sc-domain:yourloveelement.com` property was verified through its exact DNS TXT record. Its Performance report was reachable again on 2026-07-30 but was still processing, so no search baseline exists yet. The sitemap now reports success and seven discovered URLs. Lemon Squeezy access is deliberately deferred because each login requires 2FA, and Meta is deliberately excluded from the current organic-first plan. The project-scoped `read_only=true` Supabase MCP was configured and previously validated for aggregate reads without customer rows, but it was not exposed to the scheduled 2026-07-31 runtime; the exact-project signed-in dashboard supplied the two aggregate RPC results instead. The scorecard RPC correctly rejects the MCP role because only `service_role` may execute it. The exact-repository `gh` CLI authentication and guarded branch/PR workflow are operational. No local Wrangler CLI is installed. Standing authority permits verified low-risk site conversion/SEO push/deploy; messages, social publishing, paid E2E, Meta/Lemon actions, and paid media remain denied at `$0`.
- The Harness, hooks, and CI workflow are now on the default branch. The release run passed; branch-protection setup and one-time `/hooks` review/trust for the final hook hash remain optional maintenance work.
- The 1.4 GB artifact archive is Git-ignored and local-only. Its `265/265` blobs were verified against the pre-cleanup capture, but it is not a fresh-clone backup.
- `.git` is about 2.7 GB because Codex turn-diff refs and loose objects retain media history. Do not remove those refs or run destructive pruning during active work.

## Next decision point

Collect six more complete Taipei measurement days through 2026-08-05, then rerun the evaluator on the seven-day baseline; recheck Search Console when processed data becomes available. Until that gate, measurement-plane implementation/tests and other ready high-impact local work remain valid hourly outcomes, but no customer-facing conversion experiment should be promoted from the current three-session sample. Do not run a paid-flow E2E, send customer mail, publish to social channels, use Meta, or access Lemon Squeezy without separate authorization.
