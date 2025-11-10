#!/usr/bin/env bash
# Apply SQL migration to Postgres using psql. Requires `psql` to be installed and available on PATH.
# Usage:
#   DATABASE_URL=postgres://user:pass@host:port/db ./scripts/apply_migration.sh supabase/migrations/20251107_add_versions_and_idempotency.sql

set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: DATABASE_URL=postgres://... $0 <path-to-sql-file>"
  exit 2
fi

SQL_FILE="$1"

if [ ! -f "$SQL_FILE" ]; then
  echo "SQL file not found: $SQL_FILE"
  exit 2
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "Please set DATABASE_URL environment variable (eg. export DATABASE_URL=postgres://user:pass@host:5432/db)"
  exit 2
fi

echo "Applying migration: $SQL_FILE"

# Use psql to run the SQL. We pass ON_ERROR_STOP=1 so psql fails fast on error.
PGPASSWORD=$(echo "$DATABASE_URL" | sed -E 's,.+://[^:]+:([^@]+)@.+,\1,')
export PGPASSWORD

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$SQL_FILE"

echo "Migration applied successfully."
