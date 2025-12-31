# Course Admin UI Action Audit (Phase 2)

_Updated: 2025-12-30_

## Scope
Phase 2 requested a button/control audit for the course authoring surfaces. I reviewed two primary screens:

1. `src/pages/Admin/AdminCourses.tsx` – catalog list, table, and supporting modals.
2. `src/pages/Admin/AdminCourseBuilder.tsx` – drag-and-drop builder plus preview/assignment overlays.

Each control below is marked as **Working**, **Partial**, or **Dead** based on whether it invokes a real backend/API flow today.

---

## Admin Courses (`/admin/courses`)

| Control / CTA | Implementation Highlights | Status | Notes & Fix Recommendation |
| --- | --- | --- | --- |
| Search input | Updates `searchTerm` and filters `courseStore.getAllCourses()` client-side. | **Working** | No backend search yet; consider server filtering when catalog grows. |
| Status filter dropdown | Binds to `filterStatus` (`all`, `published`, `draft`, `archived`). | **Working** | – |
| Course selection checkboxes | Toggle `selectedCourses` for bulk actions. | **Working** | Selection state is shared between cards and table. |
| **Bulk Assign** (appears when selection > 0) | `navigate('/admin/courses/bulk?ids=…')`. Route renders `AdminCourseBulkPlaceholder`. | **Dead** | Replace placeholder with real bulk assign flow or reuse `CourseAssignmentModal` with multi-select support. |
| **Publish Selected** | Calls `publishSelected` → `persistCourse` → Supabase upsert per course. | **Working** | Add toast per failure? currently aggregates errors. |
| **New Course** button | Sets `showCreateModal` → `CourseEditModal` inline create. | **Working** | Post-save navigation to `/admin/courses/:id/details`. |
| **Create Course** loader button | `navigate('/admin/courses/new')` → `AdminCourseNewPlaceholder`. | **Dead** | Either remove redundant CTA or replace placeholder with builder or `CourseEditModal`. |
| **Import** button | `navigate('/admin/courses/import')` → placeholder. | **Dead** | Hook to `/api/admin/courses/import` batching once UX ready. |
| Empty-state action | Either resets filters or opens `New Course` modal. | **Working** | – |
| Card/table “Preview” (eye icon) | Links to `/admin/courses/:id/details` (component exists). | **Working** | – |
| Card/table “Edit” (pencil) | `navigate('/admin/courses/:id/edit')`. No route registered in `App.tsx`. | **Dead** | Either add the `AdminCourseEdit` route or change navigation to `/admin/course-builder/:id`. |
| Card/table “Duplicate” | Calls `duplicateCourse` → `persistCourse` → navigates to builder. | **Working** | Duplicates include `slug`; consider slug regeneration to avoid clashes. |
| Card/table “Assign” (user icon) | Opens `CourseAssignmentModal` with selected course. | **Working** | Modal posts assignments via `/api/admin/courses/:id/assign`. |
| Card/table “Archive” | Opens confirmation, calls `persistCourse` with `status: 'archived'`. | **Working** | – |
| Card “Analytics” (bar chart) | `navigate('/admin/reports?courseId=…')`, but `/admin/reports` route is missing from `App.tsx`. | **Dead** | Register `AdminReports` route or hide CTA until analytics dashboard ships. |
| Card “Settings” (gear) | Goes to `/admin/courses/:id/settings` (route & screen exist). | **Working** | – |
| Card/table “Delete” | Shows `ConfirmationModal`, deletes via `courseStore.deleteCourse` + API call. | **Working** | – |
| Course table "Select All" & Export | `handleSelectAll` toggles `selectedCourses`; `handleExportCourses` downloads JSON. | **Working** | Export currently client-only JSON dump. |
| Footer stats | Purely derived UI from `courses`. | **Working** | – |
| Floating CTAs (Create, Import, Bulk) -> placeholder screens | See above. | **Dead** | Consolidate with builder once features land to reduce confusion. |

---

## Admin Course Builder (`/admin/course-builder/:id`)

### Header + Global Actions

