# Canonical Release Path

## Frontend

- Canonical path: Netlify
- Canonical workflow: `.github/workflows/netlify-deploy.yml`
- Purpose: build and archive the production frontend artifact used by the Netlify release path

## Backend

- Canonical path: Railway
- Canonical workflow: `.github/workflows/railway-deploy.yml`
- Health monitor target: `.github/workflows/health.yml`

## Launch Gate

- Canonical pre-release gate: `.github/workflows/ci.yml`
- This gate is the required build/test/typecheck/lint barrier before release workflows run

## Legacy Path

- `.github/workflows/deploy.yml` is retained as a manual-only GitHub Pages fallback
- It is no longer part of the automatic release story
