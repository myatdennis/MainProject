# Supabase sample data seeding

This project now ships with a deterministic seed script that hydrates a Supabase (Postgres) instance with small-but-realistic organizations, courses, modules, lessons, assignments, learner progress, and survey responses. The data mirrors the analytics dashboards and admin experiences so that QA and demo environments feel complete without manual entry.

## Prerequisites

1. **Migrations applied** – run the SQL migrations under `supabase/migrations/` (for example with `scripts/run_migration.sh` or the Supabase CLI) so the schema matches the expected tables.
2. **Database credentials** – grab your Supabase connection string (for managed Supabase you can copy it from the Project Settings → Database page). The script looks for `DATABASE_URL` first and falls back to `SUPABASE_DB_URL`.
3. **Node.js 20+** – matches the version declared in `package.json` and ensures native `fetch`/ESM support.
4. **Network access + RLS considerations** – use a service-role connection (or the `postgres` connection string Supabase provides) so the script can bypass row-level security when inserting data.

## Running the seeder

```bash
export DATABASE_URL="postgres://postgres:<password>@db.<project>.supabase.co:6543/postgres?sslmode=require"
npm run seed:supabase
```

The script will:

- connect once and run inside a single transaction
- introspect each target table before inserting (it gracefully skips tables that do not exist in your environment)
- upsert rows by `id`, so you can re-run the command without creating duplicates
- log a per-table summary so you know what landed

## Data included

| Table | Rows | Notes |
| --- | --- | --- |
| `organizations` | 2 | Atlas Health Labs (enterprise) and Lumen Workforce Collective (growth) with feature flags, cohorts, and contract metadata |
| `organization_memberships` | 3 | Maps three demo users to the organizations with realistic roles |
| `courses` | 2 | "Foundations of Inclusive Leadership" and "Psychological Safety Accelerator" complete with thumbnails, difficulty, and due dates |
| `modules` | 4 | Two per course (Awareness/Habits, Diagnostics/Coaching) |
| `lessons` | 12 | Mixed media types (video, quiz, worksheet, audio, reflection, survey) with rich `content_json` payloads |
| `assignments` | 3 | Sample due dates, grades, and submitted timestamps |
| `user_course_progress` | 3 | Demonstrates not-started, in-progress, and completed learners plus time-on-task |
| `user_lesson_progress` | 5 | Lesson-level telemetry for dashboards/drop-off views |
| `survey_responses` | 3 | Ratings and qualitative feedback tied to each organization |

Feel free to tweak `scripts/seed_supabase_sample_data.mjs` and rerun it if you need additional personas or courses—the IDs are hard-coded so the script remains idempotent.

## Troubleshooting

- **Auth/SSL errors** – ensure `?sslmode=require` (or equivalent) is appended to the connection string when talking to managed Supabase.
- **Permission denied / RLS** – run the script with a service-role connection string. Using an anon/public key won’t work because row-level security blocks inserts.
- **Missing tables** – the script prints a ⚠️ warning and skips tables that aren’t present. Double-check that all migrations ran successfully.
- **Need to reset data** – simply re-run `npm run seed:supabase`. Upserts will refresh existing rows; drop rows manually if you want a clean slate.

For production environments, consider cloning the script and swapping the static IDs or data to better match your tenants.
