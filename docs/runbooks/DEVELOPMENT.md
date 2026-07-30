# Local Development

## Start safely

```bash
PYTHONDONTWRITEBYTECODE=1 python3 scripts/harness.py preflight
python3 -m http.server 8765
```

Use `http://localhost:8765/`. `assets/runtime-config.js` deliberately disables the production API on localhost. The free preview can use local storage; checkout and paid-state actions are unavailable.

Do not override the local guard with the production Worker URL for ordinary smoke tests.

## Verify

```bash
PYTHONDONTWRITEBYTECODE=1 python3 scripts/harness.py verify --scope auto
```

The verifier checks Harness consistency, JS syntax, HTML references, JSON-LD, cache revisions, migrations, protected invariants, secrets, and large active artifacts. Browser/visual behavior remains `MANUAL_REQUIRED` when frontend files change.
