import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import worker from "../src/index.js";
import { buildGrowthScorecard } from "../../scripts/growth-scorecard-adapter.mjs";

const COUNT_FIELDS = {
  previewed_readings: "100",
  checkout_readings: "20",
  verified_orders: "10",
  refunded_orders: "0",
  paid_signals_submitted: "8",
  paid_signal_cohort_delivered: "8",
  paid_signal_cohort_delivered_within_15m: "7",
  delivered_readings: "8",
  failed_readings: "0",
};

function scorecardRow(metricDate, verifiedPurchasers, overrides = {}) {
  return {
    metric_date: metricDate,
    ...COUNT_FIELDS,
    verified_purchasers: String(verifiedPurchasers),
    ...overrides,
  };
}

function funnelRow(metricDate, overrides = {}) {
  return {
    metric_date: metricDate,
    page: "landing",
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    utm_content: null,
    utm_term: null,
    page_view_sessions: "100",
    view_content_sessions: "90",
    landing_cta_clicks: "40",
    quiz_starts: "30",
    previews_revealed: "20",
    checkouts_created: "10",
    paid_signals_submitted_events: "0",
    share_card_generated: "15",
    share_card_shared: "2",
    share_card_link_shared: "1",
    share_card_downloaded: "3",
    ...overrides,
  };
}

