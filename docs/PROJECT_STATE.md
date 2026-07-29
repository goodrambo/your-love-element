---
kind: current
status: active
last_verified: 2026-07-30
review_after: 2026-08-05
evidence: local source inspection and automated checks; desktop/mobile offline browser smoke; GitHub commit 6005da3; read-only production HTTP/browser probes; project-scoped Supabase aggregate queries
---

# Project State

This is the only current-state snapshot. It describes what is verified now, distinguishes production from the dirty local worktree, and marks unknowns explicitly.

## Executive snapshot

- Product: English Five Element-inspired relationship reading; free 10-question preview, optional `$9.99 USD` full report.
- Production topology: GitHub Pages -> Cloudflare Worker -> Supabase / Lemon Squeezy / OpenAI / Resend, plus Meta Pixel and CAPI.
- Production site: `https://yourloveelement.com` returned HTTP 200 on 2026-07-30.
- Public GitHub `main` and the deployed measurement release are commit `6005da3d68076b51aa7d1e028e378c9996234040` (`Deploy privacy-safe growth measurement`). GitHub Pages served its runtime revision and CTA attributes on 2026-07-30.
- Local branch: `codex/verified-site-seo-release`, pushed to draft PR [#1](https://github.com/goodrambo/your-love-element/pull/1) with release commit `b9eff29`. It contains the verified design, Harness, documentation, strategy, and search-visibility changes; `main` and production remain at `6005da3` until a separately reviewed merge/deployment.

## Verified production state

Read-only checks on 2026-07-30 confirmed:

- Worker `/api/health`: `ok: true`.
- Supabase health: configuration present, REST reachable, sample query succeeded.
- Email health: Resend key and sender/support domains configured. This is configuration-only and does not prove current delivery.
- Meta health: CAPI access token, Pixel ID `4282306195342317`, and Graph API `v25.0` configured; test-event code is off.
- The protected growth scorecard route is deployed: an unauthenticated request returns HTTP 401. Its positive bearer-secret path passed the dedicated integration test but was not called in production because the secret was not exposed to this session.
- The analytics route is deployed: an untrusted origin returns HTTP 403 and frontend `Purchase` returns HTTP 400 before storage. Production browser loads created exactly one `landing/page_view`, one `landing/view_content`, and one `full_report/page_view` event across the verification session; a project-scoped aggregate query confirmed them without returning hashes or identifiers.
- Supabase production has service-role-only `get_growth_scorecard`, `funnel_events`, `funnel_event_maintenance`, and `get_first_party_funnel_scorecard` after the corrected migrations were applied on 2026-07-30. RLS is enabled and `anon`/`authenticated` execute is denied.
- Public GitHub repository and production Pages are reachable. The GitHub connector confirmed the exact remote commit and files; GitHub reported no commit status checks for this direct `main` push.

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
- Legal, privacy, refund, and contact pages.
- Codex growth-control heartbeat uses phased cadence: hourly during the observability/release bootstrap, every four hours after seven complete aggregate days are available, and daily at 08:30 Asia/Taipei after the first qualifying 10-purchaser day starts the streak. It is limited to read-only monitoring and safe local work until the growth runbook's authority gate is ready.
- Project and external-account isolation are machine-checked before work. The allowlist is the exact filesystem/Git root, automation `yle`, Supabase ref `nmwhaiimnuywnjlvobde`, GitHub remote `goodrambo/your-love-element`, Cloudflare Worker `your-love-element-api` plus zone `yourloveelement.com`, and Resend domain/addresses under `yourloveelement.com`. Other repositories, sibling projects, automations, Supabase projects, Cloudflare assets, Resend domains/messages, and account-level bulk operations are denied.

## Unpublished draft branch

Draft PR [#1](https://github.com/goodrambo/your-love-element/pull/1) contains a June landing conversion and visual redesign pass:

- New Fraunces/Manrope visual system and revised layout.
- Clearer 60-second free-preview positioning.
- Answer-tap auto-advance and earlier `quiz_start` semantics.
- Diagnostic `landing_cta_click` event.
- Updated logo and Lemon Squeezy icon assets.
- Expanded documentation and the Harness introduced on 2026-07-12.
- An initial SEO/GEO/AEO content cluster adds a comprehensive Five Elements love and compatibility guide, a transparent methodology/limitations page, answer-first homepage definitions, stronger internal linking, expanded schema, updated sitemap dates, and automated search-discovery regression checks. This work is pushed to the draft branch but remains unpublished from `main`.
- A dependency-free aggregate growth decision evaluator converts scorecard/provider inputs into rolling 3/7/14-day metrics, milestone variance, one primary constraint, one pre-registered action, and experiment continue/promote/stop status. It rejects customer-level or secret-shaped input keys and remains local until aggregate production data is available.
- A machine-validated standing-authority contract records the user's 2026-07-30 authorization for only the two measurement migrations, measurement-only Git push, Worker deployment, and frontend deployment. Organic/social publishing, customer messaging, paid-flow E2E, and paid media remain denied, with paid caps fixed at `$0`. The decision CLI intersects claimed live access with this policy so input data cannot authorize its own external action.

These changes passed Harness checks and a fresh local browser smoke on 2026-07-30 at desktop and `390 x 844` mobile sizes. The test covered the homepage plus both new editorial pages, completed all 10 questions, generated the Earth preview and `1080 x 1350` share card, confirmed the download success state, found no horizontal overflow or console warnings/errors, and verified `/full-report/` stays payment-locked. The local runtime API base was blank and the local server received no API request. They have not been proven by a fresh production deployment or paid-flow E2E.

## Operational history, not current claims

- Last documented successful paid-flow E2E: 2026-05-06.
- Last documented ad readout: 2026-05-14 through 2026-05-20, `133` landing-page views and `0` purchases.
- Last dated social packages covered 2026-06-14 through 2026-06-28. Whether every item was published and how it performed is unknown.
- Historical media and campaign records are under `artifacts/archive/2026-07-12/` and `docs/history/`.

## Current risks and unknowns

- The local redesign has fresh functional desktop/mobile QA, but still needs user visual/brand review before publication.
- The new search content and structured data have local automated/browser proof but still need editorial/brand review, an authorized deployment, production rich-result validation, sitemap resubmission, and Search Console query data before organic impact can be assessed.
- Local offline-preview isolation is browser-confirmed for the homepage and `/full-report/`; future frontend changes invalidate the recorded digest and require another smoke test.
- The deployed aggregate scorecard plus first-party funnel collector have a narrow digest waiver after 6/6 auth/privacy/aggregation tests passed; the separate decision evaluator passes 11/11 access, reliability, fulfillment, conversion, economics, traffic, experiment, privacy/window, and standing-authority tests. Production gates confirmed Pages assets, four Worker health endpoints, auth rejection, event rejection, successful allowlisted browser ingestion, both production pages, and no browser warnings/errors. The paid-flow E2E remains `SKIPPED`, not deployment proof.
- Email health does not prove a new email can be delivered.
- The complete conversion funnel, settled revenue, ad state, and social publishing completion remain unknown. The first-party landing/full-report baseline began successfully on 2026-07-30. A privacy-safe direct Supabase aggregate for the seven closed Taipei days 2026-07-23 through 2026-07-29 found 0 previews, checkouts, verified purchasers/orders, refunds, and deliveries, so the current 10-purchaser streak is 0 days.
- The in-app Browser is signed in to Supabase, Cloudflare, Resend, and Google Search Console; the `sc-domain:yourloveelement.com` property was verified through its exact DNS TXT record. Its Performance report was reachable again on 2026-07-30, reported an update five hours earlier, and still said data was processing and to return in about one day, so no search baseline exists yet. The Sitemap report listed zero submitted sitemaps; submission remains deferred until the reviewed search pages are published. Lemon Squeezy access is deliberately deferred because each login requires 2FA, and Meta is deliberately excluded from the current organic-first plan. The project-scoped `read_only=true` Supabase MCP is live for aggregate reads without customer rows; the scorecard RPC correctly rejects the MCP role because only `service_role` may execute it. Git HTTPS credentials successfully push only to `goodrambo/your-love-element`; the separate GitHub CLI token remains invalid but is no longer a deployment blocker. No local Wrangler CLI is installed. The standing-authority contract permits only measurement migrations/push/deploy while organic publishing, messages, paid E2E, and paid media remain denied at `$0`.
- The new Harness, hooks, and CI workflow are available on draft PR #1 but not yet on the default branch. Fresh-clone and merge enforcement begin only after an authorized merge, branch-protection setup, and one-time `/hooks` review/trust for the final hook hash.
- The 1.4 GB artifact archive is Git-ignored and local-only. Its `265/265` blobs were verified against the pre-cleanup capture, but it is not a fresh-clone backup.
- `.git` is about 2.7 GB because Codex turn-diff refs and loose objects retain media history. Do not remove those refs or run destructive pruning during active work.

## Next decision point

Let the hourly `yle` heartbeat collect the first seven complete Taipei measurement days, retry Search Console after its processing delay, and identify a project-scoped Resend aggregate surface without opening account-wide message/domain lists. Do not run a paid-flow E2E, send customer mail, publish organic content, use Meta, or access Lemon Squeezy without separate authorization.
