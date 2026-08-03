#!/usr/bin/env node

import { pathToFileURL } from "node:url";

export const GROWTH_SCORECARD_ORIGIN = "https://your-love-element-api.goodrambo2013.workers.dev";

const TOP_LEVEL_FIELDS = new Set([
  "ok",
  "generated_at",
  "source",
  "privacy",
  "range",
  "goal",
  "totals",
  "days",
  "attribution",
  "limitations",
]);
const RANGE_FIELDS = new Set(["timezone", "start_date", "end_date", "closed_days"]);
const GOAL_FIELDS = new Set([
  "daily_verified_purchasers",
  "consecutive_days",
  "current_streak",
  "streak_start_date",
  "latest_qualifying_date",
  "qualifying_days_in_range",
  "complete",
]);
const COUNT_FIELDS = [
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
  "landing_sessions",
  "full_report_sessions",
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
];
const TOTAL_FIELDS = new Set([
  ...COUNT_FIELDS,
  "estimated_gross_usd",
  "paid_signal_delivery_rate",
  "delivery_within_15m_rate",
]);
const DAY_FIELDS = new Set([
  "date",
  ...TOTAL_FIELDS,
  "qualifies_for_daily_goal",
]);
const ATTRIBUTION_FIELDS = new Set([
  "date",
  "page",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "page_view_sessions",
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
const SENSITIVE_KEY_PATTERN = /(^|_)(email|customer|reading_id|order_id|session_hash|answers?|webhook|report_json|token|secret)($|_)/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function requireDate(value, label) {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) {
    throw new Error(`${label} must use YYYY-MM-DD`);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`${label} must be a real calendar date`);
  }
  return value;
}

function requireDays(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 90) {
    throw new Error("days must be an integer from 1 to 90");
  }
  return parsed;
}

function assertNoSensitiveKeys(value, path = "scorecard") {
  if (!value || typeof value !== "object") {
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSensitiveKeys(item, `${path}[${index}]`));
    return;
  }
  for (const [key, nested] of Object.entries(value)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      throw new Error(`scorecard contains forbidden field at ${path}.${key}`);
    }
    assertNoSensitiveKeys(nested, `${path}.${key}`);
  }
}

function assertKnownObjectFields(value, allowedFields, path) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("scorecard response does not match the aggregate contract");
  }
  for (const key of Object.keys(value)) {
    if (!allowedFields.has(key)) {
      throw new Error(`scorecard contains unknown field at ${path}.${key}`);
    }
  }
}

function assertAggregateContract(scorecard, endDate) {
  if (!scorecard || typeof scorecard !== "object" || Array.isArray(scorecard)) {
    throw new Error("scorecard response must be an object");
  }
  assertNoSensitiveKeys(scorecard);
  for (const key of Object.keys(scorecard)) {
    if (!TOP_LEVEL_FIELDS.has(key)) {
      throw new Error(`scorecard contains unknown top-level field ${key}`);
    }
  }
  const generatedAt = typeof scorecard.generated_at === "string"
    ? new Date(scorecard.generated_at)
    : null;
  if (
    scorecard.ok !== true
    || !ISO_TIMESTAMP_PATTERN.test(scorecard.generated_at)
    || Number.isNaN(generatedAt?.getTime())
    || generatedAt?.toISOString() !== scorecard.generated_at
    || scorecard.source !== "supabase_verified_lemon_state_and_first_party_funnel"
    || scorecard.privacy !== "aggregate_counts_only"
    || scorecard.range?.timezone !== "Asia/Taipei"
    || scorecard.range?.end_date !== endDate
    || !scorecard.goal
    || typeof scorecard.goal !== "object"
    || !scorecard.totals
    || typeof scorecard.totals !== "object"
    || !Array.isArray(scorecard.days)
    || !Array.isArray(scorecard.attribution)
    || !Array.isArray(scorecard.limitations)
  ) {
    throw new Error("scorecard response does not match the aggregate contract");
  }
  assertKnownObjectFields(scorecard.range, RANGE_FIELDS, "scorecard.range");
  assertKnownObjectFields(scorecard.goal, GOAL_FIELDS, "scorecard.goal");
  assertKnownObjectFields(scorecard.totals, TOTAL_FIELDS, "scorecard.totals");
  scorecard.days.forEach((day, index) => {
    assertKnownObjectFields(day, DAY_FIELDS, `scorecard.days[${index}]`);
  });
  scorecard.attribution.forEach((row, index) => {
    assertKnownObjectFields(row, ATTRIBUTION_FIELDS, `scorecard.attribution[${index}]`);
  });
  if (scorecard.limitations.some((limitation) => typeof limitation !== "string")) {
    throw new Error("scorecard response does not match the aggregate contract");
  }
}

export async function fetchGrowthScorecard({ secret, endDate, days = 45, fetchImpl = globalThis.fetch }) {
  if (typeof secret !== "string" || secret.length === 0) {
    throw new Error("JOB_RUNNER_SECRET is required");
  }
  if (typeof fetchImpl !== "function") {
    throw new Error("fetch is unavailable");
  }
  const normalizedEndDate = requireDate(endDate, "end-date");
  const normalizedDays = requireDays(days);
  const url = new URL("/api/admin/growth-metrics", GROWTH_SCORECARD_ORIGIN);
  url.searchParams.set("days", String(normalizedDays));
  url.searchParams.set("end_date", normalizedEndDate);

  const response = await fetchImpl(url, {
    method: "GET",
    redirect: "error",
    headers: {
      accept: "application/json",
      authorization: `Bearer ${secret}`,
    },
  });
  if (response.status === 401) {
    throw new Error("scorecard authorization was rejected");
  }
  if (response.status === 404) {
    throw new Error("scorecard route is not deployed");
  }
  if (!response.ok) {
    throw new Error(`scorecard request failed with HTTP ${response.status}`);
  }

  const cacheControl = response.headers.get("cache-control")?.toLowerCase() || "";
  if (!cacheControl.includes("private") || !cacheControl.includes("no-store")) {
    throw new Error("scorecard response is missing private, no-store cache controls");
  }
  if (response.headers.get("access-control-allow-origin") !== null) {
    throw new Error("scorecard response unexpectedly permits browser CORS");
  }
  const contentType = response.headers.get("content-type")?.toLowerCase() || "";
  if (!contentType.includes("application/json")) {
    throw new Error("scorecard response is not JSON");
  }

  let scorecard;
  try {
    scorecard = await response.json();
  } catch {
    throw new Error("scorecard response contains invalid JSON");
  }
  assertAggregateContract(scorecard, normalizedEndDate);
  return scorecard;
}

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if ((flag !== "--days" && flag !== "--end-date") || value === undefined) {
      throw new Error("Usage: node scripts/fetch-growth-scorecard.mjs --days <1-90> --end-date <YYYY-MM-DD>");
    }
    values[flag] = value;
  }
  if (!values["--end-date"]) {
    throw new Error("Usage: node scripts/fetch-growth-scorecard.mjs --days <1-90> --end-date <YYYY-MM-DD>");
  }
  return { days: values["--days"] ?? 45, endDate: values["--end-date"] };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const scorecard = await fetchGrowthScorecard({
    secret: process.env.JOB_RUNNER_SECRET,
    ...options,
  });
  process.stdout.write(`${JSON.stringify(scorecard, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`growth-scorecard-fetch: ${error.message}\n`);
    process.exitCode = 2;
  });
}
