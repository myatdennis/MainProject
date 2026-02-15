# Supabase + Railway + Netlify/Domain: Environment & Deployment Guide

This guide aligns the API (Railway), database (Supabase), and frontend (Netlify or custom domain) so production works end‑to‑end and securely.

## TL;DR
- Server (Railway): set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, restrict CORS with CORS_ALLOWED_ORIGINS, run on PORT=8888, and disable dev fallback.
- Frontend (Netlify): set VITE_API_BASE_URL and VITE_WS_URL to your Railway URL; only set VITE_SUPABASE_* if your client talks directly to Supabase.
- DNS: point your domain to Netlify (or Vercel) and add the Netlify domain to CORS_ALLOWED_ORIGINS.

---

## 1) Railway (API server)

Environment variables (required unless noted):
- NODE_ENV=production
- PORT=8888
- DEV_FALLBACK=false
- SUPABASE_URL=https://<your-supabase>.supabase.co
- SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key> (server-only, never expose to client)
- CORS_ALLOWED_ORIGINS=https://<your-site>.netlify.app,https://www.<yourdomain>.com
- Optional:
  - BROADCAST_API_KEY=<random-long-secret> (to secure POST /api/broadcast)
  - LOG_MEMORY=false
  - DEMO_DATA_MAX_BYTES=26214400 (25MB default; lower if demo-data.json OOMs)

App behavior:
- CSRF: cookie is set for future use, but enforcement is not enabled by default.
- CORS: in production, only requests from CORS_ALLOWED_ORIGINS receive CORS headers.
- Health: GET /api/health returns JSON with status.
- WebSocket: server listens on /ws (proxied via Vite in dev; direct in prod with absolute URL).

Validation (from your machine):
- Health: curl https://<railway-app>.up.railway.app/api/health
- CORS preflight (replace Origin):
  - curl -i -X OPTIONS https://<railway-app>.up.railway.app/api/health -H "Origin: https://<your-site>.netlify.app" -H "Access-Control-Request-Method: GET"
  - Expect 204 and Access-Control-Allow-Origin matching the Origin.

## 2) Netlify (frontend)

Build settings (netlify.toml already present):
- Build command: npm run build
- Publish directory: dist
- Ensure devDependencies are installed (Netlify UI or netlify.toml config already covers this).

Environment variables:
- VITE_API_BASE_URL=https://<railway-app>.up.railway.app
- VITE_WS_URL=wss://<railway-app>.up.railway.app/ws
- Optional (only if the client needs direct Supabase access):
  - VITE_SUPABASE_URL=...
  - VITE_SUPABASE_ANON_KEY=...

Deploy steps:
1) Clear any build command/output overrides in Netlify UI so netlify.toml is honored.
2) Set the env vars above and redeploy with "Clear cache and deploy".
3) After deploy, open browser devtools Network panel and verify:
   - API requests go to VITE_API_BASE_URL
   - Response headers include x-request-id
   - No CORS errors in console

## 3) DNS (GoDaddy → Netlify)

- Add a CNAME for your domain/subdomain to Netlify’s assigned hostname.
- Add your production domain to CORS_ALLOWED_ORIGINS on Railway.
- Wait for DNS to propagate (usually < 30 minutes).

## 4) Supabase notes

- Never expose SUPABASE_SERVICE_ROLE_KEY to the client; it must live on the server (Railway) only.
- If you need client-side Supabase (uploads/RLS reads), only use VITE_SUPABASE_ANON_KEY.
- Server-side uses SUPABASE_SERVICE_ROLE_KEY for administrative tasks (imports, assignments, writes).

### PostgREST schema cache refresh

Supabase’s PostgREST layer caches table/view metadata. Whenever a migration drops/recreates views (for example `user_organizations_vw`) or adds/removes columns on tables that the API hits directly (`audit_logs`, `analytics_events`, `assignments`, etc.), refresh the cache immediately after running migrations:

```
psql "$SUPABASE_DATABASE_URL" -c "NOTIFY pgrst, 'reload schema';"
```

Do this for every environment (staging + production) so API requests don’t see `PGRST204`/`PGRST205` errors after deploy.

## 5) Troubleshooting

- CORS 403 on preflight:
  - Ensure the Origin you see in the browser matches exactly one entry in CORS_ALLOWED_ORIGINS.
  - Add both https://<your-site>.netlify.app and https://www.<yourdomain>.com if you use both.
- Mixed content (WS or HTTP):
  - Use HTTPS for API and WSS for websockets in production.
- API 137 (Killed/OOM):
  - Large server/demo-data.json may be getting loaded. Lower DEMO_DATA_MAX_BYTES or remove the file.
- Supabase auth failures:
  - Confirm SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are correct and rotated if previously exposed.

## 6) Quick verification checklist

- [ ] Railway /api/health responds 200
- [ ] Netlify build succeeds and SPA routes work on refresh
- [ ] API requests succeed (no CORS errors)
- [ ] WebSocket connects to VITE_WS_URL (optional feature)
- [ ] No service role keys in client bundle (inspect built assets if unsure)

---

If you prefer /api proxying through Netlify instead of absolute URLs, add a [[redirects]] rule in netlify.toml pointing /api/* to your Railway URL, and update CORS_ALLOWED_ORIGINS to your Netlify domain only. In that setup, cookies/CSRF can be made same-site if you also proxy /ws.
