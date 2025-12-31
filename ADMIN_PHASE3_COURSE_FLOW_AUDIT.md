# Phase 3 – Course CRUD / Publish / Assign Flow Audit

_Updated: 2025-12-30_

## Scope & references
- **Screens covered:** `src/pages/Admin/AdminCourses.tsx`, `src/pages/Admin/AdminCourseBuilder.tsx`, shared `CourseEditModal`, and `CourseAssignmentModal`.
- **Data layer:** `courseStore`, `CourseService.syncCourseToDatabase`, `/api/admin/courses` upsert endpoint, `/api/admin/courses/:id/publish`, `/api/admin/courses/:id/assign`.
- **Assignment infra:** `src/utils/assignmentStorage.ts`, `course_assignments` table usage on the client, versus `assignments` table on the server.

The goal for Phase 3 was to map how builder CRUD, publish, and assign actions actually traverse UI components, local stores, DAL helpers, and Supabase endpoints. Each subsection below lists the concrete flow, highlights the trust boundaries, and spells out misalignments to fix before Phase 4 (media hardening) begins.

---

## 1. CRUD entry points & persistence

### 1.1 Create a brand-new course from the catalog modal
1. **Trigger:** `AdminCourses` → “New Course” toggles `CourseEditModal` in `mode="create"`.
2. **Modal:** `CourseEditModal` builds a default `Course`, validates lesson content (with alert-driven messaging), and on Save calls parent `handleCreateCourseSave`.
3. **Store write:** `handleCreateCourseSave` slugifies the payload and invokes `courseStore.createCourse`, which synthesizes IDs, merges defaults, then immediately `syncCourseToDatabase` (Supabase RPC or demo fallback).
4. **Post-save navigation:** toast + redirect to `/admin/courses/:id/details`. The detailed view eventually links into the builder for deep editing.

### 1.2 Edit or continue building an existing course
1. **Trigger:** In practice, admins hit the builder through `/admin/course-builder/:courseId`; the table “Edit” link still points at `/admin/courses/:id/edit` (dead route, noted in Phase 2).
2. **Hydration:** `AdminCourseBuilder` loads the latest graph from `courseStore` or calls `loadCourseFromDatabase` (which GETs `/api/client/courses/:id?includeDrafts=true`).
3. **Live editing:** Builder keeps course state locally, autosaves to `courseStore.saveCourse` every ~1.5 s, and keeps a `lastPersistedRef` snapshot for dirty tracking.
4. **Explicit Save:** `handleSave` runs `validateCourse`, recomputes duration/lesson counts, and calls `persistCourse` → `syncCourseToDatabase` when there are material diffs.

### 1.3 Data pipeline (shared by create, edit, duplicate)
```
UI modal / builder → courseStore (local map) → CourseService.normalize →
POST /api/admin/courses (course + modules payload) →
server upsert (RPC or manual) → Supabase `courses/modules/lessons` tables
```
- All “save” buttons rely on the same `syncCourseToDatabase` upsert; there is **no dedicated draft endpoint**.
- `CourseValidationError` bubbles when `validateCourse` fails (builder) or when Supabase rejects schema constraints.

### 1.4 Observed issues & recommendations
| Area | Issue | Impact | Recommendation |
| --- | --- | --- | --- |
| Catalog “Edit” CTA | Routes to `/admin/courses/:id/edit`, but only `AdminCourseBuilder` exists. | Broken navigation keeps admins from reaching builder via list view. | Point both card/table edit buttons to `/admin/course-builder/:id` (matching duplicate flow). |
| Slug collisions | `CourseEditModal` re-slugifies titles but never checks unique constraints before calling `courseStore.createCourse`. Duplicate slugs hit Supabase unique index and throw `version_conflict`/409 errors that surface as generic toast failures. | Creates phantom “failed create” states; admins retry and end up with multiple draft copies. | Before `syncCourseToDatabase`, call `/api/admin/courses?slug=...` or let server return the conflicting row and map it back to the modal with actionable messaging. |
| Autosave diffing | Builder’s `computeCourseDiff` compares against `lastPersistedRef` only. Opening the same course in two tabs causes the newer edits to overwrite older versions silently. | Multi-admin editing loses data and invalidates version assumptions. | Stamp `version` on every save (already on the model) and have the server publish endpoint enforce optimistic concurrency; surface 409 with “Reload latest copy” CTA. |
| Validation parity | `CourseEditModal` relies on alert strings and never serializes lessons into modules unless the modal’s internal `lessonContents` array is used. Builder requires at least one module/lesson with concrete video URLs. | Modal can produce “valid” payloads that later fail builder validation, confusing admins. | Either reuse `validateCourse` logic inside the modal or remove the modal in favor of routing new-course creation directly into the builder template. |

