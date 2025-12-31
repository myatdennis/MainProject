# Phase 5 – Permissions & Organization Scoping Audit

_Updated: 2025-12-31_

## Scope & methodology
- **Backend services reviewed:** `server/index.js`, `server/middleware/auth.js`, organization/workspace routes, assignment handler (`/api/admin/courses/:id/assign`), and helper guards (`requireUserContext`, `requireOrgAccess`).
- **Front-end touchpoints:** Admin builder (`src/pages/Admin/AdminCourseBuilder.tsx`), catalog actions, `CourseAssignmentModal`, `assignmentStorage`, `apiClient` header plumbing, and Zustand `courseStore` filters.
- **Database & RLS:** Supabase migrations touching `courses`, `modules`, `lessons`, `assignments`, `course_assignments`, `organization_memberships`, workspace tables, and the org-aware policy migrations from 2025-10 through 2025-12.

The goal for Phase 5 was to chart how multi-tenant boundaries are enforced (or skipped) as requests move from the UI to API to Supabase, and to surface concrete remediation work before we harden analytics and reporting in later phases.

---

## Executive summary
1. **Admin-only trust boundary** – Every `/api/admin/courses/*` route depends solely on the JWT `role === 'admin'` check. Once a user is granted admin, they can CRUD courses for *all* organizations because no orgId scoping or membership verification happens in those handlers.
2. **Courses rarely carry an `organization_id`** – Builder upserts default this column to `null`, so the RLS policies that expect `organization_id` + membership end up falling back to “creator owns everything.” Non-admin editors from customer orgs can’t persist changes once the stricter policies from `20251229133000_harden_org_scoped_rls.sql` are deployed.
3. **Assignments leak across tenants** – The UI writes directly to `course_assignments` (client-side Supabase upsert) without an `organization_id` column, while the server/API uses a separate `assignments` table *with* `organization_id` and WebSocket broadcasts. This split bypasses org enforcement, logging, and produces two inconsistent data sources.
4. **RLS migrations conflict** – We now have *three* generations of policies (`20250919231840_wild_cliff.sql`, `20251101130000_rls_policy_templates.sql`, `20251229133000_harden_org_scoped_rls.sql`). Several tables have overlapping `DROP POLICY/CREATE POLICY` blocks referencing different helper functions, which leads to unpredictable policy order and occasional Supabase migration failures.
5. **Demo/offline fallbacks ignore org context** – When Supabase is unavailable (DEV_FALLBACK/E2E), `requireOrgAccess` bypasses membership checks entirely and returns `{ role: 'admin' }`, so automated tests never catch missing org validations. The front-end likewise queues offline assignments with no org metadata, so when they sync later they lack the information required by RLS.

---

## Backend enforcement findings

| Endpoint / handler | Current guard | Org awareness | Risk | Required action |
| --- | --- | --- | --- | --- |
| `/api/admin/courses`, `/modules`, `/lessons` (CRUD) | `app.use('/api/admin', authenticate, requireAdmin)` | **None** – handlers never read `organization_id` or call `requireOrgAccess` | Any staff/admin can edit another org’s catalog; no way to delegate per-org editors | Accept an `orgId` parameter and enforce membership via `requireOrgAccess(..., { write: true })`. Stamp that `orgId` on every `courses/modules/lessons` row so RLS can evaluate it. |
| `/api/admin/courses/:id/publish` | `requireAdmin` only | None; trusts caller | Publish action can leak embargoed content between tenants, and RLS cannot limit notifications by org | Same fix: require org context + membership before publishing. |
| `/api/admin/courses/:id/assign` | `requireAdmin` + `requireUserContext` + `requireOrgAccess` **if** `organization_id` is passed | Guard only triggers when payload includes `organization_id`; otherwise assignments become “global” | Front-end never passes `organization_id`, so the guard never runs in production | Make `organization_id` mandatory in the handler and reject payloads without it. |
| Org workspace (`/api/orgs/:orgId/workspace/*`) | `requireOrgAccess` | Read/write filtered by membership roles | ✅ (works) | No change needed. |
| Client catalog (`/api/client/courses`) | Optional `orgId` query & assignments lookup | Filters assigned courses by org when provided, but only checks `assignments` table | Because UI writes to `course_assignments`, org-specific catalog requests return empty results; learners see full catalog | Unify on a single assignments table and ensure rows store org ids. |

Additional observations:
- `requireUserContext` trusts the `X-User-Role` header if the token is missing. Any script spoofing that header becomes “admin.” Thankfully `/api/admin/*` routes attach `authenticate`, but numerous non-admin routes (workspace, analytics exports) call `requireUserContext` without any JWT validation – we should disallow role promotion from headers when `req.user` is absent.
- In DEV/E2E modes we short-circuit `requireOrgAccess` and hand back `{ role: 'admin' }`, so automated tests never fail when orgId is omitted. To catch missing org scopes, we need a feature flag to *force* membership checks even in fallback mode.

---

## Front-end scope leaks

1. **Builder & catalog editors never ask for an org**
   - `CourseEditModal` and `AdminCourseBuilder` call `courseStore` → `syncCourseToDatabase` without supplying `organizationId`. The helper `guessOrganizationId` only works if the course already had one.
   - Result: new courses save with `organization_id = null`, so RLS treats them as “global.” When org-specific policies roll out, non-admin editors can’t touch those rows.

2. **Assignment modal bypasses the API**
   - `CourseAssignmentModal` → `addAssignments` → Supabase `course_assignments` upsert.
   - No `organizationId`, `assignedBy`, or audit trail is provided, and because this table’s policies permit every authenticated user to `SELECT/INSERT/UPDATE/DELETE`, any learner can overwrite anyone else’s assignment if they know the course ID.
   - The admin API route that *would* enforce org access and broadcast updates is never invoked.

