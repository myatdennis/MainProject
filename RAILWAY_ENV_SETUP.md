This guide helps you set the required environment variables on Railway using the Railway CLI.

1. Install Railway CLI

   ```bash
   npm install -g @railway/cli
   ```

2. Get your Railway API token (if needed) & login

   - In Railway dashboard, go to Account → Tokens → Create Token. Copy value.
   - Login to Railway in your terminal:
     ```bash
     railway login --apiKey YOUR_RAILWAY_API_KEY
     ```

3. Set your project & environment

   - Find your project ID: Visit https://railway.app and open your project. The ID is in project URL or Settings → General.
   - For most users, environment is `production`.

4. Set environment variables automatically from your local `.env` (one line)

   ```bash
   RAILWAY_PROJECT_ID=<your-id> RAILWAY_ENVIRONMENT=production ./scripts/railway_set_envs.sh
   ```

   The script will read values from the current environment (preferred) and fall back to a `.env` file in the repo root if present.

5. Manually set if you prefer the Railway UI

   - Go to your Railway project → Services → [Your API] → Variables
   - Add or update values like `DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CORS_ALLOWED_ORIGINS`, `JWT_SECRET` etc.

6. Common values

   - DATABASE_URL: Use the Supabase DB connection string: `postgresql://postgres:<password>@db.<your-supabase>.supabase.co:5432/postgres?sslmode=verify-full`
   - SUPABASE_SERVICE_ROLE_KEY: The server-side Supabase key (keep secret)
   - JWT_SECRET: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
   - CORS_ALLOWED_ORIGINS: `https://mainproject-production-4e66.up.railway.app,https://your-frontend.example`
    - ENFORCE_HTTPS (optional): Set to `true` to enable a server-side HTTP->HTTPS redirect when running behind a proxy (Netlify/Cloudflare/Vercel). Note: `app.set('trust proxy', 1)` is already added to the server to support this.

7. After setting variables

   - Trigger a redeploy via Railway UI or push a new commit to GitHub.
   - Check your deployment logs: Railway → Project → Services → [Service] → Logs.
   - Confirm health: `curl -fsS https://<your-railway-host>/api/health`

If you need a screen-by-screen walkthrough for Railway's UI, I can guide you interactively. If you prefer, I can also show you how to set variables in GitHub Actions or in the Railway UI with screenshots.