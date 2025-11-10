Phase 3 — Analytics, UX Polish & Launch Readiness
===============================================

This document summarizes the tasks implemented by the automated assistant and how to finish the remaining steps locally (secrets required).

What I implemented locally in the repo
- SQL migration: `supabase/migrations/20251108_add_analytics_tables_and_views.sql`
- Server endpoints:
  - `server/routes/admin-analytics.js` — aggregates API
  - `server/routes/admin-analytics-export.js` — CSV export
  - `server/routes/admin-analytics-summary.js` — AI summary (uses OPENAI_API_KEY optionally)
- Frontend:
  - `src/pages/Admin/AnalyticsDashboard.tsx` — admin dashboard polling/Realtime fallback
  - `src/lib/supabaseClient.ts` — frontend Supabase client wrapper
  - `src/components/Analytics/CompletionChart.tsx` — Chart.js based completion bar chart
  - `src/styles/design-tokens.css` — brand color tokens and utilities
- PWA: `public/manifest.json`, `public/sw.js`, and `index.html` updated with meta tags and SW registration
- AI prompts: `docs/ai_prompts/analytics_prompts.md`

Next steps you must run locally (requires secrets)
1) Install frontend deps for charts and supabase (run in project root):

```bash
# install chart and supabase client
npm install chart.js react-chartjs-2 @supabase/supabase-js
```

2) Apply the analytics SQL migration to your Supabase DB (you will be prompted for DB password and cert):

```bash
# interactive (zsh)
read -s "DB_PASS?Postgres password: " && echo
read -e "SSLROOT?Path to SSL root CA (or leave empty): " && \
if [ -n "$SSLROOT" ]; then \
  export DATABASE_URL="postgresql://postgres:${DB_PASS}@db.miqzywzuqzeffqpiupjm.supabase.co:5432/postgres?sslmode=verify-full&sslrootcert=${SSLROOT}"; \
else \
  export DATABASE_URL="postgresql://postgres:${DB_PASS}@db.miqzywzuqzeffqpiupjm.supabase.co:5432/postgres"; \
fi
sh ./scripts/apply_migration.sh supabase/migrations/20251108_add_analytics_tables_and_views.sql
```

3) Add frontend env (.env) with Supabase anon key and URL for realtime:

```
VITE_SUPABASE_URL=https://db.miqzywzuqzeffqpiupjm.supabase.co
VITE_SUPABASE_ANON_KEY=[YOUR_ANON_KEY]
```

4) Start dev server and browse Admin Analytics page (URL depends on your routing; example `/admin/analytics` or import the `AnalyticsDashboard` into your admin routes).

5) To enable AI summaries, set `OPENAI_API_KEY` in the server environment.

Quality & deployment notes
- CSV export is synchronous and intended for moderate datasets; add a background job for large exports.
- Realtime: currently uses Supabase Realtime subscription if `VITE_SUPABASE_ANON_KEY` is present; for scale, move subscriptions to a server-side fan-out or use a message queue.
- Security: do NOT grant broad SELECT to anon role; configure RLS policies scoped by `org_id` and ensure `server/index.js` endpoints validate `x-user-id` or use server-side auth.

If you want, I can now:
- Attempt to run the migration interactively in your environment (you'll be prompted for password and cert). I won't store secrets.
- Switch dashboard fully to Supabase Realtime with better channel management and user-scoped subscriptions.
- Generate mock screenshots (static HTML) of the dashboard and create Chart configs for Chart.js and Recharts.
