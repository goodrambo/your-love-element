# Growth Control Loop

Last updated: 2026-08-04

## Goal and deadline

The growth objective now has two sequential stages.

1. Traffic stage: exceed `1,000` Google Search clicks per complete Search Console day for `30` consecutive days. The executable threshold is therefore `>= 1,001` clicks. Use only final `web` Performance data at property aggregation for exact property `sc-domain:yourloveelement.com`; impressions, Discover/News traffic, browser analytics, and preliminary data do not qualify. Search Console daily dates use `America/Los_Angeles`, not Asia/Taipei, and normal reporting lag is recorded rather than converted into inferred values. No Stage 1 deadline was supplied, so its deadline is explicitly `null`.
2. Purchase stage: after Stage 1 is complete, reach at least `10` unique, verified, non-refunded purchasers per Asia/Taipei calendar day for `30` consecutive days.

- The Stage 2 purchase streak planning target remains 2026-09-15, target completion remains 2026-10-14, and 2026-10-15 remains a hard review. These dates do not override the Stage 1 gate. If Stage 1 has not completed by then, report it as the blocking missed stage rather than silently extending or skipping it.
- At `$9.99 USD`, 300 purchases in the qualifying purchase window represent `$2,997 USD` gross revenue before fees, refunds, generation costs, and acquisition spend.

The Stage 2 streak counter uses the authoritative Lemon Squeezy payment/webhook state, not GSC clicks, frontend clicks, or Meta attribution. Count one purchaser per day by Lemon customer identity, falling back to normalized customer email only inside a protected aggregate query. Never expose identities in reports or logs. A refunded order is excluded and can invalidate an earlier provisional day.

## Project isolation

- The only authorized project root and Git top-level is `/Users/suchinglun/Documents/Codex/product-lab/your-love-element`.
- Before any write or project-scoped external call, resolve both paths and stop if either differs. Never traverse into `product-lab` siblings, another workspace root, or another Git repository.
- Use only automation id `yle` and Supabase project ref `nmwhaiimnuywnjlvobde`. Never use another Supabase MCP entry, even if it is installed and authenticated.
- GitHub calls must target only `https://github.com/goodrambo/your-love-element.git`; never list, inspect, push to, change settings for, or open a PR against another repository in the account.
- Cloudflare calls must target only Worker `your-love-element-api`, origin `https://your-love-element-api.goodrambo2013.workers.dev`, or zone `yourloveelement.com`. Never use account-wide bulk actions or touch another Worker, Pages project, zone, DNS record set, secret, or deployment.
- Resend calls must be filterable before execution to domain `yourloveelement.com` and the addresses `reports@yourloveelement.com` or `support@yourloveelement.com`. Never enumerate or mutate another domain, API key, broadcast, audience, contact set, or unrelated message in the account.
- If an external tool or dashboard action cannot be scoped to the exact allowlisted identifier before execution, classify it as `project_scope_block` and do not call it.
- OS temporary files may be used only as disposable inputs/outputs for this project. They must never be copied into, or used to modify, another project.

## Baseline and forecast

A read-only Supabase aggregate verified the partial 2026-07-01 through 2026-07-30 baseline: 1 preview, 1 checkout, 0 provisional verified purchasers, 0 refund-flagged orders, 0 delivered readings, and 0 failed readings. This is not a complete traffic baseline because visits that did not create a reading and the unpublished first-party funnel stages are absent. The last historical ad window, 2026-05-14 through 2026-05-20, recorded 133 landing-page views and zero purchases; it is not a current baseline. Therefore the deadline is an aggressive operating target, not a forecast or guarantee.

Required landing-page views per day depend on verified landing-to-purchase conversion:

| Verified purchase rate | Views needed for 10 purchases/day |
| --- | ---: |
| 0.5% | 2,000 |
| 1.0% | 1,000 |
| 1.5% | 667 |
| 2.0% | 500 |
| 3.0% | 334 |

The control loop must replace this scenario table with actual 7-day funnel rates as soon as access exists.

## Day 0: mandatory data and authority gate

Automation is not operationally autonomous until every capability used by the active organic plan is `ready`. A deliberately deferred channel is not a substitute for the remaining required data access, and a public health check is not a substitute for dashboard or API access.

