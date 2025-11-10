#!/usr/bin/env bash
set -euo pipefail

MIGRATION_FILE="$1"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL not set. Please export DATABASE_URL (postgres://user:pass@host:port/db) and retry." >&2
  echo "You can also run interactively and paste the DATABASE_URL when requested by the script." >&2
fi

echo "Looking for psql..."
if command -v psql >/dev/null 2>&1; then
  echo "psql found: $(psql --version)"
  if [ -z "${DATABASE_URL:-}" ]; then
    read -r -p "Enter DATABASE_URL (postgres://...): " DATABASE_URL
  fi
  echo "Running migration via psql..."
  psql "$DATABASE_URL" -f "$MIGRATION_FILE"
  echo "Migration applied via psql."
  exit 0
fi

echo "psql not found. Checking for supabase CLI..."
if command -v supabase >/dev/null 2>&1; then
  echo "supabase CLI found. Will attempt to push SQL using supabase CLI."
  if [ -z "${DATABASE_URL:-}" ]; then
    read -r -p "Enter DATABASE_URL (postgres://...): " DATABASE_URL
  fi
  echo "Configuring remote DB in supabase CLI..."
  supabase db remote set "$DATABASE_URL"
  echo "Pushing migration file via supabase db push..."
  supabase db push --file "$MIGRATION_FILE" || {
    echo "supabase db push failed. You may need to run this locally with proper auth." >&2
    exit 2
  }
  echo "Migration applied via supabase CLI."
  exit 0
fi

echo "Neither psql nor supabase CLI found on PATH. Please install the Postgres client (psql) or the supabase CLI and re-run."
echo "Homebrew on macOS: brew install libpq  (then add /opt/homebrew/opt/libpq/bin to PATH)"
exit 3
