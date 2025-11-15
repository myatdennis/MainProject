# GitHub Secrets Checklist for Railway Deploys

Add these secrets to your GitHub repository (Settings → Secrets and variables → Actions):

| Secret Name           | Value (example)                                      | Description                                 |
|----------------------|------------------------------------------------------|---------------------------------------------|
| RAILWAY_API_KEY      | <your Railway API key>                                | Get from Railway dashboard (Account > API)  |
| RAILWAY_PROJECT_ID   | <your Railway project ID>                             | Get from Railway dashboard (Project > Settings > General) |
| RAILWAY_ENVIRONMENT  | production                                           | Usually 'production' unless you use preview |
| RAILWAY_HOST         | https://backboard.railway.app                        | Default for most Railway projects           |

## How to Find Values
- **RAILWAY_API_KEY**: https://railway.app/account/tokens
- **RAILWAY_PROJECT_ID**: https://railway.app/project/[your-project-slug]/settings/general
- **RAILWAY_ENVIRONMENT**: Use 'production' unless you have a custom environment
- **RAILWAY_HOST**: Usually 'https://backboard.railway.app'

---

# CORS_ALLOWED_ORIGINS for Railway
Set this in your Railway project variables:

CORS_ALLOWED_ORIGINS=https://mainproject-production-4e66.up.railway.app,https://your-frontend-domain.com

- Replace 'https://your-frontend-domain.com' with your actual frontend domain (e.g., Netlify, Vercel, or custom domain).
- If you use multiple domains, separate them with commas (no spaces).

---

# .env.example Status
- Your `.env.example` is up to date with the latest Railway backend URL and all required variables.
- If you add new environment variables, update `.env.example` accordingly.

---

# Next Steps
1. Add the above secrets to your GitHub repository.
2. Set CORS_ALLOWED_ORIGINS in your Railway project variables to include your frontend domain(s).
2.1 If your app uses a database (for example Supabase), set `DATABASE_URL` in Railway variables. Get the connection string in Supabase under Settings → Database → Connection string. Never commit database secrets to GitHub.
2.2 Use the helper script `scripts/railway_set_envs.sh` to import values from your local `.env` into Railway via the Railway CLI. Refer to `RAILWAY_ENV_SETUP.md`.
3. Deploy via GitHub Actions or Railway dashboard.
4. Verify your backend health endpoint: https://mainproject-production-4e66.up.railway.app/api/health

If you need to automate any of these steps further, let me know!