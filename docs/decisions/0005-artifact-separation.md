---
status: accepted
date: 2026-07-12
---

# 0005 — Artifact Separation and Archive Policy

## Context

Generated social and ad media consumed roughly 1.4 GB in active paths, including dated packs, ZIPs containing the same files, QA sheets, and multiple render revisions.

## Decision

Only files required by the running site belong in `assets/`. Generated media, campaign exports, QA output, demos, and dated delivery packages belong in ignored `artifacts/`. Historical text belongs in `docs/history/`.

Archives are preserved but are never current or publishable by default. New large binaries outside `artifacts/` fail the Harness.

## Consequences

Future media work restores only necessary sources, writes generated output to `artifacts/`, and records a release manifest. Git LFS or external object storage can be adopted later without changing runtime layout.
