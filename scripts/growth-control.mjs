#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export const TRAFFIC_GOAL = Object.freeze({
  metric: "gsc_web_search_clicks",
  property: "sc-domain:yourloveelement.com",
  search_type: "web",
  aggregation: "property",
  data_state: "final",
  timezone: "America/Los_Angeles",
  daily_clicks_strictly_above: 1000,
  minimum_qualifying_clicks: 1001,
  consecutive_days: 30,
  deadline: null,
});

export const PURCHASE_GOAL = Object.freeze({
  metric: "verified_non_refunded_purchasers",
  timezone: "Asia/Taipei",
  daily_verified_purchasers: 10,
  consecutive_days: 30,
  streak_start_deadline: "2026-09-15",
  completion_deadline: "2026-10-14",
  hard_review_date: "2026-10-15",
});

export const GOAL = Object.freeze({
  active_stage: "gsc_traffic",
  stage_1: TRAFFIC_GOAL,
  stage_2: PURCHASE_GOAL,
});

const COUNT_FIELDS = Object.freeze([
  "landing_sessions",
  "landing_cta_clicks",
  "quiz_starts",
  "previews_revealed",
  "checkouts_created",
  "verified_purchasers",
  "verified_orders",
  "refunded_orders",
  "paid_signals_submitted",
  "paid_signal_cohort_delivered",
  "paid_signal_cohort_delivered_within_15m",
  "delivered_readings",
  "failed_readings",
]);

const CRITICAL_AUTHORITIES = Object.freeze([
  "gsc_read",
  "lemon_read",
  "scorecard_read",
  "meta_read",
  "resend_read",
  "deploy",
  "publish",
  "paid_media",
  "paid_flow_e2e",
]);

const GSC_ACCESS_AUTHORITIES = Object.freeze([
  "gsc_read",
]);

const PURCHASE_ACCESS_AUTHORITIES = Object.freeze([
  "scorecard_read",
]);

const FUNNEL_STEPS = Object.freeze([
  { id: "landing_to_cta", numerator: "landing_cta_clicks", denominator: "landing_sessions", target: 0.25, minimum: 100 },
  { id: "cta_to_quiz", numerator: "quiz_starts", denominator: "landing_cta_clicks", target: 0.70, minimum: 100 },
  { id: "quiz_to_preview", numerator: "previews_revealed", denominator: "quiz_starts", target: 0.60, minimum: 100 },
  { id: "preview_to_checkout", numerator: "checkouts_created", denominator: "previews_revealed", target: 0.06, minimum: 100 },
  { id: "checkout_to_purchase", numerator: "verified_purchasers", denominator: "checkouts_created", target: 0.55, minimum: 100 },
  { id: "purchase_to_paid_signals", numerator: "paid_signals_submitted", denominator: "verified_purchasers", target: 0.70, minimum: 20 },
]);

