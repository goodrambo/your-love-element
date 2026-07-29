-- Add privacy-minimized first-party funnel events and aggregate reporting.
-- Target Supabase project ref: nmwhaiimnuywnjlvobde
-- The browser-generated session UUID is SHA-256 hashed by the Worker before insert.
-- No IP, user agent, email, reading/order/customer id, answers, URL/query string,
-- referrer, webhook payload, or generated report content is stored here.

create table if not exists public.funnel_events (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  session_hash text not null,
  event_name text not null,
  page text not null,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  received_at timestamptz not null default now(),

  constraint funnel_events_event_id_key unique (event_id),
  constraint funnel_events_session_hash_shape
    check (session_hash ~ '^[0-9a-f]{64}$'),
  constraint funnel_events_event_name_known
    check (event_name in (
      'page_view',
      'view_content',
      'landing_cta_click',
      'quiz_start',
      'preview_revealed',
      'checkout_created',
      'paid_signals_submitted',
      'share_card_generated',
      'share_card_shared',
      'share_card_link_shared',
      'share_card_downloaded'
    )),
  constraint funnel_events_page_known
    check (page in ('landing', 'full_report')),
  constraint funnel_events_utm_source_shape
    check (utm_source is null or (length(utm_source) between 1 and 120 and utm_source ~ '^[A-Za-z0-9._~:+-]+$')),
  constraint funnel_events_utm_medium_shape
    check (utm_medium is null or (length(utm_medium) between 1 and 120 and utm_medium ~ '^[A-Za-z0-9._~:+-]+$')),
  constraint funnel_events_utm_campaign_shape
    check (utm_campaign is null or (length(utm_campaign) between 1 and 120 and utm_campaign ~ '^[A-Za-z0-9._~:+-]+$')),
  constraint funnel_events_utm_content_shape
    check (utm_content is null or (length(utm_content) between 1 and 120 and utm_content ~ '^[A-Za-z0-9._~:+-]+$')),
  constraint funnel_events_utm_term_shape
    check (utm_term is null or (length(utm_term) between 1 and 120 and utm_term ~ '^[A-Za-z0-9._~:+-]+$'))
);

create unique index if not exists funnel_events_one_stage_per_session_key
  on public.funnel_events (session_hash, event_name, page);

create index if not exists funnel_events_received_at_idx
  on public.funnel_events (received_at desc);

create index if not exists funnel_events_attribution_idx
  on public.funnel_events (utm_source, utm_campaign, utm_content, received_at desc);

create table if not exists public.funnel_event_maintenance (
  singleton boolean primary key default true,
  last_cleanup_at timestamptz not null default now(),
  constraint funnel_event_maintenance_singleton check (singleton)
);

insert into public.funnel_event_maintenance (singleton)
values (true)
on conflict (singleton) do nothing;

create or replace function public.maintain_funnel_event_retention()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  claimed boolean;
begin
  update public.funnel_event_maintenance
  set last_cleanup_at = now()
  where singleton = true
    and last_cleanup_at <= now() - interval '1 day'
  returning true into claimed;

  if coalesce(claimed, false) then
    delete from public.funnel_events
    where received_at < now() - interval '180 days';
  end if;

  return null;
end;
$$;

drop trigger if exists funnel_events_retention_after_insert on public.funnel_events;
create trigger funnel_events_retention_after_insert
after insert on public.funnel_events
for each statement
execute function public.maintain_funnel_event_retention();

create or replace function public.get_first_party_funnel_scorecard(
  p_start_date date,
  p_end_date date
)
returns table (
  metric_date date,
  page text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  page_view_sessions bigint,
  view_content_sessions bigint,
  landing_cta_clicks bigint,
  quiz_starts bigint,
  previews_revealed bigint,
  checkouts_created bigint,
  paid_signals_submitted_events bigint,
  share_card_generated bigint,
  share_card_shared bigint,
  share_card_link_shared bigint,
  share_card_downloaded bigint
)
language sql
stable
set search_path = public, pg_temp
as $$
  select
    (f.received_at at time zone 'Asia/Taipei')::date as metric_date,
    f.page,
    f.utm_source,
    f.utm_medium,
    f.utm_campaign,
    f.utm_content,
    f.utm_term,
    count(distinct f.session_hash) filter (where f.event_name = 'page_view') as page_view_sessions,
    count(distinct f.session_hash) filter (where f.event_name = 'view_content') as view_content_sessions,
    count(distinct f.session_hash) filter (where f.event_name = 'landing_cta_click') as landing_cta_clicks,
    count(distinct f.session_hash) filter (where f.event_name = 'quiz_start') as quiz_starts,
    count(distinct f.session_hash) filter (where f.event_name = 'preview_revealed') as previews_revealed,
    count(distinct f.session_hash) filter (where f.event_name = 'checkout_created') as checkouts_created,
    count(distinct f.session_hash) filter (where f.event_name = 'paid_signals_submitted') as paid_signals_submitted_events,
    count(distinct f.session_hash) filter (where f.event_name = 'share_card_generated') as share_card_generated,
    count(distinct f.session_hash) filter (where f.event_name = 'share_card_shared') as share_card_shared,
    count(distinct f.session_hash) filter (where f.event_name = 'share_card_link_shared') as share_card_link_shared,
    count(distinct f.session_hash) filter (where f.event_name = 'share_card_downloaded') as share_card_downloaded
  from public.funnel_events f
  where (f.received_at at time zone 'Asia/Taipei')::date between p_start_date and p_end_date
  group by 1, 2, 3, 4, 5, 6, 7
  order by 1, 2, 3 nulls first, 5 nulls first, 6 nulls first;
$$;

alter table public.funnel_events enable row level security;
alter table public.funnel_event_maintenance enable row level security;

drop policy if exists "Service role can manage funnel events" on public.funnel_events;
create policy "Service role can manage funnel events"
on public.funnel_events
for all
to service_role
using (true)
with check (true);

drop policy if exists "Service role can manage funnel maintenance" on public.funnel_event_maintenance;
create policy "Service role can manage funnel maintenance"
on public.funnel_event_maintenance
for all
to service_role
using (true)
with check (true);

revoke all on public.funnel_events from anon, authenticated;
revoke all on public.funnel_event_maintenance from anon, authenticated;
grant select, insert, delete on public.funnel_events to service_role;
grant select, update on public.funnel_event_maintenance to service_role;

revoke all on function public.maintain_funnel_event_retention() from public, anon, authenticated;
grant execute on function public.maintain_funnel_event_retention() to service_role;
revoke all on function public.get_first_party_funnel_scorecard(date, date) from public, anon, authenticated;
grant execute on function public.get_first_party_funnel_scorecard(date, date) to service_role;

comment on table public.funnel_events is
  'Privacy-minimized, service-role-only first-party funnel stages. Session UUIDs are hashed before storage and rows expire after 180 days.';

comment on function public.get_first_party_funnel_scorecard(date, date) is
  'Returns aggregate Asia/Taipei session-stage counts by sanitized UTM dimensions. Contains no session hashes or customer-level values.';
