## Deployment Guide

### Blue/green dry run (2025-12-31)

1. **Warm staging slot** – cloned production DB snapshot `2025-12-30T18:00Z` into Railway service `admin-platform-blue` and synced Supabase storage buckets (`course-videos`, `course-resources`).
2. **Deploy candidate build** – `npm run build && npm run start:server` via Railway deploy hook `deploy-blue`. Verified `/api/health` plus Playwright smoke suite (`npm run test:e2e -- --project smoke`).
3. **Flip traffic (simulated)** – updated Netlify proxy + Vercel preview DNS in staging org to point to Blue for 20 minutes while monitoring Grafana latencies. No errors logged in `server_health_report.json`.
4. **Rollback rehearsal** – triggered failure flag `FORCE_ORG_ENFORCEMENT=false`, observed alert, and performed DNS revert in < 2 minutes. Documented timings + owners in `server_health_report.json` (entry `blue-green-dry-run-2025-12-31`).

> Future cutovers follow the same steps; simply replace the snapshot timestamp and update the health-report log entry.

### Quick Deploy to Vercel

1. **Install Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel:**
   ```bash
   vercel login
   ```

3. **Deploy:**
   ```bash
   vercel
   ```

4. **Set Environment Variables:**
   ```bash
   vercel env add VITE_SUPABASE_URL
   vercel env add VITE_SUPABASE_ANON_KEY
   vercel env add JWT_SECRET
   vercel env add VITE_API_BASE_URL
   ```

5. **Deploy to Production:**
   ```bash
   vercel --prod
   ```

### Connect Custom Domain

1. **In Vercel Dashboard:**
   - Go to your project → Settings → Domains
   - Click "Add Domain"
   - Enter your domain (e.g., `app.yourdomain.com`)
   - Follow DNS configuration instructions

2. **Update DNS Records:**
   - Add the CNAME or A record shown by Vercel
   - Wait for DNS propagation (5-60 minutes)

3. **Update Environment Variables:**
   ```bash
   vercel env add VITE_API_BASE_URL production
   # Enter: https://yourdomain.com
   
   vercel env add VITE_API_URL production
   # Enter: https://yourdomain.com/api
   ```

4. **Redeploy:**
   ```bash
   vercel --prod
   ```

### Alternative: Railway

1. **Install Railway CLI:**
   ```bash
   npm install -g @railway/cli
   ```

2. **Login:**
   ```bash
   railway login
   ```

3. **Initialize:**
   ```bash
   railway init
   ```

4. **Set Environment Variables:**
   ```bash
   railway variables set VITE_SUPABASE_URL=your-value
   railway variables set JWT_SECRET=your-secret
   ```

5. **Deploy:**
   ```bash
   railway up
   ```

6. **Add Custom Domain:**
   - Go to Railway dashboard
   - Settings → Domains
   - Add custom domain
   - Update DNS records as instructed

### Environment Variables Checklist

Production environment variables you need to set:

