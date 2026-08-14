import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { evaluateGrowthControl, GOAL } from "../growth-control.mjs";

const CLI_PATH = fileURLToPath(new URL("../growth-control.mjs", import.meta.url));

const DEFAULT_COUNTS = {
  landing_sessions: 160,
  landing_cta_clicks: 48,
  quiz_starts: 38,
  previews_revealed: 28,
  checkouts_created: 4,
  verified_purchasers: 2,
  verified_orders: 2,
  refunded_orders: 0,
  paid_signals_submitted: 2,
  paid_signal_cohort_delivered: 2,
  paid_signal_cohort_delivered_within_15m: 2,
  delivered_readings: 2,
  failed_readings: 0,
};

const READY_AUTHORITY = {
  gsc_read: true,
  lemon_read: true,
  scorecard_read: true,
  meta_read: true,
  resend_read: true,
  deploy: true,
  publish: true,
  paid_media: true,
  paid_flow_e2e: true,
};

const DENY_STANDING_AUTHORITY = {
  grants: {
    apply_production_migrations: { authorized: false },
    git_push: { authorized: false },
    deploy_worker: { authorized: false },
    deploy_frontend: { authorized: false },
    publish_organic: { authorized: false },
    run_paid_flow_e2e: { authorized: false },
    send_customer_messages: { authorized: false },
  },
  paid_media: {
    authorized: false,
    currency: "USD",
    daily_cap: 0,
    lifetime_cap: 0,
    max_increase_percent_per_24h: 20,
  },
};

function addDays(date, delta) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + delta);
  return value.toISOString().slice(0, 10);
}

function scorecard(overrides = {}, dayCount = 14) {
  const endDate = "2026-07-29";
  const days = Array.from({ length: dayCount }, (_, index) => ({
    date: addDays(endDate, index - dayCount + 1),
    ...DEFAULT_COUNTS,
    ...overrides,
  }));
  return {
    source: "supabase_verified_lemon_state_and_first_party_funnel",
    privacy: "aggregate_counts_only",
    range: { timezone: "Asia/Taipei", end_date: endDate },
    goal: { current_streak: 0, complete: false },
    days,
  };
}

function searchConsole(runDate, overrides = {}, dayCount = 30) {
  const endDate = addDays(runDate, -3);
  const days = Array.from({ length: dayCount }, (_, index) => ({
    date: addDays(endDate, index - dayCount + 1),
    clicks: 1001,
    impressions: 5000,
    ...overrides,
  }));
  return {
    property: "sc-domain:yourloveelement.com",
    source: "google_search_console_performance",
    search_type: "web",
    aggregation: "property",
    data_state: "final",
    timezone: "America/Los_Angeles",
    privacy: "aggregate_counts_only",
    fetched_on: runDate,
    start_date: days[0].date,
    end_date: endDate,
    days,
  };
}

test("keeps the evaluator goal aligned with the Harness contract", () => {
  const contracts = JSON.parse(readFileSync(new URL("../../harness/contracts.json", import.meta.url), "utf8"));
  assert.deepEqual(GOAL, contracts.growth_goal);
});

test("classifies missing GSC truth as access and keeps traffic values unknown", () => {
  const result = evaluateGrowthControl({
    run_date: "2026-07-30",
    scorecard: null,
    authority: {},
    provider: { public_health_ok: true, paid_flow_incident: false },
  });

  assert.equal(result.status, "blocked_on_gsc_truth");
  assert.equal(result.primary_constraint, "access");
  assert.equal(result.traffic_streak, null);
  assert.equal(result.traffic.rolling["7d"].clicks, null);
  assert.equal(result.current_streak, null);
  assert.equal(result.rolling["7d"].purchasers_per_day, null);
  for (const window of Object.values(result.rolling)) {
    assert.equal(window.closed_days, 0);
    for (const field of Object.keys(DEFAULT_COUNTS)) {
      assert.equal(window[field], null);
    }
  }
  assert.equal(result.action.id, "complete_gsc_traffic_gate");
  assert.deepEqual(result.action.missing_authority, ["gsc_read"]);
  assert.equal(result.missing_authorities.length, 9);
});

test("retains an active experiment while aggregate experiment metrics are unavailable", () => {
  const result = evaluateGrowthControl({
    run_date: "2026-08-03",
    scorecard: null,
    authority: {},
    provider: { public_health_ok: true, paid_flow_incident: false },
    active_experiment: {
      started_on: "2026-07-31",
      eligible_sessions: null,
      baseline_primary_rate: null,
      current_primary_rate: null,
      baseline_guardrail_rate: null,
      current_guardrail_rate: null,
      has_breakage: false,
    },
  });

  assert.equal(result.experiment.decision, "continue");
  assert.equal(result.experiment.measurement_status, "unavailable");
  assert.equal(result.experiment.eligible_sessions, null);
  assert.match(result.experiment.reason, /awaiting aggregate measurement/);
});