---

## 2. Publish workflows

### 2.1 Builder “Publish Course” button
1. `handlePublish` simply sets `status: 'published'`, stamps `publishedDate`, recomputes duration/lessons, and calls `persistCourse(publishedCourse, 'published')`.
2. `persistCourse` → `syncCourseToDatabase` (same upsert pipeline as drafts). No special endpoint is called.
3. Toast reports success, but no additional downstream actions occur.

### 2.2 Bulk publish from the catalog
1. `publishSelected` loops each selected course, clones it with `status: 'published'`, and calls the same `persistCourse` helper.
2. Validation failures per course show as aggregated toast errors.

### 2.3 Mismatch with server publish endpoint
- Server exposes `POST /api/admin/courses/:id/publish`, which:
  - Requeries the latest row, bumps the version, sets `published_at`, and
  - Broadcasts `course_updated` events to org/global topics for real-time clients.
- **Front-end never calls this route**; instead it upserts the entire graph again.
- Result: success toasts but **no broadcast** to listeners, no guaranteed `published_at`, and potential race conditions when multiple admins publish simultaneously (because version bump is client-side guesswork).

### 2.4 Publish-specific recommendations
| Gap | Consequence | Fix |
| --- | --- | --- |
| Publish buttons reuse draft upsert | Learner feeds, analytics, and org listeners never receive the publish event. | After a successful course upsert, call `adminPublishCourse(course.id)` (already exported) to trigger the dedicated endpoint and rely on its version + broadcast handling. |
| Version mismatch | Builder may send a stale version number; server silently overwrites. | Surface `version_conflict` from `/api/admin/courses` and rehydrate builder state before allowing publish. |
| Missing readiness gate | Builder publish button only checks for module presence. No verification that lessons include playable media or quizzes. | Extend `validateCourse` to ensure each published module has at least one fully-configured lesson (e.g., video URL or quiz questions) and fail fast before hitting the network. |

---

## 3. Assignment workflows

### 3.1 UI entry points
- **Catalog table/card “Assign”** and builder header “Assign to Users” both open `CourseAssignmentModal` with the current course ID prefilled.
- Modal accepts a free-form list of emails/user IDs, optional due date, and note.

### 3.2 Data path implemented today
```
CourseAssignmentModal → addAssignments(courseId, userIds, metadata)
  ↳ if Supabase configured: direct client-side upsert into `course_assignments`
  ↳ if offline/no Supabase: write to localStorage + emit sync events via syncService
```
- `assignmentStorage` later tries to sync local records once Supabase connectivity is restored.
- `CourseAssignment` type carries **no organization context**; everything is keyed solely by `courseId + userId`.

### 3.3 Server assignment route (unused by the UI)
- `/api/admin/courses/:id/assign` expects `{ organization_id, user_ids[], due_at }` and writes to the **`assignments`** table (note the missing `course_` prefix).
- The handler enforces org write access, deduplicates active assignments, and emits broadcast events per org/user.
- Because the modal never calls this route, none of those authorization checks or broadcasts occur.

