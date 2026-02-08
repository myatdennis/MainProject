# Local Development Setup

## Environment Variables

Create a `.env` file in the project root with the following safe defaults:

```
NODE_ENV=development
PORT=8888
SUPABASE_URL=http://localhost:54321
SUPABASE_KEY=REPLACE_ME
# SUPABASE_SERVICE_ROLE_KEY=REPLACE_ME (optional, used if SUPABASE_KEY is not set)
```

**Important:** Never expose your Supabase service role key to the browser or client code. Do not prefix it with `VITE_`. Only use it in backend/server code.

## Running Backend and Frontend

Open two terminals:

**Terminal 1 (Backend):**
```
npm install
npm run start:server
```

**Terminal 2 (Frontend):**
```
npm run dev
```

## Health Check

Test your backend health endpoint:
```
curl http://localhost:8888/api/health
```
LMSWebsite

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

Visit http://localhost:5174

### Backend API (Express on Railway)

```bash
# Build the SPA so static assets exist for the API to serve
npm run build

# Start the Express server (uses PORT env or defaults to 8888)
npm run start:server

# In a second terminal, verify the health endpoint
curl http://localhost:8888/api/health
```

When running locally behind another port, set `PORT=5000 npm run start:server` and update the proxy target in `vite.config.ts` (the `/api` proxy) to point at that port. Keep `VITE_API_BASE_URL` as `/api` so the browser always talks to the Vite server, which forwards requests to your API. The `/api/health` endpoint always responds with `{ ok: true, env: <NODE_ENV> }`, which is what Netlify uses to confirm the Railway proxy is healthy.

## Full-stack dev runbook

1. **Start everything**
    ```bash
    npm run dev:full
    ```
    This script boots the Express API on port **8888** and the Vite dev server on **5174** (proxying `/api` + `/ws`).
2. **Health via Vite proxy**
    ```bash
    curl -i http://localhost:5174/api/health
    ```
    Vite forwards this to `http://localhost:8888/api/health`, so a `200 OK` means both servers are happy.
    ```bash
    curl -i http://localhost:5174/api/auth/session
    ```
    This should return JSON (200 or 401) proving `/api/auth/session` is reachable through Vite.
3. **(Optional) Direct API health**
    ```bash
    curl -i http://localhost:8888/api/health
    ```
4. **Confirm Vite UI** – open http://localhost:5174/ in your browser.
5. **Troubleshooting**
    - `ECONNREFUSED` in the browser console → the API is not running on 8888 or Vite's proxy target was changed.
    - Repeated `401` logs from `/api/admin/*` → you're not logged in; hit `/admin/login` and retry.
    - Fast Refresh/HMR feels stuck → restart `npm run dev:full` to clear the React bundle cache.

Local development: API proxy note
---------------------------------

When developing locally prefer the Vite proxy so requests go to your local backend.

- Leave `VITE_API_BASE_URL` blank **or** set it to `/api` in `.env` / `.env.local` to use the Vite proxy.
- If you set it to a remote/production URL your browser will call that host directly and you may see CORS errors.
- If you change your API port, update `vite.config.ts -> server.proxy['/api'].target` to the new origin instead of changing `VITE_API_BASE_URL`.

### Backend base URL configuration

The frontend now derives **all** HTTP and WebSocket calls from a single origin so production builds can talk to Railway without Netlify rewrites.

- **Local dev (.env.local)** – leave `VITE_API_BASE_URL` unset or set it to `/api` to keep using the Vite proxy. Update `vite.config.ts` if your API runs on a different port. When testing against a remote API you may set `VITE_API_BASE_URL=https://remote-host/api`.

    ```env
    # .env.local
    VITE_API_BASE_URL=/api
    VITE_WS_URL=ws://localhost:8888/ws
    VITE_ENABLE_WS=true
    ```

    Restart `npm run dev` after changing these values.