test("uses complete final GSC days for the Stage 1 experiment sample clock", () => {
  const result = evaluateGrowthControl({
    run_date: "2026-08-15",
    search_console: searchConsole("2026-08-15", { clicks: 0 }, 16),
    scorecard: null,
    authority: { gsc_read: true },
    provider: { public_health_ok: true, paid_flow_incident: false },
    active_experiment: {
      started_on: "2026-08-13",
      eligible_sessions: null,
      baseline_primary_rate: null,
      current_primary_rate: null,
      baseline_guardrail_rate: null,
      current_guardrail_rate: null,
      has_breakage: false,
    },
  });

  assert.equal(result.experiment.elapsed_days, 2);
  assert.equal(result.experiment.sample_days, 0);
  assert.equal(result.experiment.sample_basis, "final_gsc_days");
  assert.equal(result.experiment.sample_end_date, "2026-08-12");
  assert.equal(result.experiment.decision, "continue");
});

test("counts the experiment start date as one final GSC sample day", () => {
  const result = evaluateGrowthControl({
    run_date: "2026-08-16",
    search_console: searchConsole("2026-08-16", { clicks: 0, impressions: 1000000 }, 17),
    scorecard: null,
    authority: { gsc_read: true },
    provider: { public_health_ok: true, paid_flow_incident: false },
    active_experiment: {
      started_on: "2026-08-13",
      eligible_sessions: null,
      baseline_primary_rate: null,
      current_primary_rate: null,
      baseline_guardrail_rate: null,
      current_guardrail_rate: null,
      has_breakage: false,
    },
  });

  assert.equal(result.experiment.elapsed_days, 3);
  assert.equal(result.experiment.sample_days, 1);
  assert.equal(result.experiment.sample_basis, "final_gsc_days");
  assert.equal(result.experiment.sample_end_date, "2026-08-13");
  assert.equal(result.experiment.decision, "continue");
  assert.equal(result.traffic.current_streak, 0);
});

test("rejects an active experiment that starts after the run date", () => {
  assert.throws(() => evaluateGrowthControl({
    run_date: "2026-08-15",
    search_console: searchConsole("2026-08-15", { clicks: 0 }, 16),
    scorecard: null,
    authority: { gsc_read: true },
    provider: { public_health_ok: true, paid_flow_incident: false },
    active_experiment: {
      started_on: "2026-08-16",
      eligible_sessions: null,
      baseline_primary_rate: null,
      current_primary_rate: null,
      baseline_guardrail_rate: null,
      current_guardrail_rate: null,
      has_breakage: false,
    },
  }), /cannot start after the run date/);
});

test("opens the Stage 1 decision gate after seven complete final GSC days", () => {
  const result = evaluateGrowthControl({
    run_date: "2026-08-22",
    search_console: searchConsole("2026-08-22", { clicks: 0 }),
    scorecard: null,
    authority: { gsc_read: true },
    provider: { public_health_ok: true, paid_flow_incident: false },
    active_experiment: {
      started_on: "2026-08-13",
      eligible_sessions: 250,
      baseline_primary_rate: 0.25,
      current_primary_rate: 0.28,
      baseline_guardrail_rate: 0.10,
      current_guardrail_rate: 0.11,
      has_breakage: false,
    },
  });

  assert.equal(result.experiment.sample_days, 7);
  assert.equal(result.experiment.sample_end_date, "2026-08-19");
  assert.equal(result.experiment.decision, "promote");
});

test("CLI preserves unavailable totals and the active unmeasured experiment", () => {
  const completed = spawnSync(process.execPath, [CLI_PATH, "--input", "-"], {
    encoding: "utf8",
    input: JSON.stringify({
      run_date: "2026-08-03",
      scorecard: null,
      authority: {},
      provider: {
        public_health_ok: true,
        paid_flow_incident: false,
        rolling_3d_start_date: "2026-07-31",
        rolling_3d_end_date: "2026-08-02",
        rolling_3d_spend_usd: null,
        rolling_3d_settled_revenue_usd: null,
        max_acceptable_cac_usd: null,
      },
      active_experiment: {
        started_on: "2026-07-31",
        eligible_sessions: null,
        baseline_primary_rate: null,
        current_primary_rate: null,
        baseline_guardrail_rate: null,
        current_guardrail_rate: null,
        has_breakage: false,
      },
    }),
  });

  assert.equal(completed.status, 0, completed.stderr);
  const result = JSON.parse(completed.stdout);
  for (const window of Object.values(result.rolling)) {
    assert.equal(window.closed_days, 0);
    for (const field of Object.keys(DEFAULT_COUNTS)) {
      assert.equal(window[field], null);
    }
  }
  assert.equal(result.experiment.decision, "continue");
  assert.equal(result.experiment.measurement_status, "unavailable");
});

