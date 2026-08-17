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

test("keeps exact GSC evidence access-blocked when live gsc_read is false", () => {
  const result = evaluateGrowthControl({
    run_date: "2026-08-15",
    search_console: searchConsole("2026-08-15", { clicks: 1001 }, 30),
    scorecard: null,
    authority: { gsc_read: false },
    provider: { public_health_ok: true, paid_flow_incident: false },
  });

  assert.equal(result.traffic.complete, true);
  assert.equal(result.active_stage, "gsc_traffic");
  assert.equal(result.status, "blocked_on_gsc_truth");
  assert.equal(result.primary_constraint, "access");
  assert.match(result.constraint_evidence.join(" "), /gsc_read is not currently available/);
  assert.deepEqual(result.action.missing_authority, ["gsc_read"]);
  assert.equal(result.action.execution_scope, "one_time_user_bootstrap_required");
});

test("CLI preserves the live GSC read gate despite a qualifying aggregate snapshot", () => {
  const completed = spawnSync(process.execPath, [CLI_PATH, "--input", "-"], {
    encoding: "utf8",
    input: JSON.stringify({
      run_date: "2026-08-15",
      search_console: searchConsole("2026-08-15", { clicks: 1001 }, 30),
      scorecard: null,
      authority: { gsc_read: false },
      provider: { public_health_ok: true, paid_flow_incident: false },
    }),
  });

  assert.equal(completed.status, 0, completed.stderr);
  const result = JSON.parse(completed.stdout);
  assert.equal(result.traffic.complete, true);
  assert.equal(result.active_stage, "gsc_traffic");
  assert.equal(result.status, "blocked_on_gsc_truth");
  assert.equal(result.primary_constraint, "access");
  assert.deepEqual(result.action.missing_authority, ["gsc_read"]);
  assert.equal(result.action.execution_scope, "one_time_user_bootstrap_required");
});

test("rejects undeclared Search Console aggregate and daily fields", () => {
  const withAggregateDetail = searchConsole("2026-08-15");
  withAggregateDetail.average_position = 6.3;
  assert.throws(() => evaluateGrowthControl({
    run_date: "2026-08-15",
    search_console: withAggregateDetail,
    scorecard: null,
    authority: { gsc_read: true },
    provider: { public_health_ok: true, paid_flow_incident: false },
  }), /Search Console aggregate contains unknown field: average_position/);

  const withDailyDetail = searchConsole("2026-08-15");
  withDailyDetail.days[0].ctr = 0.2;
  assert.throws(() => evaluateGrowthControl({
    run_date: "2026-08-15",
    search_console: withDailyDetail,
    scorecard: null,
    authority: { gsc_read: true },
    provider: { public_health_ok: true, paid_flow_incident: false },
  }), /Search Console day 0 contains unknown field: ctr/);
});

test("CLI emits no decision for undeclared Search Console daily fields", () => {
  const invalidSearchConsole = searchConsole("2026-08-15");
  invalidSearchConsole.days[0].ctr = 0.2;
  const completed = spawnSync(process.execPath, [CLI_PATH, "--input", "-"], {
    encoding: "utf8",
    input: JSON.stringify({
      run_date: "2026-08-15",
      search_console: invalidSearchConsole,
      scorecard: null,
      authority: { gsc_read: true },
      provider: { public_health_ok: true, paid_flow_incident: false },
    }),
  });

  assert.equal(completed.status, 2);
  assert.equal(completed.stdout, "");
  assert.match(completed.stderr, /Search Console day 0 contains unknown field: ctr/);
});

test("CLI emits no decision for a non-allowlisted GSC property", () => {
  const runDate = "2026-07-30";
  const wrongProperty = searchConsole(runDate, { clicks: 1001 });
  wrongProperty.property = "sc-domain:not-yourloveelement.invalid";
  const completed = spawnSync(process.execPath, [CLI_PATH, "--input", "-"], {
    encoding: "utf8",
    input: JSON.stringify({
      run_date: runDate,
      search_console: wrongProperty,
      scorecard: null,
      authority: { gsc_read: true },
      provider: { public_health_ok: true, paid_flow_incident: false },
    }),
  });

  assert.equal(completed.status, 2);
  assert.equal(completed.stdout, "");
  assert.match(completed.stderr, /Invalid aggregate Search Console contract/);
});

test("CLI emits no decision for a non-web GSC search type", () => {
  const runDate = "2026-07-30";
  const wrongSearchType = searchConsole(runDate, { clicks: 1001 });
  wrongSearchType.search_type = "discover";
  const completed = spawnSync(process.execPath, [CLI_PATH, "--input", "-"], {
    encoding: "utf8",
    input: JSON.stringify({
      run_date: runDate,
      search_console: wrongSearchType,
      scorecard: null,
      authority: { gsc_read: true },
      provider: { public_health_ok: true, paid_flow_incident: false },
    }),
  });

  assert.equal(completed.status, 2);
  assert.equal(completed.stdout, "");
  assert.match(completed.stderr, /Invalid aggregate Search Console contract/);
});

