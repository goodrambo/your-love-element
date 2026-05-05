-- Harden function execution context for the paid report automation schema.
-- Target Supabase project ref: nmwhaiimnuywnjlvobde

alter function public.enqueue_report_generation_job_when_ready()
  set search_path = public, pg_temp;

alter function public.set_updated_at()
  set search_path = public, pg_temp;

do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'rls_auto_enable'
  ) then
    revoke execute on function public.rls_auto_enable() from anon, authenticated;
  end if;
end $$;