| Control | Implementation | Status | Notes / Fix |
| --- | --- | --- | --- |
| Back to Course Management | `<Link to="/admin/courses">` | **Working** | – |
| Status banner actions | `statusBanner.onAction` triggers retry or reload hooks. | **Working** | – |
| Discard | Sets `confirmDialog('discard')` → `revertToLastSaved`. | **Working** | Depends on `lastPersistedRef`; safe-guards in place. |
| Reset Template | Resets to `createEmptyCourse`. | **Working** | Warns via confirm modal. |
| Live Preview | `setShowPreview(true)` → `LivePreview` modal. | **Working** | Relies on local state; no server fetch. |
| Save Draft | `handleSave` → validation → `persistCourse` (Supabase upsert) | **Working** | Keyboard shortcut ⌘S also mapped. |
| Assign to Users | Opens `CourseAssignmentModal` (disabled until modules exist). | **Working** | Shares modal component with list page. |
| Publish Course | `handlePublish` sets status `published` and upserts. | **Working** | Validates before publish. |
| Preview (opens `/courses/:id` in new tab) | `window.open(`/courses/${course.id}`, '_blank')`. No such top-level route exists. | **Dead** | Should point to `/client/courses/:id` (client portal) or `/lms/courses/:id` depending on persona. |
| Duplicate | Clones local course, saves to store, navigates to new builder route. No immediate Supabase sync. | **Partial** | Works locally but requires manual Save/Publish to persist new course. Consider auto-calling `persistCourse`. |
| Export | Generates JSON data URI download. | **Working** | – |
| Delete | Confirmation modal → `courseStore.deleteCourse`. | **Working** | – |
| Auto-save indicator | Watches `computeCourseDiff` and updates status. | **Working** | – |

### Tabs & Editors

| Area | Implementation | Status | Notes / Fix |
| --- | --- | --- | --- |
| Tabs (Overview, Content, Settings, History) | `tabs` array + `setActiveTab`. | **Working** | History uses `VersionControl`; ensure backend feed exists (currently local). |
| Overview form | Controlled inputs for metadata, objectives, tags. | **Working** | All data persisted on general Save. |
| Content tab | Drag/drop modules & lessons with `DragDropItem`. | **Working** | Lesson editor writes directly to state; "Save Lesson" merely closes drawer (expected). |
| Settings tab | Course-type, prerequisites, certification toggles. | **Working** | – |
| History tab | Renders `<VersionControl />`. | **Partial** | Component swaps entire course when `onRestore` fires, but no upstream snapshots are loaded unless `VersionControl` is wired to backend (needs follow-up). |
| Module controls | Add, delete, expand/collapse, reorder via `reorderModules`. | **Working** | Delete uses local state only until Save. |
| Lesson controls | Add lesson, reorder, edit content by type, upload doc/video (storage API). | **Working** | Video upload uses `/api/admin/courses/:courseId/modules/:moduleId/lessons/:lessonId/video-upload`. |
| Mobile Toolbar | `MobileCourseToolbar` wires `onAddModule`, `onPreview`, `onSave`. | **Working** | Keep parity with desktop actions. |

### Overlays & Modals

| Modal | Trigger | Status | Notes |
| --- | --- | --- | --- |
| CourseAssignmentModal | Header Assign button | **Working** | Shares handler with list view; ensures `course.id` present. |
| LivePreview | Header + `CoursePreviewDock` | **Working** | Mirrors current lesson context. |
| Confirm dialogs (discard/reset/delete) | Via `confirmDialog` state | **Working** | Uses consistent tone styling. |

---

## Key Gaps & Proposed Fixes

1. **Broken navigation targets**
   - `/admin/courses/:id/edit` and `/admin/reports` are not registered routes. Update `App.tsx` or retarget buttons (e.g., send Edit directly to the builder and Analytics to the existing AdminAnalytics dashboards).
   - Builder "Preview" should deep-link into the learner experience (e.g., `/client/courses/:courseId` with impersonation) instead of `/courses/:id`.
2. **Placeholder flows still exposed**
   - `AdminCourseNewPlaceholder`, `AdminCourseImportPlaceholder`, and `AdminCourseBulkPlaceholder` are still publicly linked. Hide or replace these CTAs until the real workflows land.
3. **Duplicate button lacks persistence**
   - Builder duplicate action only mutates the local store. Auto-call `persistCourse` (and regenerate slug) before redirecting to avoid confusing "ghost" courses.
4. **Version history lacks source of truth**
   - `VersionControl` currently receives only the in-memory course. Hook it to Supabase revisions or remove the History tab until versioning is implemented.

Addressing the dead/partial controls above will prevent admins from hitting placeholder pages and ensure every surfaced action has a predictable outcome.
