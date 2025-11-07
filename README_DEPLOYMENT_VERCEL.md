# Deployment Guide: Vercel + External Node API

This project has two major parts:
1. React + Vite frontend (build output in `dist/`)
2. Express + WebSocket API (`server/index.js`)

Vercel can host both via `vercel.json`, but note that long-lived WebSocket connections and large in-memory state may not be ideal in Vercel serverless functions. For production you may prefer:
- Frontend on Vercel
- API + WS on Railway / Render / Fly.io / DigitalOcean / AWS EC2

## Option A (Simple Demo): Everything on Vercel
Pros: One-click deploy
Cons: Serverless function cold starts, WS instability under load, memory limits

### Steps
1. Install Vercel CLI
   ```bash
   npm i -g vercel
   ```
2. Link project
   ```bash
   vercel link
   ```
3. Set environment variables (see below)
   ```bash
   vercel env add VITE_SUPABASE_URL
   vercel env add VITE_SUPABASE_ANON_KEY
   vercel env add SUPABASE_SERVICE_ROLE_KEY
   vercel env add JWT_SECRET
   vercel env add DEMO_MODE
   vercel env add VITE_API_URL
   ```
4. Deploy preview
   ```bash
   vercel
   ```
5. Promote to production
   ```bash
   vercel --prod
   ```

## Option B (Recommended): Split Hosting
| Layer      | Hosting      | Notes |
|-----------|--------------|-------|
| Frontend  | Vercel       | Fast global CDN, static build (`vite build`) |
| API + WS  | Railway/Render| Persistent process, easier for WebSockets |

### Split Setup
1. Deploy API container/process elsewhere (e.g. Railway). Ensure it's reachable (e.g. `https://api.yourdomain.com`).
2. On Vercel set `VITE_API_URL=/api` and add a proxy (either keep relative and use same domain if you put API behind reverse proxy), or set `VITE_API_BASE_URL=https://api.yourdomain.com` if code reads that.
3. Replace any hardcoded localhost references.
4. Rebuild and deploy frontend.

## Environment Variables Reference
From `.env.example`:
- `VITE_SUPABASE_URL` – Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` – Public anon key
- `SUPABASE_SERVICE_ROLE_KEY` – (Only in API host, NOT on frontend) Service role key
- `JWT_SECRET` – 32+ random chars (API host only)
- `DEMO_MODE` – `false` for production
- `E2E_TEST_MODE` – Keep `false` in production
- `VITE_API_URL` – Base path for API calls in browser (usually `/api` when proxying)
- `PORT` – Not needed on Vercel; for external API host set to 8888 or 8787

### Generating Secrets
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" # JWT_SECRET
```

## DNS + Custom Domain
1. Add domain in Vercel dashboard (e.g. `app.example.com`).
2. Vercel gives A / CNAME records or nameservers.
3. In your DNS provider: set `CNAME app -> cname.vercel-dns.com` (value Vercel provides).
4. Wait for propagation, Vercel auto-provisions SSL.
5. Update production variables:
   - `VITE_API_URL=https://app.example.com/api` (if API on same domain)
   - Or if split: `VITE_API_BASE_URL=https://api.example.com`

## WebSocket Considerations
If using WebSockets heavily, Vercel's serverless functions may be terminated early.
Solutions:
- Move WS server to a persistent host (Railway/Render/Fly.io)
- Or migrate to Server-Sent Events (SSE) which fit serverless better

## Deployment Verification Checklist
1. `vercel logs <deployment>` shows successful build
2. Visit `/api/health` returns `{ status: "ok" }`
3. Frontend loads at root URL and can fetch courses
4. Admin login succeeds (demo mode disabled in prod)
5. WebSocket events (if on same host) connect: check browser devtools WS frames

## Rollback
```bash
vercel list
vercel rollback <deployment-id>
```

## Troubleshooting
| Symptom | Cause | Fix |
|---------|-------|-----|
| 404 on SPA route | Missing rewrite | Ensure final route to `/dist/index.html` in `vercel.json` |
| API cold starts slow | Serverless spin-up | Move API to persistent host |
| WS disconnects | Lambda reaped | Use persistent host or SSE fallback |
| Supabase auth fails | Missing env var | Set `VITE_SUPABASE_URL` / keys in production |
| Demo credentials still work | `DEMO_MODE=true` | Set `DEMO_MODE=false` on production |

## Example Production Variable Set (Frontend on Vercel)
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=sbp_public_key_here
VITE_API_URL=/api
DEMO_MODE=false
E2E_TEST_MODE=false
```

## Example Production Variable Set (Split API)
Frontend (Vercel):
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
JWT_SECRET=<generated>
DEMO_MODE=false
E2E_TEST_MODE=false
```

---
**Next Steps:**
1. Decide hosting pattern (simple vs split).
2. Configure env vars.
3. Deploy and verify health + login.
4. Plan WS migration if needed.
