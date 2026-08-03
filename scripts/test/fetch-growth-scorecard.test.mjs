import assert from "node:assert/strict";
import test from "node:test";

import { fetchGrowthScorecard, GROWTH_SCORECARD_ORIGIN } from "../fetch-growth-scorecard.mjs";
import worker from "../../worker/src/index.js";

function commerceRow(metricDate, verifiedPurchasers = 0) {
  return {
    metric_date: metricDate,
    previewed_readings: "0",
    checkout_readings: "0",
    verified_purchasers: String(verifiedPurchasers),
    verified_orders: String(verifiedPurchasers),
    refunded_orders: "0",
    paid_signals_submitted: "0",
    paid_signal_cohort_delivered: "0",
    paid_signal_cohort_delivered_within_15m: "0",
    delivered_readings: "0",
    failed_readings: "0",
  };
}

function funnelRow(metricDate, pageViewSessions) {
  return {
    metric_date: metricDate,
    page: "landing",
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    utm_content: null,
    utm_term: null,
    page_view_sessions: String(pageViewSessions),
    view_content_sessions: String(pageViewSessions),
    landing_cta_clicks: "0",
    quiz_starts: "0",
    previews_revealed: "0",
    checkouts_created: "0",
    paid_signals_submitted_events: "0",
    share_card_generated: "0",
    share_card_shared: "0",
    share_card_link_shared: "0",
    share_card_downloaded: "0",
  };
}

function scorecard(overrides = {}) {
  return {
    ok: true,
    generated_at: "2026-08-01T00:00:00.000Z",
    source: "supabase_verified_lemon_state_and_first_party_funnel",
    privacy: "aggregate_counts_only",
    range: {
      timezone: "Asia/Taipei",
      start_date: "2026-07-01",
      end_date: "2026-07-31",
      closed_days: 31,
    },
    goal: { current_streak: 0, complete: false },
    totals: { verified_purchasers: 0 },
    days: [],
    attribution: [],
    limitations: ["aggregate only"],
    ...overrides,
  };
}

function jsonResponse(body, overrides = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "cache-control": "private, no-store",
      "content-type": "application/json; charset=utf-8",
      ...overrides,
    },
  });
}

test("fetches only the exact Worker aggregate route without exposing the secret", async () => {
  const requests = [];
  const result = await fetchGrowthScorecard({
    secret: "test-only-secret",
    days: 45,
    endDate: "2026-07-31",
    fetchImpl: async (url, options) => {
      requests.push({ url: String(url), options });
      return jsonResponse(scorecard());
    },
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, `${GROWTH_SCORECARD_ORIGIN}/api/admin/growth-metrics?days=45&end_date=2026-07-31`);
  assert.equal(requests[0].options.method, "GET");
  assert.equal(requests[0].options.redirect, "error");
  assert.equal(requests[0].options.headers.authorization, "Bearer test-only-secret");
  assert.equal(JSON.stringify(result).includes("test-only-secret"), false);
  assert.equal(result.range.end_date, "2026-07-31");
});

test("fetcher accepts the protected Worker aggregate contract end to end", async () => {
  const originalFetch = globalThis.fetch;
  const rpcRequests = [];
  globalThis.fetch = async (url, options) => {
    const value = String(url);
    rpcRequests.push({ value, body: JSON.parse(options.body) });
    if (value.endsWith("/rest/v1/rpc/get_growth_scorecard")) {
      return jsonResponse([
        commerceRow("2026-07-30"),
        commerceRow("2026-07-31", 1),
      ]);
    }
    if (value.endsWith("/rest/v1/rpc/get_first_party_funnel_scorecard")) {
      return jsonResponse([
        funnelRow("2026-07-30", 3),
        funnelRow("2026-07-31", 4),
      ]);
    }
    throw new Error(`Unexpected mocked RPC request: ${value}`);
  };

  try {
    const result = await fetchGrowthScorecard({
      secret: "test-growth-secret",
      days: 2,
      endDate: "2026-07-31",
      fetchImpl: (url, options) => worker.fetch(new Request(url, options), {
        JOB_RUNNER_SECRET: "test-growth-secret",
        SUPABASE_URL: "https://database.example.test",
        SUPABASE_SERVICE_ROLE_KEY: "test-service-role",
      }),
    });

    assert.deepEqual(result.range, {
      timezone: "Asia/Taipei",
      start_date: "2026-07-30",
      end_date: "2026-07-31",
      closed_days: 2,
    });
    assert.equal(result.totals.verified_purchasers, 1);
    assert.equal(result.totals.landing_sessions, 7);
    assert.deepEqual(new Set(rpcRequests.map(({ value }) => value)), new Set([
      "https://database.example.test/rest/v1/rpc/get_growth_scorecard",
      "https://database.example.test/rest/v1/rpc/get_first_party_funnel_scorecard",
    ]));
    for (const { body } of rpcRequests) {
      assert.deepEqual(body, {
        p_start_date: "2026-07-30",
        p_end_date: "2026-07-31",
      });
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("requires a secret and explicit real closed-day date before any request", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return jsonResponse(scorecard());
  };

  await assert.rejects(
    fetchGrowthScorecard({ secret: "", endDate: "2026-07-31", fetchImpl }),
    /JOB_RUNNER_SECRET is required/,
  );
  await assert.rejects(
    fetchGrowthScorecard({ secret: "test", endDate: "2026-02-30", fetchImpl }),
    /real calendar date/,
  );
  assert.equal(calls, 0);
});

test("fails once on authorization or missing route without returning a response body", async () => {
  for (const [status, message] of [[401, /authorization was rejected/], [404, /route is not deployed/]]) {
    let calls = 0;
    await assert.rejects(
      fetchGrowthScorecard({
        secret: "test",
        endDate: "2026-07-31",
        fetchImpl: async () => {
          calls += 1;
          return new Response("private response must stay hidden", { status });
        },
      }),
      message,
    );
    assert.equal(calls, 1);
  }
});

test("rejects sensitive or unknown response fields", async () => {
  for (const [body, message] of [
    [scorecard({ customer_email: "hidden@example.test" }), /forbidden field/],
    [scorecard({ diagnostic: true }), /unknown top-level field/],
    [scorecard({ generated_at: "yesterday" }), /aggregate contract/],
    [scorecard({ generated_at: undefined }), /aggregate contract/],
  ]) {
    await assert.rejects(
      fetchGrowthScorecard({
        secret: "test",
        endDate: "2026-07-31",
        fetchImpl: async () => jsonResponse(body),
      }),
      message,
    );
  }
});

test("rejects a response that is cacheable, browser-readable, or for another day", async () => {
  const scenarios = [
    [jsonResponse(scorecard(), { "cache-control": "public, max-age=60" }), /private, no-store/],
    [jsonResponse(scorecard(), { "access-control-allow-origin": "*" }), /browser CORS/],
    [jsonResponse(scorecard({ range: { ...scorecard().range, end_date: "2026-07-30" } })), /aggregate contract/],
  ];
  for (const [response, message] of scenarios) {
    await assert.rejects(
      fetchGrowthScorecard({
        secret: "test",
        endDate: "2026-07-31",
        fetchImpl: async () => response,
      }),
      message,
    );
  }
});
