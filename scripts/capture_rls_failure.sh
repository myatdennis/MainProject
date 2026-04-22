#!/usr/bin/env bash
set -euo pipefail

# Usage:
# TOKEN=<JWT> ORG_ID=<ORG_ID> ./scripts/capture_rls_failure.sh [endpoint]
# Example:
# TOKEN=ey... ORG_ID=org_123 ./scripts/capture_rls_failure.sh /api/client/surveys/assigned

REQUEST_ID=${REQUEST_ID:-trace-rls-001}
ENDPOINT=${1:-/api/client/surveys/assigned}
LOG_FILE=${LOG_FILE:-server.log}
HOST=${HOST:-http://localhost:8888}

if [ -z "${TOKEN:-}" ]; then
  echo "ERROR: TOKEN environment variable is required. Export TOKEN=<JWT> and retry."
  exit 2
fi
if [ -z "${ORG_ID:-}" ]; then
  echo "ERROR: ORG_ID environment variable is required. Export ORG_ID=<ORG_ID> and retry."
  exit 2
fi

if [ ! -f "$LOG_FILE" ]; then
  echo "ERROR: Log file '$LOG_FILE' not found. Start the server with logs redirected to $LOG_FILE or set LOG_FILE to the path of your running server log."
  echo "Example: npm run start:server > server.log 2>&1 &"
  exit 3
fi

URL="$HOST$ENDPOINT"

echo "Sending single request to $URL (request id: $REQUEST_ID)"

curl -sS -w "\nHTTP_STATUS:%{http_code}\n" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Request-Id: $REQUEST_ID" \
  -H "X-Org-Id: $ORG_ID" \
  "$URL" || true

# give the server a moment to flush logs
sleep 1

echo
echo "=== rls_context_materialize_start (near $REQUEST_ID) ==="
grep -n -C3 '"rls_context_materialize_start"' "$LOG_FILE" || true

echo
echo "=== client_assigned_materialize_trigger (near $REQUEST_ID) ==="
grep -n -C3 '"client_assigned_materialize_trigger"' "$LOG_FILE" || true

echo
echo "=== survey_assignments_materialize_failed (near $REQUEST_ID) ==="
grep -n -C8 '"survey_assignments_materialize_failed"' "$LOG_FILE" || true

echo
echo "=== course_assignments_materialize_failed (near $REQUEST_ID) ==="
grep -n -C8 '"course_assignments_materialize_failed"' "$LOG_FILE" || true

echo
echo "If the above blocks are empty, try increasing the grep context or confirm the server is writing to $LOG_FILE."

echo "Done. Paste the three log blocks (exact) into the support ticket or reply to the assistant." 
