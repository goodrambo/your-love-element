#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export const GOAL = Object.freeze({
  timezone: "Asia/Taipei",
  daily_verified_purchasers: 10,
  consecutive_days: 30,
  streak_start_deadline: "2026-09-15",
  completion_deadline: "2026-10-14",
  hard_review_date: "2026-10-15",
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
  "lemon_read",
  "scorecard_read",
  "meta_read",
  "resend_read",
  "deploy",
  "publish",
  "paid_media",
  "paid_flow_e2e",
]);

const REQUIRED_ACCESS_AUTHORITIES = Object.freeze([
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
  access: {
    id: "complete_authority_and_scorecard_gate",
    hypothesis: "Once one authorized aggregate scorecard path is available, the loop can choose and evaluate the actual bottleneck instead of optimizing from stale proxies.",
    primary_metric: "scorecard_access_ready",
    guardrails: ["no secrets or customer-level data in logs", "no external mutation without recorded standing authority"],
    sample_gate: "scorecard_read has current exact-project evidence",
    time_gate: "recheck on every daily run until ready",
    stop_condition: "stop immediately for OTP, CAPTCHA, permission denial, or ambiguous target account",
    authority_required: REQUIRED_ACCESS_AUTHORITIES,
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
    id: "increase_qualified_landing_sessions",
    hypothesis: "Increasing message-matched qualified sessions while preserving conversion will move verified purchases toward 10 per day.",
    primary_metric: "qualified_landing_sessions_per_day",
    guardrails: ["landing-to-purchase conversion must not decline", "no spend without a cap", "fulfillment remains >= 98%"],
    sample_gate: "seven closed days or at least 200 eligible landing sessions",
    time_gate: "evaluate on rolling 3/7/14-day windows",
    stop_condition: "stop the source after two target CACs without a purchase, a 30% guardrail decline, or a paid-flow incident",
    authority_required: [],
    authority_one_of: ["publish", "paid_media"],
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

const SENSITIVE_KEY_PATTERN = /(^|_)(email|customer|reading_id|order_id|session_hash|answers?|webhook|report_json|token|secret)($|_)/i;

function assertAggregateOnly(value, path = "input") {
  if (!value || typeof value !== "object") {
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertAggregateOnly(item, `${path}[${index}]`));
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
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
    || scorecard.range?.timezone !== GOAL.timezone
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
  if (scorecard.goal?.complete === true && currentStreak < GOAL.consecutive_days) {
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

function evaluateExperiment(experiment, runDate) {
  if (!experiment) {
    return { decision: "none", reason: "no active experiment" };
  }
  const startedOn = requireDate(experiment.started_on, "active_experiment.started_on");
  const elapsedDays = Math.max(0, daysBetween(startedOn, runDate));
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
        eligible_sessions: null,
      };
    }
    return {
      decision: "continue",
      reason: "active experiment is awaiting aggregate measurement",
      measurement_status: "unavailable",
      elapsed_days: elapsedDays,
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
    return { decision: "stop", reason: "breakage reported", elapsed_days: elapsedDays, eligible_sessions: eligible };
  }
  if (eligible >= 100 && guardrailDecline >= 0.30) {
    return { decision: "stop", reason: "guardrail declined at least 30% after 100 eligible sessions", elapsed_days: elapsedDays, eligible_sessions: eligible };
  }
  if (elapsedDays < 7 || eligible < 200) {
    return { decision: "continue", reason: "seven-day and 200-session decision gate not reached", elapsed_days: elapsedDays, eligible_sessions: eligible };
  }
  if (relativeLift !== null && relativeLift >= minimumLift && guardrailDecline <= 0) {
    return { decision: "promote", reason: "primary metric improved beyond the configured lift and the guardrail did not decline", elapsed_days: elapsedDays, eligible_sessions: eligible };
  }
  if (relativeLift === null || relativeLift <= 0) {
    return { decision: "stop", reason: "primary metric did not improve after the full decision gate", elapsed_days: elapsedDays, eligible_sessions: eligible };
  }
  return { decision: "continue", reason: "primary metric improved but promotion guardrails are not yet satisfied", elapsed_days: elapsedDays, eligible_sessions: eligible };
}

function nextMilestone(runDate, rolling7, scorecard, authorityReady) {
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
  const executionScope = action.id === "complete_authority_and_scorecard_gate"
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

  const scorecard = normalizeScorecard(input.scorecard);
  const taipeiToday = new Date(Date.now() + (8 * 60 * 60 * 1000)).toISOString().slice(0, 10);
  const runDate = requireDate(input.run_date || (scorecard ? addDays(scorecard.end_date, 1) : taipeiToday), "run_date");
  if (scorecard && scorecard.end_date !== addDays(runDate, -1)) {
    throw new Error("Scorecard must end on the latest closed Asia/Taipei day");
  }
  const authority = resolveAuthority(input.authority, standingAuthority);
  const authorityPolicy = authorityPolicySummary(standingAuthority);
  const missingAuthorities = CRITICAL_AUTHORITIES.filter((key) => !authority[key]);
  const missingRequiredAccess = REQUIRED_ACCESS_AUTHORITIES.filter((key) => !authority[key]);
  const provider = input.provider || {};
  if (typeof provider.public_health_ok !== "boolean" || typeof provider.paid_flow_incident !== "boolean") {
    throw new Error("Provider health and paid-flow incident signals must be explicit booleans");
  }
  const publicHealthOk = provider.public_health_ok;
  const paidFlowIncident = provider.paid_flow_incident;

  if (!scorecard) {
    const empty = aggregateWindow([], 7);
    const accessAction = actionWithAuthority(ACTIONS.access, authority);
    return {
      schema_version: 1,
      run_date: runDate,
      status: "blocked_on_aggregate_truth",
      goal: GOAL,
      deadline: {
        days_until_streak_start_deadline: daysBetween(runDate, GOAL.streak_start_deadline),
        days_until_completion_deadline: daysBetween(runDate, GOAL.completion_deadline),
      },
      current_streak: null,
      rolling: { "3d": aggregateWindow([], 3), "7d": empty, "14d": aggregateWindow([], 14) },
      economics: providerMetrics(provider, aggregateWindow([], 3)),
      next_milestone: nextMilestone(runDate, empty, null, missingRequiredAccess.length === 0),
      primary_constraint: "access",
      constraint_evidence: ["protected aggregate scorecard is unavailable"],
      action: accessAction,
      experiment: evaluateExperiment(input.active_experiment, runDate),
      authority_policy: authorityPolicy,
      missing_authorities: missingAuthorities,
    };
  }

  const rolling3 = aggregateWindow(scorecard.days, 3);
  const rolling7 = aggregateWindow(scorecard.days, 7);
  const rolling14 = aggregateWindow(scorecard.days, 14);
  const economics = providerMetrics(provider, rolling3);
  const evidence = [];
  let constraint = "traffic";
  let action = ACTIONS.traffic;

  if (scorecard.goal.complete && scorecard.goal.current_streak >= GOAL.consecutive_days) {
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
      const requiredViewsPerDay = Math.ceil(GOAL.daily_verified_purchasers / planningRate);
      evidence.push(`${rolling7.landing_sessions_per_day ?? 0} landing sessions/day versus approximately ${requiredViewsPerDay} required at the observed/planning conversion rate`);
      action = { ...ACTIONS.traffic, required_landing_sessions_per_day: requiredViewsPerDay };
    }
  }

  return {
    schema_version: 1,
    run_date: runDate,
    status: constraint === null ? "goal_evidence_ready_for_final_audit" : "actionable",
    goal: GOAL,
    deadline: {
      days_until_streak_start_deadline: daysBetween(runDate, GOAL.streak_start_deadline),
      days_until_completion_deadline: daysBetween(runDate, GOAL.completion_deadline),
    },
    current_streak: scorecard.goal.current_streak,
    rolling: { "3d": rolling3, "7d": rolling7, "14d": rolling14 },
    economics,
    next_milestone: nextMilestone(runDate, rolling7, scorecard, missingRequiredAccess.length === 0),
    primary_constraint: constraint,
    constraint_evidence: evidence,
    action: actionWithAuthority(action, authority),
    experiment: evaluateExperiment(input.active_experiment, runDate),
    authority_policy: authorityPolicy,
    missing_authorities: missingAuthorities,
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
