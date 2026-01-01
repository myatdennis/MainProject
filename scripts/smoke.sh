#!/usr/bin/env bash
set -euo pipefail
DOMAIN=${1:-the-huddle.co}
RAILWAY_HOST=${2:-example-api.up.railway.app}
EMAIL=${3:-mya@the-huddle.co}
PASS=${4:-admin123}

log() { printf "\n[smoke] %s\n" "$*"; }
fail() { printf "\n[smoke][FAIL] %s\n" "$*"; exit 1; }

log "DNS lookup apex";
APEX_IPS=$(dig +short "$DOMAIN" || true)
[ -z "$APEX_IPS" ] && log "No A records yet (NXDOMAIN likely)." || echo "$APEX_IPS" | sed 's/^/  /'

log "DNS lookup www";
WWW_CNAME=$(dig +short www."$DOMAIN" || true)
[ -z "$WWW_CNAME" ] && log "No CNAME for www yet." || echo "$WWW_CNAME" | sed 's/^/  /'

log "Health endpoint";
curl -fsS "https://$RAILWAY_HOST/api/health" || fail "API health failed"

log "CORS preflight";
curl -i -X OPTIONS "https://$RAILWAY_HOST/api/auth/login" \
  -H "Origin: https://$DOMAIN" \
  -H "Access-Control-Request-Method: POST" | sed -n '1,12p'

log "Demo login (if DEV_FALLBACK enabled)";
LOGIN_JSON=$(curl -s -w '\n%{http_code}' -H 'Content-Type: application/json' \
  -H "Origin: https://$DOMAIN" \
  -d '{"email":"'$EMAIL'","password":"'$PASS'"}' \
  "https://$RAILWAY_HOST/api/auth/login")
HTTP_CODE=$(echo "$LOGIN_JSON" | tail -n1)
BODY=$(echo "$LOGIN_JSON" | head -n -1)
if [ "$HTTP_CODE" != "200" ]; then
  log "Login failed (status $HTTP_CODE). Body: $BODY"
else
  echo "$BODY" | grep -q 'accessToken' && log "Login success" || log "Login response missing accessToken"
fi

log "Done."