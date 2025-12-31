# Phase 6 – Data Integrity & Org-Scoped Remediation Plan

_Updated: 2025-12-30_

Phase 5 proved that our permission boundary is porous: courses rarely carry `organization_id`, assignments are written to two different tables, and our Supabase RLS stack is conflicting. Phase 6 is where we actually fix that debt. This plan translates the audit findings into concrete migration work, application changes, and verification criteria so we can enter the analytics/reporting phases with trustworthy tenant isolation.

---

## Objectives

1. **Single source of truth for assignments** so every learner/course/org relationship flows through the guarded `/api/admin/courses/:id/assign` endpoint and the `assignments` table (which already has RLS-aware columns).
2. **Org metadata stamped throughout the course tree** (`courses → modules → lessons`) plus learner progress tables, enabling RLS enforcement and org-level analytics.
3. **Deterministic RLS posture** by cleaning up legacy migrations, re-installing the hardened helpers once, and adding regression coverage in CI.
4. **Guaranteed org context at the API layer**—admin CRUD/publish/assign routes must accept and validate an `orgId`; header spoofing in dev/offline modes must no longer bypass checks.
5. **UX visibility + offline safety nets** so builders and assignment flows cannot proceed without declaring an org, even when running in fallback/demo modes.

Success criteria: org-specific editors can CRUD their courses without being blocked by RLS, cross-tenant writes are rejected, and catalog/assignment APIs always return tenant-filtered data regardless of online/offline mode.

---

## Workstreams & Tasks

### 1. Consolidate assignments

| Step | Details | Owners |
| --- | --- | --- |
| Drop `course_assignments` table | Author a migration that copies active rows into `assignments` (backfilling `organization_id` via joins to `courses`/`organization_memberships` where possible), then drops the redundant table and its permissive policies. | Backend + DB |
| Harden `/api/admin/courses/:id/assign` | Require `organization_id` in the payload, validate membership via `requireOrgAccess(..., { write: true })`, and stop accepting anonymous `user_ids`. Return structured errors so the UI can prompt for org selection. | Backend |
| Front-end assignment flow | `CourseAssignmentModal` + `assignmentStorage.addAssignments` should send assignments through the admin API instead of direct Supabase writes; cache org + `assignedBy` locally for offline retries. | Front-end |
| WebSocket + analytics updates | Ensure server broadcasts use the canonical `assignments` rows and analytics queries no longer touch the deleted table. | Backend |

### 2. Stamp org IDs across the course tree

1. **Schema updates:** add `organization_id UUID NOT NULL` to `modules` and `lessons` with cascade trigger to copy from parent `courses`. Enforce `organization_id` on `courses` itself (no more NULLs) with a `DEFAULT` that rejects inserts without a value.
2. **Builder UX:** update `AdminCourseBuilder` and related modals to require choosing an organization (use `organizationStore`/memberships to populate). Store selection in `courseStore` so future edits retain it.
3. **Sync pipelines:** ensure `syncCourseToDatabase` and server upserts propagate `organization_id` through nested inserts; reject payloads that omit it when the user isn’t a platform super-admin.
4. **Progress writers:** when recording `user_course_progress` and `user_lesson_progress` (see `recordCourseProgress`/`recordLessonProgress`), populate `org_id` from the corresponding assignment/course metadata.
5. **Backfill:** script to join `courses.created_by` → `organization_memberships` (or customer config) and fill missing `organization_id` for `courses/modules/lessons` before enabling new constraints.

### 3. Normalize RLS policies

- Write a dedicated migration (e.g., `20260105_cleanup_rls.sql`) that **drops every existing policy** on the affected tables before re-creating the hardened `_is_org_admin/_is_org_member` helpers and policies in a deterministic order.
- Include sanity queries (SELECT counts per table) inside the migration to verify policy attachment when run via CI.
- Add CI hooks: `supabase db reset --linked` + smoke tests to ensure migrations remain idempotent.
- Document policy expectations in `API_REFERENCE.md` to keep future contributions aligned.

### 4. Tighten backend guards

