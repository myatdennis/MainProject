This folder contains SQL migrations you can apply to your Postgres database.

2026-03-28_add_user_profiles_and_harden_org_invites.sql
- Purpose: create canonical profile and membership tables if missing and harmonize
  `org_invites` so both `organization_id` and legacy `org_id` are present. It
  also creates helpful indexes and will only set NOT NULL on `organization_id`
  if there are no null values.

How to run (safe steps)
1. Backup your database (recommended):

   pg_dump -Fc --file=backup.pre-user-profiles.dump "${DATABASE_URL}"

2. Run the migration with psql (replace connection string):

   psql "${DATABASE_URL}" -f migrations/2026-03-28_add_user_profiles_and_harden_org_invites.sql

3. Verify:

   psql "${DATABASE_URL}" -c "SELECT COUNT(*) FROM public.org_invites WHERE organization_id IS NULL;"
   psql "${DATABASE_URL}" -c "SELECT COUNT(*) FROM public.user_profiles;"

Notes
- The migration uses gen_random_uuid() from the `pgcrypto` extension. If you
  use a different UUID generator (for example `uuid_generate_v4()` from
  `uuid-ossp`) change the migration accordingly.
- The script is intentionally conservative and non-destructive. It will not
  drop columns or force constraints if preconditions aren't met.

If you'd like, I can:
- convert this into your project's preferred migration format (Knex, Flyway,
  Hasura, Rails, etc.) and commit it to the repo,
- or run verification queries against a provided dev DB (with credentials).

Supabase migration history note
- The Supabase CLI history includes placeholder files (`supabase/migrations/20260328000005/6/7_placeholder_remote.sql`) used to align with the remote project's applied migrations. Keep them unless you plan a full history normalization + re-sync.
