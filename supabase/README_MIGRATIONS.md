Applying migrations to your Supabase/Postgres instance

This project stores SQL migrations under `supabase/migrations/`.

Two easy ways to apply the migration `supabase/migrations/20251107_add_versions_and_idempotency.sql`:

1) Using the `psql` CLI (recommended when you have a DATABASE_URL):

   ```bash
   # Example (replace with your real DATABASE_URL):
   export DATABASE_URL=postgres://user:password@db.host:5432/database
   ./scripts/apply_migration.sh supabase/migrations/20251107_add_versions_and_idempotency.sql
   ```

   The helper script uses `psql` and requires it to be on your PATH. It will fail-fast on SQL errors.

2) Using the Supabase CLI:

   If you have the `supabase` CLI configured and a project context set, you can run:

   ```bash
   supabase db remote set <YOUR_DB_URL>
   supabase db execute --file supabase/migrations/20251107_add_versions_and_idempotency.sql
   ```

Notes and safety
- Review the SQL file before applying to production. The migration adds `version` columns to `modules` and `lessons` and creates an `idempotency_keys` table — these are additive but still worth verifying in your environment.
- If you use managed Supabase, ensure your connection allows schema changes and you have a recent backup before applying.

If you'd like, I can also add a small Node-based migration runner that uses `psql` or `pg` and validates the connection first — tell me if you'd prefer that.
