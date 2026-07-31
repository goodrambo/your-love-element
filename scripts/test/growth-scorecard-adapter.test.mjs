import assert from "node:assert/strict";
import test from "node:test";

import { evaluateGrowthControl } from "../growth-control.mjs";
import { buildGrowthScorecard } from "../growth-scorecard-adapter.mjs";

function commerceRow(date, overrides = {}) {
  return {
    metric_date: date,
    previewed_readings: "0",
    checkout_readings: "0",
    verified_purchasers: "0",
    verified_orders: "0",
    refunded_orders: "0",
    paid_signals_submitted: "0",
    paid_signal_cohort_delivered: "0",
    paid_signal_cohort_delivered_within_15m: "0",
    delivered_readings: "0",
    failed_readings: "0",
    ...overrides,
  };
}

function funnelRow(date, page, overrides = {}) {
  return {
    metric_date: date,
    page,
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    utm_content: null,
    utm_term: null,
    page_view_sessions: "0",
    view_content_sessions: "0",
    landing_cta_clicks: "0",
    quiz_starts: "0",
    previews_revealed: "0",
    checkouts_created: "0",
    paid_signals_submitted_events: "0",
    share_card_generated: "0",
    share_card_shared: "0",
    share_card_link_shared: "0",
    share_card_downloaded: "0",
    ...overrides,
  };
}

test("merges commerce, landing, full-report, and sanitized attribution into evaluator-ready days", () => {
  const scorecard = buildGrowthScorecard({
    start_date: "2026-07-29",
    end_date: "2026-07-30",
    commerce_rows: [
      commerceRow("2026-07-29", {
        verified_purchasers: "10",
        verified_orders: "10",
        paid_signals_submitted: "8",
        paid_signal_cohort_delivered: "8",
        paid_signal_cohort_delivered_within_15m: "8",
        delivered_readings: "8",
      }),
      commerceRow("2026-07-30"),
    ],
    funnel_rows: [
      funnelRow("2026-07-29", "landing", {
        utm_source: "google",
        utm_medium: "organic",
        utm_campaign: "five_elements",
        page_view_sessions: "7",
        view_content_sessions: "6",
        landing_cta_clicks: "2",
        quiz_starts: "1",
      }),
      funnelRow("2026-07-29", "full_report", {
        page_view_sessions: "3",
        view_content_sessions: "2",
      }),
      funnelRow("2026-07-30", "landing", {
        page_view_sessions: "4",
        view_content_sessions: "4",
      }),
    ],
  });

  assert.equal(scorecard.source, "supabase_verified_lemon_state_and_first_party_funnel");
  assert.equal(scorecard.privacy, "aggregate_counts_only");
  assert.deepEqual(scorecard.range, {
    timezone: "Asia/Taipei",
    start_date: "2026-07-29",
    end_date: "2026-07-30",
    closed_days: 2,
  });
  assert.equal(scorecard.days[0].landing_sessions, 7);
  assert.equal(scorecard.days[0].full_report_sessions, 3);
  assert.equal(scorecard.days[0].view_content_sessions, 8);
  assert.equal(scorecard.days[0].verified_purchasers, 10);
  assert.equal(scorecard.days[0].qualifies_for_daily_goal, true);
  assert.equal(scorecard.days[1].landing_sessions, 4);
  assert.equal(scorecard.goal.current_streak, 0);
  assert.equal(scorecard.goal.qualifying_days_in_range, 1);
  assert.equal(scorecard.totals.landing_sessions, 11);
  assert.equal(scorecard.totals.estimated_gross_usd, 99.9);
  assert.equal(scorecard.attribution.length, 1);
  assert.equal(scorecard.attribution[0].utm_campaign, "five_elements");

  const decision = evaluateGrowthControl({
    run_date: "2026-07-31",
    scorecard,
    authority: {},
    provider: { public_health_ok: true, paid_flow_incident: false },
  });
  assert.equal(decision.primary_constraint, "observability");
  assert.equal(decision.rolling["7d"].closed_days, 2);
});

test("rejects customer-level or identifier-shaped fields before adapting rows", () => {
  const row = commerceRow("2026-07-30");
  row.customer_email = null;
  assert.throws(() => buildGrowthScorecard({
    start_date: "2026-07-30",
    end_date: "2026-07-30",
    commerce_rows: [row],
    funnel_rows: [],
  }), /sensitive key/);
});

test("rejects unknown aggregate fields instead of silently forwarding them", () => {
  const row = funnelRow("2026-07-30", "landing");
  row.raw_payload = null;
  assert.throws(() => buildGrowthScorecard({
    start_date: "2026-07-30",
    end_date: "2026-07-30",
    commerce_rows: [commerceRow("2026-07-30")],
    funnel_rows: [row],
  }), /unknown field: raw_payload/);

  assert.throws(() => buildGrowthScorecard({
    start_date: "2026-07-30",
    end_date: "2026-07-30",
    commerce_rows: [commerceRow("2026-07-30")],
    funnel_rows: [],
    debug_rows: [],
  }), /input contains unknown field: debug_rows/);
});

test("rejects a missing or duplicate commerce day rather than inventing zero purchase truth", () => {
  assert.throws(() => buildGrowthScorecard({
    start_date: "2026-07-29",
    end_date: "2026-07-30",
    commerce_rows: [commerceRow("2026-07-30")],
    funnel_rows: [],
  }), /Missing commerce row for closed day 2026-07-29/);

  assert.throws(() => buildGrowthScorecard({
    start_date: "2026-07-30",
    end_date: "2026-07-30",
    commerce_rows: [commerceRow("2026-07-30"), commerceRow("2026-07-30")],
    funnel_rows: [],
  }), /Duplicate commerce row/);
});

test("rejects unsanitized attribution labels", () => {
  assert.throws(() => buildGrowthScorecard({
    start_date: "2026-07-30",
    end_date: "2026-07-30",
    commerce_rows: [commerceRow("2026-07-30")],
    funnel_rows: [funnelRow("2026-07-30", "landing", { utm_source: "not allowed" })],
  }), /Invalid aggregate label/);
});