const ACTIONS = Object.freeze({
  gsc_access: {
    id: "complete_gsc_traffic_gate",
    hypothesis: "Once final aggregate GSC web-click data is available for the exact domain property, the loop can measure progress toward the traffic-stage streak without relying on impressions or analytics proxies.",
    primary_metric: "gsc_read_ready",
    guardrails: ["exact property sc-domain:yourloveelement.com", "final aggregate data only", "no query or page detail required"],
    sample_gate: "gsc_read has current exact-property evidence",
    time_gate: "recheck on every run until ready",
    stop_condition: "stop immediately for login, OTP, CAPTCHA, permission denial, or ambiguous property",
    authority_required: GSC_ACCESS_AUTHORITIES,
  },
  access: {
    id: "complete_authority_and_scorecard_gate",
    hypothesis: "Once one authorized aggregate scorecard path is available, the loop can choose and evaluate the actual bottleneck instead of optimizing from stale proxies.",
    primary_metric: "scorecard_access_ready",
    guardrails: ["no secrets or customer-level data in logs", "no external mutation without recorded standing authority"],
    sample_gate: "scorecard_read has current exact-project evidence",
    time_gate: "recheck on every daily run until ready",
    stop_condition: "stop immediately for OTP, CAPTCHA, permission denial, or ambiguous target account",
    authority_required: PURCHASE_ACCESS_AUTHORITIES,
  },
  reliability: {
    id: "repair_paid_flow_reliability",
    hypothesis: "Restoring a healthy paid flow before acquisition prevents paid traffic from producing failed orders, missing reports, or duplicate delivery.",
    primary_metric: "paid_flow_incidents",
    guardrails: ["no scaling while an incident is open", "exactly-once report delivery", "refund and webhook integrity"],
    sample_gate: "one authorized end-to-end order plus current health evidence",
    time_gate: "resolve before the next acquisition action",
    stop_condition: "halt external actions if payment, webhook, queue, generation, or delivery state is ambiguous",
    authority_required: ["paid_flow_e2e", "deploy"],
  },
  fulfillment: {
    id: "restore_fulfillment_above_98_percent",
    hypothesis: "Fixing post-purchase completion and delivery first protects customers and makes additional acquisition economically safe.",
    primary_metric: "paid_signals_to_delivery_within_15m_rate",
    guardrails: ["delivery success >= 98%", "no duplicate emails", "failed readings return to zero"],
    sample_gate: "all affected readings reconciled and one authorized end-to-end verification passes",
    time_gate: "do not resume scaling until the rolling rate is at least 98%",
    stop_condition: "pause acquisition for any unresolved paid reading or duplicate delivery",
    authority_required: ["paid_flow_e2e", "deploy"],
  },
  observability: {
    id: "complete_measurement_plane",
    hypothesis: "A complete seven-day aggregate window plus settled revenue and spend makes experiment promotion and channel scaling decisions auditable.",
    primary_metric: "required_metrics_available",
    guardrails: ["aggregate-only inputs", "Lemon/Supabase remain purchase truth", "estimated gross is not settled revenue"],
    sample_gate: "seven closed days with complete funnel, purchase, refund, fulfillment, revenue, and spend fields",
    time_gate: "collect on each daily run until the window is complete",
    stop_condition: "do not infer missing values or substitute frontend/Meta events for verified purchases",
    authority_required: ["scorecard_read", "lemon_read", "meta_read", "resend_read"],
  },
  economics: {
    id: "reset_acquisition_economics",
    hypothesis: "Reducing CAC or improving settled contribution before scaling will prevent growth that loses money on each order.",
    primary_metric: "rolling_3d_cac_usd",
    guardrails: ["never exceed the recorded spend cap", "refund and fulfillment rates must not worsen", "use settled revenue and actual spend"],
    sample_gate: "at least two verified purchases in the decision window",
    time_gate: "evaluate after each closed day; scale changes no more than 20% per 24 hours",
    stop_condition: "pause after two target CACs without a purchase or CAC exceeds the cap by 30%",
    authority_required: ["paid_media", "meta_read", "lemon_read"],
  },
  traffic: {
    id: "increase_final_gsc_web_clicks",
    hypothesis: "Publishing and improving search-matched pages for the exact domain can raise daily organic Search clicks toward the 1,001-click qualifying threshold.",
    primary_metric: "gsc_web_search_clicks_per_final_day",
    guardrails: ["GSC impressions do not count as visits", "only final web-search click data qualifies", "paid media remains $0"],
    sample_gate: "at least seven contiguous final GSC days",
    time_gate: "evaluate on final 7/14/30-day windows",
    stop_condition: "replace the active SEO action after its stated sample/time gate if final clicks do not improve, or stop for production breakage",
    authority_required: ["deploy"],
  },
});

const CONVERSION_ACTIONS = Object.freeze({
  landing_to_cta: ["test_first_viewport_promise", "landing_view_to_cta_rate", "Test one hero promise, CTA, or message-match change."],
  cta_to_quiz: ["remove_quiz_entry_friction", "cta_to_quiz_start_rate", "Remove the smallest measured first-question or mobile-entry friction."],
  quiz_to_preview: ["repair_quiz_abandonment", "quiz_start_to_preview_rate", "Fix the exact abandonment or validation step before shortening the quiz."],
  preview_to_checkout: ["strengthen_preview_offer", "preview_to_checkout_rate", "Improve sample proof, value framing, trust, price clarity, or email friction."],
  checkout_to_purchase: ["inspect_checkout_friction", "checkout_to_verified_purchase_rate", "Inspect Lemon checkout, payment-method, trust, and price objections."],
  purchase_to_paid_signals: ["repair_post_purchase_handoff", "purchase_to_paid_signals_rate", "Improve receipt, return link, and post-purchase instructions."],
});

const SENSITIVE_KEY_PATTERN = /(^|_)(email|customer|session|order|reading|answers?|webhook|report|quer(?:y|ies)|pages?|token|secret)($|_)/i;
const ALLOWED_AGGREGATE_COUNT_KEYS = new Set([
  "full_report_sessions",
  "page_view_sessions",
]);

function isAllowedAggregateKey(key, value, path) {
  if (ALLOWED_AGGREGATE_COUNT_KEYS.has(key)) {
    return true;
  }
  return key === "page"
    && /^input\.scorecard\.attribution\[\d+\]$/.test(path)
    && (value === "landing" || value === "full_report");
}

function assertAggregateOnly(value, path = "input") {
  if (!value || typeof value !== "object") {
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertAggregateOnly(item, `${path}[${index}]`));
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (SENSITIVE_KEY_PATTERN.test(key) && !isAllowedAggregateKey(key, child, path)) {
      throw new Error(`Aggregate input rejected sensitive key at ${path}.${key}`);
    }
    assertAggregateOnly(child, `${path}.${key}`);
  }
}

function requireDate(value, label) {
  const date = String(value || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(`${date}T00:00:00.000Z`).toISOString().slice(0, 10) !== date) {
    throw new Error(`Invalid ${label}`);
  }
  return date;
}

