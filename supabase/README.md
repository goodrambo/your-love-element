# Your Love Element Supabase

Target project:

- Project ref: `nmwhaiimnuywnjlvobde`
- MCP server name: `supabase-your-love-element`

## Migration Order

Apply migrations only to the Your Love Element Supabase project. Do not run these against another Supabase project.

1. `migrations/202605050001_create_paid_report_schema.sql`
2. `migrations/202605050002_harden_paid_report_functions.sql`
3. `migrations/202605050003_revoke_public_rls_auto_enable.sql`

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