test("CLI emits no decision for GSC News clicks", () => {
  const runDate = "2026-07-30";
  const newsSearch = searchConsole(runDate, { clicks: 1001 });
  newsSearch.search_type = "news";
  const completed = spawnSync(process.execPath, [CLI_PATH, "--input", "-"], {
    encoding: "utf8",
    input: JSON.stringify({
      run_date: runDate,
      search_console: newsSearch,
      scorecard: null,
      authority: { gsc_read: true },
      provider: { public_health_ok: true, paid_flow_incident: false },
    }),
  });

  assert.equal(completed.status, 2);
  assert.equal(completed.stdout, "");
  assert.match(completed.stderr, /Invalid aggregate Search Console contract/);
});

test("CLI emits no decision for a non-property GSC aggregation", () => {
  const runDate = "2026-07-30";
  const wrongAggregation = searchConsole(runDate, { clicks: 1001 });
  wrongAggregation.aggregation = "country";
  const completed = spawnSync(process.execPath, [CLI_PATH, "--input", "-"], {
    encoding: "utf8",
    input: JSON.stringify({
      run_date: runDate,
      search_console: wrongAggregation,
      scorecard: null,
      authority: { gsc_read: true },
      provider: { public_health_ok: true, paid_flow_incident: false },
    }),
  });

  assert.equal(completed.status, 2);
  assert.equal(completed.stdout, "");
  assert.match(completed.stderr, /Invalid aggregate Search Console contract/);
});

test("CLI emits no decision for a non-GSC traffic timezone", () => {
  const runDate = "2026-07-30";
  const wrongTimezone = searchConsole(runDate, { clicks: 1001 });
  wrongTimezone.timezone = "Asia/Taipei";
  const completed = spawnSync(process.execPath, [CLI_PATH, "--input", "-"], {
    encoding: "utf8",
    input: JSON.stringify({
      run_date: runDate,
      search_console: wrongTimezone,
      scorecard: null,
      authority: { gsc_read: true },
      provider: { public_health_ok: true, paid_flow_incident: false },
    }),
  });

  assert.equal(completed.status, 2);
  assert.equal(completed.stdout, "");
  assert.match(completed.stderr, /Invalid aggregate Search Console contract/);
});

test("CLI emits no decision for a non-GSC traffic source", () => {
  const runDate = "2026-07-30";
  const wrongSource = searchConsole(runDate, { clicks: 1001 });
  wrongSource.source = "browser_analytics";
  const completed = spawnSync(process.execPath, [CLI_PATH, "--input", "-"], {
    encoding: "utf8",
    input: JSON.stringify({
      run_date: runDate,
      search_console: wrongSource,
      scorecard: null,
      authority: { gsc_read: true },
      provider: { public_health_ok: true, paid_flow_incident: false },
    }),
  });

  assert.equal(completed.status, 2);
  assert.equal(completed.stdout, "");
  assert.match(completed.stderr, /Invalid aggregate Search Console contract/);
});

test("CLI emits no decision when the GSC traffic source is missing", () => {
  const runDate = "2026-07-30";
  const missingSource = searchConsole(runDate, { clicks: 1001 });
  delete missingSource.source;
  const completed = spawnSync(process.execPath, [CLI_PATH, "--input", "-"], {
    encoding: "utf8",
    input: JSON.stringify({
      run_date: runDate,
      search_console: missingSource,
      scorecard: null,
      authority: { gsc_read: true },
      provider: { public_health_ok: true, paid_flow_incident: false },
    }),
  });

  assert.equal(completed.status, 2);
  assert.equal(completed.stdout, "");
  assert.match(completed.stderr, /Invalid aggregate Search Console contract/);
});

test("CLI emits no decision when a remaining required GSC identity field is missing", () => {
  const runDate = "2026-07-30";
  for (const field of [
    "property",
    "search_type",
    "aggregation",
    "data_state",
    "timezone",
    "privacy",
  ]) {
    const missingField = searchConsole(runDate, { clicks: 1001 });
    delete missingField[field];
    const completed = spawnSync(process.execPath, [CLI_PATH, "--input", "-"], {
      encoding: "utf8",
      input: JSON.stringify({
        run_date: runDate,
        search_console: missingField,
        scorecard: null,
        authority: { gsc_read: true },
        provider: { public_health_ok: true, paid_flow_incident: false },
      }),
    });

    assert.equal(completed.status, 2, field);
    assert.equal(completed.stdout, "", field);
    assert.match(
      completed.stderr,
      /Invalid aggregate Search Console contract/,
      field,
    );
  }
});

test("CLI emits no decision for Meta clicks", () => {
  const runDate = "2026-07-30";
  const metaClicks = searchConsole(runDate, { clicks: 1001 });
  metaClicks.source = "meta_clicks";
  const completed = spawnSync(process.execPath, [CLI_PATH, "--input", "-"], {
    encoding: "utf8",
    input: JSON.stringify({
      run_date: runDate,
      search_console: metaClicks,
      scorecard: null,
      authority: { gsc_read: true },
      provider: { public_health_ok: true, paid_flow_incident: false },
    }),
  });

  assert.equal(completed.status, 2);
  assert.equal(completed.stdout, "");
  assert.match(completed.stderr, /Invalid aggregate Search Console contract/);
});

