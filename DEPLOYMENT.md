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

- ✅ `VITE_SUPABASE_URL`
- ✅ `VITE_SUPABASE_ANON_KEY`
- ✅ `SUPABASE_SERVICE_ROLE_KEY`
- ✅ `JWT_SECRET` (generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`)
- ✅ `VITE_API_BASE_URL` (your domain URL)
- ✅ `VITE_API_URL` (your domain URL + /api)
- ✅ `NODE_ENV=production`
- ✅ `PORT=8787` (or your hosting platform's default)

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