3. **Client headers rely on local storage overrides**
   - `buildAuthHeaders` reads `localStorage.huddle_active_org` and blindly sets `X-Org-Id`. A malicious user can switch this value to access another org’s workspace endpoints as long as they have any membership row for that org. We should verify header overrides server-side when `req.user.organizationId` differs from membership.

4. **Offline queues drop org context**
   - `assignmentStorage` caches offline rows in `localStorage` keyed by `courseId+userId`. When connectivity returns it upserts to `course_assignments` without adding `org_id`. Even if we add org checks to the API, these queued rows would fail unless we start storing the org at capture time.

5. **Learner catalog filtering is best-effort**
   - `courseStore.init` sets `restrictToOrg = normalizedRole !== 'admin'` and, when true, attempts to fetch assignments for the user and limit the catalog. Because assignments live in the wrong table and lack org ids, the filter often falls back to the entire published catalog.

---

## Database & RLS assessment

### 1. Table/state mismatches
- `public.assignments` (analytics migration) already has `org_id` and is the table used by `/api/admin/courses/:id/assign` and `/api/client/courses?assigned=true`.
- `public.course_assignments` (2025-10 migration) is **redundant** and lacks any org metadata. Its RLS policies are deliberately permissive (`USING (true)` for every CRUD verb), making it useless for production multi-tenancy.
- Recommendation: migrate/merge `course_assignments` into `assignments`, delete the redundant table, and update `assignmentStorage` + analytics queries accordingly.

### 2. Conflicting RLS generations
- `20250919231840_wild_cliff.sql` created basic “admins can manage everything” policies.
- `20251101130000_rls_policy_templates.sql` layered org-aware checks referencing `organization_memberships`.
- `20251229133000_harden_org_scoped_rls.sql` introduced helper functions (`_is_org_admin`, `_is_org_member`) and rewrote the same policies again, but the migration only dropped a subset of the earlier policies. We now have *both* sets defined for `courses`, `assignments`, `user_*_progress`, etc.
- This causes:
  - Supabase complaining about duplicate policy names on fresh deployments.
  - Inconsistent behavior depending on policy order (e.g., `courses_member_read` vs. legacy “Anyone can read published courses”).
- Recommendation: author a cleanup migration that drops *all* legacy policies before re-creating the desired helpers, and run `supabase db reset` in a staging branch to confirm idempotency.

### 3. Missing org columns
- `modules` and `lessons` still do not carry `organization_id`. Policies infer org via `JOIN courses`, which is fine until a course’s org id is `NULL`. Because the builder never sets org, those joins return `NULL`, forcing policies to use the fallback “created_by owns it,” effectively disabling tenant isolation.
- `user_course_progress` and `user_lesson_progress` have an `org_id` column introduced in `20251108_add_analytics_tables_and_views.sql`, but the server’s progress endpoints never set it when inserting rows. Without populating it, queries like “org-wide completion rate” will mix tenants.

### 4. Organization membership integrity
- `organization_memberships` table + policies look solid (admin/editor roles, service role overrides). However, we never call Supabase from the backend to resolve a user’s org membership; we rely on `X-Org-Id` headers and manual lookups via `organization_memberships` table executed through Supabase service role. This is acceptable but we must ensure `orgId` is always supplied; otherwise `requireOrgAccess` returns 403 and admin-only fallback kicks in.

---

## Recommended remediation backlog

### Priority 0 – unblock RLS rollout
1. **Single source for assignments:**
   - Remove `course_assignments`, migrate any data into `assignments`, and update the front-end (`assignmentStorage`) to call `/api/admin/courses/:id/assign` with `{ organization_id, user_ids, due_at }`.
   - Make `organization_id` mandatory in the API and persist it on every row.
2. **Stamp org IDs on courses/modules/lessons:**
   - Extend `CourseEditModal` + builder to require selecting an org (default to the admin’s own) and send it through `syncCourseToDatabase`.
   - Update the upsert RPC/sequence to propagate `organization_id` to child tables, so existing RLS can enforce membership.
3. **Clean RLS migrations:**
   - Write a new migration that removes legacy policies, installs `_is_org_admin/_is_org_member`, and re-applies the hardened policies in a consistent order. Add regression tests via `supabase db lint`/`supabase db diff` in CI.

### Priority 1 – tighten backend guards
1. **Require org context on all admin course routes** and validate via `requireOrgAccess`. Provide a default fallback only for super-admins operating on “global” catalog rows.
2. **Disallow role spoofing via headers** – if `req.user` is missing, reject rather than falling back to `X-User-Role`.
3. **Force membership checks in DEV/E2E when `FORCE_ORG_ENFORCEMENT=true`** so we can catch regressions in automated tests.

### Priority 2 – UX & observability
1. **Expose active org + offline status in the UI** (builder banner + assignment modal) and block destructive actions when org context is missing.
2. **Surfacing pending offline assignments** so admins know what will sync once Supabase comes back.
3. **Instrument audit logs** for assignments and course publishes once all writes pass through the server.

### Priority 3 – Data hygiene tasks
1. Backfill `organization_id` on existing `courses/modules/lessons` rows from customer metadata.
2. Populate `org_id` on `user_course_progress`/`user_lesson_progress` using joins to `assignments` or `organization_memberships`.
3. Rebuild analytics views to filter by `org_id` once populated.

---

## Next steps
Phase 6 (Data integrity & migrations) will implement the schema migrations outlined above, backfill missing org IDs, and add regression tests for the new RLS helpers. Once the org-aware guardrails are in place, we can revisit analytics and reporting with confidence that each org sees only its own catalog, assignments, and learner progress.
