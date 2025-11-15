#!/usr/bin/env bash
set -euo pipefail

# Small helper to set common environment variables in Railway using the Railway CLI.
# Usage: 
#   1) Ensure you have Railway CLI: npm i -g @railway/cli
#   2) Login: railway login --apiKey $RAILWAY_API_KEY
#   3) Run: RAILWAY_PROJECT_ID=<id> RAILWAY_ENVIRONMENT=production ./scripts/railway_set_envs.sh
#
# This script will try to read values from the current environment, falling back to .env if present.

REQUIRED_VARS=(RAILWAY_PROJECT_ID RAILWAY_ENVIRONMENT)
for v in "${REQUIRED_VARS[@]}"; do
  if [[ -z "${!v:-}" ]]; then
    echo "Required environment variable $v is not set. Please export it or run with $v=value"
    exit 1
  fi
done

PROJECT=$RAILWAY_PROJECT_ID
ENV=${RAILWAY_ENVIRONMENT}

# function to read from env or fallback to .env file
getval() {
  local key="$1"
  # priority: environment variable -> .env file -> empty
  if [[ -n "${!key:-}" ]]; then
    echo "${!key}"
    return
  fi
  if [[ -f .env ]]; then
    # Use awk to find the first non-commented line with KEY=VALUE
    local val
    val=$(awk -F'=' -v k="$key" '$0 !~ /^#/ && $1==k {sub(/^[^=]*=/, "", $0); print $0; exit}' .env)
    # Remove surrounding quotes if present
    val="$(echo "$val" | sed -E 's/^"(.*)"$/\1/; s/^\'(.*)\'$/\1/')"
    if [[ -n "$val" ]]; then
      echo "$val"
      return
    fi
  fi
  echo ""
}

# List of variables we want to ensure in Railway
declare -a RAILWAY_VARS=(
  "DATABASE_URL"
  "SUPABASE_URL"
  "SUPABASE_SERVICE_ROLE_KEY"
  "VITE_SUPABASE_URL"
  "VITE_SUPABASE_ANON_KEY"
  "JWT_SECRET"
  "VITE_API_BASE_URL"
  "VITE_API_URL"
  "CORS_ALLOWED_ORIGINS"
  "BROADCAST_API_KEY"
  "NODE_ENV"
  "PORT"
)

set -x
for KEY in "${RAILWAY_VARS[@]}"; do
  VAL=$(getval "$KEY")
  if [[ -z "$VAL" ]]; then
    echo "Skipping $KEY: no value found in environment or .env"
    continue
  fi

  # railway variables set supports KEY=VALUE
  railway variables set "$KEY=${VAL}" --project "$PROJECT" --environment "$ENV" || {
    echo "railway variables set failed for $KEY"; exit 1
  }
done
set +x

echo "Completed setting Railway variables for $PROJECT ($ENV)"
