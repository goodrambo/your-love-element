import assert from "node:assert/strict";
import test from "node:test";

import { fetchGrowthScorecard, GROWTH_SCORECARD_ORIGIN } from "../fetch-growth-scorecard.mjs";

function scorecard(overrides = {}) {
  return {
    ok: true,
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
