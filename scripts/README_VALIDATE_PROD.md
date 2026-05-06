Production environment validation

Run the included script `scripts/validate_prod_env.mjs` on the target host to verify runtime environment variables, CORS configuration, and optionally basic HTTP health/auth endpoints.

Usage examples (on the server):

```bash
# Basic check (requires NODE_ENV=production in environment)
NODE_ENV=production node scripts/validate_prod_env.mjs

# Provide production base URLs for extra checks
NODE_ENV=production PROD_BASE_URL=https://app.example.com PROD_API_URL=https://api.example.com node scripts/validate_prod_env.mjs

# Optionally provide a test account to exercise a login endpoint (non-destructive)
AUTH_TEST_EMAIL=test@example.com AUTH_TEST_PASSWORD=secret NODE_ENV=production PROD_API_URL=https://api.example.com node scripts/validate_prod_env.mjs
```

Notes:
- The script reads `server/middleware/cors.js` to determine allowed origins. Ensure the server code is present in the runtime working directory when running the script.
- The script is non-destructive: it only reads config and performs safe GET/POST checks when credentials are provided.
