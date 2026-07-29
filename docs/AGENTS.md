# Documentation Rules

- Root `AGENTS.md` remains in force.
- `PROJECT_STATE.md` contains only recently verified present state; `BACKLOG.md` is the only active task list.
- Add a decision under `decisions/` only for a durable choice with meaningful alternatives.
- Put chronological narrative, completed prompts, dated campaign records, and superseded plans under `history/`.
- Do not copy secrets, personal addresses, raw customer data, or unredacted production payloads into documentation.
- When behavior changes, update the narrowest authoritative document; do not duplicate the same “current” fact across multiple files.
- Run `python3 scripts/harness.py verify --scope docs` after documentation changes.
