# Production Readiness Map

_Last updated: 2024-05-09_

## Snapshot
- **Data plane:** Supabase Postgres + Storage. Service-role key is consumed by the Express API (`server/index.js`) and the Supabase Edge function (`supabase/functions/api/index.ts`). Demo/E2E fallbacks can disable Supabase entirely if `DEV_FALLBACK` or `E2E_TEST_MODE` is on.
- **Auth:** Supabase Auth sessions are created in `routes/auth.js`, cached in httpOnly cookies (`utils/authCookies.js`), and verified per-request by `middleware/auth.js`. A double-submit CSRF cookie is emitted globally (`middleware/csrf.js`).
- **APIs:** All production REST endpoints are mounted in `server/index.js`; admin routes are protected by `authenticate` + `requireAdmin` while learner/org endpoints require `authenticate`. A legacy Edge function duplicates some admin course operations.
- **Storage:** Buckets `course-videos` and `course-resources` are public-read per migrations `20250919235815_sunny_sunset.sql` + `20250920000532_velvet_lake.sql`. Document uploads write to `DOCUMENTS_BUCKET` (default `course-resources`) and rely on signed URLs for private access.
- **Security helpers:** RLS helper functions `_is_org_admin` / `_is_org_member` (migration `20251229133000_harden_org_scoped_rls.sql`) serve as the basis for org-aware policies. Additional security definer functions fan out batch progress and auto-create org memberships.

## 1. Schema & RLS inventory
### 1.1 Core learning + engagement tables
| Area | Tables | Migration(s) | RLS state | Notes |
| --- | --- | --- | --- | --- |
| Course content | `courses`, `modules`, `lessons`, `assignments`, `course_assignments` | `20251021123000_lms_core_schema.sql`, `20251019120000_add_course_assignments.sql`, `20251031215913_api_contract_rls_updates.sql` | Enabled; `courses_*`, `modules_*`, `lessons_*`, `assignments_*` policies grant `service_role` full access, members read, admins manage | Org scoping enforced via `_is_org_member`/`_is_org_admin`. Draft courses can be created without `organization_id`.
| Learner progress | `user_course_progress`, `user_lesson_progress`, `progress_events`, `progress_events` trigger helpers | `20251021123000_lms_core_schema.sql`, `20251101130000_rls_policy_templates.sql`, `20251229133000_harden_org_scoped_rls.sql`, `20260105_progress_batch_proc.sql` | Enabled; `*_service/self/admin` policies; `upsert_progress_batch` (security definer) inserts rows on behalf of clients | Batch endpoint `/api/client/progress/batch` depends on the stored procedure.
| Certificates & analytics | `certificates`, `analytics_events`, `analytics_event_batches`, `analytics_dead_letters`, `analytics_insights`, `learner_journeys` | `20251021123000_lms_core_schema.sql`, `20251021134500_lms_analytics_tables.sql`, `20260104_analytics_ingestion.sql` | Mixed: analytics tables expose `service_role` policies; `learner_journeys` select-only; certificates share course RLS helpers | Need to confirm `certificates` RLS (not yet hardened — scheduled in subsequent task).
| Surveys & assignments | `surveys`, `survey_assignments`, `survey_responses` | `20251021150000_lms_surveys_tables.sql`, `20251228120000_surveys_org_rls.sql`, `20251229133000_harden_org_scoped_rls.sql` | Enabled with `service_role`, member read, admin manage, plus self-submit policies for responses | Org scoping enforced by `_is_org_member`.
| Documents library | `documents` | `20251021143000_lms_documents_tables.sql`, `20251031173857_normalize_documents_updated_trigger.sql`, `20251104120000_add_document_storage_columns.sql` | **No RLS**; relies entirely on backend service-role access | Security definer function `increment_document_download` updates counts; storage path tracked per row.
| Messaging & notifications | `messages`, `notifications` | `20260104_messaging_notifications.sql`, `20251021153000_lms_notifications_tables.sql`, `20251022170000_org_memberships_and_access.sql` | Notifications have member/admin/service policies; `messages` currently lacks explicit RLS (requires review). | Notification policies align with org membership; message exposure TBD.
| Organizations & memberships | `organizations`, `organization_memberships`, `organization_profiles`, `organization_branding`, `organization_contacts`, `organization_leadership_recommendations` | `20251021140500_lms_orgs_tables.sql`, `20251022170000_org_memberships_and_access.sql`, `20260104_org_profile_tables.sql`, `20260104_leadership_ai_recommendations.sql`, `20260106_multitenant_foundation.sql` | Enabled everywhere; policies rely on `_is_org_member` & `_is_org_admin` and grant `service_role` maintenance access | Trigger `create_owner_membership_for_org` (security definer) auto-inserts owner rows.
| Workspace | `org_workspace_strategic_plans`, `org_workspace_session_notes`, `org_workspace_action_items` | `20251022160000_org_workspace_tables.sql`, `20251022170000_org_memberships_and_access.sql` | Enabled; member read, editor/admin manage, `service_role` all | Multiple policies per table; editors defined via org membership role.
| User profile / goals | `user_profiles`, `user_learning_goals`, `user_achievements` | `20250919231840_wild_cliff.sql`, `20251019123000_add_learning_goals_and_achievements.sql` | Enabled; users manage own rows | Foundational policies ensure PII isolation.
| Support tables | `idempotency_keys`, `documents_downloads`, etc. | `20251107_add_versions_and_idempotency.sql`, others | Typically service-role only | Used by Express API for dedupe.

