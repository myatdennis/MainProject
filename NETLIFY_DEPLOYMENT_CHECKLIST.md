# Netlify Deployment Checklist

Use this checklist to ensure a reliable production deploy of the SPA + external API.

## 1. Build Settings
- Remove UI overrides for Build command & Publish directory so `netlify.toml` is honored.
  - Set the Build command to: `npm run build:ci` to include a post-build scan for deprecated hostnames.
- Confirm `netlify.toml` in repo root contains:
  - `[build] command = "npm run build"`
  - `publish = "dist"`
  - `[[redirects]] from = "/*" to = "/index.html" status = 200` (SPA fallback)
  - `[[headers]]` blocks for security & cache control.

## 2. Required Environment Variables (UI > Site Settings > Environment)
Set BEFORE redeploy to avoid runtime 404s:
```
VITE_API_BASE_URL=https://api.example.com   # full origin of your backend API (no trailing slash)
VITE_ENABLE_WS=true                         # enable realtime socket client (set false if backend lacks WS)
VITE_WS_URL=wss://api.example.com/ws        # websocket endpoint (if using realtime)
SUPABASE_URL=                                # if using Supabase features
SUPABASE_ANON_KEY=                           # public client key
SUPABASE_SERVICE_ROLE_KEY=                   # ONLY in Netlify build if scripts need it; NEVER expose client-side
``` 
If you proxy `/api/*` through Netlify instead of using absolute URLs, you may omit `VITE_API_BASE_URL` and add a redirect.

## 3. Optional API Proxy (Choose ONE approach)
A. External API via absolute env vars (simpler)
- Keep `VITE_API_BASE_URL` and `VITE_ENABLE_WS=true` (plus `VITE_WS_URL`) variables.
- Do NOT add `/api/*` redirect.

B. Netlify proxy to backend (backend must allow CORS / accept same-origin)
Uncomment and adapt inside `netlify.toml`:
```
[[redirects]]
  from = "/api/*"
  to = "https://api.example.com/:splat"
  status = 200
  force = true
```
If using WebSockets on same host & path `/ws`, keep `VITE_ENABLE_WS=true` and add (only if upgrade issues appear):
```
[[headers]]
  for = "/ws"
  [headers.values]
    Connection = "upgrade"
```

## 4. WebSocket Validation
- Open browser console after deploy; ensure no `WebSocket connection failed` errors.
- If failing, confirm `VITE_WS_URL` matches backend and is wss:// in production.

## 5. Post-Deploy Smoke Test
In deployed site:
1. Request `/api/health` (Network tab or fetch from console): should return status ok.
2. Admin login flow works (no CORS errors).
3. Import page: attempt dry-run import (no 500s).
4. Publish & assign a course; verify it appears in client catalog.
5. Progress updates persist (watch Network requests for 2xx responses).
6. Security headers present: check a random route for `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`.

## 6. Common Pitfalls
| Issue | Symptom | Fix |
|-------|---------|-----|
| UI overrides still active | Build ignores `netlify.toml` | Clear build & publish fields in UI |
| Missing `VITE_API_BASE_URL` | 404s to relative `/api/*` | Set env var OR add proxy redirect |
| Wrong protocol for WS | Mixed content / failure | Use `wss://` in `VITE_WS_URL` and ensure `VITE_ENABLE_WS` matches deployment |
| CORS errors | 403/blocked responses | Configure backend CORS allow Netlify domain |
| Large initial payload | Slow first paint | Enable code splitting (already partly done); consider preloading critical chunks |

## 7. Rollback Strategy
If a deploy breaks:
1. Use Netlify Deploys tab to restore previous successful deploy.
2. Re-check last commit diff (`git show HEAD`) for config or env changes.
3. Re-run local build: `npm run build` and inspect `dist/`.

## 8. Future Hardening
- Add bundle analyzer step (`npm run analyze`) and trim vendor size.
- Add health check script as a build plugin to fail fast if API is unreachable.
- Consider Netlify Edge Functions for auth header injection if moving logic toward edge.

## 9. Verification Script (Optional)
Create a simple script to run against production:
```bash
node scripts/api-smoke.mjs --base https://app.example.com --api https://api.example.com
```
### Pre-deploy local checks
Before you push or create a PR, you can run these checks locally to ensure Vite is healthy and the build is clean:

1. Install deps and run Vite check:
```bash
npm ci
npm run check:vite
```

2. If the check passes, run the full CI build (includes host scanning):
```bash
npm run build:ci
```

3. Preview the build locally and test:
```bash
npm run preview
# open http://localhost:4173 and inspect the Console/Network tabs
```

(Modify script to accept flags if desired.)

## 10. Local Build & Troubleshooting Quick Steps
These commands will help you reproduce the production build locally and verify there are no stale host references or cached service worker issues:

1. Install and build:
  - npm ci
  - npm run build:ci

2. Preview the production build and verify client-side behavior:
  - npm run preview
  - Open http://localhost:4173/ in a browser and inspect the Console and Network tabs

3. If the site shows the offline page or blank UI:
  - Open http://localhost:4173/unregister-sw.html
  - Click "Unregister Service Worker" and follow instructions to clear caches
  - Reload the app

4. Inspect produced `dist` for old hostnames:
  - grep -R "api.the-huddle.co" dist || true
  - node scripts/find_hosts_in_dist.mjs

If you still see runtime errors or a blank page, collect the build logs and browser console network traces and share them.


---
Checklist maintained on: 2025-11-07.
Update when backend domain or deployment model changes.
