## Files reviewed / modified for quiz + video audit
- `src/pages/Admin/AdminCourseBuilder.tsx` — admin UI state for lessons, quiz editors, and video controls.
- `src/services/courseService.ts` — shapes payload for `/api/admin/courses` and maps Supabase records → frontend models.
- `server/index.js` + `server/routes/admin-courses.js` — Express handlers persisting course/module/lesson graphs (focus on `lessons.content_json`).
- `src/utils/courseNormalization.ts` + `src/utils/contentMigrator.ts` — canonicalizes lesson `content_json` into runtime shape.
- `src/components/CoursePlayer/CoursePlayer.tsx` — learner player for videos + quizzes.
- `supabase/migrations/*` (schema verification for `lessons.content_json`, `courses.version`, etc.).

## Quiz data flow answers
- **Admin builder storage:** Each lesson stores quiz edits under `lesson.content.questions`. Questions currently hold `{ id, text, options: string[], correctAnswerIndex }` and persisted locally through `courseStore`.
- **Payload on save/publish:** `CourseService.buildModulesPayloadForUpsert` sanitizes `lesson.content`, wraps it inside `{ type, body }`, and posts that as `lesson.content_json` via `/api/admin/courses`.
- **Backend persistence:** Express route in `server/index.js` upserts `lessons` rows and stores the posted JSON verbatim in `content_json`. No extra quiz tables exist; quizzes live fully inside the JSON blob.
- **Client fetch/render:** Learner views call `/api/client/courses` → `CourseService.mapCourseRecord` → `normalizeCourse` which runs `migrateLessonContent(content_json)`. `CoursePlayer` expects each quiz question to expose `{ id, text, options: [{ id, text, correct }], passingScore }`, otherwise the modal cannot score attempts, which is why quizzes authored in the builder disappear today (they arrive as raw strings and lack option IDs/flags).

## Video data flow answers
- **Admin builder fields:** Lessons capture video metadata under `lesson.content.videoUrl`, `videoSourceType`, `videoProvider`, and optional upload info (`fileName`, `fileSize`, `videoDuration`, `transcript`, etc.).
- **Payload to backend:** Same `content_json` pipeline serializes this object into `{ type: 'video', body: { videoUrl, videoSourceType, ... } }`.
- **Supabase storage:** `lessons.content_json` stores the blob. Existing demo courses (e.g., Empathy to Action) were seeded before the builder change and therefore saved the video metadata at the root instead of inside `body`, which is why those continue to work.
- **Client expectations:** `CoursePlayer` reads `lesson.content.videoUrl`, `videoProvider`, `videoSourceType`, etc., directly on the lesson content. When newer lessons arrive, the player never sees `videoUrl` because everything is nested under `.body`, so renderers fall back to the text branch and nothing plays. Normalizing the JSON (flattening `body`, promoting `video` fields, and deriving a canonical `LessonVideo` object) fixes persistence + playback for both new and legacy courses.

## DEV CHECKLIST (after implementing fixes)
1. **Quiz flow**
   - Create a lesson with at least two quiz questions (Admin Course Builder).
   - Click *Save* → confirm `/api/admin/courses` returns `201`.
   - Reload the builder → verify quiz question text/options persist.
   - In the learner app, open `/client/courses/:slug` → start quiz → submit → verify score > 0 and review panel highlights correct answers.
2. **Video flow**
   - Add a lesson with an external video URL (YouTube/Vimeo/etc.).
   - Save & publish → verify `/api/client/courses/:id` response includes `lesson.content.video.url`.
   - In the learner view, start the new lesson → video iframe/player renders and can play/seek; transcript toggle remains functional if transcript text was provided.
3. **API spot-checks**
   - `GET /api/debug/whoami` while logged in as `mya@the-huddle.co` shows `role: "admin"`.
   - `GET /api/admin/courses` returns each lesson with `content_json.schema_version >= 1` and `questions[].options[].id`.
4. **Tests**
   - Run `npm run test -- contentMigrator` (Vitest) for the new unit coverage.
   - Run `npx playwright test tests/e2e/course_video_quiz.spec.ts` (or via `npm run test:e2e` if wired) to exercise the happy-path course → quiz/video round-trip.