### 1.2 Views & helper functions
- `organization_membership_vw`, `user_organizations_vw` (migration `20260106_multitenant_foundation.sql`) expose membership metadata to authenticated and service-role clients.
- Functions:
  - `_current_request_user_id()` (stable function) surfaces JWT subject for triggers.
  - `_is_org_admin(org_id)` / `_is_org_member(org_id)` (migration `20251229133000_harden_org_scoped_rls.sql`) power most RLS policies.
  - `create_owner_membership_for_org()` trigger (security definer) inserts owner membership after org creation.
  - `increment_document_download(doc_id)` (security definer) increments `documents.download_count`.
  - `upsert_progress_batch(events_json)` (security definer) ingests batched progress payloads.
  - Document updated-at triggers (`documents_set_updated_at` in `20251031173857_normalize_documents_updated_trigger.sql`).

### 1.3 RLS coverage & gaps
- ✅ Org-linked tables (courses, modules, lessons, assignments, surveys, workspace, memberships) enforce RLS via helper functions.
- ⚠️ `documents` and `messages` lack explicit RLS; access is enforced only through the backend service role and must not be exposed to anon/public keys.
- ⚠️ Storage buckets `course-videos` / `course-resources` allow anonymous `SELECT` (public read). Downloads rely on URL entropy rather than RLS; pre-signed URLs are only used for the `documents` table when `visibility != 'public'`.

## 2. Backend APIs (Express)
_All endpoints live in `server/index.js` unless noted. Middleware order: `securityHeaders` + `setDoubleSubmitCSRF` + `apiLimiter` (per route), followed by `authenticate` / `requireAdmin` where needed._

### 2.1 Health, diagnostics, and dev tooling
| Method | Path | Guards | Notes |
| --- | --- | --- | --- |
| GET | `/api/health`, `/healthz` | none | Aggregates Supabase, offline queue, and storage health (lines ~353-420).
| GET | `/api/diagnostics/metrics` | none | Exposes internal counters.
| GET | `/api/dev/diagnostics/courses` & POST `/api/dev/publish-course` | `withDevToolsGate` (loopback + key) | Only runs when `DEV_TOOLS_ENABLED=true` (lines ~614-704).
| GET | `/api/debug/whoami` | `authenticate` | Returns decoded `req.user` (line 492).

### 2.2 Auth & session
| Method | Path | Guards | Notes |
| --- | --- | --- | --- |
| GET | `/api/auth/csrf` | none | Returns CSRF token (double-submit pattern).
| POST | `/api/auth/login`, `/login` | none | `routes/auth.js`; uses Supabase Auth or demo users, sets cookies.
| POST | `/api/auth/refresh` | none | Issues new tokens via refresh cookie.
| POST | `/api/auth/forgot-password` | none | Proxy to Supabase.
| GET | `/api/auth/verify` | `authenticate` | Validates current user.
| `/api/mfa/*` | `mfaRoutes` | Manage MFA flows against Supabase Auth.

