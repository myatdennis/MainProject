# Course Data Pipeline Notes

- Added a normalized loader (`loadCourse`) that resolves courses by numeric id or slug, falls back to the local store when Supabase is unavailable, and returns ordered modules/lessons.
- `normalizeCourse` now derives slugs from an explicit slug, title, or id (in that order) and hardens lesson defaults so malformed `content_json` blocks cannot break rendering.
- Local progress persistence stores completion state, last lesson, and partial percentages; `CoursePlayer` rehydrates this to resume playback and navigation states.
- Vitest coverage in `src/test/courseDataLoader.test.ts` exercises the id/slug lookup path and the normalization guard against missing lesson metadata.
