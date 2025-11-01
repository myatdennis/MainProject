# LMS Course & Portal Remediation To‑Do

> Comprehensive follow-up items derived from the full Course/LMS audit.  
> Each task lists the goal, concrete actions, owners (suggested), and success criteria.

---

## 1. Data Model & Persistence (High Priority)
- **Goal:** Ensure courses, lessons, assignments, and progress persist in Supabase (or production DB) rather than local storage.
- **Tasks**
  - [ ] Wire `courseManagementStore` and `courseStore` to Supabase CRUD endpoints (create/update/delete/read).
  - [ ] Persist chapter/lesson metadata, including lesson `content`, ordering, estimated duration, and lesson types.
  - [ ] Replace `assignmentStorage.ts` with Supabase-backed tables for assignments and due dates.
  - [ ] Extend progress logging (`courseProgress.ts`, `useSyncService`) to push to Supabase and invalidate caches.
- **Owner:** Backend + Fullstack.
- **Success Criteria:** Course edits, assignments, and progress remain after browser refresh; Supabase tables reflect changes within <3 seconds.

## 2. Course Builder Enhancements
- **Goal:** Deliver a production-ready course authoring experience.
- **Tasks**
  - [ ] Add validation + inline error to Save/Publish (title required, at least one module/lesson, video URL format, etc.).
  - [ ] Implement lesson editors for text, quiz, interactive, resource, and scenario types (fields + preview).
  - [ ] Introduce autosave (local draft) + explicit “Discard/Reset” actions.
  - [ ] Replace `alert`/`confirm` with Toast/Modal feedback using ToastContext.
- **Owner:** Frontend (Admin builder team).
- **Success Criteria:** Authors can configure all lesson types, see validation errors, and Save/Publish without page alerts; autosave prevents data loss.

## 3. Assignment & Analytics Sync
- **Goal:** Provide real-time assignment visibility and accurate analytics.
- **Tasks**
  - [ ] Implement Supabase channel or polling for assignments and progress; update Client Dashboard on new assignment within 3 seconds.
  - [ ] Connect `LearningAnalyticsEngine`, `SurveyAnalyticsDashboard`, and Admin dashboards to real data instead of mocked arrays.
  - [ ] Add fallback states (“No data yet”) when tables are empty.
  - [ ] Ensure completion events trigger analytics invalidation.
- **Owner:** Fullstack + Analytics.
- **Success Criteria:** New assignment appears on Client Dashboard instantly; Admin dashboards display real progress/ completion numbers.

## 4. Video Playback & Lesson UX
- **Goal:** Deliver resilient video lessons with meaningful feedback.
- **Tasks**
  - [ ] Replace “Video source unavailable” with branded loader + friendly error card; add retry.
  - [ ] Move demo fallback out of CoursePlayer; require valid `videoUrl` or flag the lesson as content-missing.
  - [ ] Ensure playback completion logs progress events (≥90%) and saves resume position.
  - [ ] Support captions/transcripts in the player and store them per lesson.
- **Owner:** Frontend (CoursePlayer) + Accessibility.
- **Success Criteria:** Video lessons show loader and branded error, playback completes and syncs progress, transcripts accessible.

## 5. Client Portal Experience
- **Goal:** Ensure learners have a seamless course/lesson flow.
- **Tasks**
  - [ ] Verify `/client` routes for Start/Continue → `CoursePlayer namespace="client"`; fix any stale path references.
  - [ ] Add friendly empty states for no assignments/no lessons.
  - [ ] Confirm lesson completion triggers `CourseCompletion` screen with resources/reflection.
  - [ ] Remove direct `window.location.assign` usages; use SPA navigation (`navigate()`).
- **Owner:** Frontend (Client portal).
- **Success Criteria:** Learners can start/continue lessons, complete courses, and return to dashboard without reloads; completion screen appears with branded copy.

## 6. Admin Portal Buttons & Routing
- **Goal:** Eliminate dead links and ensure every button routes correctly.
- **Tasks**
  - [ ] Audit `AdminCourses`, `AdminCourseCreate`, `AdminCourseEdit`, `CourseAssignmentModal` for missing routes and no-op handlers.
  - [ ] Implement delete + archive flows with confirmation and server persistence.
  - [ ] Ensure `Assign` action opens a working modal tied to Supabase assignments.
  - [ ] Add placeholder pages for any referenced but missing routes (e.g., analytics subpages).
- **Owner:** Frontend/Admin UX.
- **Success Criteria:** Manual click-through finds zero dead buttons; Delete/Archive/Assign operations persist and show toasts.

## 7. Brand Consistency & Styling
- **Goal:** Enforce unified Huddle Co. palette and typography across Admin, Client, and LMS.
- **Tasks**
  - [ ] Replace Tailwind defaults (`text-blue-600`, `bg-green-50`, etc.) with brand-specific classes or tokens.
  - [ ] Update gradients, badges, toasts, and status chips to use Sunrise, Sky Blue, Forest, Deep Red, Soft White, Charcoal.
  - [ ] Run design-consistency checker after palette update; address flagged files.
  - [ ] Document brand usage in `BrandKitPage` and distribute to engineers/designers.
- **Owner:** Design Systems + Frontend.
- **Success Criteria:** No stray Tailwind default colors; design tool reports zero non-brand hex codes; visual parity between portals.

## 8. Error Handling & Feedback
- **Goal:** Provide graceful, branded error experiences.
- **Tasks**
  - [ ] Replace `alert`/`confirm` with Toast or Modal patterns tied to ToastContext.
  - [ ] Add `try/catch` around Save/Publish/Assign; display friendly error messages with actions.
  - [ ] Implement `Course not found`/`Lesson not available` pages with navigation to dashboard/courses.
  - [ ] Ensure network failures use brand colors via `NetworkErrorHandler`.
- **Owner:** Frontend + UX Writing.
- **Success Criteria:** All errors surface as toasts/modals; no native alert/confirm usage; user can recover from missing content without dead ends.

## 9. Testing & Quality Gates
- **Goal:** Rebuild automated confidence around the LMS flows.
- **Tasks**
  - [ ] Add integration/unit tests for course creation → publish → assign → client completion.
  - [ ] Implement end-to-end tests (Playwright/Cypress) for admin/client journeys, including video progress.
  - [ ] Include Lighthouse CI run targeting course and lesson pages (≥90 performance).
  - [ ] Configure `npm run lint` to pass by fixing existing hook-order issues (`AddUserModal`, `AdminLogin`) and `no-case-declarations`.
- **Owner:** QA + Frontend.
- **Success Criteria:** CI runs lint/tests/Lighthouse successfully; test suite covers critical flows.

## 10. Ops & Tooling
- **Goal:** Support dev workflows and monitoring.
- **Tasks**
  - [ ] Seed Supabase with sample courses/lessons for staging environments.
  - [ ] Document the course lifecycle (Draft → Published → Assigned → Completed) with API expectations.
  - [ ] Enable logging/monitoring (Sentry or Supabase logs) for assignment/progress events.
  - [ ] Update `design-consistency-checker` to run pre-commit or via CI.
- **Owner:** Platform/DevOps.
- **Success Criteria:** Developers can spin up environment with sample data; logs capture course/lesson events; design checker flags issues automatically.

---

### Tracking & Reporting
- Create Jira/Epic: **LMS Revamp Phase II**.
- Assign each section to responsible squad with estimated timelines.
- Weekly standup review of progress; demo improvements to stakeholders.