### 2.3 Admin content management
_All admin endpoints enforce `authenticate` + `requireAdmin` either via `app.use('/api/admin', ...)` or inline._
- Courses: CRUD + import/publish/assign at `/api/admin/courses` (lines ~2495-3555). Uses `ensureSupabase()` guard and server-side Supabase client.
- Modules & lessons: `/api/admin/modules`, `/api/admin/lessons`, reorder endpoints, patch/delete (lines ~3782-4240).
- Course media: `/api/admin/courses/:courseId/modules/:moduleId/lessons/:lessonId/video-upload` with Multer + Supabase Storage (line ~6330).
- Documents: upload/list/create/update/delete/download under `/api/admin/documents*` (lines ~6555-6720).
- Surveys: `/api/admin/surveys*` for CRUD, `/api/admin/notifications*` for messaging (lines ~6747-7050).
- Organizations & memberships: `/api/admin/organizations*`, `/api/admin/organizations/:orgId/members*` (lines ~5228-5580) plus profile bundle endpoints (`handleOrgProfile*` helpers around line ~5694-5855).
- Org profiles & contacts: `/api/admin/org-profiles*`, `/api/admin/orgs/:orgId/profile` variations.

### 2.4 Learner/client endpoints
| Domain | Paths | Auth |
| --- | --- | --- |
| Client courses | `/api/client/courses`, `/api/client/courses/:identifier`, `/api/client/assignments` | Mixed: some enforce `authenticate`, others rely on `ensureSupabase` but allow unauthenticated reads (needs review).
| Learner progress | `/api/learner/progress` (GET/POST), `/api/client/progress/course`, `/lesson`, `/batch` | Write endpoints authenticate except `/api/client/progress/course`/`lesson` (currently unauthenticated but expect client-signed tokens included inside body; flagged for hardening).
| Certificates | `/api/client/certificates` (GET) and POST `/api/client/certificates/:courseId` | Validate completion; no admin guard.
| Analytics | `/api/analytics/events`, `/api/analytics/events/batch`, `/api/analytics/journeys` | Accepts JSON payloads; limited validation.
| Surveys | `/api/client/surveys` | Optional auth (line ~3276) — relies on `ensureSupabase` for gating by organization.

### 2.5 Organization workspace
All endpoints prefixed with `/api/orgs/:orgId/workspace/*` require `authenticate` (line ~5963 onward). They provide CRUD for `strategic-plans`, `session-notes`, `action-items` and membership acceptance/leave flows.

### 2.6 Audit/broadcasting
- `/api/broadcast` (line ~2453) — currently unauthenticated; writes to `broadcastMessages` store (needs gating).
- `/api/audit-log` (lines ~5115 & ~7158) — dual definitions; second one duplicates analytics logging.

### 2.7 Edge Function overlap
`supabase/functions/api/index.ts` exposes similar course/module/lesson CRUD over Supabase Functions with only header-based auth. It uses the **service-role key** directly and infers roles from JWT headers; ensure deployment is disabled or hardened before production.

## 3. Auth, session, and CSRF flow
- **Login path:** `POST /api/auth/login` calls Supabase Auth (`supabaseAuthClient.auth.signInWithPassword`) when Supabase is configured, else falls back to demo users governed by `ALLOW_DEMO` / `DEV_FALLBACK`. Successful logins set httpOnly `access_token` and `refresh_token` cookies (`utils/authCookies.js`).
- **Middleware:** `authenticate` in `middleware/auth.js` resolves the active token from `Authorization: Bearer` or cookies, fetches the Supabase user via `supabase.auth.getUser`, caches memberships, and attaches `req.user`. If Supabase is disabled and `DEV_FALLBACK` or `E2E_TEST_MODE` is true, it injects a synthetic platform admin identity.
- **Authorization helpers:** `requireAdmin` ensures `platform_role === platform_admin` or canonical admin email; `requireRole`, `requireSameOrganizationOrAdmin`, etc., enforce organization-level permissions.
- **CSRF:** `setDoubleSubmitCSRF` seeds a non-httpOnly `csrf_token` cookie. Clients must reflect it via the `x-csrf-token` header. Endpoint `/api/auth/csrf` returns the current token for SPAs/tests. No automatic rotation beyond the 24h cookie TTL.
- **Session refresh:** `/api/auth/refresh` validates refresh token cookie and reissues tokens. `authLimiter` (rate-limit) protects auth routes.
- **Risk areas:**
  - Demo fallback can unintentionally enable anonymous admin access if Supabase env vars are missing in production. Mitigate by forcing `DEV_FALLBACK=false` and `STRICT_AUTH=true` in prod configs.
  - Token + membership caches rely on in-memory Maps; horizontal scaling requires shared cache or sticky sessions.

