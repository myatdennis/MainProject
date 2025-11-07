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

� **[Complete Documentation Index](./DOCUMENTATION_INDEX.md)** - All project documentation organized by category

**Quick Links:**
- 📊 [Comprehensive Review Summary](./COMPREHENSIVE_REVIEW_SUMMARY.md) - Latest audit overview
- 🗺️ [Routes & Buttons Matrix](./ROUTES_BUTTONS_MATRIX.md) - All 82 routes and navigation
- 🔒 [Security Audit & Fixes](./SECURITY_AUDIT_FIXES.md) - Security vulnerabilities and fixes
- � [Codebase Audit Report](./CODEBASE_AUDIT_REPORT.md) - Technical analysis
- 📖 [Troubleshooting Guide](./TROUBLESHOOTING.md) - Common issues and solutions

---

## Dev & Deploy Notes
- API server default port is now 8888 (aligned with Vite proxy). If you need a different port: `PORT=8787 node server/index.js`.
- Vite dev server proxies `/api` and `/ws` to `http://localhost:8888`. Adjust `vite.config.ts` if you change the API port.
- Production builds rely on `VITE_API_BASE_URL` (and optional `VITE_WS_URL`). Set these in Netlify/Vercel to avoid runtime 404s.
- If using Netlify proxy instead of absolute URLs, add a redirect mapping `/api/*` to your backend in `netlify.toml`.
- Service worker can be cleared at `/unregister-sw.html` if you see stale assets.
- When Supabase is not configured, the server uses a safe in-memory fallback by default (DEV_FALLBACK). Disable with `DEV_FALLBACK=false`.
- E2E tests use `E2E_TEST_MODE=true` and stub `VITE_API_BASE_URL` as needed.

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