test("rejects a partially unavailable active experiment measurement", () => {
  assert.throws(() => evaluateGrowthControl({
    run_date: "2026-08-03",
    scorecard: null,
    authority: {},
    provider: { public_health_ok: true, paid_flow_incident: false },
    active_experiment: {
      started_on: "2026-07-31",
      eligible_sessions: 10,
      baseline_primary_rate: null,
      current_primary_rate: 0.02,
      baseline_guardrail_rate: 1,
      current_guardrail_rate: 1,
      has_breakage: false,
    },
  }), /must be all available or all null/);
});

test("treats exactly 1000 GSC clicks as non-qualifying even with high impressions", () => {
  const runDate = "2026-07-30";
  const result = evaluateGrowthControl({
    run_date: runDate,
    search_console: searchConsole(runDate, { clicks: 1000, impressions: 100000 }),
    scorecard: null,
    authority: { gsc_read: true },
    provider: { public_health_ok: true, paid_flow_incident: false },
  });

  assert.equal(result.active_stage, "gsc_traffic");
  assert.equal(result.primary_constraint, "traffic");
  assert.equal(result.traffic_streak, 0);
  assert.equal(result.traffic.rolling["30d"].qualifying_days, 0);
  assert.equal(result.action.id, "increase_final_gsc_web_clicks");
});

test("qualifies 1001 GSC clicks for 30 contiguous final days and advances to purchase stage", () => {
  const runDate = "2026-07-30";
  const result = evaluateGrowthControl({
    run_date: runDate,
    search_console: searchConsole(runDate),
    scorecard: null,
    authority: { gsc_read: true },
    provider: { public_health_ok: true, paid_flow_incident: false },
  });

  assert.equal(result.traffic.complete, true);
  assert.equal(result.traffic_streak, 30);
  assert.equal(result.traffic.data_lag_days, 3);
  assert.equal(result.active_stage, "verified_purchases");
  assert.equal(result.status, "blocked_on_aggregate_truth");
  assert.equal(result.action.id, "complete_authority_and_scorecard_gate");
  assert.deepEqual(result.action.missing_authority, ["scorecard_read"]);
  assert.equal(result.action.execution_scope, "one_time_user_bootstrap_required");
});

test("rejects a gap or preliminary state in GSC traffic evidence", () => {
  const runDate = "2026-07-30";
  const gapped = searchConsole(runDate);
  gapped.days.splice(5, 1);
  assert.throws(() => evaluateGrowthControl({
    run_date: runDate,
    search_console: gapped,
    scorecard: null,
    authority: { gsc_read: true },
    provider: { public_health_ok: true, paid_flow_incident: false },
  }), /contiguous final days/);

  const preliminary = searchConsole(runDate);
  preliminary.data_state = "preliminary";
  assert.throws(() => evaluateGrowthControl({
    run_date: runDate,
    search_console: preliminary,
    scorecard: null,
    authority: { gsc_read: true },
    provider: { public_health_ok: true, paid_flow_incident: false },
  }), /Invalid aggregate Search Console contract/);
});

test("keeps optional and deliberately excluded channels out of the organic authority gate", () => {
  const result = evaluateGrowthControl({
    run_date: "2026-07-30",
    search_console: searchConsole("2026-07-30"),
    scorecard: scorecard(),
    authority: { gsc_read: true, scorecard_read: true },
    provider: { public_health_ok: true, paid_flow_incident: false },
  });

  assert.equal(result.next_milestone.metric, "authority_gate");
  assert.equal(result.next_milestone.actual, 1);
  assert.ok(result.missing_authorities.includes("paid_media"));
  assert.ok(result.missing_authorities.includes("paid_flow_e2e"));
});

