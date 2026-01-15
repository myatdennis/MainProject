#!/usr/bin/env bash
set -euo pipefail

BASE="${BASE:-http://localhost:8888}"
ORIGIN="${ORIGIN:-http://localhost:5174}"
EMAIL="${EMAIL:-mya@the-huddle.co}"
COOKIE_JAR="${COOKIE_JAR:-/tmp/mainproject.cookies}"

fail() { echo "❌ $1" >&2; exit 1; }
ok() { echo "✅ $1"; }

echo "== MainProject Doctor =="
echo "BASE:       $BASE"
echo "ORIGIN:     $ORIGIN"
echo "EMAIL:      $EMAIL"
echo "COOKIE_JAR: $COOKIE_JAR"
echo

echo "1) Health"
HEALTH_JSON="$(curl -fsS -H "Origin: $ORIGIN" "$BASE/api/health" || true)"
echo "$HEALTH_JSON" | grep -Eq '("ok"[[:space:]]*:[[:space:]]*true|"status"[[:space:]]*:[[:space:]]*"ok")' \
  && ok "Health OK" \
  || { echo "$HEALTH_JSON" | head -c 400; echo; fail "Health failed"; }
echo

echo "2) Login (prompts for password; no echo)"
printf "Password: "
stty -echo
read -r PASS
stty echo
echo

# store cookies; don't print full body
curl -fsS -i -c "$COOKIE_JAR" \
  -H "Origin: $ORIGIN" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" \
  "$BASE/api/auth/login" >/dev/null

unset PASS
ok "Login OK + cookies stored at $COOKIE_JAR"
echo

echo "3) Session"
SESSION_JSON_PATH="/tmp/doctor.session.json"
curl -fsS -b "$COOKIE_JAR" -H "Origin: $ORIGIN" "$BASE/api/auth/session" > "$SESSION_JSON_PATH" || fail "Session fetch failed"
head -c 1000 "$SESSION_JSON_PATH" | grep -q '"user"' && ok "Session OK" || { head -c 500 "$SESSION_JSON_PATH"; fail "Session failed"; }

# robust active org parse (handles multiple shapes)
ACTIVE_ORG_ID="$(python3 -c '
import json
try:
  with open("/tmp/doctor.session.json") as f:
    j = json.load(f)
except Exception as e:
  print("Session JSON parse error:", e)
  exit(1)
candidates = [
  j.get("activeOrgId"),
  (j.get("user") or {}).get("activeOrgId"),
  (j.get("user") or {}).get("organizationId"),
]
mem = j.get("memberships") or (j.get("user") or {}).get("memberships") or []
if isinstance(mem, list) and mem and isinstance(mem[0], dict):
  candidates.append(mem[0].get("orgId") or mem[0].get("organizationId"))
val = next((x for x in candidates if isinstance(x, str) and x.strip()), "")
print(val)
')"

[ -n "$ACTIVE_ORG_ID" ] && ok "Active org: $ACTIVE_ORG_ID" || { head -c 500 "$SESSION_JSON_PATH"; echo; fail "No active org id in session"; }
echo

echo "4) Admin gate (/api/admin/me)"
ADMIN_JSON="$(curl -fsS -b "$COOKIE_JAR" -H "Origin: $ORIGIN" "$BASE/api/admin/me")"
echo "$ADMIN_JSON" | grep -q '"allowed":true' && ok "Admin access OK" || { echo "$ADMIN_JSON" | head -c 400; echo; fail "Admin gate failed"; }
echo

echo "5) Admin courses (/api/admin/courses)"
COURSES_JSON="$(curl -fsS -b "$COOKIE_JAR" -H "Origin: $ORIGIN" "$BASE/api/admin/courses")"
COURSE_COUNT="$(printf '%s' "$COURSES_JSON" | python3 -c 'import sys,json
j=json.load(sys.stdin)
data=j.get("data") or []
print(len(data) if isinstance(data, list) else 0)
')"
[ "$COURSE_COUNT" -ge 0 ] && ok "Courses returned: $COURSE_COUNT" || fail "Courses check failed"
echo

echo "6) Analytics (POST /api/analytics/events)"
TS="$(date +%s)000"
ANALYTICS_CODE="$(curl -sS -o /tmp/doctor.analytics.out -w "%{http_code}" \
  -b "$COOKIE_JAR" -H "Origin: $ORIGIN" -H "Content-Type: application/json" \
  -d "{\"org_id\":\"$ACTIVE_ORG_ID\",\"event_type\":\"doctor_test\",\"ts\":$TS,\"event_name\":\"doctor_test\",\"properties\":{\"source\":\"doctor\",\"note\":\"doctor script\"}}" \
  "$BASE/api/analytics/events" || true)"

echo "Analytics status: $ANALYTICS_CODE"
head -c 400 /tmp/doctor.analytics.out; echo
[ "$ANALYTICS_CODE" = "200" ] && ok "Analytics OK" || fail "Analytics failed (expected 200)"
echo

echo "== Doctor complete =="
