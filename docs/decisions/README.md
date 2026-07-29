# Architecture Decisions

Decision records explain durable choices and their consequences. They are append-only evidence, not a chronological task log.

- `0001`: Harness and memory authority.
- `0002`: Worker boundary and dynamic checkout.
- `0003`: Server-only Meta Purchase.
- `0004`: Idempotent report delivery and monotonic state.
- `0005`: Artifact separation and archive policy.

If a decision changes, add a new ADR that explicitly supersedes the old one. Do not silently rewrite the original rationale.
