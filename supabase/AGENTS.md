# Supabase Rules

- Root `AGENTS.md` remains in force.
- Existing migrations are immutable and protected by checksums in `harness/contracts.json`.
- Add a new timestamped migration for every schema or policy change; never rewrite an applied file.
- Keep product tables behind RLS with service-role-only access. The browser must not talk directly to Supabase.
- Update `supabase/README.md` and the Harness inventory when a migration is added.
