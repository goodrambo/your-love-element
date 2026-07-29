# Your Love Element Supabase

Target project:

- Project ref: `nmwhaiimnuywnjlvobde`
- MCP server name: `supabase-your-love-element`

## Migration Order

Apply migrations only to the Your Love Element Supabase project. Do not run these against another Supabase project.

1. `migrations/202605050001_create_paid_report_schema.sql`
2. `migrations/202605050002_harden_paid_report_functions.sql`
3. `migrations/202605050003_revoke_public_rls_auto_enable.sql`
4. `migrations/202605060001_grant_service_role_paid_report_tables.sql`
5. Do not apply `migrations/202607290001_add_growth_scorecard_function.sql`; its first production attempt was rejected at parse time before creating objects because `offset` is reserved syntax.
6. `migrations/202607290002_add_growth_scorecard_function.sql` supersedes the rejected file without rewriting it.
7. `migrations/202607300001_add_first_party_funnel_events.sql`

## Access Model

The GitHub Pages frontend should call the Cloudflare Workers API, not Supabase directly.

Cloudflare Workers should use the Supabase service role key for backend-only operations:

- create a `readings` row after the free 10-question quiz
- attach Lemon Squeezy checkout/order metadata
- store paid 8-question answers
- queue and update `report_generation_jobs`
- save generated report content
- store Resend email delivery metadata

RLS is enabled on all product tables. Only `service_role` has policies. `anon` and `authenticated` are intentionally not granted direct table access.

The superseding scorecard migration adds `get_growth_scorecard(start_date, end_date)`, an aggregate-only RPC for the protected Worker growth endpoint. Apply it before deploying the corresponding Worker route. Execute permission is service-role-only; it returns no customer-level data.

The sixth migration adds the service-role-only `funnel_events` table, 180-day retention maintenance, and `get_first_party_funnel_scorecard(start_date, end_date)`. The browser still talks only to the Worker; it never receives Supabase credentials or table access.
