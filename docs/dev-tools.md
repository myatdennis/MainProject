# Dev Tools Endpoints

These endpoints exist only for local troubleshooting and **must never** be enabled in production.

## Enabling

```bash
# .env.local (never commit real secrets)
DEV_TOOLS_ENABLED=true
DEV_TOOLS_KEY=dev-secret-123
```

Run the server (it already trusts `NODE_ENV !== 'production'`) and use `curl` with the shared header from `localhost` only.

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/dev/diagnostics/courses?ids=course-tlc-retreat-dei-2026` | Returns datastore mode (`demo`/`supabase`) and publish status for each course id. Defaults to the TLC course when `ids` is omitted. |
| POST | `/api/dev/publish-course` | Publishes a course in the active datastore. Body: `{ "id": "course-id" }`. |

Both require:

- `DEV_TOOLS_ENABLED=true`
- `DEV_TOOLS_KEY` set to a secret, and header `X-DEV-TOOLS-KEY: <secret>`
- Requests must originate from `localhost` / loopback IPs

## Example usage

```bash
curl -s http://localhost:8888/api/dev/diagnostics/courses \
  -H "X-DEV-TOOLS-KEY: $DEV_TOOLS_KEY" | jq

curl -s -X POST http://localhost:8888/api/dev/publish-course \
  -H "Content-Type: application/json" \
  -H "X-DEV-TOOLS-KEY: $DEV_TOOLS_KEY" \
  -d '{"id":"course-tlc-retreat-dei-2026"}' | jq
```

Unset `DEV_TOOLS_ENABLED` (or the key) before deploying to any shared environment.

## Importing courses with a Supabase access token

Use the password-grant helper to mint a short-lived Supabase session token and feed it to the importer. Replace the placeholder values inline—never echo real credentials in shared history.

```bash
# 1) Provide Supabase + admin credentials (pull from your local .env/.env.local).
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_ANON_KEY="public-anon-key-here"
export ADMIN_EMAIL="admin@example.com"
export ADMIN_PASSWORD="correct-horse-battery-staple"

# 2) Capture a user access token (prints token only).
export ADMIN_TOKEN=$(node scripts/get_supabase_access_token.mjs)

# 3) Run the importer with full safety flags.
node scripts/import_courses.js import/courses-template.json --dedupe --wait --publish
```

The importer reads `ADMIN_TOKEN` and calls the secured admin endpoints using your authenticated Supabase session.
