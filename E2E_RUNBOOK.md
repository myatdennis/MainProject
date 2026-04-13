E2E Runbook — local and staging guidance

Purpose
- Provide a safe, repeatable process to run end-to-end tests (Playwright) and smoke checks for the learning/learner surface.
- Use either a remote staging environment (faster) or a local Docker Compose stack (isolated).

Prerequisites
- Node >= 20
- Docker & Docker Compose (for local harness)
- Environment variables set (see `.env.local.example`)
- A staging Postgres/Supabase instance with the app schema migrated, or a local DB seeded with test data.

Quick options
- Option A: Run against an existing staging environment (recommended if available)
  1. Ensure the staging DB contains seeded users, memberships, courses, lessons and assignments required by the tests.
  2. Set the environment variables in your shell or add them to `.env.local` (copy from `.env.local.example`).
  3. Start the server in E2E mode:
     ```bash
     npm run start:server:e2e
     ```
  4. In another shell, run Playwright tests:
     ```bash
     npm run test:e2e
     ```
  5. Review Playwright traces and screenshots in `playwright-report/` (or test artifacts directory configured by your Playwright config).

- Option B: Local Docker Compose (isolated, reproducible)
  1. Use Docker Compose to create a Postgres instance and run your migrations.
  2. Seed the DB with test data (users, org, membership, simple course + lesson).
  3. Export env vars (pointing to the local DB + local SUPABASE-like values). Example:
     ```bash
     export DATABASE_POOLER_URL=postgres://postgres:postgres@localhost:5432/mainproject
     export VITE_API_BASE_URL=http://localhost:8888
     export VITE_SUPABASE_ANON_KEY=local-anon
     export VITE_SUPABASE_URL=http://localhost:54321
     # etc. (see .env.local.example)
     ```
  4. Start the server in E2E mode and run Playwright as above.

Notes & Tips
- Always run E2E against staging or a dedicated test DB. Do not run tests against production.
- Capture Playwright trace and screenshots on failures. Configure Playwright to save artifacts in failure mode in `playwright.config.ts`.
- If a test fails, inspect the server logs, Playwright video/trace, and the `ClientDashboard` DEV overlay (if present in your dev build) to understand the boot sequence and missing data.

Troubleshooting
- Missing envs: tests will fail when SUPABASE_* or DATABASE_* envs are missing. Ensure `.env.local` is complete.
- DB migration mismatch: the app expects a specific schema and RLS policies. Run your migration scripts or use `node scripts/verify-schema.mjs`.
- Index/RLS maintenance: use `scripts/generate_rls_auth_initplan_alter_statements.sql` and `scripts/collect_unused_index_defs.sql` to inspect DB objects before dropping or altering.

Cleaning up
- After running E2E locally, stop the server and the DB:
  ```bash
  # if docker-compose used
  docker compose down -v
  ```

Reporting
- When filing an E2E bug report, include:
  - failing test name, Playwright trace/video, server logs for the same time range, and DB query logs (if available).
  - The output of `npm run test:e2e --reporter=junit` if you need CI-friendly artifacts.

Security reminder
- Never commit secrets. Use `.env.local` (gitignored) for local secrets.