test("CLI emits no decision for non-aggregate GSC privacy", () => {
  const runDate = "2026-07-30";
  const detailedSearch = searchConsole(runDate, { clicks: 1001 });
  detailedSearch.privacy = "query_rows";
  const completed = spawnSync(process.execPath, [CLI_PATH, "--input", "-"], {
    encoding: "utf8",
    input: JSON.stringify({
      run_date: runDate,
      search_console: detailedSearch,
      scorecard: null,
      authority: { gsc_read: true },
      provider: { public_health_ok: true, paid_flow_incident: false },
    }),
  });

  assert.equal(completed.status, 2);
  assert.equal(completed.stdout, "");
  assert.match(completed.stderr, /Invalid aggregate Search Console contract/);
});

test("CLI emits no decision for GSC query or page detail fields", () => {
  const runDate = "2026-07-30";
  for (const field of ["query", "page"]) {
    const detailedSearch = searchConsole(runDate, { clicks: 1001 });
    detailedSearch[field] = "synthetic-placeholder";
    const completed = spawnSync(process.execPath, [CLI_PATH, "--input", "-"], {
      encoding: "utf8",
      input: JSON.stringify({
        run_date: runDate,
        search_console: detailedSearch,
        scorecard: null,
        authority: { gsc_read: true },
        provider: { public_health_ok: true, paid_flow_incident: false },
      }),
    });

    assert.equal(completed.status, 2);
    assert.equal(completed.stdout, "");
    assert.match(completed.stderr, /Aggregate input rejected sensitive key/);
  }
});