## 4. Storage + file handling
| Surface | Location | Notes |
| --- | --- | --- |
| Buckets | Migrations `20250919235815_sunny_sunset.sql`, `20250920000532_velvet_lake.sql` | Buckets `course-videos` and `course-resources` created as **public**. File size + MIME limits set via bucket metadata.
| Lesson video upload | `POST /api/admin/courses/:courseId/.../video-upload` (line ~6330) | Admin-only; uploads via Multer to `COURSE_VIDEOS_BUCKET`, returns `getPublicUrl`. No signed URLs; rely on bucket ACL.
| Document upload & download | `/api/admin/documents/upload`, `/api/admin/documents/:id/download` (lines ~6520-6720) | Admin-only; stores binary in `DOCUMENTS_BUCKET`. Signed URLs refreshed via `createSignedDocumentUrl` + persisted onto `documents` rows.
| Document retention | `DOCUMENT_URL_TTL_SECONDS` env controls expiry (default 7 days). `refreshDocumentSignedUrls` updates stale URLs before response.
| Health checks | `getSupabaseBucketHealth` verifies required buckets at startup health endpoints.
| Risk areas | Buckets are public read; consider switching to private buckets + signed URLs for all content. Missing RLS on `documents` table means direct client access must stay impossible.

## 5. Service-role & privileged key usage
| Location | Purpose | Notes |
| --- | --- | --- |
| `server/index.js` (`supabaseServiceRoleKey`) | Primary backend Supabase client (line ~521). Required for all CRUD endpoints. | Guards via `ensureSupabase`. Missing env vars trigger 503 unless `DEV_FALLBACK` true.
| `server/lib/supabaseClient.js` | Shared server + anon clients (service + anon keys). | Imported by `middleware/auth.js`, `routes/auth.js`, scripts.
| `server/config/runtimeFlags.js` | Detects whether Supabase is configured to decide fallback behavior. | Controls `DEV_FALLBACK`, `demoLoginEnabled`.
| `supabase/functions/api/index.ts` | Edge Function uses service key for course/module CRUD. | Must not be exposed publicly without JWT enforcement; currently only looks at headers.
| Scripts (`scripts/create_demo_users.ts/js`, `scripts/check_env_local.cjs`, `scripts/check_deploy_env.cjs`, `scripts/railway_set_envs.sh`) | Provisioning utilities that call Supabase REST using the service key. | Ensure scripts are not bundled client-side.
| Deployment docs (`README.md`, `DEPLOYMENT.md`, `RAILWAY_ENV_SETUP.md`, etc.) | Remind ops teams to keep service key server-only. | Some docs currently advise never setting service key on Netlify frontend builds.
| `.env` / `.env.example` | Contains placeholder service role key. | Confirm `.env` is never committed to production images.

## 6. Known gaps & follow-ups
1. **Disable demo fallback in prod**: Set `DEV_FALLBACK=false`, `ALLOW_DEMO=false`, and `STRICT_AUTH=true` for production deployments so missing Supabase env vars cannot silently create an in-memory admin user.
2. **Harden unauthenticated client routes**: `/api/client/progress/course`, `/api/client/progress/lesson`, `/api/broadcast`, and analytics endpoints accept unauthenticated writes. Add auth or signed webhook secrets before production.
3. **Lock down storage**: Convert `course-videos` / `course-resources` to private buckets or remove public `SELECT` policies; rely exclusively on signed URLs with narrow TTLs.
4. **Add RLS to `documents` and `messages`**: Today only the service-role client accesses these tables. Define org-aware policies so future Supabase REST usage is safe.
5. **Edge Function gating**: `supabase/functions/api/index.ts` trusts `x-user-role` headers while running with service-role privileges. Either remove the function or require JWT verification identical to the Express middleware.
6. **Cache + CSRF stores**: In-memory caches (`membershipCache`, CSRF token Map) do not replicate across instances. For multi-instance deployments, introduce Redis or sticky sessions.
7. **Policy drift monitors**: Add automated tests/linters to ensure every table listed above has `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` and at least a service + org policy.

This map should remain the source of truth while we execute Tasks B–G (API hardening, RLS audit *in situ*, storage lockdown, headers/CORS tightening, CI). Update it whenever the schema, auth flow, or API surface changes to keep future responders unblocked.
