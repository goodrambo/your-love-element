import assert from "node:assert/strict";
import test from "node:test";

import {
  fetchGscPerformance,
  GSC_API_ORIGIN,
  GSC_PROPERTY,
} from "../fetch-gsc-performance.mjs";
import { evaluateGrowthControl } from "../growth-control.mjs";

function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}

test("fetches only exact-property final web performance and emits aggregate counts", async () => {
  const requests = [];
  const result = await fetchGscPerformance({
    accessToken: "test-only-token",
    startDate: "2026-08-01",
    endDate: "2026-08-03",
    fetchedOn: "2026-08-05",
    fetchImpl: async (url, options) => {
      requests.push({ url: String(url), options });
      return jsonResponse({
        responseAggregationType: "byProperty",
        rows: [
          { keys: ["2026-08-01"], clicks: 1001, impressions: 5000, ctr: 0.2, position: 2.5 },
          { keys: ["2026-08-03"], clicks: 7, impressions: 40, ctr: 0.175, position: 4 },
        ],
      });
    },
  });

  assert.equal(requests.length, 1);
  assert.equal(GSC_API_ORIGIN, "https://www.googleapis.com");
  assert.equal(
    requests[0].url,
    "https://www.googleapis.com/webmasters/v3/sites/sc-domain%3Ayourloveelement.com/searchAnalytics/query",
  );
  assert.equal(requests[0].options.method, "POST");
  assert.equal(requests[0].options.redirect, "error");
  assert.equal(requests[0].options.headers.authorization, "Bearer test-only-token");
  assert.deepEqual(JSON.parse(requests[0].options.body), {
    startDate: "2026-08-01",
    endDate: "2026-08-03",
    dimensions: ["date"],
    type: "web",
    dataState: "final",
    aggregationType: "byProperty",
    rowLimit: 25000,
  });
  assert.deepEqual(result, {
    property: GSC_PROPERTY,
    source: "google_search_console_performance",
    search_type: "web",
    aggregation: "property",
    data_state: "final",
    timezone: "America/Los_Angeles",
    privacy: "aggregate_counts_only",
    fetched_on: "2026-08-05",
    start_date: "2026-08-01",
    end_date: "2026-08-03",
    days: [
      { date: "2026-08-01", clicks: 1001, impressions: 5000 },
      { date: "2026-08-02", clicks: 0, impressions: 0 },
      { date: "2026-08-03", clicks: 7, impressions: 40 },
    ],
  });
  assert.equal(JSON.stringify(result).includes("test-only-token"), false);
});

test("produces an evaluator-compatible Stage 1 aggregate", async () => {
  const aggregate = await fetchGscPerformance({
    accessToken: "test-only-token",
    startDate: "2026-08-01",
    endDate: "2026-08-03",
    fetchedOn: "2026-08-05",
    fetchImpl: async () => jsonResponse({
      responseAggregationType: "byProperty",
      rows: [
        { keys: ["2026-08-01"], clicks: 1001, impressions: 5000 },
        { keys: ["2026-08-02"], clicks: 1001, impressions: 5000 },
        { keys: ["2026-08-03"], clicks: 1001, impressions: 5000 },
      ],
    }),
  });
  const decision = evaluateGrowthControl({
    run_date: "2026-08-05",
    search_console: aggregate,
    scorecard: null,
    authority: { gsc_read: true },
    provider: { public_health_ok: true, paid_flow_incident: false },
  });
  assert.equal(decision.traffic.latest_final_date, "2026-08-03");
  assert.equal(decision.traffic.current_streak, 3);
});

test("requires token and exact real dates before making a request", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return jsonResponse({ rows: [] });
  };
  await assert.rejects(
    fetchGscPerformance({ accessToken: "", startDate: "2026-08-01", endDate: "2026-08-03", fetchedOn: "2026-08-05", fetchImpl }),
    /GSC_ACCESS_TOKEN is required/,
  );
  await assert.rejects(
    fetchGscPerformance({ accessToken: "test", startDate: "2026-02-30", endDate: "2026-08-03", fetchedOn: "2026-08-05", fetchImpl }),
    /real calendar date/,
  );
  await assert.rejects(
    fetchGscPerformance({ accessToken: "test", startDate: "2026-08-03", endDate: "2026-08-05", fetchedOn: "2026-08-05", fetchImpl }),
    /end-date must precede fetched-on/,
  );
  assert.equal(calls, 0);
});

test("fails once on exact-property authorization or availability errors", async () => {
  for (const [status, message] of [
    [401, /authorization was rejected/],
    [403, /authorization was rejected/],
    [404, /sc-domain:yourloveelement.com/],
  ]) {
    let calls = 0;
    await assert.rejects(
      fetchGscPerformance({
        accessToken: "test",
        startDate: "2026-08-01",
        endDate: "2026-08-03",
        fetchedOn: "2026-08-05",
        fetchImpl: async () => {
          calls += 1;
          return new Response("private response must remain hidden", { status });
        },
      }),
      message,
    );
    assert.equal(calls, 1);
  }
});

test("rejects detailed, malformed, duplicate, or non-property response rows", async () => {
  const cases = [
    [{ responseAggregationType: "byPage", rows: [] }, /not property-aggregated/],
    [{ diagnostic: true, rows: [] }, /unknown field/],
    [{ rows: [{ keys: ["2026-08-01"], clicks: 1, impressions: 1, query: "forbidden" }] }, /unknown field/],
    [{ rows: [{ keys: ["2026-08-01", "query"], clicks: 1, impressions: 1 }] }, /only the date dimension/],
    [{ rows: [{ keys: ["2026-08-01"], clicks: 1.5, impressions: 1 }] }, /non-negative integer/],
    [{ rows: [
      { keys: ["2026-08-01"], clicks: 1, impressions: 1 },
      { keys: ["2026-08-01"], clicks: 2, impressions: 2 },
    ] }, /duplicate date/],
  ];
  for (const [body, message] of cases) {
    await assert.rejects(
      fetchGscPerformance({
        accessToken: "test",
        startDate: "2026-08-01",
        endDate: "2026-08-03",
        fetchedOn: "2026-08-05",
        fetchImpl: async () => jsonResponse(body),
      }),
      message,
    );
  }
});

test("rejects non-JSON success responses and never prints the token", async () => {
  await assert.rejects(
    fetchGscPerformance({
      accessToken: "sensitive-test-token",
      startDate: "2026-08-01",
      endDate: "2026-08-03",
      fetchedOn: "2026-08-05",
      fetchImpl: async () => new Response("not json", {
        status: 200,
        headers: { "content-type": "text/plain" },
      }),
    }),
    (error) => /not JSON/.test(error.message) && !error.message.includes("sensitive-test-token"),
  );
});
