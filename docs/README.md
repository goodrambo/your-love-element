# Your Love Element Knowledge Map

Last reviewed: 2026-07-12

This directory is routed documentation, not one flat memory store. Start from current state and load only the reference needed for the task.

## Authority

1. Current verified state: [`PROJECT_STATE.md`](PROJECT_STATE.md)
2. Active tasks: [`BACKLOG.md`](BACKLOG.md)
3. Durable decisions: [`decisions/`](decisions/)
4. Procedures: [`runbooks/`](runbooks/)
5. Implementation and product reference: numbered documents below
6. Historical evidence: [`history/`](history/) — never current by default

Machine routing lives in [`../harness/routes.json`](../harness/routes.json). Project-wide behavior lives in [`../AGENTS.md`](../AGENTS.md).

## Reference map

- [`01-product-blueprint.md`](01-product-blueprint.md): product positioning, funnel, price, free/paid boundary.
- [`02-architecture-overview.md`](02-architecture-overview.md): system topology and state machine.
- [`03-frontend-implementation.md`](03-frontend-implementation.md): pages, quiz, preview, local runtime guard, share card, browser events.
- [`04-backend-worker-implementation.md`](04-backend-worker-implementation.md): routes, checkout, webhook, queue, report, email, health.
- [`05-supabase-database.md`](05-supabase-database.md): tables, migrations, constraints, RLS.
- [`06-commerce-and-fulfillment.md`](06-commerce-and-fulfillment.md): Lemon Squeezy and delivery flow.
- [`07-ai-report-generation.md`](07-ai-report-generation.md): deterministic scoring, generation, normalization, rendering.
- [`08-tracking-and-analytics.md`](08-tracking-and-analytics.md): Pixel, CAPI, event definitions, UTM.
- [`09-visual-assets-and-social.md`](09-visual-assets-and-social.md): runtime visual assets and reusable social guidance.
- [`SEO_GEO_AEO_PLAN.md`](SEO_GEO_AEO_PLAN.md): organic search, answer-engine, and generative-search strategy, implementation, guardrails, and measurement sequence.
- [`11-deployment-and-operations.md`](11-deployment-and-operations.md): hosting, health, monitoring, recovery.
- [`12-pitfalls-and-guardrails.md`](12-pitfalls-and-guardrails.md): known high-risk regressions.
- [`13-new-product-playbook.md`](13-new-product-playbook.md): reusable product-building playbook.
- [`14-third-party-platforms.md`](14-third-party-platforms.md): platform inventory and ownership boundaries.

The earlier Meta launch narrative and launch kits are dated records under [`history/`](history/), not active setup instructions.

## Runtime source map

- Frontend: `index.html`, `full-report/index.html`, legal/support page folders.
- Shared browser behavior: `script.js`.
- Visual system: `styles.css`.
- Environment guard: `assets/runtime-config.js`.
- Tracking config: `assets/tracking-config.js`, `assets/meta-pixel-base.js`.
- Backend: `worker/src/index.js`, `worker/wrangler.toml`.
- Database: `supabase/migrations/`.
- Runtime images: `assets/elements/`, `assets/share-templates/`, logo/hero/social-preview files.
- Non-runtime generated media: ignored `artifacts/`.

## Stable production identifiers

These are implementation configuration, not proof of current external health:

- Site: `https://yourloveelement.com`
- Worker: `https://your-love-element-api.goodrambo2013.workers.dev`
- Supabase project ref: `nmwhaiimnuywnjlvobde`
- Lemon Squeezy store ID: `365266`
- Meta Pixel / Dataset ID: `4282306195342317`
- Worker name: `your-love-element-api`

Use `PROJECT_STATE.md` for dated verification evidence.
