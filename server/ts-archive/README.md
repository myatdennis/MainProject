Archive of TypeScript server files moved from /server

This folder contains TypeScript source files that were used to author the server
implementation historically, but which are not used at runtime. The production
server uses ESM JavaScript files in `/server` (for example `app.js` and the
`routes/*.js` files). These `.ts` files are now archived here for historical
reference and possible future porting to TypeScript sources for dev-time
tooling.

Purpose:
- Provide a clear location for legacy TypeScript source files under `/server`.
- Keep repo runtime clean (no `.ts` files used at runtime), while preserving
  the prior TypeScript sources for reference and possible re-work later.

Notes:
- Files here are NOT used by the runtime and are intentionally ignored by the
  `scripts/check_no_ts_in_server.mjs` CI script. Do not place active runtime
  TypeScript files here. The CI build still enforces that no `.ts` exists under
  `/server` outside this archive.

If you want to restore a file to the runtime, re-create the runtime `.js` or
use a build step to transpile `.ts` to `.js` in `/server` during CI.
