---
status: accepted
date: 2026-07-12
---

# 0001 — Harness and Memory Authority

## Context

The project accumulated a 1,510-line handoff, multiple files claiming to be current, expired schedules, and contradictory next steps. Most newer knowledge was untracked.

## Decision

Use a layered Harness:

- `AGENTS.md` is the concise per-run behavioral contract.
- `harness/contracts.json` and `scripts/harness.py` are the machine-enforced contract.
- `docs/PROJECT_STATE.md` is the sole current snapshot.
- `docs/BACKLOG.md` is the sole active task list.
- ADRs hold durable rationale; runbooks hold procedures; history never overrides current state.
- Codex lifecycle hooks, a Git pre-commit hook, and GitHub Actions reuse the same verifier.

## Consequences

Session narrative can no longer be appended to active memory. External claims expire and become unknown without new evidence. Changing a protected invariant requires an explicit decision and contract update.