| Capability | Evidence required | Status verified through 2026-07-30 |
| --- | --- | --- |
| Production and Worker health | Read-only HTTP access to site and four health endpoints | Ready; all returned HTTP 200 with healthy/configured responses on 2026-07-30 |
| Authoritative purchases and refunds | Lemon Squeezy orders/subscriptions/refunds read access, or reconciled Supabase webhook-backed aggregates | Lemon dashboard/API access deferred by the user because every login requires 2FA; use Supabase webhook-backed state provisionally, while settled revenue remains unavailable |
| Reading funnel and fulfillment | Supabase aggregate read access to `readings`, `webhook_events`, and jobs, or a protected aggregate endpoint | Ready for aggregate collection; project-scoped read-only MCP completed schema/aggregate queries, and the corrected scorecard/funnel migrations, Worker route, and frontend collector were deployed and verified on 2026-07-30. The bearer-protected scorecard remains unavailable to a scheduled run unless `JOB_RUNNER_SECRET` exists in that live environment |
| Traffic and frontend funnel | Final property-level GSC `web` clicks for Stage 1, plus the first-party funnel for diagnosis; Meta only if later reintroduced | Partial; the first-party collector is deployed and receiving allowlisted events, and `sc-domain:yourloveelement.com` was DNS-verified with a successful seven-URL sitemap. The latest verified Performance baseline covers 2026-07-28 through 2026-07-31 at `0` clicks and `0` impressions; later final data is not yet recorded. Meta is deliberately excluded |
| Deploy and rollback | Valid GitHub write authentication plus Cloudflare deployment visibility | Ready for the authorized site-only scope; exact-repository `gh` authentication, reversible branch/PR, CI, Pages deployment, and production smoke completed for PR #2 on 2026-07-30 |
| Email deliverability | Resend email-log read access | Partial; Resend dashboard login verified, but a current delivery-log sample has not been captured |
| Organic publishing | Authorized site/SEO publication path and standing publication authority | Site-only conversion/SEO publishing is authorized after required checks. Social, Meta/Instagram, customer messaging, and account-wide publishing remain unapproved |
| Paid acquisition | Ads Manager access plus an explicit daily/lifetime spend cap and pause authority | Deliberately excluded; Meta is not logged in and the default/authorized budget remains `$0` |
| Paid-flow E2E | Approved test method, test address, and charge/refund authority | Blocked/unapproved |

One-time authentication, OTP, CAPTCHA, payment-method approval, and spend-cap selection cannot be bypassed or inferred. After the one-time bootstrap, routine runs should not require daily user operation.

Standing mutation authority is machine-readable under `harness/contracts.json`. The user authorized exact-repository Git push and frontend deployment for verified low-risk measurement, conversion, and SEO changes on 2026-07-30. Production migrations and Worker deployment remain measurement-only; off-site/social organic publishing, paid-flow E2E, customer messaging, and paid media remain denied, with paid caps at `$0`. A grant can become active only with an `explicit_user_authorization:` evidence string; actual login/tool availability is checked separately every run and cannot be inferred from the standing grant.

## Required measurement plane

Stage 1 uses final Search Console property-level `web` data in `America/Los_Angeles`, with rolling 1/7/14/30-day windows and a contiguous qualifying-day streak. Stage 2 uses the protected business scorecard on closed Asia/Taipei days and rolling 3/7/14-day windows.

Authoritative business metrics:

- unique verified purchasers, gross revenue, refunds, net order value
- landing views, `landing_cta_click`, `quiz_start`, `preview_revealed`, `checkout_created`
- verified `Purchase`, paid-signal submission, report delivered, fulfillment failures
- spend, CAC, ROAS, refund rate, and delivery success/time
- results by `utm_source`, `utm_campaign`, and `utm_content`

Data precedence:

1. Google Search Console final property-level web clicks for the Stage 1 traffic streak.
2. Lemon verified orders/refunds for Stage 2 purchase and revenue.
3. Supabase state for reading and fulfillment truth.
4. Meta for ad spend, attributed traffic, and browser-event diagnosis only if separately reintroduced.
5. Public HTTP probes for availability only.

The protected aggregate growth endpoint, authoritative-purchase RPC, and privacy-minimized first-party funnel layer are implemented, deployed, and tested. They return aggregate session stages, UTM labels, verified purchaser counts, refunds, and fulfillment rates; use `JOB_RUNNER_SECRET` for scorecard reads; and expose no email, answers, session hashes, reading/order/customer IDs, tokens, webhook payloads, or report content. Meta/provider access is still required for spend, CAC, ROAS, and actual settled revenue.

