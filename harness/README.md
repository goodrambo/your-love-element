# Project Harness

Harness version: `1.0.0`

The Harness keeps project instructions, current memory, machine contracts, and verification synchronized. It is deliberately dependency-free apart from Python 3 and an available Node binary for JavaScript syntax checks.

## Enforcement layers

1. Root and nested `AGENTS.md` files define durable behavior and routing.
2. `contracts.json` defines machine-checkable paths, revisions, migrations, and protected invariants.
3. `scripts/harness.py` performs preflight, verification, live read-only checks, and maintenance reporting.
4. `.codex/hooks.json` runs preflight at session start/compaction and verify before a Codex turn stops.
5. `.githooks/pre-commit` runs the same verifier for local commits.
6. `.github/workflows/harness.yml` runs the same verifier on pushes and pull requests.

Project-local Codex hooks run only in a trusted repository and must be reviewed once after changes. Use `/hooks` in Codex to review and trust them. `AGENTS.md` and CI remain effective even before hook trust.

After a fresh clone, enable the tracked Git hook once:

```bash
git config core.hooksPath .githooks
```

## Commands

```bash
PYTHONDONTWRITEBYTECODE=1 python3 scripts/harness.py preflight
PYTHONDONTWRITEBYTECODE=1 python3 scripts/harness.py verify --scope auto
PYTHONDONTWRITEBYTECODE=1 python3 scripts/harness.py live
PYTHONDONTWRITEBYTECODE=1 python3 scripts/harness.py maintenance
```

The verifier reports:

- `PASS`: verified automatically.
- `FAIL`: contract violation; do not finish or commit.
- `MANUAL_REQUIRED`: a changed high-risk surface needs named human/browser/E2E evidence.
- `SKIPPED`: legitimately out of scope or intentionally not run; never present it as a pass.

Manual evidence is bound to the exact digest of the files it covers. A `waived` paid-flow record is a narrow, dated exception shown as `SKIPPED`, never a passing E2E; any protected source change invalidates it. CI blocks stale or missing paid-flow evidence.

## Memory protocol

- Present external state: `docs/PROJECT_STATE.md`, with evidence and expiry.
- Active work: `docs/BACKLOG.md` only.
- Durable decisions: `docs/decisions/`.
- Procedures: `docs/runbooks/`.
- Historical narrative: `docs/history/`.
- Per-session baselines/results: ignored `.harness/`.

Do not add more active memory layers. If a repeated failure appears, add the smallest rule and a mechanical regression check where possible.

## Intentional changes to protected contracts

If the user approves an architectural change:

1. Add a superseding ADR.
2. Change implementation and tests.
3. Update `contracts.json` in the same change.
4. Run full verification and the relevant manual/E2E gate.
5. Update current state with fresh evidence.

Never weaken a contract merely to make a failing check green.