- **Netlify production env vars** – open *Site settings → Build & deploy → Environment* and set:

    ```
    VITE_API_BASE_URL=https://<your-railway-service>.up.railway.app/api
    VITE_WS_URL=wss://<your-railway-service>.up.railway.app/ws   # optional; defaults to API base
    VITE_ENABLE_WS=true                                        # only if Railway exposes /ws
    ```

    Netlify will inject those values at build time so the deployed SPA calls Railway directly (`https://the-huddle.co` will no longer attempt `/api/*`).

After changing `.env` files fully stop and restart both the frontend (`npm run dev`) and backend (`npm run start:server:e2e` or `npm run start:server`).

If you use the Vite dev server the UI will call `/api/*` and Vite will proxy to your backend (default `http://localhost:8888`).

### Environment modes

- Copy `.env.example` to `.env` (server) and `.env.local` (frontend) to keep the contracts in sync.
- **Demo / re-entry mode** (default for local): keep `DEV_FALLBACK=true` and `DEMO_MODE=true`. The API will serve in-memory courses, allow the demo logins listed below, and ignore missing Supabase credentials.
- **Optional auto-auth bypass**: silent platform-admin sessions are now disabled by default, even in demo mode. If you intentionally need every localhost request to auto-authenticate (for example, when running legacy smoke suites), set `ALLOW_DEMO_AUTO_AUTH=true` and restart the server. `E2E_TEST_MODE` continues to force the bypass for automated runs.
- **Guard & menu diagnostics**: toggle `VITE_ENABLE_ROUTE_GUARD_DEBUG=true` to watch role/org redirect decisions in the console, and `VITE_ENABLE_ADMIN_MENU_DEBUG=true` to trace when the admin avatar menu opens, closes, or locks. Both default to the noisier dev build only.
- **Supabase mode** (staging/prod): set `DEV_FALLBACK=false` and `DEMO_MODE=false`, then provide `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_ANON_KEY`.
- Always keep `SUPABASE_SERVICE_ROLE_KEY` and `JWT_SECRET` on the server only. Never expose them in the Vite bundle.
- `VITE_API_BASE_URL` should point to your deployed Express host when not using the Vite proxy.
- Set `VITE_ENABLE_WS=true` when your backend WebSocket endpoint is reachable; leave it `false` to fall back to Supabase realtime + polling.
- When WebSockets are enabled, ensure `VITE_WS_URL` matches your backend (wss:// in prod, ws:// in local) or rely on the default `/ws` proxy path.

### Runtime health & registration guardrails

The client polls `/api/health` (see `src/state/runtimeStatus.ts`) and stores the parsed result on `window.__APP_RUNTIME_STATUS__`. That snapshot powers the login banner, the assignment store, and any module that needs to know whether Supabase is currently safe to call.

| Status label | When it appears | Login experience |
|--------------|-----------------|------------------|
| `demo-fallback` | `DEV_FALLBACK=true` **or** Supabase credentials missing/unhealthy | Demo credentials auto-fill, registration + password reset are disabled, and the banner explains that production accounts are locked. |
| `ok` | Supabase configured **and** `/api/health` reports `healthy=true` | Registration tab is enabled, forgot-password calls Supabase, and the secure badge shows the last health check timestamp. |
| `degraded` | Health endpoint fails or Supabase is reachable but unhealthy | UI stays in secure mode but warns that new network calls may fail; assignment/progress fetches fall back to cached data. |

Key behaviors:

- The banner on `/lms/login` flips between "Demo mode active" and "Secure mode connected" based on the runtime snapshot.
- `assignmentStorage` and `progressService` refuse remote reads when Supabase is offline or the local session is missing. This is why demo mode only shows assignments stored locally.
- Runtime polling pauses when the tab is hidden and refreshes immediately when focus returns, so status pills stay current without reloading the app.

#### Enabling Supabase-backed registration & reset flows

1. Provide the Supabase env vars (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) and set `DEV_FALLBACK=false`, `DEMO_MODE=false`.
2. Restart both the Express API and Vite dev server so `SecureAuthContext` can see the updated runtime status.
3. From the LMS login page, switch to the **Create Account** tab. The form is backed by `SecureAuthContext.register`, which POSTs to `/api/auth/register` and creates the Supabase user + profile row.
4. Include an `organizationId` when onboarding a real customer; it scopes the learner to the right catalog immediately after their first login.
5. Forgot-password works only while Supabase is healthy. The UI will automatically block the flow (and explain why) whenever the runtime snapshot says otherwise.

If you need to verify the backend state manually, call `/api/health` in your browser or via `curl` and confirm that `status`, `supabase.status`, and `demoMode.enabled` match the expectation shown in the UI banner.

## Troubleshooting

**Seeing a blank page?** Visit http://localhost:5174/unregister-sw.html to clear service worker cache.

### Supabase schema mismatches

If you see `PGRST201` or `PGRST205` in the API logs, your database schema is behind. Apply the pending migrations:

```bash
supabase db push
```

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for complete troubleshooting guide.

## Demo Credentials

- **Admin**: mya@the-huddle.co / admin123
- **LMS User**: user@pacificcoast.edu / user123

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Client (React + TypeScript)              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Public     │  │     LMS      │  │    Admin     │      │
│  │   Routes     │  │   Portal     │  │   Portal     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                  │                  │              │
│         └──────────────────┴──────────────────┘              │
│                            │                                 │
│                    ┌───────▼────────┐                       │
│                    │  Auth Context  │                       │
│                    │  Course Store  │                       │
│                    └────────────────┘                       │
└────────────────────────────┬────────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │   API Layer     │
                    │  (DAL Pattern)  │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │   Supabase      │
                    │  PostgreSQL +   │
                    │   Realtime      │
                    └─────────────────┘
```

### Tech Stack

- **Frontend**: React 18.3.1 + TypeScript + Vite 5.4.20
- **Backend**: Supabase 2.57.4 (PostgreSQL + Realtime + Auth)
- **Styling**: Tailwind CSS 3.4.17
- **State**: Zustand 5.0.3 + React Context
- **Routing**: React Router 7.9.1
- **Animations**: Framer Motion 12.23.24
- **Forms**: Zod validation
- **Build**: Vite with lazy-loaded routes

### Key Features

- 🔐 **Role-Based Access Control** - Separate portals for Admin, LMS, and Client users
- 📚 **Course Management** - Full-featured course builder with modules, lessons, and quizzes
- 📊 **Analytics Dashboard** - Real-time tracking of learner progress and engagement
- 📋 **Survey System** - Create, deploy, and analyze surveys with advanced analytics
- 🏢 **Organization Workspace** - Strategic planning, session notes, and document management
- 🔄 **Offline Support** - Service worker for offline course access
- 🎨 **Responsive Design** - Mobile-first design with Tailwind CSS
- ⚡ **Performance** - Code splitting, lazy loading, and optimized bundles

### Project Structure

```
src/
├── components/      # Reusable UI components
│   ├── ErrorBoundary.tsx
│   ├── Header.tsx
│   ├── Footer.tsx
│   └── ...
├── pages/          # Route components
│   ├── admin/      # Admin portal pages
│   ├── lms/        # LMS portal pages
│   └── public/     # Public marketing pages
├── context/        # Global state (Auth, Theme)
├── store/          # Zustand stores (Courses, Surveys)
├── dal/            # Data Access Layer (Supabase abstraction)
├── services/       # Business logic
├── hooks/          # Custom React hooks
├── utils/          # Utility functions
└── types/          # TypeScript type definitions
```

### Data Flow

1. **User Authentication** → Auth Context → Supabase Auth
2. **Course Data** → Course Store → DAL → Supabase
3. **Real-time Updates** → Supabase Realtime → React State
4. **Offline Access** → Service Worker → IndexedDB cache

## Data Access Layer contract

All UI code (components, hooks, Zustand stores) must talk to APIs through the modules in `src/dal/`. Each DAL file wraps the corresponding service, applies runtime-status checks, and exposes a typed surface tailor-made for React. Directly importing anything under `src/services/` from a component will break the lint rules and bypass the new safety rails.

**Guidelines when adding data access:**

- Add or update a DAL module (for example `src/dal/progress.ts`) and keep all network/Supabase calls inside that file or the existing service helpers it delegates to.
- Lean on runtime helpers such as `isSupabaseOperational()` inside the DAL so demo mode never attempts live writes.
- Keep tests close to the behavior: `src/utils/__tests__/assignmentStorage.test.ts` and `src/services/__tests__/progressService.test.ts` show how to cover session guardrails and offline fallbacks.
- Wire UI imports to the DAL entry point only once; re-exporting shared helpers from there makes refactors (like the recent WebSocket client proxy) transparent to the rest of the app.

Following this contract gives us a single choke point for auth tokens, offline queues, and future multi-tenant checks without forcing another sweeping refactor.

### Documentation


**Documentation Index:**
- 📖 [Complete Documentation Index](./DOCUMENTATION_INDEX.md)
- 📊 [Comprehensive Review Summary](./COMPREHENSIVE_REVIEW_SUMMARY.md)
- 🗺️ [Routes & Buttons Matrix](./ROUTES_BUTTONS_MATRIX.md)
- 🔒 [Security Audit & Fixes](./SECURITY_AUDIT_FIXES.md)
- 🛡️ [Security Policy](./SECURITY.md)
- 📚 [API Reference](./API_REFERENCE.md)
- 🏛️ [Architecture Overview](./ARCHITECTURE.md)
- 🤝 [Contributing Guide](./CONTRIBUTING.md)
- 🧪 [Testing Guide](./TESTING.md)
- 🛠️ [Deployment Guide](./DEPLOYMENT.md)
- 📖 [Troubleshooting Guide](./TROUBLESHOOTING.md)
- � [Codebase Audit Report](./CODEBASE_AUDIT_REPORT.md)

---

## Dev & Deploy Notes
- API server default port is now 8888 (aligned with Vite proxy). If you need a different port: `PORT=8787 node server/index.js`.
- Vite dev server proxies `/api` and `/ws` to `http://localhost:8888`. Adjust `vite.config.ts` if you change the API port.
- Production builds rely on `VITE_API_BASE_URL` and, when `VITE_ENABLE_WS=true`, `VITE_WS_URL`. Set these in Netlify/Vercel to avoid runtime 404s.
- If using Netlify proxy instead of absolute URLs, add a redirect mapping `/api/*` to your backend in `netlify.toml` (we've scaffolded placeholders — replace `<RAILWAY_HOST>`).
- Service worker can be cleared at `/unregister-sw.html` if you see stale assets.
- When Supabase is not configured, the server uses a safe in-memory fallback by default (DEV_FALLBACK). Disable with `DEV_FALLBACK=false`.
- E2E tests use `E2E_TEST_MODE=true` and stub `VITE_API_BASE_URL` as needed.

## E2E Testing

### E2E API base URL
The Playwright auth helpers consume this value to drive the SecureAuth login flow. If the API is not reachable at `E2E_API_BASE_URL` you may see connection refusals or the login page staying in the "Initializing authentication" state before the `#email` field renders.
#### SecureAuth tips


The server runtime now uses JavaScript files (ESM) under `server/`.
All historical server TypeScript sources are archived under `server/ts-archive/`.
CI enforces that there are no `.ts` files under `server/` outside this archive; see `scripts/check_no_ts_in_server.mjs`.

For local-only diagnostics (e.g., forcing the TLC course to publish), see [`docs/dev-tools.md`](docs/dev-tools.md). These helpers require `DEV_TOOLS_ENABLED=true`, a matching `DEV_TOOLS_KEY`, and the `X-DEV-TOOLS-KEY` header. Never enable them in shared or production environments.
If you need to recover previous TypeScript logic, consult the archive or reintroduce a TypeScript -> JS build step.

To clean up any remaining legacy `.ts` placeholder files under `server/` and move them into the archive, run:

```bash
npm run remove:server-ts
```

### Quick Production Checklist (Netlify + Railway)

1) DNS at GoDaddy
    - A @ → 75.2.60.5 and 99.83.190.102 (Netlify)
    - CNAME www → <your-site>.netlify.app

2) Railway env
    - NODE_ENV=production, PORT=8888
    - DEV_FALLBACK=true (temporary for demo logins) or configure Supabase and set DEV_FALLBACK=false
    - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (server-only)
    - CORS_ALLOWED_ORIGINS=https://the-huddle.co,https://www.the-huddle.co,https://<your-site>.netlify.app