function scorecardFetch(commerceRows, funnelRows = []) {
  return async (url, options) => {
    const value = String(url);
    if (value.endsWith("/rest/v1/rpc/get_growth_scorecard")) {
      return new Response(JSON.stringify(commerceRows), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (value.endsWith("/rest/v1/rpc/get_first_party_funnel_scorecard")) {
      return new Response(JSON.stringify(funnelRows), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    throw new Error(`Unexpected request: ${value} ${options?.method || "GET"}`);
  };
}

function env() {
  return {
    JOB_RUNNER_SECRET: "test-growth-secret",
    SUPABASE_URL: "https://database.example.test",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role",
  };
}

test("growth metrics rejects requests without the bearer secret before querying Supabase", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    throw new Error("Supabase should not be called");
  };

  try {
    const response = await worker.fetch(new Request("https://worker.test/api/admin/growth-metrics"), env());
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "Unauthorized" });
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("growth metrics returns aggregate-only daily counts and a verified purchaser streak", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  const fetchScorecards = scorecardFetch([
    scorecardRow("2026-07-26", 10),
    scorecardRow("2026-07-27", 12),
    scorecardRow("2026-07-28", 11),
  ], [
    funnelRow("2026-07-26", {
      utm_source: "meta",
      utm_medium: "paid_social",
      utm_campaign: "launch",
      utm_content: "creative_a",
    }),
    funnelRow("2026-07-27"),
    funnelRow("2026-07-28"),
  ]);
  globalThis.fetch = async (url, options) => {
    requests.push({ url: String(url), options });
    return fetchScorecards(url, options);
  };

  try {
    const request = new Request(
      "https://worker.test/api/admin/growth-metrics?days=3&end_date=2026-07-28",
      { headers: { authorization: "Bearer test-growth-secret" } },
    );
    const response = await worker.fetch(request, env());
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.equal(response.headers.get("access-control-allow-origin"), null);
    assert.equal(body.privacy, "aggregate_counts_only");
    assert.equal(body.source, "supabase_verified_lemon_state_and_first_party_funnel");
    assert.deepEqual(body.range, {
      timezone: "Asia/Taipei",
      start_date: "2026-07-26",
      end_date: "2026-07-28",
      closed_days: 3,
    });
    assert.equal(body.goal.current_streak, 3);
    assert.equal(body.goal.streak_start_date, "2026-07-26");
    assert.equal(body.goal.latest_qualifying_date, "2026-07-28");
    assert.equal(body.goal.complete, false);
    assert.equal(body.totals.verified_purchasers, 33);
    assert.equal(body.totals.estimated_gross_usd, 299.7);
    assert.equal(body.totals.paid_signal_delivery_rate, 1);
    assert.equal(body.totals.delivery_within_15m_rate, 0.875);
    assert.equal(body.totals.landing_sessions, 300);
    assert.equal(body.totals.quiz_starts, 90);
    assert.equal(body.days[0].qualifies_for_daily_goal, true);
    assert.equal(body.attribution.length, 1);
    assert.equal(body.attribution[0].utm_campaign, "launch");
    assert.equal(JSON.stringify(body).includes("customer_id"), false);
    assert.equal(JSON.stringify(body).includes("order_id"), false);
    assert.equal(JSON.stringify(body).includes("email"), false);

    assert.equal(requests.length, 2);
    assert.deepEqual(new Set(requests.map((item) => item.url)), new Set([
      "https://database.example.test/rest/v1/rpc/get_growth_scorecard",
      "https://database.example.test/rest/v1/rpc/get_first_party_funnel_scorecard",
    ]));
    for (const item of requests) {
      assert.deepEqual(JSON.parse(item.options.body), {
        p_start_date: "2026-07-26",
        p_end_date: "2026-07-28",
      });
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("protected Worker scorecard stays in golden parity with the aggregate adapter", async () => {
  const originalFetch = globalThis.fetch;
  const commerceRows = [
    scorecardRow("2026-07-26", 10),
    scorecardRow("2026-07-27", 12, { refunded_orders: "1" }),
    scorecardRow("2026-07-28", 11),
  ];
  const funnelRows = [
    funnelRow("2026-07-26", {
      utm_source: "zeta",
      utm_medium: "organic",
      utm_campaign: "alpha",
      utm_content: "guide_b",
    }),
    funnelRow("2026-07-26", {
      utm_source: "alpha",
      utm_medium: "referral",
      utm_campaign: "zeta",
      utm_content: "guide_a",
      page_view_sessions: "7",
      view_content_sessions: "6",
    }),
    funnelRow("2026-07-27", {
      page: "full_report",
      page_view_sessions: "3",
      view_content_sessions: "2",
    }),
    funnelRow("2026-07-28"),
  ];
  globalThis.fetch = scorecardFetch(commerceRows, funnelRows);

  try {
    const request = new Request(
      "https://worker.test/api/admin/growth-metrics?days=3&end_date=2026-07-28",
      { headers: { authorization: "Bearer test-growth-secret" } },
    );
    const response = await worker.fetch(request, env());
    const actual = await response.json();
    const expected = buildGrowthScorecard({
      start_date: "2026-07-26",
      end_date: "2026-07-28",
      commerce_rows: commerceRows,
      funnel_rows: funnelRows,
    });

    assert.equal(response.status, 200);
    for (const field of ["ok", "source", "privacy", "range", "goal", "totals", "days", "attribution", "limitations"]) {
      assert.deepEqual(actual[field], expected[field], `${field} contract drifted`);
    }
    assert.deepEqual(actual.attribution.map((row) => row.utm_source), ["alpha", "zeta"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("growth metrics fails closed on incomplete, duplicate, or out-of-range commerce days", async () => {
  const originalFetch = globalThis.fetch;
  const originalConsoleError = console.error;
  const scenarios = [
    {
      name: "missing",
      rows: [scorecardRow("2026-07-26", 10), scorecardRow("2026-07-28", 11)],
      error: "Growth scorecard omitted closed commerce day 2026-07-27",
    },
    {
      name: "duplicate",
      rows: [
        scorecardRow("2026-07-26", 10),
        scorecardRow("2026-07-27", 12),
        scorecardRow("2026-07-27", 12),
        scorecardRow("2026-07-28", 11),
      ],
      error: "Growth scorecard returned duplicate commerce day 2026-07-27",
    },
    {
      name: "out-of-range",
      rows: [
        scorecardRow("2026-07-25", 9),
        scorecardRow("2026-07-26", 10),
        scorecardRow("2026-07-27", 12),
        scorecardRow("2026-07-28", 11),
      ],
      error: "Growth scorecard returned out-of-range commerce day 2026-07-25",
    },
  ];

  try {
    console.error = () => {};
    for (const scenario of scenarios) {
      globalThis.fetch = scorecardFetch(scenario.rows);
      const request = new Request(
        "https://worker.test/api/admin/growth-metrics?days=3&end_date=2026-07-28",
        { headers: { authorization: "Bearer test-growth-secret" } },
      );
      const response = await worker.fetch(request, env());
      assert.equal(response.status, 502, `${scenario.name} status`);
      assert.deepEqual(await response.json(), { error: scenario.error }, `${scenario.name} response`);
    }
  } finally {
    console.error = originalConsoleError;
    globalThis.fetch = originalFetch;
  }
});

test("growth metrics fails closed on duplicate or out-of-range funnel attribution rows", async () => {
  const originalFetch = globalThis.fetch;
  const originalConsoleError = console.error;
  const commerceRows = [
    scorecardRow("2026-07-26", 10),
    scorecardRow("2026-07-27", 12),
    scorecardRow("2026-07-28", 11),
  ];
  const attributed = funnelRow("2026-07-26", {
    utm_source: "google",
    utm_medium: "organic",
    utm_campaign: "five_elements",
  });
  const scenarios = [
    {
      name: "duplicate",
      rows: [attributed, { ...attributed }],
      error: "Growth scorecard returned duplicate funnel attribution row 2026-07-26 landing",
    },
    {
      name: "out-of-range",
      rows: [funnelRow("2026-07-25")],
      error: "Growth scorecard returned out-of-range funnel day 2026-07-25",
    },
  ];

  try {
    console.error = () => {};
    for (const scenario of scenarios) {
      globalThis.fetch = scorecardFetch(commerceRows, scenario.rows);
      const request = new Request(
        "https://worker.test/api/admin/growth-metrics?days=3&end_date=2026-07-28",
        { headers: { authorization: "Bearer test-growth-secret" } },
      );
      const response = await worker.fetch(request, env());
      assert.equal(response.status, 502, `${scenario.name} status`);
      assert.deepEqual(await response.json(), { error: scenario.error }, `${scenario.name} response`);
    }
  } finally {
    console.error = originalConsoleError;
    globalThis.fetch = originalFetch;
  }
});

test("growth metrics fails closed on unknown RPC aggregate fields", async () => {
  const originalFetch = globalThis.fetch;
  const originalConsoleError = console.error;
  const commerceRows = [
    scorecardRow("2026-07-26", 10),
    scorecardRow("2026-07-27", 12),
    scorecardRow("2026-07-28", 11),
  ];
  const scenarios = [
    {
      name: "commerce",
      commerce: [{ ...commerceRows[0], raw_payload: null }, ...commerceRows.slice(1)],
      funnel: [],
      error: "Growth scorecard returned unknown commerce field raw_payload",
    },
    {
      name: "funnel",
      commerce: commerceRows,
      funnel: [funnelRow("2026-07-26", { customer_email: null })],
      error: "Growth scorecard returned unknown funnel field customer_email",
    },
  ];

  try {
    console.error = () => {};
    for (const scenario of scenarios) {
      globalThis.fetch = scorecardFetch(scenario.commerce, scenario.funnel);
      const request = new Request(
        "https://worker.test/api/admin/growth-metrics?days=3&end_date=2026-07-28",
        { headers: { authorization: "Bearer test-growth-secret" } },
      );
      const response = await worker.fetch(request, env());
      assert.equal(response.status, 502, `${scenario.name} status`);
      assert.deepEqual(await response.json(), { error: scenario.error }, `${scenario.name} response`);
    }
  } finally {
    console.error = originalConsoleError;
    globalThis.fetch = originalFetch;
  }
});

test("growth metrics fails closed on non-object or missing RPC aggregate fields", async () => {
  const originalFetch = globalThis.fetch;
  const originalConsoleError = console.error;
  const commerceRows = [
    scorecardRow("2026-07-26", 10),
    scorecardRow("2026-07-27", 12),
    scorecardRow("2026-07-28", 11),
  ];
  const missingCommerceCount = { ...commerceRows[0] };
  delete missingCommerceCount.verified_orders;
  const missingFunnelCount = funnelRow("2026-07-26");
  delete missingFunnelCount.quiz_starts;
  const scenarios = [
    {
      name: "non-object commerce row",
      commerce: [null, ...commerceRows.slice(1)],
      funnel: [],
      error: "Growth scorecard returned an invalid commerce row",
    },
    {
      name: "non-object funnel row",
      commerce: commerceRows,
      funnel: [[]],
      error: "Growth scorecard returned an invalid funnel row",
    },
    {
      name: "missing commerce count",
      commerce: [missingCommerceCount, ...commerceRows.slice(1)],
      funnel: [],
      error: "Growth scorecard returned invalid verified_orders",
    },
    {
      name: "missing funnel count",
      commerce: commerceRows,
      funnel: [missingFunnelCount],
      error: "Growth scorecard returned invalid quiz_starts",
    },
  ];

  try {
    console.error = () => {};
    for (const scenario of scenarios) {
      globalThis.fetch = scorecardFetch(scenario.commerce, scenario.funnel);
      const request = new Request(
        "https://worker.test/api/admin/growth-metrics?days=3&end_date=2026-07-28",
        { headers: { authorization: "Bearer test-growth-secret" } },
      );
      const response = await worker.fetch(request, env());
      assert.equal(response.status, 502, `${scenario.name} status`);
      assert.deepEqual(await response.json(), { error: scenario.error }, `${scenario.name} response`);
    }
  } finally {
    console.error = originalConsoleError;
    globalThis.fetch = originalFetch;
  }
});

test("growth streak resets when the latest closed day misses the target", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = scorecardFetch([
    scorecardRow("2026-07-26", 10),
    scorecardRow("2026-07-27", 10),
    scorecardRow("2026-07-28", 9),
  ]);

  try {
    const request = new Request(
      "https://worker.test/api/admin/growth-metrics?days=3&end_date=2026-07-28",
      { headers: { authorization: "Bearer test-growth-secret" } },
    );
    const body = await (await worker.fetch(request, env())).json();
    assert.equal(body.goal.current_streak, 0);
    assert.equal(body.goal.streak_start_date, null);
    assert.equal(body.goal.latest_qualifying_date, null);
    assert.equal(body.goal.qualifying_days_in_range, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("growth metrics rejects invalid ranges without querying Supabase", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response("[]", { status: 200 });
  };

  try {
    const request = new Request(
      "https://worker.test/api/admin/growth-metrics?days=91&end_date=2026-07-28",
      { headers: { authorization: "Bearer test-growth-secret" } },
    );
    const response = await worker.fetch(request, env());
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "days must be an integer from 1 to 90" });
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("first-party analytics hashes the session and stores only allowlisted fields", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url: String(url), options });
    return new Response(JSON.stringify([{ id: "11111111-1111-4111-8111-111111111111" }]), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  };

  const sessionId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const eventId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  try {
    const request = new Request("https://worker.test/api/analytics/events", {
      method: "POST",
      headers: {
        origin: "https://yourloveelement.com",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        event_id: eventId,
        session_id: sessionId,
        event_name: "quiz_start",
        page: "landing",
        utm_source: "meta",
        utm_medium: "paid_social",
        utm_campaign: "launch",
        ignored_contact: "must-not-be-stored",
        reading_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      }),
    });
    const response = await worker.fetch(request, env());
    const body = await response.json();

    assert.equal(response.status, 202);
    assert.deepEqual(body, { ok: true });
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, "https://database.example.test/rest/v1/funnel_events?select=id");
    const stored = JSON.parse(requests[0].options.body);
    assert.deepEqual(Object.keys(stored).sort(), [
      "event_id",
      "event_name",
      "page",
      "session_hash",
      "utm_campaign",
      "utm_content",
      "utm_medium",
      "utm_source",
      "utm_term",
    ]);
    assert.equal(stored.event_id, eventId);
    assert.equal(stored.session_hash, createHash("sha256").update(sessionId).digest("hex"));
    assert.equal(stored.utm_source, "meta");
    assert.equal(stored.utm_content, null);
    assert.equal(JSON.stringify(stored).includes("must-not-be-stored"), false);
    assert.equal(JSON.stringify(stored).includes("reading_id"), false);
    assert.equal(JSON.stringify(stored).includes(sessionId), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("first-party analytics rejects frontend purchase and untrusted origins before storage", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response("[]", { status: 201 });
  };

  const validBody = {
    event_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    session_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    event_name: "purchase",
    page: "landing",
  };
  try {
    const purchaseResponse = await worker.fetch(new Request("https://worker.test/api/analytics/events", {
      method: "POST",
      headers: { origin: "https://yourloveelement.com", "content-type": "application/json" },
      body: JSON.stringify(validBody),
    }), env());
    assert.equal(purchaseResponse.status, 400);
    assert.deepEqual(await purchaseResponse.json(), { error: "Invalid event_name" });

    const originResponse = await worker.fetch(new Request("https://worker.test/api/analytics/events", {
      method: "POST",
      headers: { origin: "https://untrusted.example", "content-type": "application/json" },
      body: JSON.stringify({ ...validBody, event_name: "quiz_start" }),
    }), env());
    assert.equal(originResponse.status, 403);
    assert.deepEqual(await originResponse.json(), { error: "Forbidden" });
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
