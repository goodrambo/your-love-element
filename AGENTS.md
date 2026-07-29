<!-- HARNESS_VERSION: 1.0.0 -->
# Your Love Element Agent Contract

This file is the durable repository contract. Keep it short. Codex loads it before work; detailed process and machine checks live under `harness/` and `scripts/harness.py`.

## Authority and memory

Use this order when information disagrees:

1. The user's current request and safety constraints.
2. Executable source, migrations, runtime configuration, and passing checks.
3. `docs/PROJECT_STATE.md` for recently verified production or operational state.
4. Accepted decisions under `docs/decisions/`.
5. Current runbooks and reference docs.
6. `docs/history/` and `artifacts/archive/` only as historical evidence.

History is never current by default. A nested `AGENTS.md` may add constraints for its subtree but must not weaken this contract.

## Required start sequence

Before editing:

1. Run `PYTHONDONTWRITEBYTECODE=1 python3 scripts/harness.py preflight`.
2. Read `docs/PROJECT_STATE.md`, `docs/BACKLOG.md`, and the matching route in `harness/routes.json`.
3. Read `git status --short --branch`; preserve unrelated and pre-existing changes.
4. State the change scope and its verification gate. If the baseline Harness fails, repair or report that failure before unrelated feature work.

## Working rules

- Project isolation is absolute: this contract authorizes writes only inside `/Users/suchinglun/Documents/Codex/product-lab/your-love-element`. Before any scheduled or interactive write, resolve both the working directory and Git top-level; if either is outside that exact root, stop without writing. Never read from, edit, run commands in, deploy, push, or call project-scoped services for a sibling/other project. The only non-project writes allowed are the existing `yle` automation metadata and disposable OS temporary files; neither may be used to alter another project.
- External-account isolation is equally absolute. Supabase, GitHub, Cloudflare, and Resend access must include the exact Your Love Element asset identifier from `harness/contracts.json`; never enumerate, inspect, mutate, deploy, delete, or reuse credentials for another asset in the same account. If a tool cannot scope the operation to the allowlisted asset before the call, do not use it.
- Make the smallest coherent change and verify it proportionally.
- Do not append session transcripts to active memory. Put only current facts in `PROJECT_STATE.md`, actionable work in `BACKLOG.md`, durable reasons in an ADR, and old narrative in `docs/history/`.
- Do not claim an external state is current after its `review_after` date without fresh evidence. Mark it `unknown` or `stale`.
- Local browser testing must stay in offline preview mode. Never point localhost at the production Worker or create real readings, checkouts, purchases, emails, ads, posts, or deployments without explicit user authorization.
- Do not expose secrets or personal test addresses in source, logs, docs, screenshots, or memory.
- Do not edit an existing Supabase migration. Add a new migration and update its inventory.
- Preserve the paid-flow invariants in `harness/contracts.json` unless the user explicitly approves an architecture change and the decision is recorded.
- Generated MP4, ZIP, QA sheets, campaign exports, and dated media packs belong under ignored `artifacts/`, not runtime `assets/`.
- Do not deploy, push, spend money, publish content, or mutate third-party systems unless the user explicitly requests that action.

## Required finish sequence

Before declaring a change complete:

1. Run `PYTHONDONTWRITEBYTECODE=1 python3 scripts/harness.py verify --scope auto`.
2. Run any additional scope-specific or manual checks named by the Harness.
3. Update `PROJECT_STATE.md` only when current behavior or verified external state changed; update `BACKLOG.md` when work status changed; add an ADR only for a durable decision.
4. Report PASS, FAIL, MANUAL_REQUIRED, and SKIPPED items honestly. A missing required check is not a pass.

Definition of done: requested behavior is implemented, relevant automated checks pass, required manual checks are named, active memory matches reality, and no unrelated user changes were overwritten.
