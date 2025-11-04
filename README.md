LMSWebsite

Dev notes
- API server runs on 8787 by default (npm run start:server). If that port is busy, you can run on a different port: PORT=8888 node server/index.js.
- Vite dev server is configured to proxy /api and /ws to the API server. Currently, proxy points to http://localhost:8888 to match the alternate port. If you switch the API back to 8787, update `vite.config.ts` proxy targets accordingly.
- When Supabase is not configured, the server uses a safe in-memory fallback by default in non-production (DEV_FALLBACK). To disable it, set DEV_FALLBACK=false. For test runs, you can also use E2E_TEST_MODE=true.
