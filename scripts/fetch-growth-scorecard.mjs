#!/usr/bin/env node

import { pathToFileURL } from "node:url";

export const GROWTH_SCORECARD_ORIGIN = "https://your-love-element-api.goodrambo2013.workers.dev";

const TOP_LEVEL_FIELDS = new Set([
  "ok",
  "source",
  "privacy",
  "range",
  "goal",
  "totals",
  "days",
  "attribution",
  "limitations",
]);
const SENSITIVE_KEY_PATTERN = /(^|_)(email|customer|reading_id|order_id|session_hash|answers?|webhook|report_json|token|secret)($|_)/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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
  if (
    scorecard.ok !== true
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
