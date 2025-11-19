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

Local development: API proxy note
---------------------------------

When developing locally prefer the Vite proxy so requests go to your local backend.

- Leave `VITE_API_BASE_URL` and `VITE_API_URL` blank in `.env` / `.env.local` to use the Vite proxy (`/api`).
- If you set them to a remote/production URL your browser will call that host directly and you may see CORS errors.
- To call a local backend directly set:

```env
VITE_API_BASE_URL=http://localhost:8888
VITE_API_URL=http://localhost:8888/api
```

After changing `.env` files fully stop and restart both the frontend (`npm run dev`) and backend (`npm run start:server:e2e` or `npm run start:server`).

If you use the Vite dev server the UI will call `/api/*` and Vite will proxy to your backend (default `http://localhost:8888`).

## Troubleshooting

**Seeing a blank page?** Visit http://localhost:5174/unregister-sw.html to clear service worker cache.

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for complete troubleshooting guide.

## Demo Credentials

- **Admin**: admin@thehuddleco.com / admin123
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
- Production builds rely on `VITE_API_BASE_URL` (and optional `VITE_WS_URL`). Set these in Netlify/Vercel to avoid runtime 404s.
- If using Netlify proxy instead of absolute URLs, add a redirect mapping `/api/*` to your backend in `netlify.toml` (we've scaffolded placeholders — replace `<RAILWAY_HOST>`).
- Service worker can be cleared at `/unregister-sw.html` if you see stale assets.
- When Supabase is not configured, the server uses a safe in-memory fallback by default (DEV_FALLBACK). Disable with `DEV_FALLBACK=false`.
- E2E tests use `E2E_TEST_MODE=true` and stub `VITE_API_BASE_URL` as needed.

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
    - Absolute URL mode: set VITE_API_BASE_URL=https://<railway-app>, VITE_WS_URL=wss://<railway-app>/ws
    - Proxy mode: edit `netlify.toml` and replace `<RAILWAY_HOST>` in redirects; then VITE_API_BASE_URL is optional

4) Verify
    - `./scripts/smoke.sh the-huddle.co <railway-host> admin@thehuddleco.com admin123`
    - Browser Network tab: /api calls 200/204, no CORS errors

Troubleshooting: see `SUPABASE_RAILWAY_ENV_GUIDE.md` (CORS, OOM, 503 auth) and `scripts/smoke.sh`.

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

