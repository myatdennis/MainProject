# GitHub ↔ Railway Integration Guide

This file shows how to connect your GitHub repository to Railway and how to use a GitHub Action to deploy automatically.

1) Railway Dashboard (recommended)
   - Go to Railway: https://railway.app
   - Create a new project or select an existing project.
   - Click "Settings" → "Integrations" → "GitHub".
   - Connect your GitHub account and select the `myatdennis/MainProject` repository.
   - Pick the branch you want Railway to track (eg `main` or `feat/ws-client`).
   - For a multi-service project (frontend + backend), create two services in Railway: `api` for Node and `frontend` for Vite static.
   - For the `api` service, set the Start command to: `npm run start:server`.

2) Add GitHub Secrets
   - In your GitHub repo go to `Settings` → `Secrets and variables` → `Actions` → `New repository secret`.
   - Add these secrets:
     - `RAILWAY_API_KEY` — You can get this from Railway. Use a read/write token; keep it secret.
     - `RAILWAY_PROJECT_ID` — The Railway project id (optional but recommended for unambiguous deployment).
     - `RAILWAY_ENVIRONMENT` — The environment (defaults such as `production`).
     - `RAILWAY_HOST` — `example-api.up.railway.app` — used by the optional health check.

3) Verify the action
   - The added workflow `.github/workflows/railway-deploy.yml` is triggered on push to `main` and `feat/ws-client`.
   - It will install Node deps, build the frontend, install the Railway CLI, login using your `RAILWAY_API_KEY`, and attempt to `railway up` the `api` service.
   - Check the GitHub Actions run for errors and adjust secrets or service names.

Notes
   - If you prefer to let Railway handle the deployments automatically via the Railway GitHub integration, you can disable/skip this workflow.
   - Do not store `SUPABASE_SERVICE_ROLE_KEY` or other server-only secrets in the frontend build. Put them only in Railway service variables.

If you want, I can try to add a safer 'deploy-only' step that uses Railway's official GitHub action (if you prefer); otherwise the CLI-based approach above is a simple start.