3) Frontend env (choose one mode)
    - Absolute URL mode: set VITE_API_BASE_URL=https://mainproject-production-4e66.up.railway.app, VITE_ENABLE_WS=true, VITE_WS_URL=wss://mainproject-production-4e66.up.railway.app/ws
    - Proxy mode: edit `netlify.toml` and replace `<RAILWAY_HOST>` in redirects; then VITE_API_BASE_URL is optional. Set VITE_ENABLE_WS=true if your `/ws` proxy is wired up, or leave it false to skip the connection entirely.

4) Verify
    - `./scripts/smoke.sh the-huddle.co <railway-host> mya@the-huddle.co admin123`
    - TLS / SSL check: run `npm run diag:ssl -- the-huddle.co` to confirm the certificate and TLS protocol
    - Browser Network tab: /api calls 200/204, no CORS errors

Troubleshooting: see `SUPABASE_RAILWAY_ENV_GUIDE.md` (CORS, OOM, 503 auth) and `scripts/smoke.sh`.
If the site reports `ERR_SSL_PROTOCOL_ERROR`, see `DEPLOYMENT.md` -> SSL Troubleshooting or run the above `diag:ssl` script to validate the certificate. Also ensure `ENFORCE_HTTPS=true` (optional) and `NODE_ENV=production` in your server env so Express can set `trust proxy` and redirect accordingly.

