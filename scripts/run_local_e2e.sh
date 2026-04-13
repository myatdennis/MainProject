#!/usr/bin/env bash
# scripts/run_local_e2e.sh
# Wrapper to help run a local E2E run against a staging/local DB.
# This script does not start Docker Compose. It assumes you have a running DB
# and have set env vars (see .env.local.example).

set -euo pipefail

# Load .env.local if present
if [ -f .env.local ]; then
  echo "Loading .env.local"
  export $(cat .env.local | grep -v '^#' | xargs)
fi

if [ -z "${DATABASE_POOLER_URL:-}" ] && [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: Set DATABASE_POOLER_URL or DATABASE_URL in your environment or .env.local"
  exit 1
fi

# Run quick verification steps
echo "1) Typecheck"
npm run typecheck

echo "2) Lint"
npm run lint

echo "3) Unit tests (fast)"
npm run test:run

# Optionally generate reversible migration with live DB (optional)
read -p "Generate reversible index migration from DB before E2E? (y/N) " gen
if [ "${gen}" = "y" ] || [ "${gen}" = "Y" ]; then
  node scripts/generate_reversible_index_migration.mjs
  echo "Review migrations/2026-04-13_drop_unused_indexes_reversible.sql before applying to any DB."
fi

# Start server in E2E mode
echo "Starting server in E2E mode (background)..."
npm run start:server:e2e &
SERVER_PID=$!

# Wait for server to be healthy (poll /health or root)
echo "Waiting for server to be ready..."
for i in {1..30}; do
  if curl -sS --fail ${VITE_API_BASE_URL:-http://localhost:8888}/health >/dev/null 2>&1; then
    echo "Server ready"
    break
  fi
  echo -n "."
  sleep 1
done

# Run playwright tests
echo "Running Playwright E2E tests"
npm run test:e2e || E2E_EXIT_CODE=$?

# Cleanup
echo "Shutting down server (PID: $SERVER_PID)"
kill $SERVER_PID || true

if [ -n "${E2E_EXIT_CODE:-}" ]; then
  echo "E2E tests failed with code: $E2E_EXIT_CODE"
  exit $E2E_EXIT_CODE
fi

echo "E2E run completed successfully"
