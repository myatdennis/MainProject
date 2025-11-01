# API Edge Function

Use the deployed edge function to perform smoke tests against the persistent Supabase backend.

## Environment

Set the function base URL (replace the project ref if different):

```bash
export API_BASE_URL="https://miqzywzuqzeffqpiupjm.functions.supabase.co"
```

Authentication headers accepted by the routes:

- `Authorization: Bearer <JWT>` – optional; the function will extract `sub` and `role` claims when present.
- `X-User-Id` – required for admin/member endpoints when no JWT is supplied.
- `X-User-Role` – must be `admin` or `member` for authenticated routes.
- `X-Org-Id` – optional org scoping (falls back to payload values).

JWT verification remains disabled for the function (set via `deno.json`), matching the smoke test harness.

## Example calls

```bash
# Health check (public)
curl "$API_BASE_URL/api/health"

# List admin courses
curl "$API_BASE_URL/api/admin/courses" \
  -H "X-User-Id: 6fe9d95f-79a0-4866-b698-6d5841753868" \
  -H "X-User-Role: admin"

# Create a course
curl "$API_BASE_URL/api/admin/courses" \
  -H "content-type: application/json" \
  -H "X-User-Id: 6fe9d95f-79a0-4866-b698-6d5841753868" \
  -H "X-User-Role: admin" \
  --data '{"name":"Smoke Seed","slug":"smoke-seed"}'
```

Re-enable JWT enforcement from the Supabase Dashboard if you require signed-in clients only.