## Milestones

Stage 1 has one data-driven milestone: `30` contiguous final GSC days at `>= 1,001` clicks. Its completion date cannot be forecast from the current zero-click baseline without fabricating a growth rate. The dated milestones below remain the Stage 2 purchase plan and hard-review risk controls; Stage 2 cannot start until the traffic audit passes.

| Date | Exit criterion |
| --- | --- |
| 2026-08-02 | All critical read permissions and standing authorities ready; current 30-day business data captured; no production reliability blocker |
| 2026-08-09 | Protected daily scorecard operational; current landing redesign reviewed; one authorized production release or a documented reason not to release |
| 2026-08-16 | At least 1 verified purchaser/day on a 7-day average; first complete-funnel experiment decided |
| 2026-08-30 | At least 3 purchasers/day on a 7-day average; one channel has positive contribution or a clearly measured offer-economics reset is active |
| 2026-09-06 | At least 7 purchasers/day on a 7-day average; fulfillment success at least 98% and no unresolved paid-flow incident |
| 2026-09-15 | First qualifying 10-purchaser day; begin streak no later than this date |
| 2026-10-14 | 30th consecutive qualifying day |

Missing a milestone does not permit blind budget increases. The loop must identify whether the constraint is access, reliability, traffic, conversion, unit economics, or fulfillment and change the relevant hypothesis.

## Funnel targets and diagnosis

These are initial control limits, not claims about current performance. Replace them with observed cohort baselines after the first 7 complete days.

| Step | Initial target | Default action below target |
| --- | ---: | --- |
| Landing view -> CTA click | 25%+ | Test first-viewport promise, CTA, load speed, and ad-message match |
| CTA click -> quiz start | 70%+ | Remove first-question or mobile visibility friction |
| Quiz start -> preview revealed | 60%+ | Shorten perceived effort and fix abandonment/validation points |
| Preview revealed -> checkout created | 6%+ | Improve sample proof, value framing, trust, price, and email friction |
| Checkout created -> verified purchase | 55%+ | Inspect Lemon checkout, payment methods, trust, and price objection |
| Purchase -> paid signals submitted | 70%+ | Repair redirect, receipt link, and post-purchase instructions |
| Paid signals -> delivered within 15 minutes | 98%+ | Stop scaling; fix queue, OpenAI, Resend, or idempotency issues first |

If landing-to-purchase conversion is below 1% after 500 qualified landing views, prioritize conversion and offer work before scaling traffic. If it is at least 1.5% and CAC is below the contribution cap, scale the best channel gradually.

## Experiment portfolio

Run one primary experiment at a time for the current bottleneck. Keep safety and fulfillment fixes outside the experiment queue.

1. Reliability: fresh paid-flow E2E, Worker health, exactly-once email, webhook and job failure monitoring.
2. Landing: ship the already-tested local redesign after brand review and deployment authorization; test hero promise/CTA before lower-page changes.
3. Quiz: use the existing tap-to-advance flow; diagnose the exact abandonment step before removing questions.
4. Offer: strengthen report preview, specificity, trust, guarantee/refund clarity, and delivery proof. Test price or bundles only when CAC cannot fit the current `$9.99` economics.
5. Checkout/post-purchase: improve receipt/return path and completion of eight paid signals.
6. Acquisition: first scale the content/ad combination with verified purchase economics. Organic content may build demand but is not counted as published until the platform confirms it.
7. Referral/share: improve share-card completion and attributable links without exposing private reading data.

Do not use marketing email without an explicit opt-in and compliant unsubscribe path. Do not use deterministic soulmate, reunion, or timing claims.

## Unit economics and spend rules

- Default paid-media budget is `$0` until the user records a standing daily and lifetime cap.
- Derive the maximum acceptable CAC from settled net order value minus report-generation, support, refund, and desired contribution costs. Do not assume `$9.99` is spendable CAC.
- Start at the approved test cap. Increase no more than 20% per 24 hours only when the rolling 3-day CAC is below the approved cap, fulfillment is healthy, and at least two verified purchases exist in the window.
- Pause an ad set when it spends two approved target CACs without a purchase, the rolling 3-day CAC exceeds the cap by 30%, a platform warning appears, or paid-flow reliability falls below 98%.
- Never compensate for a weak funnel by exceeding the recorded cap.

