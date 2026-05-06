validate_prod_db.mjs — Production DB validation (read-only)
=========================================================

Purpose
-------

Small read-only Node script to verify that a production Postgres (Supabase) schema includes critical migrations, indexes, canonical columns, and RLS on protected tables.

It is intentionally non-destructive and only queries pg_catalog / information_schema.

Usage
-----

Run on a machine that has the application's DATABASE_URL available (CI, host, or locally with a production DB replica):

```bash
DATABASE_URL=postgres://user:pass@host:5432/dbname node scripts/validate_prod_db.mjs
```

Exit codes
----------
- 0: validation passed
- 2: validation failed (missing migrations / indexes / RLS not enabled)
- 1: unexpected runtime error (connection problem, unexpected exception)

Checks performed
----------------
- Migrations: verifies the presence of three specific migration files recorded in `supabase_migrations.schema_migrations`.
- Index: verifies a canonical unique organization/user membership index exists.
- Columns: ensures critical org-scoped tables have canonical `organization_id` columns.
- RLS: checks that row-level security is enabled on a list of protected tables.
- Warnings only: missing optional views, legacy `org_id` columns still present, and optional triggers absent.

Notes
-----
- CI should run this only when `DATABASE_URL` is present.
- If your project records migrations in a different schema/table, adjust the script accordingly.
