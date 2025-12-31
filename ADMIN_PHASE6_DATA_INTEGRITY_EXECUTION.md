# Phase 6 – Data Integrity & Org-Scoped Remediation Report

_Updated: 2026-01-03_

Phase 6 translates the remediation plan into concrete code, schema, and UX changes that make organization context a first-class requirement across the LMS. This report captures the executed work, the touchpoints that still need follow-up, and the verification matrix gating entry into Phase 7.

---

## Scope recap
- **Backend:** `server/index.js` admin CRUD routes, `/api/admin/courses/:id/assign`, learner progress writers, `requireUserContext`/`requireOrgAccess` middleware, and health endpoints.
- **Frontend:** `CourseAssignmentModal`, `assignmentStorage.ts`, `courseStore`, `AdminCourseBuilder`, runtime/org selection banners.
- **Database:** migrations under `supabase/migrations/**` including the hardened RLS set (`20251229133000_harden_org_scoped_rls.sql`) and new cleanup scripts.

---

## Shipped changes

### 1. Single assignments source of truth
- Authored `20260102_assignments_unification.sql` to:
  - Copy surviving rows from `course_assignments` → `assignments`, resolving `org_id` via `courses.organization_id` and, when null, via `organization_memberships` of `assigned_by`.
  - Drop `course_assignments`, its permissive `USING (true)` policies, and dependent foreign keys.
  - Add `assigned_by UUID NOT NULL DEFAULT auth.uid()` plus indexes to `assignments` to align with API usage.
- Updated `/api/admin/courses/:id/assign` (see `server/index.js` @ `assignCourseToUsers`) to **require** `organization_id` and validate it through `requireOrgAccess(orgId, { write: true })`. Missing org payloads now receive `422 org_required` errors with actionable hints for the UI.
- `CourseAssignmentModal` now sources org context from `courseStore.activeOrganizationId`, blocks submission if undefined, and POSTs to the admin assign route instead of calling Supabase directly. Offline fallbacks persist `orgId` inside the queued payload.

### 2. Org metadata stamped through the course tree
- Added `organization_id UUID NOT NULL` to `modules` and `lessons` via `20260102_course_tree_org_ids.sql`, plus triggers that cascade the parent `courses.organization_id` on insert/update.
- Tightened course creates/updates: `syncCourseToDatabase` and the server-side upserts reject payloads that omit `organization_id` unless the caller has the `platform_super_admin` claim.
- Builder UX now surfaces an "Active organization" chip (fed by `organizationStore`) and forces admins to choose before saving, publishing, or cloning content.
- Learner progress writers (`recordCourseProgress`, `recordLessonProgress`) enrich inserts with `org_id` fetched from the related assignment/course rows so analytics views can filter by tenant.
- Backfill script (`scripts/backfill_org_ids.mjs`) joins `courses.created_by` to `organization_memberships` and accepts a CSV override for legacy content. Completion is logged in `server_health_report.json`.

### 3. Deterministic RLS posture
- New migration `20260103_cleanup_rls.sql` drops **all** legacy policies before reinstalling the `_is_org_admin/_is_org_member` helpers and scoped policies. Tables covered: `courses`, `modules`, `lessons`, `assignments`, `user_course_progress`, `user_lesson_progress`, `progress_events`, `survey_responses`.
- Added CI step (`.github/workflows/ci.yml`) to run `supabase db reset --linked` on every PR so policy drift cannot reappear unnoticed.
- Documented expected policies and helper behavior in `API_REFERENCE.md#rls-policies` with examples for org editors vs. platform admins.

### 4. Backend guardrails & fallback safety
- Introduced `withOrgContext` middleware for `/api/admin/courses/*` that extracts `orgId` from body/query headers, validates membership, and injects `req.orgContext`. All CRUD, publish, and assignment routes use it.
- `requireUserContext` no longer trusts `X-User-Role` when `req.user` is absent; instead it returns `401 missing_auth`. Header overrides now validate against JWT claims before honoring.
- Added `FORCE_ORG_ENFORCEMENT` env (enabled in CI/staging) so DEV/E2E fallbacks still run membership checks. Assignments without org context now fail loudly during automated tests.
- Catalog API (`/api/client/courses`) aligns with admin logic: `assigned=true` queries require `orgId` and validated membership before returning tenant-filtered data.

### 5. UX signals & offline awareness
- Builder and assignment experiences show the selected organization and disable actions when offline unless an org is cached locally.
- `assignmentStorage` stores `{ orgId, assignedBy }` with each offline record and replays via the admin API once `runtimeStatus.supabaseHealthy` becomes true.
- Runtime banner uses `runtimeStatus.statusLabel` plus new org warnings to surface misconfigurations early.

---

## Verification status

| Area | Status | Evidence |
| --- | --- | --- |
| Schema migrations | ✅ | `supabase db reset` run in CI (`ci.yml` step `Verify Supabase migrations`) and local dry runs recorded in `server_health_report.json`.
| Backend guards | ✅ | Supertest suite `tests/adminAssignments.spec.ts` covers missing orgId, invalid membership, and happy path. Playwright smoke test `tests/e2e/adminAssignments.spec.ts` validates UI blocking.
| Front-end flows | ✅ | Manual walkthrough: create course with org, assign learners offline/online, verify WebSocket updates. Screenshots attached in `NEXT_PHASE_REPORT.json`.
| Data backfill | ✅ | Script logs commit hash + record counts; metrics appended to `ADVANCED_ITERATION_REPORT.json`.
| Monitoring | ⚠️ | `/api/health` now includes `orgEnforcement:true`, but Grafana alert wiring remains TODO in Phase 9.

---

## Known gaps carried forward
1. Analytics materialized views still join on `org_id IS NULL` fallback logic—Phase 7 will rebuild them now that data is trustworthy.
2. Batch progress ingestion hasn’t been re-tuned post-org enforcement; expect Phase 8 to revisit throughput budgets.
3. Runtime health endpoint lacks passive callbacks (only polled), representing a resiliency risk slated for Phase 9.
4. Feature flags (`USE_ASSIGNMENTS_API`, `FORCE_ORG_ENFORCEMENT`) remain toggled for gradual rollout; Phase 10 will codify their final settings.

---

With Phase 6 complete, tenant boundaries are enforced consistently, and assignments/progress data finally carries org metadata end-to-end. This unlocks Phase 7’s analytics hardening work without compounding legacy data issues.
