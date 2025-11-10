# ARCHITECTURE.md

## System Architecture Overview

### Frontend
- **Framework:** React 18 + TypeScript
- **Build Tool:** Vite
- **State Management:** Zustand, React Context
- **Routing:** React Router
- **Styling:** Tailwind CSS
- **Forms:** Zod validation
- **Animations:** Framer Motion

### Backend
- **API Server:** Node.js (Express, ESM modules)
- **Database:** Supabase (PostgreSQL + Realtime)
- **Authentication:** Supabase Auth, server-verified tokens
- **WebSockets:** ws (for real-time updates)
- **Security:** CSRF, rate limiting, RLS, input validation

### Data Flow
1. **User Auth**: Client → Auth Context → Supabase Auth (server-verified)
2. **Course Data**: Client → DAL → Supabase
3. **Analytics**: Client → API → Supabase views/functions
4. **Realtime**: Supabase Realtime → React state
5. **Offline**: Service Worker → IndexedDB

### Key Patterns
- **DAL Layer:** All data access via `src/dal/` for consistency and testability.
- **Batching:** Progress and analytics events are batched for efficiency.
- **Role-Based Access:** All portals (Admin, LMS, Client) have separate auth and navigation.
- **Security:** All user input is validated and sanitized; tokens are never trusted from the client alone.

### Deployment
- **Frontend:** Vercel, Netlify, or static hosting
- **Backend:** Railway, Vercel, or custom Node server
- **Environment Variables:** See `DEPLOYMENT.md` for required keys

### Diagrams
See `README.md` for architecture diagram and project structure tree.

---

For more details, see the codebase or contact the project maintainer.