test("prioritizes fulfillment below 98 percent before traffic or conversion", () => {
  const result = evaluateGrowthControl({
    run_date: "2026-07-30",
    search_console: searchConsole("2026-07-30"),
    scorecard: scorecard({
      paid_signals_submitted: 10,
      paid_signal_cohort_delivered: 10,
      paid_signal_cohort_delivered_within_15m: 9,
    }),
    authority: READY_AUTHORITY,
    provider: { public_health_ok: true, paid_flow_incident: false, rolling_3d_start_date: "2026-07-27", rolling_3d_end_date: "2026-07-29", rolling_3d_spend_usd: 20, rolling_3d_settled_revenue_usd: 140, max_acceptable_cac_usd: 8 },
  });

  assert.equal(result.primary_constraint, "fulfillment");
  assert.equal(result.action.id, "restore_fulfillment_above_98_percent");
  assert.equal(result.rolling["7d"].paid_signals_to_delivery_within_15m_rate, 0.9);
});

test("selects the largest adequately sampled conversion gap", () => {
  const result = evaluateGrowthControl({
    run_date: "2026-07-30",
    search_console: searchConsole("2026-07-30"),
    scorecard: scorecard({
      landing_sessions: 200,
      landing_cta_clicks: 80,
      quiz_starts: 60,
      previews_revealed: 50,
      checkouts_created: 2,
      verified_purchasers: 1,
      verified_orders: 1,
      paid_signals_submitted: 1,
      paid_signal_cohort_delivered: 1,
      paid_signal_cohort_delivered_within_15m: 1,
      delivered_readings: 1,
    }),
    authority: READY_AUTHORITY,
    provider: { public_health_ok: true, paid_flow_incident: false, rolling_3d_start_date: "2026-07-27", rolling_3d_end_date: "2026-07-29", rolling_3d_spend_usd: 0, rolling_3d_settled_revenue_usd: 69.93, max_acceptable_cac_usd: 8 },
  });

  assert.equal(result.primary_constraint, "conversion");
  assert.equal(result.action.id, "strengthen_preview_offer");
  assert.equal(result.action.observed_rate, 0.04);
  assert.equal(result.action.target_rate, 0.06);
});

test("selects economics when measured CAC exceeds the approved cap", () => {
  const result = evaluateGrowthControl({
    run_date: "2026-07-30",
    search_console: searchConsole("2026-07-30"),
    scorecard: scorecard(),
    authority: READY_AUTHORITY,
    provider: { public_health_ok: true, paid_flow_incident: false, rolling_3d_start_date: "2026-07-27", rolling_3d_end_date: "2026-07-29", rolling_3d_spend_usd: 75, rolling_3d_settled_revenue_usd: 59.94, max_acceptable_cac_usd: 8 },
  });

  assert.equal(result.primary_constraint, "economics");
  assert.equal(result.action.id, "reset_acquisition_economics");
  assert.equal(result.economics.cac_usd, 12.5);
  assert.equal(result.economics.roas, 0.7992);
});

test("falls back to a quantified traffic action when the measured funnel clears gates", () => {
  const result = evaluateGrowthControl({
    run_date: "2026-07-30",
    search_console: searchConsole("2026-07-30"),
    scorecard: scorecard(),
    authority: READY_AUTHORITY,
    provider: { public_health_ok: true, paid_flow_incident: false, rolling_3d_start_date: "2026-07-27", rolling_3d_end_date: "2026-07-29", rolling_3d_spend_usd: 0, rolling_3d_settled_revenue_usd: 139.86, max_acceptable_cac_usd: 8 },
  });

  assert.equal(result.primary_constraint, "traffic");
  assert.equal(result.action.id, "increase_qualified_landing_sessions");
  assert.equal(result.action.required_landing_sessions_per_day, 800);
  assert.equal(result.next_milestone.date, "2026-08-02");
});

test("stops an experiment after a 30 percent guardrail decline", () => {
  const result = evaluateGrowthControl({
    run_date: "2026-07-30",
    search_console: searchConsole("2026-07-30"),
    scorecard: scorecard(),
    authority: READY_AUTHORITY,
    provider: { public_health_ok: true, paid_flow_incident: false, rolling_3d_start_date: "2026-07-27", rolling_3d_end_date: "2026-07-29", rolling_3d_spend_usd: 0, rolling_3d_settled_revenue_usd: 139.86, max_acceptable_cac_usd: 8 },
    active_experiment: {
      started_on: "2026-07-27",
      eligible_sessions: 120,
      baseline_primary_rate: 0.25,
      current_primary_rate: 0.28,
      baseline_guardrail_rate: 0.10,
      current_guardrail_rate: 0.06,
    },
  });

  assert.equal(result.experiment.decision, "stop");
  assert.match(result.experiment.reason, /guardrail declined/);
});

