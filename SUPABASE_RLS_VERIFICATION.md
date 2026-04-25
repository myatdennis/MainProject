# Supabase RLS Verification

This file describes how to apply the RLS migrations and verify platform_admin access at runtime.

Steps

1. Apply migrations

Using Supabase CLI (recommended):

```bash
supabase db remote set <your-project-ref>
supabase db push
```

Or paste the SQL from `supabase/migrations/*.sql` into the Supabase SQL editor and run.

2. Run runtime checks

Set an environment variable with a valid platform_admin token and run the helper script:

```bash
export PLATFORM_ADMIN_TOKEN="<token>"
export BASE_URL="https://your-app.example.com" # optional
node scripts/check_rls.mjs
```

The script calls `/api/debug/rls-check` and the admin endpoints and prints a summary. Inspect the output and server logs if any counts are 0.

3. Cleanup

Remove the `get_platform_role_claims` function and `/api/debug/rls-check` endpoint after verification if you don't need them.
