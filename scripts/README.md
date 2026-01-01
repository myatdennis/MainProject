# Scripts

This folder contains utility scripts for local development. Do NOT commit secrets or service role keys.

## create_demo_users.js

Creates two demo users (admin and a sample LMS user) using the Supabase Admin REST endpoint.

Usage (run locally):

```bash
SUPABASE_URL=https://<project>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<service-role-key> node scripts/create_demo_users.js
```

Notes:
- The script uses the Supabase service role key — keep it secret and run locally on a trusted machine.
- The script will print errors if user creation fails (for example, if a user already exists).
- We intentionally do not commit or store keys in the repo.
# Demo user creation

This script creates demo users in your Supabase project using the service role key.

Run locally:

1. Build TypeScript (optional) or use ts-node (we included `ts-node` as a devDependency):

```bash
# using ts-node (recommended)
SUPABASE_URL=https://<project>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<service-role-key> npm run create-demo-users

# or compile then run
npx tsc scripts/create_demo_users.ts --outDir dist && SUPABASE_URL=https://<project>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<service-role-key> node ./dist/scripts/create_demo_users.js
```

2. The script will create these demo accounts:
- mya@the-huddle.co / admin123 (role: admin)
- user@pacificcoast.edu / user123 (role: user)

Security: Do not commit your service role key. Run this from a secure environment.