### 3.4 Issues & recommended fixes
| Issue | Details | Impact | Recommendation |
| --- | --- | --- | --- |
| Table mismatch | Front-end upserts `course_assignments`; server/API use `assignments`. | Analytics dashboards and `/api/client/courses?assigned=true` (which queries `assignments`) never see modal-created records. | Decide on a single `assignments` table schema. Rename client helper to hit `/api/admin/courses/:id/assign` so all writes pass through the server.
| Missing org context | Modal has no way to pick an organization or segment assignments vs. org-wide announcement. | Supabase rows lack `organization_id`, so learner lists can’t filter assignments per org or tenant. | Extend the modal to capture the org (default to admin’s), include it in the API payload, and persist it on the assignment model/type. |
| Offline queue visibility | When Supabase is down, assignments live in `localStorage` with no UI indicator other than a toast. Admins can’t tell what’s queued. | Leads to duplicate sends once they retry manually. | Surface a “Pending assignments” list (fed by `assignmentStorage`) and allow manual retry/cancel. |
| Audit trail | Server endpoint logs assignment events; direct Supabase writes bypass logging and notifications. | Learners never get WebSocket pushes, and admins lose auditability. | Same fix as above: funnel through server so `broadcastToTopic` fires and syncService receives canonical events. |

---

## Cross-cutting risks spotted while tracing flows
1. **Offline vs. online divergence** – Builder and assignment modal both support offline fallbacks, but there’s no UI badge when you’re editing offline. Accidental overwrites happen when Supabase reconnects mid-session.
2. **Idempotency gaps** – Upsert requests support `idempotency_key`, yet the UI never supplies one. Rapid double-clicks fire two identical saves, occasionally hitting 409 “duplicate key” responses that the UI treats as fatal errors.
3. **Shared store as single source of truth** – `courseStore` is an in-memory singleton and doesn’t persist to IndexedDB/localStorage (helpers are stubs). Refreshing the page between saves relies entirely on Supabase; in demo mode there’s a pseudo store, but in production a network hiccup means losing unsaved modules.
4. **Lesson media placeholders** – When CourseEditModal creates video lessons without a real URL, builder validation fails later. Need a consistent placeholder strategy (or disable video-type lessons until a playable asset is attached).

---

## Immediate remediation backlog before Phase 4
1. **Fix navigation + slug handling** (CRUD)
   - Point “Edit” to the builder, hide/replace placeholder routes, and add slug uniqueness validation in `courseStore.createCourse`.
2. **Call the publish endpoint** (Publish)
   - After every successful upsert (builder save/publish, bulk publish), call `adminPublishCourse` so Supabase emits `course_updated` events and stamps `published_at`.
3. **Unify assignment plumbing** (Assign)
   - Update `addAssignments` to POST `/api/admin/courses/:id/assign` with organization context, then delete the direct `course_assignments` client upsert.
4. **Expose offline state** (All)
   - Surface runtime status (from `state/runtimeStatus`) inside builder and assignment modal so admins know when they’re editing/assigning offline.
5. **Adopt optimistic concurrency** (CRUD/Publish)
   - Bubble `version_conflict` responses up to the UI with a “Reload latest and retry” button to prevent silent overwrites.

---

## Phase 4+ preview
- **Phase 4 (Media & document handling):** audit `/api/admin/courses/:courseId/modules/:moduleId/lessons/:lessonId/video-upload`, Supabase storage buckets, and LMS playback fallbacks. Blocked until publish flow guarantees consistent lesson media metadata.
- **Phase 5 (Permissions/org scoping):** leverage the `organization_id` checks already present in the server assignment route; extend similar enforcement to course CRUD endpoints.
- **Phase 6 (Data integrity & migrations):** align client models (`course_assignments`) with actual tables, add migrations for any schema drift (e.g., add `organization_id` to assignments if missing).
- **Phase 7–10 (Performance, UX polish, analytics, regression harness):** will piggyback on the cleaned-up flows above so we can reliably instrument builder events, assignment success metrics, and Supabase query budgets.

With these findings locked, we can move into the media/upload audit confident that CRUD/publish/assign have clear ownership paths and a prioritized remediation list.
