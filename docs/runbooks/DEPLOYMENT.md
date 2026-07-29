# Deployment

Deployment is an external mutation and requires explicit user authorization.

## Before deployment

1. Review the complete diff and intended commit scope.
2. Run `python3 scripts/harness.py verify --scope deployment` and the CI-equivalent `python3 scripts/harness.py verify --scope all --ci`.
3. Complete any reported manual browser checks.
4. For paid-flow changes, complete the authorized E2E gate. A current digest-scoped waiver may explain why it was not run, but it is `SKIPPED` evidence and must never be presented as deployment proof.

For the aggregate growth scorecard and first-party funnel, apply the superseding `supabase/migrations/202607290002_add_growth_scorecard_function.sql` and then `supabase/migrations/202607300001_add_first_party_funnel_events.sql` to the intended Supabase project before deploying the Worker routes. Do not apply the checksum-protected `202607290001` file: its production attempt was rejected at parse time before creating objects because `offset` is reserved syntax. Reversing the corrected order makes the ingestion/scorecard endpoints fail because their tables and RPCs do not exist yet.

## Confirmed path

The historical working path is commit and push to `main`; GitHub Pages and the Cloudflare GitHub integration deploy from it. Do not assume a local `wrangler deploy` path is configured.

## After deployment

1. Confirm GitHub Pages built the intended commit.
2. Check the site and `/full-report/` with cache revision intact.
3. Run `python3 scripts/harness.py live`.
4. Check browser console and the changed user journey.
5. Update `docs/PROJECT_STATE.md` with date and evidence; never update only the date.

For the growth scorecard, first call `GET /api/admin/growth-metrics` without credentials and confirm `401`. Then call it with the configured `JOB_RUNNER_SECRET`, confirm `200`, `Cache-Control: private, no-store`, aggregate-only daily rows, and no customer/order/reading identifiers. Never print the secret or store the authorized response if it contains unexpected fields.

For first-party ingestion, verify an untrusted-origin request is rejected, then complete a production-origin page view and one quiz stage. Confirm only hashed/allowlisted fields appear in Supabase, no duplicate stage is created for the same session/page, and the protected scorecard reports the aggregate without exposing a session hash. Do not create a frontend `Purchase` test event.
