# Course lifecycle playbook

> How a course moves from an admin idea to learner analytics inside this LMS stack.

## 1. Authoring & curation (Admin)

| Step | Owner | Source files / endpoints | Storage | Notes |
| --- | --- | --- | --- | --- |
| Draft or import | Admin UI (`src/pages/Admin/CourseBuilderPage.tsx`, `src/pages/Admin/BrandKitPage.tsx`) | `/api/admin/courses` (server `courseUpsertSchema`), `/api/admin/modules`, `/api/admin/lessons` | `courses`, `modules`, `lessons` tables in Supabase | Rich text, video, worksheet, quiz, survey content is persisted inside `meta_json`, `content_json`, `completion_rule_json`. |
| Media handling | Admin uploads via enhanced video/doc widgets | Server streams to Supabase Storage bucket `course-resources` (see `SUPABASE_DOCUMENTS_BUCKET`) | Storage object metadata stored back on lessons | Signed URLs refreshed via `DOCUMENT_URL_TTL_SECONDS` window. |
| Versioning & validation | `courseUpsertSchema`, `lessonCreateSchema`, etc. in `server/validators.js` | In-memory `e2eStore` mirrors Supabase for demo/dev parity | Guarantees order indexes, slug uniqueness, and module <> lesson referential integrity before commit. |

**Key behaviors**

- Upserts are idempotent (`id`, `slug`, or `external_id` inside `meta_json`).
- Draft/published state is toggled through the course payload (`status` column) so the learner catalog only sees "published" rows.
- When Supabase env vars aren’t present the server falls back to the persisted JSON cache (`server/demo-data.json`) which keeps local development unblocked.

## 2. Launch & assignment

| Step | Files / APIs | Data flow |
| --- | --- | --- |
| Org provisioning | `supabase/migrations/*orgs*`, seeded via `scripts/seed_supabase_sample_data.mjs` | Creates rows inside `organizations`, `organization_memberships`, enabling RLS scopes. |
| Course assignment | Admin router (see `/api/admin/assignments` handlers in `server/index.js`) and `server/routes/admin-users.js` | Inserts into `assignments` with optional `due_at`, `active` flags. Org + user IDs keep data multi-tenant aware. |
| Notifications & nudges | `notifications` table + `org_workspace_*` tables | Admin UI can trigger assignments or workspace action items referencing the same org IDs. |

**What to remember**

- Assignment rows are the contract the learner portal reads to decide which courses appear in "My queue".
- Sample data (via `npm run seed:supabase`) already maps three personas → two orgs so QA immediately sees the full workflow.

## 3. Learner experience & runtime state

| Layer | Implementation | Responsibilities |
| --- | --- | --- |
| Client shell | `src/pages/LMS/LMSModule.tsx`, `src/components/CoursePlayer/CoursePlayer.tsx` | Loads lessons via React Query, renders video/quiz/text blocks, and streams progress mutations. |
| Transport | REST calls hosted in `server/index.js` (`POST /api/progress/course`, `POST /api/progress/lesson`, `POST /api/assignments/ack`) | Every request attaches `X-User-Id`, `X-Org-Id`, and optional CSRF token for session-based flows. |
| Persistence | Supabase `user_course_progress`, `user_lesson_progress`, `assignments`, `certificates` | JSON columns capture resume points, time-on-task, status, and completion booleans. |
| Real-time feedback | Admin dashboard listens to Postgres changes (see `src/pages/Admin/AnalyticsDashboard.tsx` subscribing to `postgres_changes` on `user_course_progress`). |

**Edge cases**

- When Supabase is unavailable the server writes to `e2eStore.courseProgress` / `lessonProgress` Maps and later syncs via background jobs.
- Offline/low bandwidth clients keep a lightweight cache using `localStorage` so the player can rehydrate the last lesson; once online the server reconciles via `upsert` semantics.

## 4. Completion, certificates, and surveys

1. **Completion detection** – When a learner crosses the `completion_rule_json` threshold for each lesson, the client posts a lesson progress payload (`percent`, `status`, `time_spent_s`). Course completion is derived when all published lessons are `status === 'completed'` or the course-level `percent` hits 100.
2. **Certificates** – `server/index.js` can enqueue certificate creation (writing to `certificates` table and sending transactional email). The audit hook ensures duplicates are not emitted if a learner replays the final lesson.
3. **Surveys** – `surveys` + `survey_responses` tables pair with `server/routes/admin-analytics*.js` so post-course surveys surface in admin analytics. RLS is org-scoped, and the seed script plants example responses for both orgs so charts render instantly.

## 5. Analytics & monitoring

| Report | Backing objects | Where it shows up |
| --- | --- | --- |
| Admin overview cards | `view_admin_overview`, `view_course_avg_progress`, `view_course_completion_rate` | `/api/admin/analytics` response consumed by `src/pages/Admin/AnalyticsDashboard.tsx`. |
| Lesson drop-off | `view_lesson_dropoff` + `fn_course_engagement_score` | Helps CX teams spot friction; data originates from `user_lesson_progress`. |
| Survey summary | Aggregated inside `server/routes/admin-analytics.js` with dynamic filters (`course_id`, `organization_id`, `since`, `until`). |

**Ops hooks**

- `/api/health` already reports Supabase connectivity (see `buildHealthPayload()` in `server/index.js`).
- Logging is structured per request via `attachRequestId`; progress endpoints emit `{ requestId, user_id, course_id, percent }` on every mutation for traceability.
- New seeding workflow ensures dashboards have non-empty datasets immediately after migrations land, which keeps CI screenshot tests stable.

## 6. Feedback loop / iteration checklist

| Trigger | Artifact | Next action |
| --- | --- | --- |
| Learner completes reflection | `survey_responses` + `user_course_progress.completed = true` | Kick off coaching nudges or certificate email. |
| Admin duplicates a course | `/api/admin/courses/duplicate` route copies curriculum, increments `version`, and stamps `(Copy)` in the title. | Update metadata, assign to new cohort, re-run progress seeding if demo data is needed. |
| Ops monitors backlog | Offline queue snapshot stored at `server/diagnostics/offline-queue.json` with thresholds set by `OFFLINE_QUEUE_WARN_AT`. | If backlog spikes, inspect worker logs and temporarily disable new assignments. |

## Sequence cheat-sheet

1. **Create** – Admin author uses UI → server validates → Supabase tables updated.
2. **Assign** – Admin selects org/users → `assignments` rows created → notifications optional.
3. **Consume** – Learner loads course → lessons/material served via Supabase Storage + metadata.
4. **Track** – Client emits granular lesson + course progress → server upserts into analytics tables.
5. **Complete** – Completion triggers certificate + surveys → responses feed analytics views.
6. **Review** – Admin dashboards aggregate results → insights loop back into authoring (revise modules, reorder lessons, etc.).

## Using the seeding + lifecycle docs together

- Run `npm run seed:supabase` after migrations to populate orgs, courses, assignments, progress, and survey rows.
- Follow the table above to trace a persona (Alex, Jordan, or Maya) from assignment → completion; each persona touches a different branch of the lifecycle and unlocks every dashboard widget.
- When adding a new feature, update both the Supabase seed (so QA/demo data exercises it) and this playbook (so ops + design know where it fits in the flow).
