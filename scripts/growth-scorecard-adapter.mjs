#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const TIMEZONE = "Asia/Taipei";
const DAILY_PURCHASER_TARGET = 10;
const STREAK_TARGET_DAYS = 30;
const PRODUCT_PRICE_USD = 9.99;
const MAX_CLOSED_DAYS = 90;

const COMMERCE_FIELDS = Object.freeze([
  "previewed_readings",
  "checkout_readings",
  "verified_purchasers",
  "verified_orders",
  "refunded_orders",
  "paid_signals_submitted",
  "paid_signal_cohort_delivered",
  "paid_signal_cohort_delivered_within_15m",
  "delivered_readings",
  "failed_readings",
]);

const FUNNEL_FIELDS = Object.freeze([
  "view_content_sessions",
  "landing_cta_clicks",
  "quiz_starts",
  "previews_revealed",
  "checkouts_created",
  "paid_signals_submitted_events",
  "share_card_generated",
  "share_card_shared",
  "share_card_link_shared",
  "share_card_downloaded",
]);

const ATTRIBUTION_FIELDS = Object.freeze([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
]);

const ALL_COUNT_FIELDS = Object.freeze([
  ...COMMERCE_FIELDS,
  "landing_sessions",
  "full_report_sessions",
  ...FUNNEL_FIELDS,
]);

const COMMERCE_KEYS = new Set(["metric_date", ...COMMERCE_FIELDS]);
const INPUT_KEYS = new Set(["start_date", "end_date", "commerce_rows", "funnel_rows"]);
const FUNNEL_KEYS = new Set([
  "metric_date",
  "page",
  ...ATTRIBUTION_FIELDS,
  "page_view_sessions",
  ...FUNNEL_FIELDS,
]);
const SENSITIVE_KEY_PATTERN = /(^|_)(email|customer|reading_id|order_id|session_hash|answers?|webhook|report_json|token|secret)($|_)/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const LABEL_PATTERN = /^[A-Za-z0-9._~:+-]+$/;

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

function requireObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value;
}

function assertAllowedKeys(row, allowed, label) {
  for (const key of Object.keys(row)) {
    if (!allowed.has(key)) {
      throw new Error(`${label} contains unknown field: ${key}`);
    }
  }
}

function requireDate(value, label) {
  const date = String(value || "");
  if (!DATE_PATTERN.test(date) || new Date(`${date}T00:00:00.000Z`).toISOString().slice(0, 10) !== date) {
    throw new Error(`Invalid ${label}`);
  }
  return date;
}

function addDays(date, delta) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + delta);
  return value.toISOString().slice(0, 10);
}

function closedDates(startDate, endDate) {
  const dates = [];
  for (let date = startDate; date <= endDate; date = addDays(date, 1)) {
    dates.push(date);
    if (dates.length > MAX_CLOSED_DAYS) {
      throw new Error(`Scorecard range exceeds ${MAX_CLOSED_DAYS} closed days`);
    }
  }
  if (!dates.length) {
    throw new Error("Scorecard start_date must not be after end_date");
  }
  return dates;
}

function requireCount(value, label) {
  const normalized = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
  if (!Number.isSafeInteger(normalized) || normalized < 0) {
    throw new Error(`Invalid aggregate count: ${label}`);
  }
  return normalized;
}

function nullableLabel(value, label) {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "string" || value.length < 1 || value.length > 120 || !LABEL_PATTERN.test(value)) {
    throw new Error(`Invalid aggregate label: ${label}`);
  }
  return value;
}

function ratio(numerator, denominator) {
  return denominator > 0 ? Number((numerator / denominator).toFixed(4)) : null;
}

function money(value) {
  return Number(value.toFixed(2));
}

function normalizeDay(day) {
  const normalized = { ...day };
  normalized.estimated_gross_usd = money(normalized.verified_orders * PRODUCT_PRICE_USD);
  normalized.paid_signal_delivery_rate = ratio(
    normalized.paid_signal_cohort_delivered,
    normalized.paid_signals_submitted,
  );
  normalized.delivery_within_15m_rate = ratio(
    normalized.paid_signal_cohort_delivered_within_15m,
    normalized.paid_signals_submitted,
  );
  normalized.qualifies_for_daily_goal = normalized.verified_purchasers >= DAILY_PURCHASER_TARGET;
  return normalized;
}

function calculateStreak(days, endDate) {
  let expectedDate = endDate;
  let streakDays = 0;
  let startDate = null;
  let latestQualifyingDate = null;
  for (let index = days.length - 1; index >= 0; index -= 1) {
    const day = days[index];
    if (day.date !== expectedDate || !day.qualifies_for_daily_goal) {
      break;
    }
    latestQualifyingDate ||= day.date;
    startDate = day.date;
    streakDays += 1;
    expectedDate = addDays(expectedDate, -1);
  }
  return { days: streakDays, startDate, latestQualifyingDate };
}