test("promotes only after seven days, 200 sessions, lift, and a non-declining guardrail", () => {
  const result = evaluateGrowthControl({
    run_date: "2026-07-30",
    search_console: searchConsole("2026-07-30"),
    scorecard: scorecard(),
    authority: READY_AUTHORITY,
    provider: { public_health_ok: true, paid_flow_incident: false, rolling_3d_start_date: "2026-07-27", rolling_3d_end_date: "2026-07-29", rolling_3d_spend_usd: 0, rolling_3d_settled_revenue_usd: 139.86, max_acceptable_cac_usd: 8 },
    active_experiment: {
      started_on: "2026-07-20",
      eligible_sessions: 250,
      baseline_primary_rate: 0.25,
      current_primary_rate: 0.28,
      baseline_guardrail_rate: 0.10,
      current_guardrail_rate: 0.11,
    },
  });

  assert.equal(result.experiment.sample_days, 10);
  assert.equal(result.experiment.sample_basis, "closed_scorecard_days");
  assert.equal(result.experiment.sample_end_date, "2026-07-29");
  assert.equal(result.experiment.decision, "promote");
});

test("rejects customer-level keys before making a decision", () => {
  assert.throws(() => evaluateGrowthControl({
    run_date: "2026-07-30",
    scorecard: null,
    customer_email: "not-allowed@example.test",
    provider: { public_health_ok: true, paid_flow_incident: false },
  }), /sensitive key/);
});

test("rejects forbidden session, order, reading, report, query, and page detail keys", () => {
  for (const detailKey of ["session", "order", "reading", "report"]) {
    assert.throws(() => evaluateGrowthControl({
      run_date: "2026-07-30",
      search_console: searchConsole("2026-07-30"),
      [detailKey]: {},
    }), /sensitive key/);
  }

  for (const detailKey of ["query", "queries", "page", "pages"]) {
    const input = {
      run_date: "2026-07-30",
      search_console: searchConsole("2026-07-30"),
    };
    input.search_console[detailKey] = [];
    assert.throws(() => evaluateGrowthControl(input), /sensitive key/);
  }
});

test("rejects monetary aggregates from a mismatched provider window", () => {
  assert.throws(() => evaluateGrowthControl({
    run_date: "2026-07-30",
    search_console: searchConsole("2026-07-30"),
    scorecard: scorecard(),
    authority: READY_AUTHORITY,
    provider: {
      public_health_ok: true,
      paid_flow_incident: false,
      rolling_3d_start_date: "2026-07-26",
      rolling_3d_end_date: "2026-07-29",
      rolling_3d_spend_usd: 20,
      rolling_3d_settled_revenue_usd: 30,
    },
  }), /must match the rolling three-day/);
});

test("rejects a scorecard with a missing closed day", () => {
  const gapped = scorecard();
  gapped.days.splice(5, 1);
  assert.throws(() => evaluateGrowthControl({
    run_date: "2026-07-30",
    scorecard: gapped,
    authority: READY_AUTHORITY,
    provider: { public_health_ok: true, paid_flow_incident: false },
  }), /contiguous closed days/);
});

test("rejects a stale scorecard that does not include the latest closed day", () => {
  assert.throws(() => evaluateGrowthControl({
    run_date: "2026-07-31",
    scorecard: scorecard(),
    authority: READY_AUTHORITY,
    provider: { public_health_ok: true, paid_flow_incident: false },
  }), /latest closed Asia\/Taipei day/);
});

test("intersects claimed mutation access with the standing-authority contract", () => {
  const result = evaluateGrowthControl({
    run_date: "2026-07-30",
    search_console: searchConsole("2026-07-30"),
    scorecard: scorecard(),
    authority: READY_AUTHORITY,
    provider: {
      public_health_ok: true,
      paid_flow_incident: false,
      rolling_3d_start_date: "2026-07-27",
      rolling_3d_end_date: "2026-07-29",
      rolling_3d_spend_usd: 0,
      rolling_3d_settled_revenue_usd: 139.86,
      max_acceptable_cac_usd: 8,
    },
  }, DENY_STANDING_AUTHORITY);

  assert.equal(result.authority_policy.applied, true);
  assert.deepEqual(result.authority_policy.authorized_grants, []);
  assert.equal(result.authority_policy.paid_media.daily_cap, 0);
  assert.equal(result.missing_authorities.includes("deploy"), true);
  assert.equal(result.missing_authorities.includes("publish"), true);
  assert.equal(result.missing_authorities.includes("paid_media"), true);
  assert.equal(result.missing_authorities.includes("paid_flow_e2e"), true);
  assert.equal(result.action.execution_scope, "local_only_until_authorized");
});
