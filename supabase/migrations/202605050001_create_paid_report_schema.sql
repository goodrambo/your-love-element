-- Your Love Element paid report automation schema.
-- Target Supabase project ref: nmwhaiimnuywnjlvobde
--
-- Security model:
-- - Cloudflare Workers should access these tables with the Supabase service role key.
-- - The static GitHub Pages frontend should not connect to these tables directly.
-- - RLS is enabled and no anon/authenticated policies are granted.

create extension if not exists pgcrypto;

do $$
begin
  create type public.reading_status as enum (
    'previewed',
    'checkout_created',
    'paid',
    'paid_answers_submitted',
    'generating',
    'report_generated',
    'delivered',
    'failed'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.report_job_status as enum (
    'queued',
    'running',
    'succeeded',
    'failed',
    'cancelled'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.readings (
  id uuid primary key default gen_random_uuid(),
  status public.reading_status not null default 'previewed',

  free_answers_json jsonb not null,
  paid_answers_json jsonb,

  customer_email text,
  lemon_squeezy_checkout_id text,
  lemon_squeezy_order_id text,
  lemon_squeezy_order_number text,
  lemon_squeezy_customer_id text,
  lemon_squeezy_variant_id text,
  lemon_squeezy_product_id text,
  payment_status text,

  report_html text,
  report_text text,
  report_json jsonb,
  email_message_id text,

  checkout_url text,
  error_message text,
  generation_attempts integer not null default 0,

  free_submitted_at timestamptz not null default now(),
  checkout_created_at timestamptz,
  paid_at timestamptz,
  paid_answers_submitted_at timestamptz,
  generation_started_at timestamptz,
  generated_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint readings_customer_email_shape
    check (customer_email is null or customer_email ~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$'),
  constraint readings_generation_attempts_nonnegative
    check (generation_attempts >= 0),
  constraint readings_paid_status_has_order
    check (
      status not in ('paid', 'paid_answers_submitted', 'generating', 'report_generated', 'delivered')
      or lemon_squeezy_order_id is not null
    ),
  constraint readings_paid_answers_status_has_answers
    check (
      status not in ('paid_answers_submitted', 'generating', 'report_generated', 'delivered')
      or paid_answers_json is not null
    ),
  constraint readings_delivered_has_email_message
    check (status <> 'delivered' or email_message_id is not null)
);

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_name text not null,
  external_event_id text,
  reading_id uuid references public.readings(id) on delete set null,
  payload_json jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_error text,

  constraint webhook_events_provider_known
    check (provider in ('lemon_squeezy'))
);

create table if not exists public.report_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  reading_id uuid not null references public.readings(id) on delete cascade,
  status public.report_job_status not null default 'queued',
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  locked_at timestamptz,
  locked_by text,
  last_error text,
  scheduled_for timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint report_generation_jobs_attempts_nonnegative
    check (attempts >= 0),
  constraint report_generation_jobs_max_attempts_positive
    check (max_attempts > 0),
  constraint report_generation_jobs_attempts_within_max
    check (attempts <= max_attempts)
);

create unique index if not exists readings_lemon_squeezy_order_id_key
  on public.readings (lemon_squeezy_order_id)
  where lemon_squeezy_order_id is not null;

create unique index if not exists readings_lemon_squeezy_checkout_id_key
  on public.readings (lemon_squeezy_checkout_id)
  where lemon_squeezy_checkout_id is not null;

create index if not exists readings_status_created_at_idx
  on public.readings (status, created_at desc);

create index if not exists readings_customer_email_idx
  on public.readings (lower(customer_email))
  where customer_email is not null;

create unique index if not exists webhook_events_provider_external_event_id_key
  on public.webhook_events (provider, external_event_id)
  where external_event_id is not null;

create index if not exists webhook_events_reading_id_idx
  on public.webhook_events (reading_id);

create index if not exists webhook_events_unprocessed_idx
  on public.webhook_events (received_at)
  where processed_at is null;

create index if not exists report_generation_jobs_pickup_idx
  on public.report_generation_jobs (scheduled_for, created_at)
  where status = 'queued';

create index if not exists report_generation_jobs_reading_id_idx
  on public.report_generation_jobs (reading_id);

create unique index if not exists report_generation_jobs_one_active_per_reading_key
  on public.report_generation_jobs (reading_id)
  where status in ('queued', 'running');

create or replace function public.enqueue_report_generation_job_when_ready()
returns trigger
language plpgsql
as $$
begin
  if new.lemon_squeezy_order_id is not null
    and new.paid_answers_json is not null
    and new.status in ('paid', 'paid_answers_submitted')
  then
    insert into public.report_generation_jobs (reading_id)
    values (new.id)
    on conflict do nothing;
  end if;

  return new;
end;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists readings_set_updated_at on public.readings;
create trigger readings_set_updated_at
before update on public.readings
for each row
execute function public.set_updated_at();

drop trigger if exists readings_enqueue_report_generation_job_when_ready on public.readings;
create trigger readings_enqueue_report_generation_job_when_ready
after insert or update of status, lemon_squeezy_order_id, paid_answers_json on public.readings
for each row
execute function public.enqueue_report_generation_job_when_ready();

drop trigger if exists report_generation_jobs_set_updated_at on public.report_generation_jobs;
create trigger report_generation_jobs_set_updated_at
before update on public.report_generation_jobs
for each row
execute function public.set_updated_at();

alter table public.readings enable row level security;
alter table public.webhook_events enable row level security;
alter table public.report_generation_jobs enable row level security;

drop policy if exists "Service role can manage readings" on public.readings;
create policy "Service role can manage readings"
on public.readings
for all
to service_role
using (true)
with check (true);

drop policy if exists "Service role can manage webhook events" on public.webhook_events;
create policy "Service role can manage webhook events"
on public.webhook_events
for all
to service_role
using (true)
with check (true);

drop policy if exists "Service role can manage report generation jobs" on public.report_generation_jobs;
create policy "Service role can manage report generation jobs"
on public.report_generation_jobs
for all
to service_role
using (true)
with check (true);

revoke all on public.readings from anon, authenticated;
revoke all on public.webhook_events from anon, authenticated;
revoke all on public.report_generation_jobs from anon, authenticated;

comment on table public.readings is
  'Authoritative free answers, paid answers, Lemon Squeezy payment state, generated report content, and email delivery state for Your Love Element.';

comment on table public.webhook_events is
  'Idempotency and audit log for Lemon Squeezy webhooks.';

comment on table public.report_generation_jobs is
  'Queue table used by the backend to generate and deliver reports once payment and paid answers are both available.';
