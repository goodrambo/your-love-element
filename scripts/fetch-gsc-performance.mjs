#!/usr/bin/env node

import { pathToFileURL } from "node:url";

export const GSC_PROPERTY = "sc-domain:yourloveelement.com";
export const GSC_API_ORIGIN = "https://www.googleapis.com";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const RESPONSE_FIELDS = new Set(["rows", "responseAggregationType"]);
const ROW_FIELDS = new Set(["keys", "clicks", "impressions", "ctr", "position"]);

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

function dateRange(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  if (start > end) {
    throw new Error("start-date must not follow end-date");
  }
  const dates = [];
  for (let cursor = start; cursor <= end; cursor = new Date(cursor.getTime() + 86_400_000)) {
    dates.push(cursor.toISOString().slice(0, 10));
  }
  if (dates.length > 90) {
    throw new Error("Search Console range must not exceed 90 days");
  }
  return dates;
}

function requireCount(value, label) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  return value;
}

function assertKnownFields(value, allowed, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new Error(`${label} contains unknown field: ${key}`);
    }
  }
}

function normalizeResponse(responseBody, dates) {
  assertKnownFields(responseBody, RESPONSE_FIELDS, "Search Console response");
  if (
    responseBody.responseAggregationType !== undefined
    && responseBody.responseAggregationType !== "byProperty"
  ) {
    throw new Error("Search Console response is not property-aggregated");
  }
  const rows = responseBody.rows ?? [];
  if (!Array.isArray(rows)) {
    throw new Error("Search Console response rows must be an array");
  }
  const allowedDates = new Set(dates);
  const metricsByDate = new Map();
  rows.forEach((row, index) => {
    assertKnownFields(row, ROW_FIELDS, `Search Console row ${index}`);
    if (!Array.isArray(row.keys) || row.keys.length !== 1) {
      throw new Error(`Search Console row ${index} must contain only the date dimension`);
    }
    const date = requireDate(row.keys[0], `Search Console row ${index} date`);
    if (!allowedDates.has(date)) {
      throw new Error(`Search Console row ${index} falls outside the requested range`);
    }
    if (metricsByDate.has(date)) {
      throw new Error(`Search Console response contains duplicate date ${date}`);
    }
    metricsByDate.set(date, {
      date,
      clicks: requireCount(row.clicks, `Search Console row ${index} clicks`),
      impressions: requireCount(row.impressions, `Search Console row ${index} impressions`),
    });
  });
  return dates.map((date) => metricsByDate.get(date) ?? { date, clicks: 0, impressions: 0 });
}

export async function fetchGscPerformance({
  accessToken,
  startDate,
  endDate,
  fetchedOn,
  fetchImpl = globalThis.fetch,
}) {
  if (typeof accessToken !== "string" || accessToken.length === 0) {
    throw new Error("GSC_ACCESS_TOKEN is required");
  }
  if (typeof fetchImpl !== "function") {
    throw new Error("fetch is unavailable");
  }
  const normalizedStartDate = requireDate(startDate, "start-date");
  const normalizedEndDate = requireDate(endDate, "end-date");
  const normalizedFetchedOn = requireDate(fetchedOn, "fetched-on");
  const dates = dateRange(normalizedStartDate, normalizedEndDate);
  if (normalizedEndDate >= normalizedFetchedOn) {
    throw new Error("end-date must precede fetched-on");
  }

  const url = new URL(
    `/webmasters/v3/sites/${encodeURIComponent(GSC_PROPERTY)}/searchAnalytics/query`,
    GSC_API_ORIGIN,
  );
  const body = {
    startDate: normalizedStartDate,
    endDate: normalizedEndDate,
    dimensions: ["date"],
    type: "web",
    dataState: "final",
    aggregationType: "byProperty",
    rowLimit: 25000,
  };
  const response = await fetchImpl(url, {
    method: "POST",
    redirect: "error",
    headers: {
      accept: "application/json",
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (response.status === 401 || response.status === 403) {
    throw new Error("Search Console authorization was rejected");
  }
  if (response.status === 404) {
    throw new Error(`Search Console exact property is unavailable: ${GSC_PROPERTY}`);
  }
  if (!response.ok) {
    throw new Error(`Search Console request failed with HTTP ${response.status}`);
  }
  const contentType = response.headers.get("content-type")?.toLowerCase() || "";
  if (!contentType.includes("application/json")) {
    throw new Error("Search Console response is not JSON");
  }
  let responseBody;
  try {
    responseBody = await response.json();
  } catch {
    throw new Error("Search Console response contains invalid JSON");
  }
  const days = normalizeResponse(responseBody, dates);
  return {
    property: GSC_PROPERTY,
    source: "google_search_console_performance",
    search_type: "web",
    aggregation: "property",
    data_state: "final",
    timezone: "America/Los_Angeles",
    privacy: "aggregate_counts_only",
    fetched_on: normalizedFetchedOn,
    start_date: normalizedStartDate,
    end_date: normalizedEndDate,
    days,
  };
}

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!["--start-date", "--end-date", "--fetched-on"].includes(flag) || value === undefined) {
      throw new Error("Usage: node scripts/fetch-gsc-performance.mjs --start-date <YYYY-MM-DD> --end-date <YYYY-MM-DD> --fetched-on <YYYY-MM-DD>");
    }
    values[flag] = value;
  }
  if (!values["--start-date"] || !values["--end-date"] || !values["--fetched-on"]) {
    throw new Error("Usage: node scripts/fetch-gsc-performance.mjs --start-date <YYYY-MM-DD> --end-date <YYYY-MM-DD> --fetched-on <YYYY-MM-DD>");
  }
  return {
    startDate: values["--start-date"],
    endDate: values["--end-date"],
    fetchedOn: values["--fetched-on"],
  };
}

async function main() {
  const aggregate = await fetchGscPerformance({
    accessToken: process.env.GSC_ACCESS_TOKEN,
    ...parseArgs(process.argv.slice(2)),
  });
  process.stdout.write(`${JSON.stringify(aggregate, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`gsc-performance-fetch: ${error.message}\n`);
    process.exitCode = 2;
  });
}