function requireCount(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Invalid aggregate count: ${label}`);
  }
  return value;
}

function optionalMoney(value, label) {
  if (value === undefined || value === null) {
    return null;
  }
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid monetary aggregate: ${label}`);
  }
  return Number(value);
}

function addDays(date, days) {
  const value = new Date(`${requireDate(date, "date")}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function daysBetween(start, end) {
  return Math.round((new Date(`${end}T00:00:00.000Z`) - new Date(`${start}T00:00:00.000Z`)) / 86400000);
}

function ratio(numerator, denominator) {
  return denominator > 0 ? Number((numerator / denominator).toFixed(4)) : null;
}

function roundMoney(value) {
  return value === null ? null : Number(value.toFixed(2));
}

function normalizeScorecard(scorecard) {
  if (scorecard === undefined || scorecard === null) {
    return null;
  }
  if (
    scorecard.source !== "supabase_verified_lemon_state_and_first_party_funnel"
    || scorecard.privacy !== "aggregate_counts_only"
    || scorecard.range?.timezone !== PURCHASE_GOAL.timezone
    || !Array.isArray(scorecard.days)
  ) {
    throw new Error("Invalid aggregate scorecard contract");
  }
  const days = scorecard.days.map((day, index) => {
    const normalized = { date: requireDate(day.date, `scorecard.days[${index}].date`) };
    for (const field of COUNT_FIELDS) {
      normalized[field] = requireCount(day[field], `scorecard.days[${index}].${field}`);
    }
    return normalized;
  }).sort((left, right) => left.date.localeCompare(right.date));
  if (new Set(days.map((day) => day.date)).size !== days.length) {
    throw new Error("Scorecard contains duplicate metric dates");
  }
  for (let index = 1; index < days.length; index += 1) {
    if (days[index].date !== addDays(days[index - 1].date, 1)) {
      throw new Error("Scorecard metric dates must be contiguous closed days");
    }
  }
  const endDate = requireDate(scorecard.range?.end_date || days.at(-1)?.date, "scorecard.range.end_date");
  if (days.length && days.at(-1).date !== endDate) {
    throw new Error("Scorecard end date does not match its latest metric day");
  }
  const currentStreak = requireCount(scorecard.goal?.current_streak ?? 0, "scorecard.goal.current_streak");
  if (scorecard.goal?.complete === true && currentStreak < PURCHASE_GOAL.consecutive_days) {
    throw new Error("Scorecard goal completion is inconsistent with its streak");
  }
  return {
    days,
    goal: {
      current_streak: currentStreak,
      complete: scorecard.goal?.complete === true,
    },
    end_date: endDate,
  };
}

function normalizeSearchConsole(searchConsole, runDate) {
  if (searchConsole === undefined || searchConsole === null) {
    return null;
  }
  if (
    searchConsole.property !== TRAFFIC_GOAL.property
    || searchConsole.source !== "google_search_console_performance"
    || searchConsole.search_type !== TRAFFIC_GOAL.search_type
    || searchConsole.aggregation !== TRAFFIC_GOAL.aggregation
    || searchConsole.data_state !== TRAFFIC_GOAL.data_state
    || searchConsole.timezone !== TRAFFIC_GOAL.timezone
    || searchConsole.privacy !== "aggregate_counts_only"
    || !Array.isArray(searchConsole.days)
  ) {
    throw new Error("Invalid aggregate Search Console contract");
  }
  if (requireDate(searchConsole.fetched_on, "search_console.fetched_on") !== runDate) {
    throw new Error("Search Console aggregate must be fetched on the run date");
  }
  const days = searchConsole.days.map((day, index) => ({
    date: requireDate(day.date, `search_console.days[${index}].date`),
    clicks: requireCount(day.clicks, `search_console.days[${index}].clicks`),
    impressions: requireCount(day.impressions, `search_console.days[${index}].impressions`),
  })).sort((left, right) => left.date.localeCompare(right.date));
  if (days.length === 0) {
    throw new Error("Search Console aggregate requires at least one final day");
  }
  if (new Set(days.map((day) => day.date)).size !== days.length) {
    throw new Error("Search Console contains duplicate dates");
  }
  for (let index = 1; index < days.length; index += 1) {
    if (days[index].date !== addDays(days[index - 1].date, 1)) {
      throw new Error("Search Console dates must be contiguous final days");
    }
  }
  const startDate = requireDate(searchConsole.start_date, "search_console.start_date");
  const endDate = requireDate(searchConsole.end_date, "search_console.end_date");
  if (days[0].date !== startDate || days.at(-1).date !== endDate) {
    throw new Error("Search Console range must match its final metric days");
  }
  if (endDate >= runDate) {
    throw new Error("Search Console final data must precede the run date");
  }
  return {
    days,
    start_date: startDate,
    end_date: endDate,
    fetched_on: runDate,
  };
}

function aggregateTrafficWindow(days, requestedDays) {
  const selected = days.slice(-requestedDays);
  const clicks = selected.reduce((total, day) => total + day.clicks, 0);
  const impressions = selected.reduce((total, day) => total + day.impressions, 0);
  return {
    final_days: selected.length,
    start_date: selected[0]?.date || null,
    end_date: selected.at(-1)?.date || null,
    clicks: selected.length ? clicks : null,
    impressions: selected.length ? impressions : null,
    clicks_per_day: selected.length ? Number((clicks / selected.length).toFixed(2)) : null,
    qualifying_days: selected.filter((day) => day.clicks > TRAFFIC_GOAL.daily_clicks_strictly_above).length,
  };
}

function trafficStage(searchConsole, runDate) {
  const emptyRolling = {
    "1d": aggregateTrafficWindow([], 1),
    "7d": aggregateTrafficWindow([], 7),
    "14d": aggregateTrafficWindow([], 14),
    "30d": aggregateTrafficWindow([], 30),
  };
  if (!searchConsole) {
    return {
      property: TRAFFIC_GOAL.property,
      metric: TRAFFIC_GOAL.metric,
      latest_final_date: null,
      data_lag_days: null,
      latest_daily_clicks: null,
      current_streak: null,
      complete: false,
      rolling: emptyRolling,
    };
  }
  let currentStreak = 0;
  for (let index = searchConsole.days.length - 1; index >= 0; index -= 1) {
    if (searchConsole.days[index].clicks <= TRAFFIC_GOAL.daily_clicks_strictly_above) {
      break;
    }
    currentStreak += 1;
  }
  return {
    property: TRAFFIC_GOAL.property,
    metric: TRAFFIC_GOAL.metric,
    latest_final_date: searchConsole.end_date,
    data_lag_days: daysBetween(searchConsole.end_date, runDate),
    latest_daily_clicks: searchConsole.days.at(-1).clicks,
    current_streak: currentStreak,
    complete: currentStreak >= TRAFFIC_GOAL.consecutive_days,
    rolling: {
      "1d": aggregateTrafficWindow(searchConsole.days, 1),
      "7d": aggregateTrafficWindow(searchConsole.days, 7),
      "14d": aggregateTrafficWindow(searchConsole.days, 14),
      "30d": aggregateTrafficWindow(searchConsole.days, 30),
    },
  };
}

function aggregateWindow(days, requestedDays) {
  const selected = days.slice(-requestedDays);
  const sums = Object.fromEntries(COUNT_FIELDS.map((field) => [field, 0]));
  for (const day of selected) {
    for (const field of COUNT_FIELDS) {
      sums[field] += day[field];
    }
  }
  const closedDays = selected.length;
  const totals = closedDays
    ? sums
    : Object.fromEntries(COUNT_FIELDS.map((field) => [field, null]));
  return {
    closed_days: closedDays,
    start_date: selected[0]?.date || null,
    end_date: selected.at(-1)?.date || null,
    ...totals,
    purchasers_per_day: closedDays ? Number((totals.verified_purchasers / closedDays).toFixed(2)) : null,
    landing_sessions_per_day: closedDays ? Number((totals.landing_sessions / closedDays).toFixed(2)) : null,
    landing_to_purchase_rate: ratio(totals.verified_purchasers, totals.landing_sessions),
    paid_signals_to_delivery_rate: ratio(totals.paid_signal_cohort_delivered, totals.paid_signals_submitted),
    paid_signals_to_delivery_within_15m_rate: ratio(totals.paid_signal_cohort_delivered_within_15m, totals.paid_signals_submitted),
  };
}

function providerMetrics(provider, rolling3) {
  const spend = optionalMoney(provider.rolling_3d_spend_usd, "provider.rolling_3d_spend_usd");
  const revenue = optionalMoney(provider.rolling_3d_settled_revenue_usd, "provider.rolling_3d_settled_revenue_usd");
  const maxCac = optionalMoney(provider.max_acceptable_cac_usd, "provider.max_acceptable_cac_usd");
  const hasWindowedMoney = spend !== null || revenue !== null;
  const windowStart = provider.rolling_3d_start_date === undefined || provider.rolling_3d_start_date === null
    ? null
    : requireDate(provider.rolling_3d_start_date, "provider.rolling_3d_start_date");
  const windowEnd = provider.rolling_3d_end_date === undefined || provider.rolling_3d_end_date === null
    ? null
    : requireDate(provider.rolling_3d_end_date, "provider.rolling_3d_end_date");
  if (hasWindowedMoney && (windowStart !== rolling3.start_date || windowEnd !== rolling3.end_date)) {
    throw new Error("Provider monetary aggregates must match the rolling three-day scorecard window");
  }
  return {
    rolling_3d_start_date: windowStart,
    rolling_3d_end_date: windowEnd,
    rolling_3d_spend_usd: spend,
    rolling_3d_settled_revenue_usd: revenue,
    max_acceptable_cac_usd: maxCac,
    cac_usd: spend !== null && rolling3.verified_purchasers > 0 ? roundMoney(spend / rolling3.verified_purchasers) : null,
    roas: spend !== null && spend > 0 && revenue !== null ? Number((revenue / spend).toFixed(4)) : null,
  };
}

function experimentSampleClock(traffic, scorecard) {
  if (!traffic.complete) {
    return {
      basis: "final_gsc_days",
      end_date: traffic.latest_final_date,
    };
  }
  return {
    basis: "closed_scorecard_days",
    end_date: scorecard?.end_date ?? null,
  };
}

function evaluateExperiment(experiment, runDate, sampleClock) {
  if (!experiment) {
    return { decision: "none", reason: "no active experiment" };
  }
  const startedOn = requireDate(experiment.started_on, "active_experiment.started_on");
  if (startedOn > runDate) {
    throw new Error("Active experiment cannot start after the run date");
  }
  const elapsedDays = daysBetween(startedOn, runDate);
  const sampleEndDate = sampleClock.end_date === null
    ? null
    : requireDate(sampleClock.end_date, "experiment_sample_clock.end_date");
  const sampleDays = sampleEndDate !== null && sampleEndDate >= startedOn
    ? daysBetween(startedOn, sampleEndDate) + 1
    : 0;
  const sample = {
    sample_days: sampleDays,
    sample_basis: sampleClock.basis,
    sample_end_date: sampleEndDate,
  };
  const measurementValues = [
    experiment.eligible_sessions,
    experiment.baseline_primary_rate,
    experiment.current_primary_rate,
    experiment.baseline_guardrail_rate,
    experiment.current_guardrail_rate,
  ];
  const measurementAvailability = measurementValues.map((value) => value !== undefined && value !== null);
  if (!measurementAvailability.some(Boolean)) {
    if (experiment.has_breakage === true) {
      return {
        decision: "stop",
        reason: "breakage reported",
        measurement_status: "unavailable",
        elapsed_days: elapsedDays,
        ...sample,
        eligible_sessions: null,
      };
    }
    return {
      decision: "continue",
      reason: "active experiment is awaiting aggregate measurement",
      measurement_status: "unavailable",
      elapsed_days: elapsedDays,
      ...sample,
      eligible_sessions: null,
    };
  }
  if (!measurementAvailability.every(Boolean)) {
    throw new Error("Active experiment aggregate measurements must be all available or all null");
  }
  const eligible = requireCount(experiment.eligible_sessions, "active_experiment.eligible_sessions");
  const baseline = Number(experiment.baseline_primary_rate);
  const current = Number(experiment.current_primary_rate);
  const baselineGuardrail = Number(experiment.baseline_guardrail_rate);
  const currentGuardrail = Number(experiment.current_guardrail_rate);
  if (![baseline, current, baselineGuardrail, currentGuardrail].every((value) => Number.isFinite(value) && value >= 0 && value <= 1)) {
    throw new Error("Invalid active experiment rate");
  }
  const relativeLift = baseline > 0 ? (current - baseline) / baseline : null;
  const guardrailDecline = baselineGuardrail > 0 ? (baselineGuardrail - currentGuardrail) / baselineGuardrail : 0;
  const minimumLift = Number.isFinite(experiment.minimum_relative_lift)
    ? Number(experiment.minimum_relative_lift)
    : 0.05;
  if (minimumLift < 0) {
    throw new Error("Invalid active experiment minimum relative lift");
  }

  if (experiment.has_breakage === true) {
    return { decision: "stop", reason: "breakage reported", elapsed_days: elapsedDays, ...sample, eligible_sessions: eligible };
  }
  if (eligible >= 100 && guardrailDecline >= 0.30) {
    return { decision: "stop", reason: "guardrail declined at least 30% after 100 eligible sessions", elapsed_days: elapsedDays, ...sample, eligible_sessions: eligible };
  }
  if (sampleDays < 7 || eligible < 200) {
    return { decision: "continue", reason: "seven-day and 200-session decision gate not reached", elapsed_days: elapsedDays, ...sample, eligible_sessions: eligible };
  }
  if (relativeLift !== null && relativeLift >= minimumLift && guardrailDecline <= 0) {
    return { decision: "promote", reason: "primary metric improved beyond the configured lift and the guardrail did not decline", elapsed_days: elapsedDays, ...sample, eligible_sessions: eligible };
  }
  if (relativeLift === null || relativeLift <= 0) {
    return { decision: "stop", reason: "primary metric did not improve after the full decision gate", elapsed_days: elapsedDays, ...sample, eligible_sessions: eligible };
  }
  return { decision: "continue", reason: "primary metric improved but promotion guardrails are not yet satisfied", elapsed_days: elapsedDays, ...sample, eligible_sessions: eligible };
}

function nextMilestone(runDate, traffic, rolling7, scorecard, authorityReady) {
  if (!traffic.complete) {
    return {
      date: null,
      metric: "consecutive_final_gsc_days_above_1000_clicks",
      target: TRAFFIC_GOAL.consecutive_days,
      actual: traffic.current_streak,
      days_remaining: null,
      gap: traffic.current_streak === null ? null : TRAFFIC_GOAL.consecutive_days - traffic.current_streak,
    };
  }
  const milestones = [
    { date: "2026-08-02", metric: "authority_gate", target: 1, actual: authorityReady ? 1 : 0 },
    { date: "2026-08-09", metric: "scorecard_operational", target: 1, actual: scorecard ? 1 : 0 },
    { date: "2026-08-16", metric: "purchasers_per_day_7d", target: 1, actual: rolling7.purchasers_per_day },
    { date: "2026-08-30", metric: "purchasers_per_day_7d", target: 3, actual: rolling7.purchasers_per_day },
    { date: "2026-09-06", metric: "purchasers_per_day_7d", target: 7, actual: rolling7.purchasers_per_day },
    { date: "2026-09-15", metric: "first_10_purchaser_day", target: 10, actual: scorecard?.days.at(-1)?.verified_purchasers ?? null },
    { date: "2026-10-14", metric: "consecutive_qualifying_days", target: 30, actual: scorecard?.goal.current_streak ?? null },
  ];
  const milestone = milestones.find((item) => item.date >= runDate) || milestones.at(-1);
  return {
    ...milestone,
    days_remaining: daysBetween(runDate, milestone.date),
    gap: milestone.actual === null ? null : Number((milestone.target - milestone.actual).toFixed(2)),
  };
}

function conversionAction(step, rate) {
  const [id, primaryMetric, hypothesis] = CONVERSION_ACTIONS[step.id];
  return {
    id,
    hypothesis,
    primary_metric: primaryMetric,
    guardrails: ["refund rate must not worsen", "paid-flow reliability remains >= 98%", "change one customer-facing variable at a time"],
    sample_gate: "at least 200 eligible sessions before promotion",
    time_gate: "at least seven closed days before promotion",
    stop_condition: "stop for breakage or a 30% guardrail decline after 100 eligible sessions",
    authority_required: ["deploy"],
    observed_rate: rate,
    target_rate: step.target,
  };
}

function actionWithAuthority(action, authority) {
  const missing = action.authority_required.filter((key) => authority[key] !== true);
  const oneOfReady = !action.authority_one_of || action.authority_one_of.some((key) => authority[key] === true);
  if (!oneOfReady) {
    missing.push(action.authority_one_of.join("_or_"));
  }
  const executionScope = ["complete_authority_and_scorecard_gate", "complete_gsc_traffic_gate"].includes(action.id)
    ? "one_time_user_bootstrap_required"
    : (missing.length ? "local_only_until_authorized" : "authorized_scope_only");
  return {
    ...action,
    missing_authority: missing,
    execution_scope: executionScope,
  };
}

function resolveAuthority(inputAuthority, standingAuthority) {
  const authority = Object.fromEntries(CRITICAL_AUTHORITIES.map((key) => [key, inputAuthority?.[key] === true]));
  if (!standingAuthority) {
    return authority;
  }
  const grants = standingAuthority.grants || {};
  const granted = (name) => grants[name]?.authorized === true;
  authority.deploy = authority.deploy && [
    "apply_production_migrations",
    "git_push",
    "deploy_worker",
    "deploy_frontend",
  ].every(granted);
  authority.publish = authority.publish && granted("publish_organic");
  authority.paid_media = authority.paid_media && standingAuthority.paid_media?.authorized === true;
  authority.paid_flow_e2e = authority.paid_flow_e2e && granted("run_paid_flow_e2e");
  return authority;
}

function authorityPolicySummary(standingAuthority) {
  if (!standingAuthority) {
    return { applied: false };
  }
  const grants = standingAuthority.grants || {};
  return {
    applied: true,
    authorized_grants: Object.entries(grants)
      .filter(([, record]) => record?.authorized === true)
      .map(([name]) => name)
      .sort(),
    paid_media: {
      authorized: standingAuthority.paid_media?.authorized === true,
      currency: standingAuthority.paid_media?.currency || null,
      daily_cap: standingAuthority.paid_media?.daily_cap ?? null,
      lifetime_cap: standingAuthority.paid_media?.lifetime_cap ?? null,
      max_increase_percent_per_24h: standingAuthority.paid_media?.max_increase_percent_per_24h ?? null,
    },
  };
}

export function evaluateGrowthControl(input, standingAuthority = null) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Input must be an aggregate JSON object");
  }
  assertAggregateOnly(input);

  const taipeiToday = new Date(Date.now() + (8 * 60 * 60 * 1000)).toISOString().slice(0, 10);
  const runDate = requireDate(input.run_date || taipeiToday, "run_date");
  const scorecard = normalizeScorecard(input.scorecard);
  if (scorecard && scorecard.end_date !== addDays(runDate, -1)) {
    throw new Error("Scorecard must end on the latest closed Asia/Taipei day");
  }
  const searchConsole = normalizeSearchConsole(input.search_console, runDate);
  const traffic = trafficStage(searchConsole, runDate);
  const authority = resolveAuthority(input.authority, standingAuthority);
  const authorityPolicy = authorityPolicySummary(standingAuthority);
  const missingAuthorities = CRITICAL_AUTHORITIES.filter((key) => !authority[key]);
  const provider = input.provider || {};
  if (typeof provider.public_health_ok !== "boolean" || typeof provider.paid_flow_incident !== "boolean") {
    throw new Error("Provider health and paid-flow incident signals must be explicit booleans");
  }
  const publicHealthOk = provider.public_health_ok;
  const paidFlowIncident = provider.paid_flow_incident;
  const rolling3 = aggregateWindow(scorecard?.days || [], 3);
  const rolling7 = aggregateWindow(scorecard?.days || [], 7);
  const rolling14 = aggregateWindow(scorecard?.days || [], 14);
  const economics = providerMetrics(provider, rolling3);
  const common = {
    schema_version: 2,
    run_date: runDate,
    goal: GOAL,
    deadline: {
      traffic_stage_deadline: TRAFFIC_GOAL.deadline,
      days_until_purchase_streak_start_deadline: daysBetween(runDate, PURCHASE_GOAL.streak_start_deadline),
      days_until_purchase_completion_deadline: daysBetween(runDate, PURCHASE_GOAL.completion_deadline),
    },
    traffic,
    traffic_streak: traffic.current_streak,
    current_streak: scorecard?.goal.current_streak ?? null,
    rolling: { "3d": rolling3, "7d": rolling7, "14d": rolling14 },
    economics,
    experiment: evaluateExperiment(input.active_experiment, runDate, experimentSampleClock(traffic, scorecard)),
    authority_policy: authorityPolicy,
    missing_authorities: missingAuthorities,
  };

  if (!searchConsole || authority.gsc_read !== true) {
    const evidence = [];
    if (!searchConsole) {
      evidence.push("current final aggregate GSC web-click data is unavailable");
    }
    if (authority.gsc_read !== true) {
      evidence.push("gsc_read is not currently available for sc-domain:yourloveelement.com");
    }
    return {
      ...common,
      active_stage: "gsc_traffic",
      status: "blocked_on_gsc_truth",
      next_milestone: nextMilestone(runDate, traffic, rolling7, scorecard, false),
      primary_constraint: "access",
      constraint_evidence: evidence,
      action: actionWithAuthority(ACTIONS.gsc_access, authority),
    };
  }

  if (!traffic.complete) {
    const constraint = !publicHealthOk || paidFlowIncident ? "reliability" : "traffic";
    const action = constraint === "reliability" ? ACTIONS.reliability : ACTIONS.traffic;
    const evidence = constraint === "reliability"
      ? [!publicHealthOk ? "a production health signal is not healthy" : "a paid-flow incident is open"]
      : [
        `${traffic.latest_daily_clicks} final GSC web clicks on ${traffic.latest_final_date}; ${TRAFFIC_GOAL.minimum_qualifying_clicks} are required`,
        `the current qualifying traffic streak is ${traffic.current_streak} of ${TRAFFIC_GOAL.consecutive_days} days`,
      ];
    return {
      ...common,
      active_stage: "gsc_traffic",
      status: "actionable",
      next_milestone: nextMilestone(runDate, traffic, rolling7, scorecard, true),
      primary_constraint: constraint,
      constraint_evidence: evidence,
      action: actionWithAuthority(action, authority),
    };
  }

  if (!scorecard || authority.scorecard_read !== true) {
    const evidence = [];
    if (!scorecard) {
      evidence.push("traffic-stage evidence is complete but the protected purchase scorecard is unavailable");
    }
    if (authority.scorecard_read !== true) {
      evidence.push("scorecard_read is not currently available for the purchase stage");
    }
    return {
      ...common,
      active_stage: "verified_purchases",
      status: "blocked_on_aggregate_truth",
      next_milestone: nextMilestone(runDate, traffic, rolling7, scorecard, false),
      primary_constraint: "access",
      constraint_evidence: evidence,
      action: actionWithAuthority(ACTIONS.access, authority),
    };
  }

  const evidence = [];
  let constraint = "traffic";
  let action = ACTIONS.traffic;

  if (scorecard.goal.complete && scorecard.goal.current_streak >= PURCHASE_GOAL.consecutive_days) {
    constraint = null;
    action = {
      id: "audit_and_hold_qualifying_streak",
      hypothesis: "Confirming the most recent closed day and refund state prevents a provisional streak from being declared final.",
      primary_metric: "verified_non_refunded_consecutive_days",
      guardrails: ["latest day is closed", "refund state is current", "no customer-level data exposed"],
      sample_gate: "30 consecutive closed qualifying days",
      time_gate: "final audit after the most recent day closes",
      stop_condition: "reopen the goal if any refund or corrected order resets the streak",
      authority_required: ["scorecard_read", "lemon_read"],
    };
    evidence.push(`authoritative scorecard reports a ${scorecard.goal.current_streak}-day streak`);
  } else if (!publicHealthOk || paidFlowIncident) {
    constraint = "reliability";
    action = ACTIONS.reliability;
    evidence.push(!publicHealthOk ? "a production health signal is not healthy" : "a paid-flow incident is open");
  } else if (
    rolling7.failed_readings > 0
    || (rolling7.paid_signals_submitted > 0 && (rolling7.paid_signals_to_delivery_within_15m_rate ?? 0) < 0.98)
  ) {
    constraint = "fulfillment";
    action = ACTIONS.fulfillment;
    evidence.push(`${rolling7.failed_readings} failed readings in the rolling window`);
    evidence.push(`delivery within 15 minutes is ${rolling7.paid_signals_to_delivery_within_15m_rate ?? "unknown"}`);
  } else if (scorecard.days.length < 7) {
    constraint = "observability";
    action = ACTIONS.observability;
    evidence.push(`only ${scorecard.days.length} closed scorecard days are available`);
  } else if (
    economics.cac_usd !== null
    && economics.max_acceptable_cac_usd !== null
    && rolling3.verified_purchasers >= 2
    && economics.cac_usd > economics.max_acceptable_cac_usd
  ) {
    constraint = "economics";
    action = ACTIONS.economics;
    evidence.push(`rolling CAC ${economics.cac_usd} exceeds the approved maximum ${economics.max_acceptable_cac_usd}`);
  } else {
    const failingStep = FUNNEL_STEPS
      .map((step) => ({ step, rate: ratio(rolling7[step.numerator], rolling7[step.denominator]) }))
      .filter(({ step, rate }) => rolling7[step.denominator] >= step.minimum && rate !== null && rate < step.target)
      .sort((left, right) => (left.rate / left.step.target) - (right.rate / right.step.target))[0];

    if (failingStep) {
      constraint = "conversion";
      action = conversionAction(failingStep.step, failingStep.rate);
      evidence.push(`${failingStep.step.id} rate ${failingStep.rate} is below target ${failingStep.step.target}`);
    } else if (
      rolling7.verified_purchasers > 0
      && (economics.rolling_3d_spend_usd === null || economics.rolling_3d_settled_revenue_usd === null)
    ) {
      constraint = "observability";
      action = ACTIONS.observability;
      evidence.push("verified purchases exist but settled revenue or spend is unavailable");
    } else {
      const observedRate = rolling7.landing_to_purchase_rate;
      const planningRate = observedRate && observedRate > 0 ? observedRate : 0.01;
      const requiredViewsPerDay = Math.ceil(PURCHASE_GOAL.daily_verified_purchasers / planningRate);
      evidence.push(`${rolling7.landing_sessions_per_day ?? 0} landing sessions/day versus approximately ${requiredViewsPerDay} required at the observed/planning conversion rate`);
      action = {
        id: "increase_qualified_landing_sessions",
        hypothesis: "Increasing message-matched qualified sessions while preserving conversion will move verified purchases toward 10 per day.",
        primary_metric: "qualified_landing_sessions_per_day",
        guardrails: ["landing-to-purchase conversion must not decline", "paid media remains $0", "fulfillment remains >= 98%"],
        sample_gate: "seven closed days or at least 200 eligible landing sessions",
        time_gate: "evaluate on rolling 3/7/14-day windows",
        stop_condition: "stop for a 30% guardrail decline or a paid-flow incident",
        authority_required: ["deploy"],
        required_landing_sessions_per_day: requiredViewsPerDay,
      };
    }
  }

  return {
    ...common,
    active_stage: "verified_purchases",
    status: constraint === null ? "goal_evidence_ready_for_final_audit" : "actionable",
    next_milestone: nextMilestone(runDate, traffic, rolling7, scorecard, authority.scorecard_read === true),
    primary_constraint: constraint,
    constraint_evidence: evidence,
    action: actionWithAuthority(action, authority),
  };
}

async function readInput(path) {
  if (!path) {
    throw new Error("Usage: node scripts/growth-control.mjs --input <aggregate-json-file>");
  }
  const raw = path === "-"
    ? await new Promise((resolve, reject) => {
      let data = "";
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", (chunk) => { data += chunk; });
      process.stdin.on("end", () => resolve(data));
      process.stdin.on("error", reject);
    })
    : await readFile(path, "utf8");
  return JSON.parse(raw);
}

async function main() {
  const inputFlag = process.argv.indexOf("--input");
  const input = await readInput(inputFlag >= 0 ? process.argv[inputFlag + 1] : null);
  const contracts = JSON.parse(await readFile(new URL("../harness/contracts.json", import.meta.url), "utf8"));
  process.stdout.write(`${JSON.stringify(evaluateGrowthControl(input, contracts.standing_authority), null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`growth-control: ${error.message}\n`);
    process.exitCode = 2;
  });
}
