-- Supersede the parser-invalid 202607290001 scorecard migration without editing it.
-- Target Supabase project ref: nmwhaiimnuywnjlvobde
-- This function returns counts only. It never returns customer email, Lemon customer/order IDs,
-- reading IDs, answers, webhook payloads, or generated report content.

create or replace function public.get_growth_scorecard(
  p_start_date date,
  p_end_date date
)
returns table (
  metric_date date,
  previewed_readings bigint,
  checkout_readings bigint,
  verified_purchasers bigint,
  verified_orders bigint,
  refunded_orders bigint,
  paid_signals_submitted bigint,
  paid_signal_cohort_delivered bigint,
  paid_signal_cohort_delivered_within_15m bigint,
  delivered_readings bigint,
  failed_readings bigint
)
language sql
stable
set search_path = public, pg_temp
as $$
  with days as (
    select p_start_date + day_offset as metric_date
    from generate_series(0, p_end_date - p_start_date) as series(day_offset)
  ),
  previews as (
    select
      (r.free_submitted_at at time zone 'Asia/Taipei')::date as metric_date,
      count(*)::bigint as previewed_readings
    from public.readings r
    where (r.free_submitted_at at time zone 'Asia/Taipei')::date between p_start_date and p_end_date
    group by 1
  ),
  checkouts as (
    select
      (r.checkout_created_at at time zone 'Asia/Taipei')::date as metric_date,
      count(*)::bigint as checkout_readings
    from public.readings r
    where r.checkout_created_at is not null
      and (r.checkout_created_at at time zone 'Asia/Taipei')::date between p_start_date and p_end_date
    group by 1
  ),
  purchases as (
    select
      (r.paid_at at time zone 'Asia/Taipei')::date as metric_date,
      count(distinct coalesce(
        nullif(r.lemon_squeezy_customer_id, ''),
        'order:' || r.lemon_squeezy_order_id
      )) filter (
        where coalesce(r.payment_status, '') !~* 'refund'
      ) as verified_purchasers,
      count(distinct r.lemon_squeezy_order_id) filter (
        where coalesce(r.payment_status, '') !~* 'refund'
      ) as verified_orders,
      count(distinct r.lemon_squeezy_order_id) filter (
        where coalesce(r.payment_status, '') ~* 'refund'
      ) as refunded_orders
    from public.readings r
    where r.paid_at is not null
      and r.lemon_squeezy_order_id is not null
      and (r.paid_at at time zone 'Asia/Taipei')::date between p_start_date and p_end_date
    group by 1
  ),
  paid_signals as (
    select
      (r.paid_answers_submitted_at at time zone 'Asia/Taipei')::date as metric_date,
      count(*)::bigint as paid_signals_submitted,
      count(*) filter (
        where r.delivered_at is not null
      ) as paid_signal_cohort_delivered,
      count(*) filter (
        where r.delivered_at is not null
          and r.delivered_at <= r.paid_answers_submitted_at + interval '15 minutes'
      ) as paid_signal_cohort_delivered_within_15m
    from public.readings r
    where r.paid_answers_submitted_at is not null
      and r.lemon_squeezy_order_id is not null
      and (r.paid_answers_submitted_at at time zone 'Asia/Taipei')::date between p_start_date and p_end_date
    group by 1
  ),
  deliveries as (
    select
      (r.delivered_at at time zone 'Asia/Taipei')::date as metric_date,
      count(*)::bigint as delivered_readings
    from public.readings r
    where r.delivered_at is not null
      and (r.delivered_at at time zone 'Asia/Taipei')::date between p_start_date and p_end_date
    group by 1
  ),
  failures as (
    select
      (r.failed_at at time zone 'Asia/Taipei')::date as metric_date,
      count(*)::bigint as failed_readings
    from public.readings r
    where r.failed_at is not null
      and (r.failed_at at time zone 'Asia/Taipei')::date between p_start_date and p_end_date
    group by 1
  )
  select
    d.metric_date,
    coalesce(pv.previewed_readings, 0)::bigint,
    coalesce(c.checkout_readings, 0)::bigint,
    coalesce(p.verified_purchasers, 0)::bigint,
    coalesce(p.verified_orders, 0)::bigint,
    coalesce(p.refunded_orders, 0)::bigint,
    coalesce(ps.paid_signals_submitted, 0)::bigint,
    coalesce(ps.paid_signal_cohort_delivered, 0)::bigint,
    coalesce(ps.paid_signal_cohort_delivered_within_15m, 0)::bigint,
    coalesce(dl.delivered_readings, 0)::bigint,
    coalesce(f.failed_readings, 0)::bigint
  from days d
  left join previews pv using (metric_date)
  left join checkouts c using (metric_date)
  left join purchases p using (metric_date)
  left join paid_signals ps using (metric_date)
  left join deliveries dl using (metric_date)
  left join failures f using (metric_date)
  order by d.metric_date;
$$;

revoke all on function public.get_growth_scorecard(date, date) from public, anon, authenticated;
grant execute on function public.get_growth_scorecard(date, date) to service_role;

comment on function public.get_growth_scorecard(date, date) is
  'Returns Asia/Taipei aggregate funnel, verified-purchase, refund, and fulfillment counts for the protected growth scorecard. Contains no customer-level fields.';
