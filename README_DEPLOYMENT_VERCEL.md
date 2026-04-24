# Deployment Guide: Netlify + External Node API

This project has two major parts:
1. React + Vite frontend (build output in `dist/`)
2. Express + WebSocket API (`server/index.js`)

Netlify can host the frontend, but note that long-lived WebSocket connections and large in-memory state may not be ideal in serverless functions. For production you may prefer:
- Frontend on Netlify
- API + WS on Railway / Render / Fly.io / DigitalOcean / AWS EC2

## Option A (Simple Demo): Frontend on Netlify
Pros: Easy deploy
Cons: Serverless function cold starts, WS instability under load, memory limits

### Steps
1. Install Netlify CLI
   ```bash
   npm i -g netlify-cli
   ```
2. Link project
   ```bash
   netlify link
   ```
3. Set environment variables (see below)
   ```bash
   netlify env:set VITE_SUPABASE_URL https://abc123xyz.supabase.co
   netlify env:set VITE_SUPABASE_ANON_KEY
   netlify env:set SUPABASE_SERVICE_ROLE_KEY
   netlify env:set JWT_ACCESS_SECRET your-jwt-access-secret
   netlify env:set JWT_REFRESH_SECRET your-jwt-refresh-secret
   netlify env:set DEMO_MODE
   netlify env:set VITE_API_URL
   ```
4. Deploy preview
   ```bash
   netlify deploy
   ```
5. Promote to production
   ```bash
   netlify deploy --prod
   ```

## Option B (Recommended): Split Hosting
| Layer      | Hosting      | Notes |
|-----------|--------------|-------|
| Frontend  | Netlify      | Fast global CDN, static build (`vite build`) |
| API + WS  | Railway/Render| Persistent process, easier for WebSockets |

### Split Setup
1. Deploy API container/process elsewhere (e.g. Railway). Ensure it's reachable (e.g. `https://api.yourdomain.com`).
2. On Netlify set `VITE_API_URL=/api` and add a proxy (either keep relative and use same domain if you put API behind reverse proxy), or set `VITE_API_BASE_URL=https://api.yourdomain.com` if code reads that.
3. Replace any hardcoded localhost references.
4. Rebuild and deploy frontend.

## Environment Variables Reference
From `.env.example`:
- `VITE_SUPABASE_URL` – Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` – Public anon key
- `SUPABASE_SERVICE_ROLE_KEY` – (Only in API host, NOT on frontend) Service role key
- `JWT_ACCESS_SECRET` – 32+ random chars (API host only)
- `DEMO_MODE` – `false` for production
- `E2E_TEST_MODE` – Keep `false` in production
- `VITE_API_URL` – Base path for API calls in browser (usually `/api` when proxying)
- `PORT` – Not needed on Netlify; for external API host set to 8888 or 8787

### Generating Secrets
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" # JWT_ACCESS_SECRET
```

## DNS + Custom Domain
1. Add domain in Netlify dashboard (e.g. `app.example.com`).
2. Netlify gives A / CNAME records or nameservers.
3. In your DNS provider: set `CNAME app -> cname.netlify.com` (value Netlify provides).
4. Wait for propagation, Netlify auto-provisions SSL.
5. Update production variables:
   - `VITE_API_URL=https://app.example.com/api` (if API on same domain)
   - Or if split: `VITE_API_BASE_URL=https://api.example.com`

## WebSocket Considerations
If using WebSockets heavily, Netlify's serverless functions may be terminated early.
Solutions:
- Move WS server to a persistent host (Railway/Render/Fly.io)
- Or migrate to Server-Sent Events (SSE) which fit serverless better

## Deployment Verification Checklist
1. `netlify logs <deployment>` shows successful build
2. Visit `/api/health` returns `{ status: "ok" }`
3. Frontend loads at root URL and can fetch courses
4. Admin login succeeds (demo mode disabled in prod)
5. WebSocket events (if on same host) connect: check browser devtools WS frames

## Rollback
```bash
netlify rollback
```

## Troubleshooting
| Symptom | Cause | Fix |
|---------|-------|-----|
| 404 on SPA route | Missing rewrite | Ensure final route to `/dist/index.html` in `netlify.toml` |
| API cold starts slow | Serverless spin-up | Move API to persistent host |
| WS disconnects | Lambda reaped | Use persistent host or SSE fallback |
| Supabase auth fails | Missing env var | Set `VITE_SUPABASE_URL` / keys in production |
| Demo credentials still work | `DEMO_MODE=true` | Set `DEMO_MODE=false` on production |

## Example Production Variable Set (Frontend on Netlify)
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=sbp_public_key_here
VITE_API_URL=/api
DEMO_MODE=false
E2E_TEST_MODE=false
```

## Example Production Variable Set (Split API)
Frontend (Netlify):
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_API_BASE_URL=https://api.example.com
VITE_API_URL=/api
DEMO_MODE=false
```
API Host:
```
PORT=8888
SUPABASE_SERVICE_ROLE_KEY=service_role_key_here
JWT_ACCESS_SECRET=<generated>
DEMO_MODE=false
E2E_TEST_MODE=false
```

---
**Next Steps:**
1. Decide hosting pattern (simple vs split).
2. Configure env vars.
3. Deploy and verify health + login.
4. Plan WS migration if needed.
