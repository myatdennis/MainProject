#!/usr/bin/env bash
set -euo pipefail

# Toggle dev-friendly VITE_API_* settings into .env.local
# Usage:
#   ./scripts/toggle_dev_env.sh apply   # backup .env.local -> .env.local.bak, set empty VITE_API_*
#   ./scripts/toggle_dev_env.sh restore # restore .env.local from .env.local.bak

ENV_FILE=".env.local"
BACKUP_FILE="${ENV_FILE}.bak"

if [ "$#" -lt 1 ]; then
  echo "Usage: $0 apply|restore"
  exit 2
fi

case "$1" in
  apply)
    if [ ! -f "$ENV_FILE" ]; then
      echo "No $ENV_FILE found — creating dev version with empty VITE_API_* settings"
      cat > "$ENV_FILE" <<'EOF'
# Local dev env (created by scripts/toggle_dev_env.sh)
VITE_API_BASE_URL=
VITE_API_URL=
EOF
      echo "Created $ENV_FILE"
      exit 0
    fi

    cp "$ENV_FILE" "$BACKUP_FILE"
    echo "Backed up $ENV_FILE -> $BACKUP_FILE"

    # filter out any existing VITE_API_* lines and append blank ones
    awk '!/^VITE_API_BASE_URL=/ && !/^VITE_API_URL=/' "$BACKUP_FILE" > "${ENV_FILE}.tmp"
    echo >> "${ENV_FILE}.tmp"
    echo "VITE_API_BASE_URL=" >> "${ENV_FILE}.tmp"
    echo "VITE_API_URL=" >> "${ENV_FILE}.tmp"
    mv "${ENV_FILE}.tmp" "$ENV_FILE"
    echo "Wrote dev-friendly $ENV_FILE (preserved other keys)."
    ;;

  restore)
    if [ -f "$BACKUP_FILE" ]; then
      mv "$BACKUP_FILE" "$ENV_FILE"
      echo "Restored $ENV_FILE from $BACKUP_FILE"
    else
      echo "No backup ($BACKUP_FILE) found to restore"
      exit 1
    fi
    ;;

  *)
    echo "Usage: $0 apply|restore"
    exit 2
    ;;
esac
