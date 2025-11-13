# E2E / Demo Mode (E2E_TEST_MODE)

This project supports an in-memory demo/E2E fallback so tests and local development can run without a Supabase backend.

Behavior summary
- When `E2E_TEST_MODE=true` (or when `DEV_FALLBACK` is enabled in non-production), the server will:
  - Ignore Supabase credentials even if present in the environment.
  - Use an in-memory store (`server/demo-data.json`) to persist demo courses and related data.
  - Report `supabaseConfigured: false` from `GET /api/health`.

Quick smoke check

1. Make sure a port is free (the script runs the server on port 8890 by default):

```bash
# check port
lsof -iTCP:8890 -sTCP:LISTEN -n -P || true
```

2. Run the smoke-check (it will spawn the server with E2E_TEST_MODE=true):

```bash
node scripts/check_e2e.cjs
```

Expected output: the script will print the `/api/health` response and confirm that `supabaseConfigured=false`.

Notes
- The in-memory/demo store persists to `server/demo-data.json` so you can inspect or pre-seed data for tests.
- The server code contains logging and an explicit override for `E2E_TEST_MODE` so local tests don't accidentally hit a misconfigured Supabase instance.

Reproducing frontend runtime errors (console captures)

If you're investigating a browser runtime error (for example: "Invalid hook call" observed in Playwright captures), use the provided scripts to make deterministic captures against the server-served build.

1) Build the production frontend and start the server in E2E mode (server will serve the `dist` directory):

```bash
# build client
npm run build

# spawn server with E2E mode on port 8888 (or set PORT to another value)
E2E_TEST_MODE=true PORT=8888 node server/index.js
```

2) Use the console capture script to visit the exact page you want to inspect. Example: open the CoursePlayer for the demo "foundations" course:

```bash
BASE_URL=http://localhost:8888 TARGET_PATH=/lms/course/foundations node scripts/collect_console.cjs
```

3) If you need to perform an interactive login and capture network requests/responses as well, use the auto-login capture. It writes a full capture to `/tmp/auto_login_output.json`:

```bash
BASE_URL=http://localhost:8888 LOGIN_PATH=/lms/login TEST_EMAIL=demo@local TEST_PASSWORD=demo node scripts/auto_login.cjs
```

4) If you see an error (for example "Invalid hook call") in the capture, save the console output and the `/tmp/auto_login_output.json` file and attach them to the bug report. If the error seems caused by a server API response (bad payload / missing fields), run the server with extra debug logging enabled (set `DEBUG_ADMIN_UPSERT=true`) to get request/response instrumentation in `server/index.js`.

If captures don't reproduce the issue, try these heuristics:
- Visit the exact route that previously failed (use the route recorded in Playwright logs) rather than the login page.
- Try both the production build (server-served `dist`) and the dev server (`npm run dev`) since bundling differences can affect code-splitting and lazy-loaded components.
- Ensure `server/demo-data.json` contains the same course/user IDs the failing trace used (you can pre-seed it or copy it from an archived capture).

