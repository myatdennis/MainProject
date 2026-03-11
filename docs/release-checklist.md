# Release Checklist

Run these steps before any production deploy. Each command is intentionally fast and prints a clear ✅/❌ result.

## 1. Environment prep

```bash
export DATABASE_URL="postgresql://..."
export API_BASE_URL="https://api.the-huddle.co/api"
export ADMIN_BEARER_TOKEN="supabase-session-token"
export LEARNER_BEARER_TOKEN="$ADMIN_BEARER_TOKEN"   # optional override
export GUARD_ORG_ID="uuid-of-staging-or-prod-org"
```

## 2. Guardrail run order

1. **Validate migrations**
   ```bash
   npm run validate:migrations
   ```
   - Replays every SQL file inside a throwaway transaction.
   - Fails immediately if `set check_function_bodies = off` sneaks into a migration or if `psql` encounters an error.

2. **Schema doctor**
   ```bash
   npm run schema:doctor
   ```
   - Confirms all critical LMS tables expose the required columns (`courses`, `modules`, `lessons`, `organization_memberships`, `user_course_progress`).

3. **Database function smoke tests**
   ```bash
   npm run test:db-functions
   ```
   - Exercises `upsert_course_graph` (draft + publish) and `upsert_progress_batch` inside rollback-only transactions.
   - Leaves the database unchanged but proves that the stored procedures still work.

4. **API smoke tests**
   ```bash
   npm run test:api-smoke
   ```
   - Hits `/api/health`, admin course CRUD, import, publish, learner catalog, and learner progress batch endpoints.
   - Uses deterministic smoke IDs so repeated runs simply overwrite the same “Schema Guard Smoke Course”.

5. **Existing CI / build**
   ```bash
   npm run lint
   npm run typecheck
   npm run test
   npm run build
   ```

## 3. Manual spot checks

- Open the admin portal, edit a lesson, watch autosave succeed.
- Publish the smoke course created by the API test (already published, but verify UI shows “Published”).
- Log in as a learner, confirm the smoke course appears in the catalog and can be opened.

## 4. Deploy

Only deploy once all guardrails are green. If any step fails:

1. Investigate the failing script’s log (they all print file names and SQL statements).
2. Fix the migration/schema/API regression.
3. Re-run the entire sequence from step 1 to make sure nothing else broke while patching.