## Scheduling cadence

- Early bootstrap: run every 30 minutes while there is a ready high-impact task, and at minimum until the exact-property final GSC aggregate read, both growth migrations, the Worker scorecard route, and the first-party collector are deployed and verified, followed by seven complete final GSC days and a 24-hour empty ready queue.
- Mid-growth: run every four hours after the early exit gate, while acquisition and conversion experiments are active.
- Streak phase: run daily at 08:30 Asia/Taipei after Stage 1 is complete and the first qualifying 10-purchaser day starts the Stage 2 streak.
- Use only the existing `yle` heartbeat. A phase transition updates that automation instead of creating duplicates. Downshift to mid-growth only after seven complete closed days exist **and** no ready high-impact action has remained in the queue for 24 hours. A lack of new closed-day data is not a reason for a monitoring-only run: choose one non-repetitive, safe task from the current constraint/backlog and produce a verified implementation, test, analysis, release preparation, release, or rollback result.

## Scheduled autonomous loop

Every scheduled run:

1. Run Harness preflight and preserve unrelated worktree changes.
2. Read `PROJECT_STATE.md`, `BACKLOG.md`, and this runbook.
3. Recheck the authority matrix. Never infer authentication or spend/publication permission.
4. Probe the production site and four Worker health endpoints read-only as a safety gate, not as the run's result.
5. Retrieve final aggregate GSC `web` clicks for exact property `sc-domain:yourloveelement.com`, calculate rolling 1/7/14/30-day traffic metrics and the Stage 1 streak, then calculate Stage 2 scorecard metrics only after Stage 1 completes. Never substitute impressions for clicks or preliminary data for final days.
6. Classify the primary constraint: access, reliability, observability, traffic, conversion, economics, or fulfillment.
7. Select the single smallest action with the highest expected impact on the primary constraint. Record hypothesis, primary metric, guardrails, sample/time gate, and stop condition before acting.
8. Deliver exactly one non-repetitive result per run: implement, test, analyze and decide, prepare a reversible release, deploy an authorized change, verify production, or roll back an incident. A monitoring-only result is permitted only when every ready action is blocked by a specific external dependency; record that blocker once instead of repeating it every run.
9. Low-risk site conversion/SEO changes may be committed, pushed, and deployed only when the exact standing grants and live exact-asset tool/session are both available. Do not autonomously alter checkout/payment/webhook/report/email/refund-policy/legal-claim behavior, send customer messages, use Meta or Lemon Squeezy, create test transactions, or spend money.
10. Before any release, require exact-scope checks, Harness PASS, the named browser/manual gate, unchanged paid-flow digest or explicit paid-flow authorization, a reversible branch/PR, successful CI, and a production smoke. Roll back or stop on breakage or an incident.
11. Verify proportionally, update current state/backlog truthfully, and report outcome, evidence, next action, and any blocked authority.

Review strategy once per 6 early-stage runs, once per 7 mid-stage runs, and once per 7 late-stage daily runs: retain, promote, stop, or replace the active experiment; recompute the forecast; and compare progress with the fixed milestones. Do not reset the deadline or call an incomplete action a win.

## Deterministic decision evaluator

Use `scripts/growth-control.mjs` after the exact-property GSC aggregate, protected scorecard response when required, and any authorized provider aggregates have been collected. The evaluator does not fetch data or read credentials. It accepts aggregate JSON only, rejects customer/session/order/reading/answer/secret-shaped keys, and emits one active stage, one primary constraint, and one pre-registered action contract.

When `JOB_RUNNER_SECRET` is injected into the live runtime, fetch the latest closed-day scorecard through the exact allowlisted Worker origin. The fetcher requires an explicit end date, never accepts a caller-supplied origin, fails once on `401` or `404`, requires private/no-store and non-CORS response headers, rejects sensitive or unknown fields, and writes only aggregate JSON to stdout. Keep redirected output under ignored `artifacts/growth-control/`, then place that aggregate into the separate growth-control input and run the evaluator CLI below.

```bash
node scripts/fetch-growth-scorecard.mjs --days 45 --end-date YYYY-MM-DD
```

