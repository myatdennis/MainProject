# Course & Lesson Functionality Audit

Scope: CoursePlayer resume/position handling, completion triggers, quiz flow, certificate issuance, and batching integration opportunities.

## Observations
- CoursePlayer
  - Uses `Button` for controls; maintains `showQuizModal` state for quizzes.
  - Progress currently posted via progressService (snapshots and per-event). New batching service is available but not yet wired.
  - Resume position is supported server-side via `resume_at_s` for lessons.
- Server endpoints
  - `/api/client/progress/lesson` and `/api/client/progress/course` support idempotency via `client_event_id`.
  - New `/api/client/progress/batch` endpoint accepts up to 25 events, dedupes, and updates in-memory store (demo/E2E).
  - `/api/client/certificates/:courseId` inserts certificate records (Supabase path) with `user_id` required.

## Completion Triggers
- Lessons: completion depends on percent and type (e.g., quizzes may have score requirements).
- Courses: overall percent & last lesson completion; completion should trigger analytics and optional certificate creation.

## Gaps & Recommendations
1. Wire batching in CoursePlayer
   - Replace per-event time updates with `batchService.enqueueProgress({ type:'lesson_progress', ... })`.
   - Flush on `visibilitychange` hidden and before unload (already implemented in service).
2. Ensure idempotent completion
   - When a lesson or course reaches completion threshold, enqueue a `lesson_completed` / `course_completed` event with a stable `clientEventId`.
3. Quiz flow
   - Ensure quiz completion emits analytics event (e.g., `quiz_completed`) via `enqueueAnalytics` with score payload.
4. Certificates
   - When course completion detected, call existing certificate endpoint if applicable; log analytics event for issuance success/failure.

## Minimal Integration Steps
- Import `batchService` in `CoursePlayer` and emit progress events on time/update hooks.
- Keep snapshot sync via `progressService` for periodic rollup; batching handles the high-frequency deltas.
- Add analytics enqueue calls at start/resume/completion boundaries.

## Acceptance Criteria
- Progress updates are batched (less network chatter) while snapshots continue to work.
- Completion events emitted exactly once (idempotent).
- Quiz actions produce analytics events with results attached.
- Certificates created on course completion when enabled.
