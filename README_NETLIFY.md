# Netlify Deployment Guide (frontend only)

This guide explains how to deploy the frontend to Netlify while keeping the backend hosted on Railway (or other host).

1) Link your repository to Netlify
- Go to https://app.netlify.com/sites and click "New site from Git".
- Choose Git provider, select the `myatdennis/MainProject` repo.
- Select the branch `feat/ws-client` (or the branch you want to deploy).

2) Build & publish settings
- Build command: `npm run build`
- Publish directory: `dist`

3) Add required Environment Variables in Netlify (Site Settings -> Build & deploy -> Environment)
- VITE_SUPABASE_URL — your Supabase URL (e.g. `https://xxxxx.supabase.co`)
- VITE_SUPABASE_ANON_KEY — Supabase anon key (public)
- VITE_API_BASE_URL — backend API base URL (e.g., `https://api.my-backend-host.app`)
  - This should be the Railway backend URL (or wherever the server is hosted unless you host API with Netlify functions).

4) Optional additional variables (frontend)
- VITE_ENABLE_DEBUG_LOGS=true (only for troubleshooting; remove in production)

5) Domain verification and CORS on the backend
- After Netlify publishes, add your custom domain (e.g. `the-huddle.co`) in the Netlify dashboard and follow the DNS steps.
- Once the domain is verified, add the Netlify site URL and your custom domain to the `CORS_ALLOWED_ORIGINS` in Railway or server host. Example:
  `https://<yoursite>.netlify.app,https://the-huddle.co`.

## DNS / Domain verification steps (what to tell support or who manages DNS)

If you have a message to customer support about verifying the domain, include these exact details:

1) The site needs a CNAME record pointing to Netlify's assigned domain for your site (e.g., `the-huddle.netlify.app`).
  - Example: `the-huddle.co CNAME the-huddle.netlify.app` (for root domain you may need A records instead; see Netlify docs)
2) If you use an apex/root domain (the-huddle.co), add the appropriate Netlify A records as instructed in the Netlify UI (Netlify gives two A records and one ALIAS/ANAME option).
3) If your DNS provider needs a verification TXT record for Netlify, add the TXT value that Netlify shows when adding a domain.
4) After DNS updates, Netlify will issue an SSL certificate via Let's Encrypt – ensure the provider allows Netlify to validate the domain.

When contacting customer support, include:
- The domain name (the-huddle.co)
- The Netlify site domain they assigned (e.g., the-huddle-abcde.netlify.app)
- A request to verify DNS records are pointing to Netlify and that there's no conflicting DNS records (old A records pointing to Vercel or other hosts)
- If they manage DNS on your behalf, ask them to add the Netlify entries and enable DNSSEC/CAA according to Netlify's advice.

## Quick checklist: after DNS changes
1) Wait for DNS propagation (up to 48h, typically < 10 minutes for TTL=60).
2) Run `dig the-huddle.co` or `nslookup the-huddle.co` to confirm.
3) In Netlify, verify the domain status is 'Verified' and TLS is issued.
4) Add your Netlify hostname to server `CORS_ALLOWED_ORIGINS` and `COOKIE_DOMAIN` as appropriate.

## SSL Troubleshooting (Common for Netlify)

If the domain shows `ERR_SSL_PROTOCOL_ERROR`, try these steps:

- Confirm A/CNAME records are pointed to Netlify per the instructions above.
- Use the included TLS diagnostic tool to inspect the certificate and handshake:
  ```bash
  npm run diag:ssl -- the-huddle.co
  ```
- If the certificate appears valid but your browser still fails:
  - Clear the host and browser caches. Sometimes a cached invalid resource triggers SSL failures.
  - Check Cloudflare (if enabled): use SSL/TLS mode 'Full (strict)' when possible, and ensure an origin certificate exists if using Cloudflare's private certs.
  - If you previously had the domain on another provider (Vercel), ensure that you removed the domain mapping there to avoid certificate conflicts.
- Lastly, in Netlify, re-trigger certificate issuance by removing and re-adding the domain (or use Netlify support) if needed; this often resolves mis-provisioned certs.


6) Test production site
- Open your Netlify site (or custom domain).
- Check the console and network logs for 500 errors and missing assets.
- Check that calls to `/api/health` and `/api/admin/courses` are proxied to your backend and returning 200.

7) Security and secret handling
- Never set `SUPABASE_SERVICE_ROLE_KEY` or `DATABASE_URL` as Netlify environment variables (they are server-only secrets). Those must be set in Railway or your backend hosting provider.

8) Switching from Vercel
- If you switch from Vercel to Netlify, make sure you remove any old Vercel alias or CDN cache referencing your domain and update `CORS_ALLOWED_ORIGINS` to include the Netlify domain.

9) Helpful checks
- Run `node scripts/check_deploy_env.cjs` locally (with env vars set) to verify essential variables are present.

If you want, I can create a Netlify deploy preview and validate that `VITE_API_BASE_URL` is configured correctly and that `/api/health` resolves to 200.