test("CLI emits no decision for GSC daily query or page detail fields", () => {
  const runDate = "2026-07-30";
  for (const field of ["query", "page"]) {
    const detailedSearch = searchConsole(runDate, { clicks: 1001 });
    detailedSearch.days[0][field] = "synthetic-placeholder";
    const completed = spawnSync(process.execPath, [CLI_PATH, "--input", "-"], {
      encoding: "utf8",
      input: JSON.stringify({
        run_date: runDate,
        search_console: detailedSearch,
        scorecard: null,
        authority: { gsc_read: true },
        provider: { public_health_ok: true, paid_flow_incident: false },
      }),
    });

    assert.equal(completed.status, 2);
    assert.equal(completed.stdout, "");
    assert.match(completed.stderr, /Aggregate input rejected sensitive key/);
  }
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

test("stops an unmeasured experiment immediately when production breakage is reported", () => {
  const result = evaluateGrowthControl({
    run_date: "2026-08-18",
    search_console: searchConsole("2026-08-18", { clicks: 0 }, 19),
    scorecard: null,
    authority: { gsc_read: true },
    provider: { public_health_ok: false, paid_flow_incident: false },
    active_experiment: {
      started_on: "2026-08-13",
      eligible_sessions: null,
      baseline_primary_rate: null,
      current_primary_rate: null,
      baseline_guardrail_rate: null,
      current_guardrail_rate: null,
      has_breakage: true,
    },
  });

  assert.equal(result.experiment.decision, "stop");
  assert.equal(result.experiment.reason, "breakage reported");
  assert.equal(result.experiment.measurement_status, "unavailable");
  assert.equal(result.experiment.sample_days, 3);
  assert.equal(result.experiment.sample_basis, "final_gsc_days");
  assert.equal(result.experiment.sample_end_date, "2026-08-15");
  assert.equal(result.experiment.eligible_sessions, null);
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

test("CLI keeps thirty exactly-1000-click days in Stage 1", () => {
  const runDate = "2026-07-30";
  const completed = spawnSync(process.execPath, [CLI_PATH, "--input", "-"], {
    encoding: "utf8",
    input: JSON.stringify({
      run_date: runDate,
      search_console: searchConsole(runDate, { clicks: 1000, impressions: 100000 }),
      scorecard: null,
      authority: { gsc_read: true },
      provider: { public_health_ok: true, paid_flow_incident: false },
    }),
  });

  assert.equal(completed.status, 0, completed.stderr);
  const result = JSON.parse(completed.stdout);
  assert.equal(result.active_stage, "gsc_traffic");
  assert.equal(result.traffic.complete, false);
  assert.equal(result.traffic_streak, 0);
  assert.equal(result.traffic.rolling["30d"].clicks, 30000);
  assert.equal(result.traffic.rolling["30d"].qualifying_days, 0);
  assert.equal(result.action.id, "increase_final_gsc_web_clicks");
});

test("CLI advances only after thirty final days reach 1001 clicks", () => {
  const runDate = "2026-07-30";
  const completed = spawnSync(process.execPath, [CLI_PATH, "--input", "-"], {
    encoding: "utf8",
    input: JSON.stringify({
      run_date: runDate,
      search_console: searchConsole(runDate, { clicks: 1001, impressions: 100000 }),
      scorecard: null,
      authority: { gsc_read: true },
      provider: { public_health_ok: true, paid_flow_incident: false },
    }),
  });

  assert.equal(completed.status, 0, completed.stderr);
  const result = JSON.parse(completed.stdout);
  assert.equal(result.traffic.complete, true);
  assert.equal(result.traffic_streak, 30);
  assert.equal(result.traffic.rolling["30d"].clicks, 30030);
  assert.equal(result.traffic.rolling["30d"].qualifying_days, 30);
  assert.equal(result.active_stage, "verified_purchases");
  assert.equal(result.primary_constraint, "access");
  assert.equal(result.action.id, "complete_authority_and_scorecard_gate");
  assert.deepEqual(result.action.missing_authority, ["scorecard_read"]);
});

test("CLI resets a 29-day qualifying streak when the latest final day has 1000 clicks", () => {
  const runDate = "2026-07-30";
  const snapshot = searchConsole(runDate, { clicks: 1001, impressions: 100000 });
  snapshot.days.at(-1).clicks = 1000;
  const completed = spawnSync(process.execPath, [CLI_PATH, "--input", "-"], {
    encoding: "utf8",
    input: JSON.stringify({
      run_date: runDate,
      search_console: snapshot,
      scorecard: null,
      authority: { gsc_read: true },
      provider: { public_health_ok: true, paid_flow_incident: false },
    }),
  });

  assert.equal(completed.status, 0, completed.stderr);
  const result = JSON.parse(completed.stdout);
  assert.equal(result.traffic.latest_daily_clicks, 1000);
  assert.equal(result.traffic.rolling["30d"].qualifying_days, 29);
  assert.equal(result.traffic_streak, 0);
  assert.equal(result.traffic.complete, false);
  assert.equal(result.active_stage, "gsc_traffic");
  assert.equal(result.action.id, "increase_final_gsc_web_clicks");
});

test("CLI restarts the streak after a 1000-click interruption", () => {
  const runDate = "2026-07-30";
  const snapshot = searchConsole(runDate, { clicks: 1001, impressions: 100000 });
  snapshot.days.at(-2).clicks = 1000;
  const completed = spawnSync(process.execPath, [CLI_PATH, "--input", "-"], {
    encoding: "utf8",
    input: JSON.stringify({
      run_date: runDate,
      search_console: snapshot,
      scorecard: null,
      authority: { gsc_read: true },
      provider: { public_health_ok: true, paid_flow_incident: false },
    }),
  });

  assert.equal(completed.status, 0, completed.stderr);
  const result = JSON.parse(completed.stdout);
  assert.equal(result.traffic.latest_daily_clicks, 1001);
  assert.equal(result.traffic.rolling["30d"].qualifying_days, 29);
  assert.equal(result.traffic_streak, 1);
  assert.equal(result.traffic.complete, false);
  assert.equal(result.active_stage, "gsc_traffic");
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

test("CLI emits no decision when final GSC traffic evidence has a missing day", () => {
  const runDate = "2026-07-30";
  const gapped = searchConsole(runDate);
  gapped.days.splice(5, 1);
  const completed = spawnSync(process.execPath, [CLI_PATH, "--input", "-"], {
    encoding: "utf8",
    input: JSON.stringify({
      run_date: runDate,
      search_console: gapped,
      scorecard: null,
      authority: { gsc_read: true },
      provider: { public_health_ok: true, paid_flow_incident: false },
    }),
  });

  assert.equal(completed.status, 2);
  assert.equal(completed.stdout, "");
  assert.match(completed.stderr, /Search Console dates must be contiguous final days/);
});

test("CLI emits no decision when final GSC traffic evidence repeats a date", () => {
  const runDate = "2026-07-30";
  const duplicated = searchConsole(runDate);
  duplicated.days[5] = { ...duplicated.days[4] };
  const completed = spawnSync(process.execPath, [CLI_PATH, "--input", "-"], {
    encoding: "utf8",
    input: JSON.stringify({
      run_date: runDate,
      search_console: duplicated,
      scorecard: null,
      authority: { gsc_read: true },
      provider: { public_health_ok: true, paid_flow_incident: false },
    }),
  });

  assert.equal(completed.status, 2);
  assert.equal(completed.stdout, "");
  assert.match(completed.stderr, /Search Console contains duplicate dates/);
});

test("CLI emits no decision for preliminary GSC traffic evidence", () => {
  const runDate = "2026-07-30";
  const preliminary = searchConsole(runDate, { clicks: 1001 });
  preliminary.data_state = "preliminary";
  const completed = spawnSync(process.execPath, [CLI_PATH, "--input", "-"], {
    encoding: "utf8",
    input: JSON.stringify({
      run_date: runDate,
      search_console: preliminary,
      scorecard: null,
      authority: { gsc_read: true },
      provider: { public_health_ok: true, paid_flow_incident: false },
    }),
  });

  assert.equal(completed.status, 2);
  assert.equal(completed.stdout, "");
  assert.match(completed.stderr, /Invalid aggregate Search Console contract/);
});

test("CLI emits no decision for a negative GSC click count", () => {
  const runDate = "2026-07-30";
  const invalidCounts = searchConsole(runDate, { clicks: -1 });
  const completed = spawnSync(process.execPath, [CLI_PATH, "--input", "-"], {
    encoding: "utf8",
    input: JSON.stringify({
      run_date: runDate,
      search_console: invalidCounts,
      scorecard: null,
      authority: { gsc_read: true },
      provider: { public_health_ok: true, paid_flow_incident: false },
    }),
  });

  assert.equal(completed.status, 2);
  assert.equal(completed.stdout, "");
  assert.match(completed.stderr, /Invalid aggregate count: search_console\.days\[0\]\.clicks/);
});

test("CLI emits no decision for a fractional GSC click count above the threshold", () => {
  const runDate = "2026-07-30";
  const invalidCounts = searchConsole(runDate, { clicks: 1000.5 });
  const completed = spawnSync(process.execPath, [CLI_PATH, "--input", "-"], {
    encoding: "utf8",
    input: JSON.stringify({
      run_date: runDate,
      search_console: invalidCounts,
      scorecard: null,
      authority: { gsc_read: true },
      provider: { public_health_ok: true, paid_flow_incident: false },
    }),
  });

  assert.equal(completed.status, 2);
  assert.equal(completed.stdout, "");
  assert.match(completed.stderr, /Invalid aggregate count: search_console\.days\[0\]\.clicks/);
});

test("CLI emits no decision for a string GSC click count equal to 1001", () => {
  const runDate = "2026-07-30";
  const invalidCounts = searchConsole(runDate, { clicks: "1001" });
  const completed = spawnSync(process.execPath, [CLI_PATH, "--input", "-"], {
    encoding: "utf8",
    input: JSON.stringify({
      run_date: runDate,
      search_console: invalidCounts,
      scorecard: null,
      authority: { gsc_read: true },
      provider: { public_health_ok: true, paid_flow_incident: false },
    }),
  });

  assert.equal(completed.status, 2);
  assert.equal(completed.stdout, "");
  assert.match(completed.stderr, /Invalid aggregate count: search_console\.days\[0\]\.clicks/);
});

test("CLI emits no decision for invalid GSC impression counts", () => {
  const runDate = "2026-07-30";
  for (const impressions of [-1, 0.5, "1"]) {
    const invalidCounts = searchConsole(runDate, { clicks: 1001 });
    invalidCounts.days[0].impressions = impressions;
    const completed = spawnSync(process.execPath, [CLI_PATH, "--input", "-"], {
      encoding: "utf8",
      input: JSON.stringify({
        run_date: runDate,
        search_console: invalidCounts,
        scorecard: null,
        authority: { gsc_read: true },
        provider: { public_health_ok: true, paid_flow_incident: false },
      }),
    });

    assert.equal(completed.status, 2, String(impressions));
    assert.equal(completed.stdout, "", String(impressions));
    assert.match(
      completed.stderr,
      /Invalid aggregate count: search_console\.days\[0\]\.impressions/,
      String(impressions),
    );
  }
});

test("CLI emits no decision when a required GSC daily field is missing", () => {
  const runDate = "2026-07-30";
  for (const [field, expectedError] of [
    ["date", /Invalid search_console\.days\[0\]\.date/],
    ["clicks", /Invalid aggregate count: search_console\.days\[0\]\.clicks/],
    ["impressions", /Invalid aggregate count: search_console\.days\[0\]\.impressions/],
  ]) {
    const missingField = searchConsole(runDate, { clicks: 1001 });
    delete missingField.days[0][field];
    const completed = spawnSync(process.execPath, [CLI_PATH, "--input", "-"], {
      encoding: "utf8",
      input: JSON.stringify({
        run_date: runDate,
        search_console: missingField,
        scorecard: null,
        authority: { gsc_read: true },
        provider: { public_health_ok: true, paid_flow_incident: false },
      }),
    });

    assert.equal(completed.status, 2, field);
    assert.equal(completed.stdout, "", field);
    assert.match(completed.stderr, expectedError, field);
  }
});

test("CLI emits no decision when a required GSC aggregate envelope field is missing", () => {
  const runDate = "2026-07-30";
  for (const [field, expectedError] of [
    ["fetched_on", /Invalid search_console\.fetched_on/],
    ["start_date", /Invalid search_console\.start_date/],
    ["end_date", /Invalid search_console\.end_date/],
    ["days", /Invalid aggregate Search Console contract/],
  ]) {
    const missingField = searchConsole(runDate, { clicks: 1001 });
    delete missingField[field];
    const completed = spawnSync(process.execPath, [CLI_PATH, "--input", "-"], {
      encoding: "utf8",
      input: JSON.stringify({
        run_date: runDate,
        search_console: missingField,
        scorecard: null,
        authority: { gsc_read: true },
        provider: { public_health_ok: true, paid_flow_incident: false },
      }),
    });

    assert.equal(completed.status, 2, field);
    assert.equal(completed.stdout, "", field);
    assert.match(completed.stderr, expectedError, field);
  }
});

test("CLI emits no decision when search_console is not an object", () => {
  const runDate = "2026-07-30";
  for (const searchConsoleValue of ["not-gsc", 1001, []]) {
    const completed = spawnSync(process.execPath, [CLI_PATH, "--input", "-"], {
      encoding: "utf8",
      input: JSON.stringify({
        run_date: runDate,
        search_console: searchConsoleValue,
        scorecard: null,
        authority: { gsc_read: true },
        provider: { public_health_ok: true, paid_flow_incident: false },
      }),
    });

    assert.equal(completed.status, 2);
    assert.equal(completed.stdout, "");
    assert.match(completed.stderr, /Invalid Search Console aggregate/);
  }
});

test("CLI emits no decision when the GSC aggregate has no final days", () => {
  const runDate = "2026-07-30";
  const emptyAggregate = searchConsole(runDate, { clicks: 1001 });
  emptyAggregate.days = [];
  const completed = spawnSync(process.execPath, [CLI_PATH, "--input", "-"], {
    encoding: "utf8",
    input: JSON.stringify({
      run_date: runDate,
      search_console: emptyAggregate,
      scorecard: null,
      authority: { gsc_read: true },
      provider: { public_health_ok: true, paid_flow_incident: false },
    }),
  });

  assert.equal(completed.status, 2);
  assert.equal(completed.stdout, "");
  assert.match(completed.stderr, /Search Console aggregate requires at least one final day/);
});

test("CLI emits no decision when GSC days is not an array", () => {
  const runDate = "2026-07-30";
  for (const days of [null, {}, "2026-07-01"]) {
    const malformedAggregate = searchConsole(runDate, { clicks: 1001 });
    malformedAggregate.days = days;
    const completed = spawnSync(process.execPath, [CLI_PATH, "--input", "-"], {
      encoding: "utf8",
      input: JSON.stringify({
        run_date: runDate,
        search_console: malformedAggregate,
        scorecard: null,
        authority: { gsc_read: true },
        provider: { public_health_ok: true, paid_flow_incident: false },
      }),
    });

    assert.equal(completed.status, 2);
    assert.equal(completed.stdout, "");
    assert.match(completed.stderr, /Invalid aggregate Search Console contract/);
  }
});

test("CLI emits no decision when a GSC day is not an object", () => {
  const runDate = "2026-07-30";
  for (const day of [null, "2026-07-01", 1001]) {
    const malformedAggregate = searchConsole(runDate, { clicks: 1001 });
    malformedAggregate.days = [day];
    const completed = spawnSync(process.execPath, [CLI_PATH, "--input", "-"], {
      encoding: "utf8",
      input: JSON.stringify({
        run_date: runDate,
        search_console: malformedAggregate,
        scorecard: null,
        authority: { gsc_read: true },
        provider: { public_health_ok: true, paid_flow_incident: false },
      }),
    });

    assert.equal(completed.status, 2);
    assert.equal(completed.stdout, "");
    assert.match(completed.stderr, /Invalid Search Console day 0/);
  }
});

test("CLI emits no decision when the GSC range start does not match its first final day", () => {
  const runDate = "2026-07-30";
  const mismatchedRange = searchConsole(runDate, { clicks: 1001 });
  mismatchedRange.start_date = addDays(mismatchedRange.start_date, -1);
  const completed = spawnSync(process.execPath, [CLI_PATH, "--input", "-"], {
    encoding: "utf8",
    input: JSON.stringify({
      run_date: runDate,
      search_console: mismatchedRange,
      scorecard: null,
      authority: { gsc_read: true },
      provider: { public_health_ok: true, paid_flow_incident: false },
    }),
  });

  assert.equal(completed.status, 2);
  assert.equal(completed.stdout, "");
  assert.match(completed.stderr, /Search Console range must match its final metric days/);
});

test("CLI emits no decision when the GSC range end does not match its last final day", () => {
  const runDate = "2026-07-30";
  const mismatchedRange = searchConsole(runDate, { clicks: 1001 });
  mismatchedRange.end_date = addDays(mismatchedRange.end_date, 1);
  const completed = spawnSync(process.execPath, [CLI_PATH, "--input", "-"], {
    encoding: "utf8",
    input: JSON.stringify({
      run_date: runDate,
      search_console: mismatchedRange,
      scorecard: null,
      authority: { gsc_read: true },
      provider: { public_health_ok: true, paid_flow_incident: false },
    }),
  });

  assert.equal(completed.status, 2);
  assert.equal(completed.stdout, "");
  assert.match(completed.stderr, /Search Console range must match its final metric days/);
});

test("CLI emits no decision when GSC marks the run date as final", () => {
  const runDate = "2026-07-30";
  const sameDayFinal = searchConsole(runDate, { clicks: 1001 });
  sameDayFinal.days = sameDayFinal.days.map((day) => ({
    ...day,
    date: addDays(day.date, 3),
  }));
  sameDayFinal.start_date = sameDayFinal.days[0].date;
  sameDayFinal.end_date = runDate;
  const completed = spawnSync(process.execPath, [CLI_PATH, "--input", "-"], {
    encoding: "utf8",
    input: JSON.stringify({
      run_date: runDate,
      search_console: sameDayFinal,
      scorecard: null,
      authority: { gsc_read: true },
      provider: { public_health_ok: true, paid_flow_incident: false },
    }),
  });

  assert.equal(completed.status, 2);
  assert.equal(completed.stdout, "");
  assert.match(completed.stderr, /Search Console final data must precede the run date/);
});

test("CLI emits no decision when the GSC aggregate was not fetched on the run date", () => {
  const runDate = "2026-07-30";
  const staleSnapshot = searchConsole(runDate, { clicks: 1001 });
  staleSnapshot.fetched_on = addDays(runDate, -1);
  const completed = spawnSync(process.execPath, [CLI_PATH, "--input", "-"], {
    encoding: "utf8",
    input: JSON.stringify({
      run_date: runDate,
      search_console: staleSnapshot,
      scorecard: null,
      authority: { gsc_read: true },
      provider: { public_health_ok: true, paid_flow_incident: false },
    }),
  });

  assert.equal(completed.status, 2);
  assert.equal(completed.stdout, "");
  assert.match(completed.stderr, /Search Console aggregate must be fetched on the run date/);
});

test("CLI emits no decision when run_date is missing or invalid", () => {
  const validRunDate = "2026-07-30";
  for (const runDate of [undefined, "2026-02-30", "2026-07-30T00:00:00Z"]) {
    const input = {
      search_console: searchConsole(validRunDate, { clicks: 1001 }),
      scorecard: null,
      authority: { gsc_read: true },
      provider: { public_health_ok: true, paid_flow_incident: false },
    };
    if (runDate !== undefined) {
      input.run_date = runDate;
    }
    const completed = spawnSync(process.execPath, [CLI_PATH, "--input", "-"], {
      encoding: "utf8",
      input: JSON.stringify(input),
    });

    assert.equal(completed.status, 2);
    assert.equal(completed.stdout, "");
    assert.match(completed.stderr, /Invalid run_date/);
  }
});

test("CLI emits no decision for undeclared top-level input fields", () => {
  const runDate = "2026-07-30";
  const completed = spawnSync(process.execPath, [CLI_PATH, "--input", "-"], {
    encoding: "utf8",
    input: JSON.stringify({
      run_date: runDate,
      search_console: searchConsole(runDate, { clicks: 1001 }),
      scorecard: null,
      authority: { gsc_read: true },
      provider: { public_health_ok: true, paid_flow_incident: false },
      active_experiment: null,
      browser_analytics: { visits: 5000 },
    }),
  });

  assert.equal(completed.status, 2);
  assert.equal(completed.stdout, "");
  assert.match(completed.stderr, /Growth control input contains unknown field: browser_analytics/);
});

test("CLI emits no decision for undeclared provider or authority fields", () => {
  const runDate = "2026-07-30";
  const cases = [
    {
      mutate: (input) => { input.provider.browser_analytics = { visits: 5000 }; },
      expected: /Provider contains unknown field: browser_analytics/,
    },
    {
      mutate: (input) => { input.authority.admin = true; },
      expected: /Authority contains unknown field: admin/,
    },
  ];

  for (const { mutate, expected } of cases) {
    const input = {
      run_date: runDate,
      search_console: searchConsole(runDate, { clicks: 1001 }),
      scorecard: null,
      authority: { gsc_read: true },
      provider: { public_health_ok: true, paid_flow_incident: false },
      active_experiment: null,
    };
    mutate(input);
    const completed = spawnSync(process.execPath, [CLI_PATH, "--input", "-"], {
      encoding: "utf8",
      input: JSON.stringify(input),
    });

    assert.equal(completed.status, 2);
    assert.equal(completed.stdout, "");
    assert.match(completed.stderr, expected);
  }
});

test("CLI emits no decision for undeclared active experiment fields", () => {
  const runDate = "2026-07-30";
  const completed = spawnSync(process.execPath, [CLI_PATH, "--input", "-"], {
    encoding: "utf8",
    input: JSON.stringify({
      run_date: runDate,
      search_console: searchConsole(runDate, { clicks: 1001 }),
      scorecard: null,
      authority: { gsc_read: true },
      provider: { public_health_ok: true, paid_flow_incident: false },
      active_experiment: {
        started_on: "2026-07-28",
        eligible_sessions: null,
        baseline_primary_rate: null,
        current_primary_rate: null,
        baseline_guardrail_rate: null,
        current_guardrail_rate: null,
        has_breakage: false,
        projected_lift: 1,
      },
    }),
  });

  assert.equal(completed.status, 2);
  assert.equal(completed.stdout, "");
  assert.match(completed.stderr, /Active experiment contains unknown field: projected_lift/);
});

test("CLI emits no decision for invalid active experiment value types", () => {
  const runDate = "2026-07-30";
  const cases = [
    {
      mutate: (experiment) => { experiment.baseline_primary_rate = "0.25"; },
      expected: /Invalid active experiment rate/,
    },
    {
      mutate: (experiment) => { experiment.has_breakage = "false"; },
      expected: /Invalid active experiment has_breakage/,
    },
    {
      mutate: (experiment) => { experiment.minimum_relative_lift = "0.05"; },
      expected: /Invalid active experiment minimum relative lift/,
    },
  ];

  for (const { mutate, expected } of cases) {
    const activeExperiment = {
      started_on: "2026-07-20",
      eligible_sessions: 250,
      baseline_primary_rate: 0.25,
      current_primary_rate: 0.28,
      baseline_guardrail_rate: 0.10,
      current_guardrail_rate: 0.11,
      has_breakage: false,
    };
    mutate(activeExperiment);
    const completed = spawnSync(process.execPath, [CLI_PATH, "--input", "-"], {
      encoding: "utf8",
      input: JSON.stringify({
        run_date: runDate,
        search_console: searchConsole(runDate, { clicks: 1001 }),
        scorecard: null,
        authority: { gsc_read: true },
        provider: { public_health_ok: true, paid_flow_incident: false },
        active_experiment: activeExperiment,
      }),
    });

    assert.equal(completed.status, 2);
    assert.equal(completed.stdout, "");
    assert.match(completed.stderr, expected);
  }
});

test("CLI emits no decision for invalid GSC calendar dates", () => {
  const runDate = "2026-07-30";
  const cases = [
    {
      mutate: (aggregate) => { aggregate.days[0].date = "2026-02-30"; },
      expected: /Invalid search_console\.days\[0\]\.date/,
    },
    {
      mutate: (aggregate) => { aggregate.start_date = "2026-02-30"; },
      expected: /Invalid search_console\.start_date/,
    },
    {
      mutate: (aggregate) => { aggregate.end_date = "2026-02-30"; },
      expected: /Invalid search_console\.end_date/,
    },
    {
      mutate: (aggregate) => { aggregate.fetched_on = "2026-07-30T00:00:00Z"; },
      expected: /Invalid search_console\.fetched_on/,
    },
  ];

  for (const { mutate, expected } of cases) {
    const invalidDateAggregate = searchConsole(runDate, { clicks: 1001 });
    mutate(invalidDateAggregate);
    const completed = spawnSync(process.execPath, [CLI_PATH, "--input", "-"], {
      encoding: "utf8",
      input: JSON.stringify({
        run_date: runDate,
        search_console: invalidDateAggregate,
        scorecard: null,
        authority: { gsc_read: true },
        provider: { public_health_ok: true, paid_flow_incident: false },
      }),
    });

    assert.equal(completed.status, 2);
    assert.equal(completed.stdout, "");
    assert.match(completed.stderr, expected);
  }
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

test("keeps deploy unavailable when live access is false despite a standing grant", () => {
  const contracts = JSON.parse(readFileSync(new URL("../../harness/contracts.json", import.meta.url), "utf8"));
  const result = evaluateGrowthControl({
    run_date: "2026-08-15",
    search_console: searchConsole("2026-08-15", { clicks: 0, impressions: 0 }, 16),
    scorecard: null,
    authority: { gsc_read: true, deploy: false },
    provider: {
      public_health_ok: true,
      paid_flow_incident: false,
      rolling_3d_start_date: "2026-08-12",
      rolling_3d_end_date: "2026-08-14",
      rolling_3d_spend_usd: null,
      rolling_3d_settled_revenue_usd: null,
      max_acceptable_cac_usd: null,
    },
  }, contracts.standing_authority);

  assert.equal(result.authority_policy.authorized_grants.includes("deploy_frontend"), true);
  assert.equal(result.primary_constraint, "traffic");
  assert.equal(result.missing_authorities.includes("deploy"), true);
  assert.deepEqual(result.action.missing_authority, ["deploy"]);
  assert.equal(result.action.execution_scope, "local_only_until_authorized");
});

test("CLI preserves live deploy denial while applying the standing-authority contract", () => {
  const completed = spawnSync(process.execPath, [CLI_PATH, "--input", "-"], {
    encoding: "utf8",
    input: JSON.stringify({
      run_date: "2026-08-15",
      search_console: searchConsole("2026-08-15", { clicks: 0, impressions: 0 }, 16),
      scorecard: null,
      authority: { gsc_read: true, deploy: false },
      provider: {
        public_health_ok: true,
        paid_flow_incident: false,
        rolling_3d_start_date: "2026-08-12",
        rolling_3d_end_date: "2026-08-14",
        rolling_3d_spend_usd: null,
        rolling_3d_settled_revenue_usd: null,
        max_acceptable_cac_usd: null,
      },
    }),
  });

  assert.equal(completed.status, 0, completed.stderr);
  const result = JSON.parse(completed.stdout);
  assert.equal(result.authority_policy.applied, true);
  assert.equal(result.authority_policy.authorized_grants.includes("deploy_frontend"), true);
  assert.deepEqual(result.action.missing_authority, ["deploy"]);
  assert.equal(result.action.execution_scope, "local_only_until_authorized");
});
