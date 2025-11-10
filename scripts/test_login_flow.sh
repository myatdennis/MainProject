#!/usr/bin/env bash
# test_login_flow.sh
# End-to-end smoke test of the login lifecycle against local server (PORT=8888)
# Requires: server running (DEV_FALLBACK demo mode acceptable)
# Demo credentials exercised: admin@thehuddleco.com / admin123
# Outputs a summary with PASS/FAIL for each stage.
set -euo pipefail
BASE_URL="http://localhost:8888/api/auth"
TMP_DIR="$(mktemp -d)"
SUMMARY="$TMP_DIR/summary.txt"
PASS_COUNT=0
FAIL_COUNT=0

log(){ printf "\n==== %s ====\n" "$1"; }
pass(){ echo "PASS: $1"; PASS_COUNT=$((PASS_COUNT+1)); }
fail(){ echo "FAIL: $1"; FAIL_COUNT=$((FAIL_COUNT+1)); }

check_health(){
  log "Health"
  curl -s "http://localhost:8888/api/health" | jq . || true
}

login(){
  log "Login"
  RESP=$(curl -s -w '\n%{http_code}' -H 'Content-Type: application/json' -d '{"email":"admin@thehuddleco.com","password":"admin123"}' "$BASE_URL/login")
  BODY=$(echo "$RESP" | head -n1)
  CODE=$(echo "$RESP" | tail -n1)
  echo "$BODY" | jq . || true
  if [ "$CODE" != "200" ]; then fail "Login status $CODE"; return 1; fi
  ACCESS=$(echo "$BODY" | jq -r '.accessToken')
  REFRESH=$(echo "$BODY" | jq -r '.refreshToken')
  EXPIRES=$(echo "$BODY" | jq -r '.expiresAt')
  if [ -z "$ACCESS" ] || [ "$ACCESS" = "null" ]; then fail "Missing accessToken"; else pass "accessToken present"; fi
  if [ -z "$REFRESH" ] || [ "$REFRESH" = "null" ]; then fail "Missing refreshToken"; else pass "refreshToken present"; fi
  if [ -z "$EXPIRES" ] || [ "$EXPIRES" = "null" ]; then fail "Missing expiresAt"; else pass "expiresAt present"; fi
  echo "$ACCESS" > "$TMP_DIR/access.token"
  echo "$REFRESH" > "$TMP_DIR/refresh.token"
}

verify(){
  log "Verify"
  ACCESS=$(cat "$TMP_DIR/access.token")
  RESP=$(curl -s -w '\n%{http_code}' -H "Authorization: Bearer $ACCESS" "$BASE_URL/verify")
  BODY=$(echo "$RESP" | head -n1)
  CODE=$(echo "$RESP" | tail -n1)
  echo "$BODY" | jq . || true
  if [ "$CODE" != "200" ]; then fail "Verify status $CODE"; else pass "Verify 200"; fi
}

refresh(){
  log "Refresh"
  REFRESH=$(cat "$TMP_DIR/refresh.token")
  RESP=$(curl -s -w '\n%{http_code}' -H 'Content-Type: application/json' -d "{\"refreshToken\":\"$REFRESH\"}" "$BASE_URL/refresh")
  BODY=$(echo "$RESP" | head -n1)
  CODE=$(echo "$RESP" | tail -n1)
  echo "$BODY" | jq . || true
  if [ "$CODE" != "200" ]; then fail "Refresh status $CODE"; return; fi
  NEW_ACCESS=$(echo "$BODY" | jq -r '.accessToken')
  if [ -n "$NEW_ACCESS" ] && [ "$NEW_ACCESS" != "null" ]; then pass "New accessToken issued"; else fail "No new accessToken"; fi
}

logout(){
  log "Logout"
  ACCESS=$(cat "$TMP_DIR/access.token")
  RESP=$(curl -s -w '\n%{http_code}' -H "Authorization: Bearer $ACCESS" -X POST "$BASE_URL/logout")
  BODY=$(echo "$RESP" | head -n1)
  CODE=$(echo "$RESP" | tail -n1)
  echo "$BODY" | jq . || true
  if [ "$CODE" != "200" ]; then fail "Logout status $CODE"; else pass "Logout 200"; fi
}

# Run sequence
check_health || true
login || true
verify || true
refresh || true
logout || true

TOTAL=$((PASS_COUNT+FAIL_COUNT))
log "Summary"
printf "Pass: %d\nFail: %d\nTotal Checks: %d\n" "$PASS_COUNT" "$FAIL_COUNT" "$TOTAL"
if [ "$FAIL_COUNT" -eq 0 ]; then echo "OVERALL: PASS"; else echo "OVERALL: FAIL"; fi

echo "(Temp artifacts in $TMP_DIR)"