- ✅ `SUPABASE_URL`
- ✅ `SUPABASE_SERVICE_ROLE_KEY`
- ✅ `SUPABASE_ANON_KEY` (backend auth client)
- ✅ `VITE_SUPABASE_URL`
- ✅ `VITE_SUPABASE_ANON_KEY` (frontend storage access)
- ✅ `JWT_SECRET` and `JWT_REFRESH_SECRET` (generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`)
- ✅ `VITE_API_BASE_URL` / `VITE_API_URL` (your domain + `/api`)
- ✅ `COOKIE_DOMAIN` (e.g. `.the-huddle.co`) so auth + `active_org` cookies stay scoped correctly
- ✅ `VITE_ENABLE_WS=true` (if WebSocket sync is enabled in prod)
- ✅ `NODE_ENV=production`
- ✅ `PORT=8787` (or your hosting platform's default)
- ➕ Optional operational knobs:
  - `ACTIVE_ORG_COOKIE_NAME` if you need a custom cookie identifier for the admin org selector
  - `VITE_ALLOW_DEFAULT_COURSES=true` only in demo environments where you intentionally seed the default catalog

### Runtime health & mode switching

Use this checklist whenever you flip the platform between demo mode (in-memory data for workshops) and secure Supabase mode:

1. **Set the correct env toggles**
   - Demo/local rehearsals: `DEV_FALLBACK=true`, `DEMO_MODE=true`, omit Supabase keys.
   - Supabase/production: `DEV_FALLBACK=false`, `DEMO_MODE=false`, and provide `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
2. **Restart both processes** (Express API + Vite build) so `src/state/runtimeStatus.ts` sees the new configuration and updates `window.__APP_RUNTIME_STATUS__`.
3. **Verify `/api/health`** from the deploy target:
   ```bash
   curl -s https://<your-host>/api/health | jq '{status, demoMode: .demoMode.enabled, supabase: .supabase.status}'
   ```
   - Demo mode should return `status:"demo-fallback"` with `demoMode.enabled=true`.
   - Secure mode should return `status:"ok"` and `supabase.status:"ok"`.
4. **Check the LMS login banner** ( `/lms/login` ):
   - Demo mode auto-fills the demo credentials and hides registration/forgot-password.
   - Secure mode shows "Secure mode connected", enables the Create Account tab, and displays the last health-check timestamp.
5. **Exercise auth flows**
   - Registration: submit the LMS Create Account form with a real organization ID; confirm Supabase user + profile rows are created.
   - Forgot password: attempt in secure mode only—UI should block the action if `/api/health` is degraded.
6. **Record the runtime snapshot** by grabbing `window.__APP_RUNTIME_STATUS__` *and* the active organization selection:
   - In the browser console run:
     ```js
     ({
       runtime: window.__APP_RUNTIME_STATUS__,
       activeOrg: document.cookie.match(/active_org=([^;]+)/)?.[1] || '(none)'
     })
     ```
   - Attach this JSON to the deployment log (e.g., `ADMIN_PORTAL_FIX_PLAN.md`) so ops can see exactly which mode and organization scope shipped.

These steps ensure the DAL-guarded services (`assignmentStorage`, `progressService`, analytics dashboards) behave consistently with the documented runtime state.

### SSL Certificate

Most platforms (Vercel, Railway, Netlify) provide automatic SSL certificates through Let's Encrypt. If using a custom server:

1. Use **Certbot** for free SSL:
   ```bash
   sudo certbot --nginx -d yourdomain.com
   ```

2. Or use **Cloudflare** for free SSL + CDN

### SSL Troubleshooting (ERR_SSL_PROTOCOL_ERROR)

If your browser shows "ERR_SSL_PROTOCOL_ERROR" for your domain, follow these steps:

- Check DNS and domain mapping: ensure A and CNAME records point to the correct host (Netlify/Vercel/Railway). A bad DNS target can return a non-TLS response on port 443.
- Verify TLS certificate details and handshake using OpenSSL:
   ```bash
   openssl s_client -connect the-huddle.co:443 -servername the-huddle.co
   ```
- Use our helper script to inspect TLS info:
   ```bash
   npm run diag:ssl -- the-huddle.co
   ```
- Cloudflare users: set SSL/TLS mode to Full or Full (strict). 'Flexible' will cause protocol mismatch between CDN and origin. If using Cloudflare origin certificates, ensure they are installed on the origin server.
- Enable host-side HTTPS in the dashboard (Netlify/Vercel) and ensure the site is verified. Wait a few minutes for certificate provisioning after changing DNS.
- If using a load balancer or reverse proxy: verify that TLS is terminated at the edge (not at a backend that returns plaintext over port 443).
- If you want the server to auto-redirect HTTP->HTTPS when proxied, enable the server env `ENFORCE_HTTPS=true` (we added middleware to the server to support this).

If the TLS handshake fails and the host returns plaintext or no certificate, re-check DNS and host settings (this typically means the target is not the correct hosting provider or the hosting provider is returning a non-TLS response).

### Build Commands

Make sure your hosting platform uses:
- **Build Command:** `npm run build`
- **Start Command:** `node server/index.js`
- **Install Command:** `npm install`
