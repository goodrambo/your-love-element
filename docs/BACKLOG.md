---
kind: backlog
status: active
last_reviewed: 2026-07-30
review_after: 2026-08-05
---

# Active Backlog

This is the only active task list. History files may contain old “next tasks”; those are not actionable unless copied here after revalidation.

## Growth objective: due 2026-10-14

- [x] Create the phased growth-control heartbeat: hourly while bootstrap/high-impact work remains, every four hours only after seven complete aggregate days and a 24-hour empty ready queue, and daily after the first qualifying streak day. Require one non-repetitive verified result per run, review early-stage strategy every six runs, and keep the hard review date non-extendable.
- [x] Enforce exact `your-love-element` isolation in the repository contract, Harness, runbook, and sole `yle` heartbeat; allowlist only this filesystem/Git root, Supabase project, GitHub repository, Cloudflare Worker/zone, and Resend domain/addresses while denying every sibling asset in the same accounts.
- [ ] Complete the organic-plan data/authority gate in `docs/runbooks/GROWTH_CONTROL_LOOP.md` by 2026-08-02: Search Console, exact-repository GitHub/Pages release access, and low-risk site conversion/SEO authority are connected; Search Console is still processing data and a project-scoped Resend delivery aggregate remains unavailable. Lemon Squeezy and Meta access are deliberately deferred; paid media remains unauthorized at `$0`.
- [x] Verify signed-in Supabase, Cloudflare, and Resend dashboard sessions; confirm the target Supabase project; configure and validate the project-scoped read-only Supabase MCP with schema and aggregate-only queries on 2026-07-30.
- [ ] Complete the current baseline. The first complete closed Taipei day, 2026-07-30, had `3` landing sessions, `3` view-content sessions, `1` full-report page-view session, and `0` CTA clicks, quiz starts, previews, checkouts, verified purchasers/orders, refunds, deliveries, or failures. Six more closed days are required through 2026-08-05. Search Console is verified and accepted a seven-URL sitemap on 2026-07-30, but query data is still processing and both new content URLs are discovered but not yet indexed; settled revenue, spend, CAC, and a project-scoped Resend delivery aggregate remain unavailable.
- [x] Implement and locally test the protected aggregate growth scorecard/RPC; it exposes counts only and no customer identifiers or private report data.
- [x] Implement and locally test privacy-minimized first-party funnel/UTM aggregates; browser `purchase` is rejected and no contact, reading, answer, URL, referrer, IP, or user-agent data is stored.
- [x] Implement and test the deterministic aggregate decision evaluator for rolling windows, milestone gaps, constraint selection, authority gating, and experiment promotion/stopping.
- [x] Add a Harness-validated standing-authority contract with explicit-evidence requirements, default-denied production mutations, and `$0` paid-media caps; make the decision CLI enforce it.
- [ ] Reach the dated milestones in the growth runbook, begin the 10-purchaser/day streak no later than 2026-09-15, and complete 30 consecutive qualifying days by 2026-10-14.

## Ready

- [ ] Release the implemented privacy-safe share attribution change through a reversible PR: replace the untagged homepage link in share text with fixed aggregate UTM labels, keep the image share payload unchanged, and production-smoke the exact cache revision. Hypothesis: attributable shared links will expose referral landing sessions without private reading data. Primary metric: aggregate landing sessions with `utm_source=share_card`. Guardrail: no answer, element, email, session, reading, order, or customer identifier in the URL. Gate: first naturally referred landing or seven closed days; stop on any private parameter, share-card breakage, or production regression. Local regression tests and desktop/mobile offline browser QA pass.