export function buildGrowthScorecard(input) {
  assertAggregateOnly(input);
  requireObject(input, "input");
  assertAllowedKeys(input, INPUT_KEYS, "input");
  const startDate = requireDate(input.start_date, "start_date");
  const endDate = requireDate(input.end_date, "end_date");
  const dates = closedDates(startDate, endDate);
  if (!Array.isArray(input.commerce_rows) || !Array.isArray(input.funnel_rows)) {
    throw new Error("commerce_rows and funnel_rows must be arrays");
  }

  const daily = new Map(dates.map((date) => [date, {
    date,
    ...Object.fromEntries(COMMERCE_FIELDS.map((field) => [field, 0])),
    landing_sessions: 0,
    full_report_sessions: 0,
    ...Object.fromEntries(FUNNEL_FIELDS.map((field) => [field, 0])),
  }]));

  const commerceDates = new Set();
  input.commerce_rows.forEach((rawRow, index) => {
    const row = requireObject(rawRow, `commerce_rows[${index}]`);
    assertAllowedKeys(row, COMMERCE_KEYS, `commerce_rows[${index}]`);
    const date = requireDate(row.metric_date, `commerce_rows[${index}].metric_date`);
    if (!daily.has(date)) {
      throw new Error(`Commerce row date is outside the requested range: ${date}`);
    }
    if (commerceDates.has(date)) {
      throw new Error(`Duplicate commerce row for ${date}`);
    }
    commerceDates.add(date);
    const day = daily.get(date);
    for (const field of COMMERCE_FIELDS) {
      day[field] = requireCount(row[field], `commerce_rows[${index}].${field}`);
    }
  });
  for (const date of dates) {
    if (!commerceDates.has(date)) {
      throw new Error(`Missing commerce row for closed day ${date}`);
    }
  }

  const attribution = [];
  const attributionKeys = new Set();
  input.funnel_rows.forEach((rawRow, index) => {
    const row = requireObject(rawRow, `funnel_rows[${index}]`);
    assertAllowedKeys(row, FUNNEL_KEYS, `funnel_rows[${index}]`);
    const date = requireDate(row.metric_date, `funnel_rows[${index}].metric_date`);
    if (!daily.has(date)) {
      throw new Error(`Funnel row date is outside the requested range: ${date}`);
    }
    if (row.page !== "landing" && row.page !== "full_report") {
      throw new Error(`Invalid funnel page at funnel_rows[${index}].page`);
    }
    const labels = Object.fromEntries(
      ATTRIBUTION_FIELDS.map((field) => [field, nullableLabel(row[field], `funnel_rows[${index}].${field}`)]),
    );
    const attributionKey = JSON.stringify([date, row.page, ...ATTRIBUTION_FIELDS.map((field) => labels[field])]);
    if (attributionKeys.has(attributionKey)) {
      throw new Error(`Duplicate funnel attribution row for ${date} ${row.page}`);
    }
    attributionKeys.add(attributionKey);

    const pageViews = requireCount(row.page_view_sessions, `funnel_rows[${index}].page_view_sessions`);
    const funnelCounts = Object.fromEntries(
      FUNNEL_FIELDS.map((field) => [field, requireCount(row[field], `funnel_rows[${index}].${field}`)]),
    );
    const day = daily.get(date);
    day[row.page === "landing" ? "landing_sessions" : "full_report_sessions"] += pageViews;
    for (const field of FUNNEL_FIELDS) {
      day[field] += funnelCounts[field];
    }

    if (Object.values(labels).some(Boolean)) {
      attribution.push({
        date,
        page: row.page,
        ...labels,
        page_view_sessions: pageViews,
        ...funnelCounts,
      });
    }
  });

  const days = [...daily.values()].map(normalizeDay);
  const totals = Object.fromEntries(ALL_COUNT_FIELDS.map((field) => [field, 0]));
  for (const day of days) {
    for (const field of ALL_COUNT_FIELDS) {
      totals[field] += day[field];
    }
  }
  totals.estimated_gross_usd = money(totals.verified_orders * PRODUCT_PRICE_USD);
  totals.paid_signal_delivery_rate = ratio(
    totals.paid_signal_cohort_delivered,
    totals.paid_signals_submitted,
  );
  totals.delivery_within_15m_rate = ratio(
    totals.paid_signal_cohort_delivered_within_15m,
    totals.paid_signals_submitted,
  );

  const streak = calculateStreak(days, endDate);
  attribution.sort((left, right) => (
    left.date.localeCompare(right.date)
    || left.page.localeCompare(right.page)
    || String(left.utm_source || "").localeCompare(String(right.utm_source || ""))
    || String(left.utm_campaign || "").localeCompare(String(right.utm_campaign || ""))
    || String(left.utm_content || "").localeCompare(String(right.utm_content || ""))
  ));

  return {
    ok: true,
    source: "supabase_verified_lemon_state_and_first_party_funnel",
    privacy: "aggregate_counts_only",
    range: {
      timezone: TIMEZONE,
      start_date: startDate,
      end_date: endDate,
      closed_days: dates.length,
    },
    goal: {
      daily_verified_purchasers: DAILY_PURCHASER_TARGET,
      consecutive_days: STREAK_TARGET_DAYS,
      current_streak: streak.days,
      streak_start_date: streak.startDate,
      latest_qualifying_date: streak.latestQualifyingDate,
      qualifying_days_in_range: days.filter((day) => day.qualifies_for_daily_goal).length,
      complete: streak.days >= STREAK_TARGET_DAYS,
    },
    totals,
    days,
    attribution,
    limitations: [
      "Estimated gross uses the fixed USD 9.99 list price and is not settled revenue.",
      "First-party session counts are diagnostic aggregates; verified purchases remain webhook-backed Supabase state.",
    ],
  };
}

async function readInput(path) {
  if (!path) {
    throw new Error("Usage: node scripts/growth-scorecard-adapter.mjs --input <aggregate-rpc-json-file>");
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
  process.stdout.write(`${JSON.stringify(buildGrowthScorecard(input), null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`growth-scorecard-adapter: ${error.message}\n`);
    process.exitCode = 2;
  });
}
