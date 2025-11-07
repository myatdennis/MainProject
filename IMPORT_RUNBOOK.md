# Course Import Runbook

This runbook explains how to import courses reliably and have them appear on the correct pages with durable persistence.

## Supported formats
- JSON (preferred): `{ "courses": [ { title, slug?, description, status?, modules: [ { title, order?, lessons: [ { type, title, order?, duration_s?, content?, completion_rule_json? } ] } ] } ] }`
- CSV: row-per-lesson with columns like `course_title, course_slug, course_description, module_title, module_order, lesson_title, lesson_type, lesson_order, lesson_duration_s`.
- SCORM: Not supported in this demo build. (Planned)

## How to import via Admin UI
1. Navigate to Admin → Courses → Import (or go to `/admin/courses/import`).
2. Drag & drop a JSON or CSV file, or use the file picker.
3. Review the pre-import summary:
   - “Create” = new course by slug
   - “Update” = existing course (slug match) will be upserted
4. Click “Import courses”. On success, you’ll be returned to the Courses list.

## Idempotency & upsert rules
- Upsert by `slug` or (if present) `external_id`.
- Stable IDs are preserved when matched. Otherwise, a new course ID is created.
- In demo/dev mode, imports are persisted to `server/demo-data.json` and survive restarts.

## Where data lives (Single Source of Truth)
- All reads and writes go through the server API:
  - Admin list: `GET /api/admin/courses`
  - Client catalog (published): `GET /api/client/courses`
  - Upsert single: `POST /api/admin/courses`
  - Batch import (this UI): `POST /api/admin/courses/import`
  - Publish: `POST /api/admin/courses/:id/publish`
  - Assign: `POST /api/admin/courses/:id/assign`
  - Assignments (client read): `GET /api/client/assignments?user_id=...`
  - Progress (client): `/api/learner/progress`, `/api/client/progress/*`

## Visibility rules
- Learners see only courses that are Published or explicitly Assigned to them.
- Admin sees all courses in the organization with filter controls.

## Troubleshooting
- If the UI doesn’t reflect recent changes, clear the service worker cache (visit `/unregister-sw.html`) and hard-refresh.
- Check server health at `/api/health`.
- Inspect logs in `server_bg.log` for import details and any validation errors.

## CLI alternative
For bulk automation, you can still run the existing script:

```
node scripts/import_courses.js import/dei-foundations.json --publish --dedupe --prune-duplicates --wait --wait-timeout 8000
```

This uses the same server endpoints as the UI and supports upsert-by-slug.