1. **Org-aware admin router:** wrap every `/api/admin/courses/*` handler with a middleware that extracts `orgId` from body/query/headers and calls `requireOrgAccess`. For destructive actions (publish/delete), require `write` membership; allow a `GLOBAL_SUPER_ADMIN_ORG_ID` env override for platform-owned catalog items.
2. **Header spoofing lock-down:** update `requireUserContext` so it **only** trusts `req.user` (JWT). If the token is missing, return 401 even if `X-User-Role` is set; keep the header only as an override when the token exists and the roles match.
3. **Fallback enforcement flag:** introduce `FORCE_ORG_ENFORCEMENT=true` (default in CI) so `requireOrgAccess` never short-circuits to `{ role: 'admin' }` in DEV/E2E. Automated tests will start failing whenever orgId is missing.
4. **Catalog API parity:** ensure `/api/client/courses?assigned=true&orgId=...` filters via `assignments` only after verifying the caller belongs to that org.

### 5. UX signals & offline flow

- Display the “active organization” in the builder header and assignment modal; block the submit button if no org is selected.
- When offline, store `orgId` alongside queued assignments (`assignmentStorage`) so replays hit the admin API with complete payloads.
- Surface pending sync count via the existing `runtimeStatus` store so admins understand what actions will post once Supabase recovers.

---

## Migration & Release Plan

1. **Preparation**
   - Freeze new assignments while we migrate (maintenance banner + feature flag).
   - Export snapshots of `assignments`, `course_assignments`, `courses`, `modules`, `lessons`, and progress tables for rollback.

2. **Schema phase**
   - Run `001_assignments_unification.sql` (copy + drop table, add NOT NULL constraints).
   - Run `002_course_tree_org_ids.sql` (add columns, triggers, backfill default values, enforce constraints).
   - Run `003_rls_cleanup.sql` (drop/recreate policies + helper funcs).

3. **Application rollout**
   - Deploy backend changes (guard middleware, assignment handler updates).
   - Deploy front-end updates with feature flag gating (UI requires org).
   - Enable `FORCE_ORG_ENFORCEMENT` in staging → run regression suite → flip flag in production once telemetry is clean.

4. **Verification**
   - Smoke test: create/edit/publish a course scoped to a non-admin org, assign to subset of learners, and confirm catalog filtering.
   - Run analytics queries per org to ensure counts exclude other tenants.
   - Monitor WebSocket channels (`assignment:org:*`) for org-specific payloads only.

5. **Rollback strategy**
   - Keep the dropped `course_assignments` data dump for 30 days.
   - Feature flags (`USE_ASSIGNMENTS_API`, `REQUIRE_COURSE_ORG_ID`) allow us to revert front-end to local storage/offline path if migrations must be rolled back.

---

## Testing Matrix

| Area | Tests |
| --- | --- |
| Backend routes | Supertest coverage for every admin course endpoint: rejects missing orgId, accepts valid membership, enforces write roles. |
| Supabase migrations | `supabase db reset` + Jest snapshot ensuring exactly one policy per table; linting via `supabase db lint`. |
| Front-end flows | Playwright scripts for builder save/publish and assignment modal in both online/offline states, verifying org selection is mandatory. |
| Offline queue | Unit tests for `assignmentStorage` to confirm queued records retain `orgId` and replay through the API. |
| Analytics sanity | Integration test comparing assignment counts vs. catalog results per org. |

---

## Risks & Mitigations

- **Missing historical org mappings:** Older courses without `organization_id` may not map cleanly. Mitigation: use customer metadata + manual CSV import for unresolved rows before enforcing `NOT NULL`.
- **Client upgrades lagging:** If the UI still writes directly to `course_assignments`, the API will reject the request. Mitigation: ship the API first but keep a backward-compatible mode (`ALLOW_LEGACY_ASSIGNMENT_DIRECT_WRITE=false`) that we only flip after clients deploy.
- **RLS locking out super-admins:** Ensure helper functions treat platform staff as org admins by referencing a `platform_admins` list or role embedded in JWTs.
- **Long-running migrations:** Copying large assignment tables could take minutes. Run during off-peak hours and test scripts with `BEGIN; ...; ROLLBACK;` in staging to time execution.

---

## Deliverables

- SQL migrations (`supabase/migrations/*.sql`) corresponding to the three schema/RLS steps.
- Backend PR covering guard middleware, assignment handler, and progress writers.
- Front-end PR covering builder/org selection, assignment modal changes, and offline queue updates.
- Updated docs: `API_REFERENCE.md`, `README_COURSECONTENTCREATOR_JS.md` (builder usage), and `RAILWAY_ENV_SETUP.md` (new env flags).
- Runbook for support teams outlining how to backfill org IDs and verify assignment integrity per tenant.

Once these tasks ship, the platform will finally have dependable tenant separation, and Phase 7 (analytics/reporting hardening) can rely on the data without fear of leaks.
