#!/usr/bin/env bash
# Usage:
#   BASE=https://the-huddle.co ORIGIN=https://the-huddle.co ./scripts/verify_auth.sh
#   BASE=https://thehuddleco.up.railway.app ORIGIN=https://thehuddleco.up.railway.app ./scripts/verify_auth.sh
set -euo pipefail

BASE="${BASE:-https://the-huddle.co}"
ORIGIN="${ORIGIN:-https://the-huddle.co}"
EMAIL="${EMAIL:-mya@the-huddle.co}"
COOKIE_JAR="${COOKIE_JAR:-/tmp/verify_auth.cookies}"
OUT_HEADERS="/tmp/verify_auth.headers.txt"
LOGIN_BODY="/tmp/verify_auth.login.body.txt"

fail() { echo "FAIL: $1" >&2; exit 1; }
ok() { echo "OK: $1"; }

chmod 600 "$COOKIE_JAR" 2>/dev/null || true

echo "== Verifying auth for $BASE =="
echo "BASE:       $BASE"
echo "ORIGIN:     $ORIGIN"
echo "EMAIL:      $EMAIL"
echo "COOKIE_JAR: $COOKIE_JAR"
echo

echo "1) Login (prompts for password; no echo)"
printf "Password: "
stty -echo
read -r PASS
stty echo
echo

LOGIN_CODE=$(curl -fsS -c "$COOKIE_JAR" -D "$OUT_HEADERS" -w '%{http_code}' \
  -H "Origin: $ORIGIN" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" \
  "$BASE/api/auth/login" -o "$LOGIN_BODY" || true)

unset PASS

printf "Login HTTP code: %s\n" "$LOGIN_CODE"
grep -i '^set-cookie:' "$OUT_HEADERS" || echo "No Set-Cookie headers found"
echo

echo "Cookie jar entries:"
grep -E 'access_token|refresh_token|csrf_token|session_id' "$COOKIE_JAR" || echo "No relevant cookies in jar"
echo

if [ "$LOGIN_CODE" != "200" ]; then
  echo "Login failed. Response body:"; head -c 500 "$LOGIN_BODY"; echo; fail "Login failed with code $LOGIN_CODE"
fi
ok "Login OK + cookies stored at $COOKIE_JAR"
echo

echo "2) /api/auth/session"
SESSION_CODE=$(curl -fsS -b "$COOKIE_JAR" -H "Origin: $ORIGIN" -w '%{http_code}' "$BASE/api/auth/session" -o /tmp/verify_auth.session.body.txt || true)
if [ "$SESSION_CODE" = "200" ]; then
  ok "/api/auth/session OK"
else
  echo "Session failed. Response body:"; head -c 500 /tmp/verify_auth.session.body.txt; echo; fail "/api/auth/session failed ($SESSION_CODE)"
fi
echo

echo "3) /api/auth/refresh"
REFRESH_CODE=$(curl -fsS -b "$COOKIE_JAR" -H "Origin: $ORIGIN" -w '%{http_code}' "$BASE/api/auth/refresh" -o /tmp/verify_auth.refresh.body.txt || true)
if [ "$REFRESH_CODE" = "200" ]; then
  ok "/api/auth/refresh OK"
else
  echo "Refresh failed. Response body:"; head -c 500 /tmp/verify_auth.refresh.body.txt; echo; fail "/api/auth/refresh failed ($REFRESH_CODE)"
fi
echo

echo "== Auth verification complete =="