-- Grant service_role table privileges used by the Cloudflare Worker.
-- Target Supabase project ref: nmwhaiimnuywnjlvobde

grant usage on schema public to service_role;

grant select, insert, update, delete on public.readings to service_role;
grant select, insert, update, delete on public.webhook_events to service_role;
grant select, insert, update, delete on public.report_generation_jobs to service_role;

grant usage, select on all sequences in schema public to service_role;