## Database maintenance

### Applying Supabase migrations
1. Commit any SQL files added under `supabase/migrations/`.
2. From the repo root, run `supabase db push --db-url "$PROD_SUPABASE_DATABASE_URL"` (or apply via the Supabase dashboard).
3. Confirm the deploy logs show each migration succeeded before routing live traffic.

### Verifying required tables
Use `psql` (or the Supabase SQL editor) against production:
```sql
select id, slug from public.organizations order by created_at desc limit 5;
select count(*) as invite_count from public.org_invites;
select count(*) as audit_entries from public.audit_logs;
```
If any query fails with “relation does not exist”, rerun `supabase db push` so production picks up the latest migrations.

## Scripts & API helpers

- Import courses:
    - `node scripts/import_courses.js import/courses-template.json`
    - Flags:
        - `--publish` — publish after import
        - `--dedupe` | `--upsert-by=slug` — upsert by slug (reuse existing id)
        - `--prune-duplicates` | `--prune` — after import, delete any other courses with the same slug
        - `--dry-run` — preview actions without making changes
        - `--wait` `--wait-timeout <ms>` — wait for `/api/health` before running

- Prune duplicates (standalone):
    - `node scripts/prune_duplicates.js --keep=first|last [--dry-run]`

- API health:
    - `GET /api/health`
    - CSRF token for scripts: `GET /api/auth/csrf`

- Server memory & demo data:
    - Guard large demo file with `DEMO_DATA_MAX_BYTES` (default 25MB)
    - Optional memory logs with `LOG_MEMORY=true`
