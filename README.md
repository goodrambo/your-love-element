# Your Love Element

An English-market Five Element-inspired relationship reading product with a free 10-question preview and an optional `$9.99 USD` personalized report delivered by email.

## Current status

Production is live, but this worktree also contains an unpublished landing-page redesign and the new project Harness. Treat the live deployment and local files as different states until the local changes are reviewed, committed, deployed, and verified.

Start here:

- Current verified state: [`docs/PROJECT_STATE.md`](docs/PROJECT_STATE.md)
- Active work: [`docs/BACKLOG.md`](docs/BACKLOG.md)
- Agent contract: [`AGENTS.md`](AGENTS.md)
- Harness: [`harness/README.md`](harness/README.md)
- Knowledge map: [`docs/README.md`](docs/README.md)

## Architecture

```text
GitHub Pages static frontend
  -> Cloudflare Worker
  -> Supabase
  -> Lemon Squeezy checkout/webhooks
  -> OpenAI report generation
  -> Resend email delivery
  -> Meta Pixel + server-side CAPI Purchase
```

Runtime source is intentionally dependency-light: HTML, CSS, browser JavaScript, a single Worker JavaScript file, and SQL migrations.

## Safe local use

```bash
PYTHONDONTWRITEBYTECODE=1 python3 scripts/harness.py preflight
python3 -m http.server 8765
```

Open `http://localhost:8765/`. Localhost uses offline preview mode and must not write to the production API.

Before handoff:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 scripts/harness.py verify --scope auto
```

After a fresh clone, run `git config core.hooksPath .githooks`. In Codex, review and trust the exact project hook hash with `/hooks`; hook changes require review again. Remote enforcement also requires the tracked workflow to be committed/pushed and configured as a required check.

Production deployment, checkout, email, social publishing, and paid-ad actions require explicit authorization and their relevant runbook.