- [x] Add a deterministic aggregate adapter and contract test that converts the two service-role-only RPC result sets into evaluator-ready daily input, including landing/full-report merging, strict closed-day completeness, sanitized UTM validation, and rejection of identifiers, unknown fields, and customer-level fields.
- [x] Add a golden parity test that feeds the same aggregate RPC fixtures through the protected Worker route and local adapter, requires identical source/privacy/limitations, range, goal/streak, totals, days, and attribution, locks deterministic multi-UTM ordering, and makes the Worker reject non-object, missing, or unknown aggregate fields, incomplete commerce rows, and duplicate or out-of-range funnel attribution rows without using production data.
- [x] Align homepage WebPage/Product structured-data images and the image sitemap with the deployed 112,840-byte WebP through reversible PR [#7](https://github.com/goodrambo/your-love-element/pull/7); add regression coverage, require Harness/Pages success, and complete production source plus desktop/mobile smoke on merge `110435e`.
- [x] Optimize the duplicated homepage hero transfer through reversible PR [#5](https://github.com/goodrambo/your-love-element/pull/5): replace the 2,268,306-byte PNG requests with a 112,840-byte WebP, add layout/loading hints and a 200 KB regression budget, require Harness/Pages success, and complete production desktop/mobile smoke on merge `e270c6f`.
- [x] Release the verified conversion audit through reversible branch `codex/preview-offer-clarity` and PR #2; require Harness/CI success, merge/deploy only the allowlisted site, and complete production desktop/mobile plus SEO schema smoke on merge `c468bf7`.

- [x] Implement the initial SEO/GEO/AEO foundation: answer-first homepage content, Five Elements pillar guide, methodology/AI disclosure page, internal cluster links, schema, sitemap updates, and automated regression coverage.
- [x] Browser-smoke the homepage and both search content pages at desktop and `390 x 844`; confirm no horizontal overflow or console warnings/errors, complete the 10-question Earth preview, and keep the local full-report page payment-locked.
- [x] Review the Five Elements guide and methodology copy for brand voice and cultural framing before publication; the user approved both on 2026-07-30.
- [x] Functionally review the unpublished landing redesign at desktop and `390 x 844` mobile sizes; no horizontal overflow or console warnings/errors on 2026-07-30.
- [x] Smoke-test all 10 free questions, Earth preview/share-card generation, localhost offline mode, first-party collection isolation, and local paid-page blocking on 2026-07-30.
- [x] Complete the user's visual/brand review of the redesign. The user approved it on 2026-07-30; share-card generation and the download success state were browser-verified at `1080 x 1350` without console warnings/errors.
- [x] Review the full verified source scope, commit it as `b9eff29`, push `codex/verified-site-seo-release`, and open draft PR [#1](https://github.com/goodrambo/your-love-element/pull/1) without changing `main` or production.
- [x] Review PR #1 and merge/publish with explicit authorization. Release merge `0de5835` reached `main`; the Harness and Pages workflows both passed on 2026-07-30.
- [x] After the authorized frontend release, validate the two new URLs in production, submit the sitemap in Search Console, inspect their indexing state, and begin the 30/60/90-day organic baseline in `docs/SEO_GEO_AEO_PLAN.md`. The sitemap succeeded with seven discovered URLs; both new pages are discovered but not yet indexed.
- [x] After the measurement deployment, verify exact Pages commit/assets, four Worker health endpoints, browser console, cache revision, auth/origin/event rejection, and allowlisted analytics ingestion.

## Authorized measurement release

- [x] Apply superseding `202607290002_add_growth_scorecard_function.sql`, then `202607300001_add_first_party_funnel_events.sql`, to the intended Supabase project. The checksum-protected `202607290001` attempt was parser-rejected before creating objects; both effective functions now exist with service-role-only execute, RLS is enabled, and the funnel table had zero rows at verification.
- [x] Deploy only the authorized measurement Worker/frontend scope as commit `6005da3`; verify unauthenticated scorecard HTTP 401, untrusted-origin HTTP 403, frontend `Purchase` HTTP 400, allowlisted production browser ingestion, and aggregate Supabase receipt. The positive bearer-secret route remains unit-tested but was not called in production because the secret was not exposed.

## Still requires separate authorization
- [ ] Run one end-to-end checkout/webhook/eight-signal/report/email test.
- [ ] Confirm the new report is delivered once, the reading reaches `delivered`, and no duplicate job/email appears.
- [ ] Confirm Meta `Purchase` in Events Manager if tracking is in scope.

## Requires fresh business data

- [x] Collect the first complete current funnel count from landing view through Purchase: 2026-07-30 closed with `3` landing sessions and `0` CTA clicks, quiz starts, previews, checkouts, or verified purchasers. Continue the seven-day baseline under the main objective item before choosing a customer-facing experiment.
- [ ] Validate the revised preview-to-offer experience with 5-8 target users who read US/UK English; record quiz comprehension, perceived personalization, price clarity, purchase intent, and the exact objections that stop checkout.
- [ ] Add customer proof only after authentic buyer feedback and explicit publication consent are available; do not fabricate testimonials, star ratings, buyer counts, or outcome claims.
- [ ] Define a concrete refund eligibility window and decision timeline with business/legal review, then surface the approved rule before checkout; the current policy is intentionally case-based and may leave cautious buyers uncertain.
- [ ] Confirm which June social items were actually published and record their performance.
- [ ] Decide the next content or paid-acquisition experiment from current data, not the May/June historical snapshot.

## Maintenance

- [x] Commit and push the reviewed Harness files on draft PR #1.
- [x] Merge PR #1 after review so the default branch, fresh clones, and remote `harness` workflow receive the Harness.
- [ ] After the final hook files are committed, review and trust their exact hash with `/hooks`; repeat whenever a hook changes.
- [ ] After the active Codex capture lifecycle is finished, audit `.git` special refs and propose a safe, separately approved cleanup; do not prune automatically.
- [ ] Enable the GitHub `harness` workflow as a required branch-protection check if repository policy should block direct merges.