When project-scoped access returns the two service-role-only RPC row sets instead of the protected endpoint response, first use the deterministic adapter. Its input contains only `start_date`, `end_date`, `commerce_rows`, and `funnel_rows`; it requires exactly one commerce row for every closed day, merges landing/full-report and sanitized UTM aggregates, and rejects unknown or sensitive fields.

```bash
node scripts/growth-scorecard-adapter.mjs --input /absolute/path/to/aggregate-rpc-input.json
```

```bash
node scripts/growth-control.mjs --input /absolute/path/to/aggregate-growth-input.json
```

The input contract is:

- `run_date`: Asia/Taipei decision date in `YYYY-MM-DD` form.
- `search_console`: a freshly fetched aggregate object for exact property `sc-domain:yourloveelement.com`, source `google_search_console_performance`, `search_type: web`, `aggregation: property`, `data_state: final`, timezone `America/Los_Angeles`, privacy `aggregate_counts_only`, `fetched_on` equal to `run_date`, matching start/end dates, and contiguous daily `clicks` plus `impressions`; or `null` when unavailable. Clicks determine qualification; impressions are diagnostic only.
- `scorecard`: the complete aggregate response from `GET /api/admin/growth-metrics`, or `null` when unavailable. It becomes the required goal truth only after Stage 1 completes.
- `authority`: live-session/tool booleans for `gsc_read`, `lemon_read`, `scorecard_read`, `meta_read`, `resend_read`, `deploy`, `publish`, `paid_media`, and `paid_flow_e2e`. The CLI intersects mutation booleans with `harness/contracts.json`; an input cannot grant itself deployment, publication, paid-media, or paid-E2E authority.
- `provider.public_health_ok` and `provider.paid_flow_incident`: current production safety signals.
- `provider.rolling_3d_start_date`, `provider.rolling_3d_end_date`, `provider.rolling_3d_spend_usd`, `provider.rolling_3d_settled_revenue_usd`, and `provider.max_acceptable_cac_usd`: authorized monetary aggregates for exactly the same rolling three closed days; use `null` when unavailable. The evaluator rejects a monetary window that does not match the scorecard.
- `active_experiment`: optional aggregate experiment state containing start date, eligible sessions, baseline/current primary rates, baseline/current guardrail rates, breakage status, and optional minimum relative lift. When an experiment is known to be active but its aggregate measurements are unavailable, keep the object and set all five measurement fields to `null` together; the evaluator returns `continue` with `measurement_status: unavailable`. Use `active_experiment: null` only when no experiment is active. Partial measurement availability is rejected.

The evaluator requires the exact GSC contract above, contiguous final dates, and a fresh `fetched_on` date. It records the latest final date and lag because Search Console normally trails the present day. Exactly `1,000` clicks fails; `1,001` qualifies. Before the 30-day traffic streak completes, priority is GSC access, production reliability, then traffic. After completion, the evaluator requires the exact scorecard source/privacy/timezone contract, contiguous closed days, and a range ending on the calendar day immediately before `run_date`; Stage 2 priority remains completed-purchase-streak audit, reliability, fulfillment below 98%, insufficient observation window, uneconomic CAC, adequately sampled conversion gap, missing revenue/spend, then qualified traffic. Missing values stay `null`, and external actions remain `local_only_until_authorized` whenever authority is absent.

## Experiment decision rules

- Pre-register one primary metric and at least one guardrail.
- Prefer a 7-day window and at least 200 eligible sessions before promoting a conversion change; continue longer when the result is inconclusive.
- Stop early for breakage, a 30%+ guardrail decline after 100 eligible sessions, policy risk, or a paid-flow incident.
- Promote only when the primary metric improves without worsening refund, CAC, or fulfillment guardrails.
- Archive the losing variant and outcome; do not run the same failed hypothesis again without new evidence.

## Completion and escalation

Stage 1 completes only after final Search Console data shows 30 consecutive days with more than 1,000 web clicks; a final day at 1,000 or below resets the current traffic streak. Stage 2 then completes only after the authoritative purchase scorecard shows 30 consecutive qualifying days and the most recent Asia/Taipei day has closed; a day below 10 verified non-refunded purchasers resets the purchase streak. The overall goal is complete only after both stages pass in order.

Notify the user immediately only for a production incident, unauthorized/missing permission that prevents meaningful progress, spend-cap/policy breach, or required authentication/OTP/CAPTCHA. Routine successful runs should remain quiet except for compact scheduled summaries.
