# Phase 4 – Media & Document Pipeline Audit

_Updated: 2025-12-30_

## Scope & references
- **Client surfaces:** `AdminCourseBuilder` (video/resource upload UI), `CourseEditModal` (content scaffolding), `EnhancedVideoPlayer`, `LMSModule`, `CoursePlayer`, `documentService`, `ServiceWorkerManager`.
- **Server endpoints:** `/api/admin/courses/:courseId/modules/:moduleId/lessons/:lessonId/video-upload`, `/api/admin/documents/upload`, `/api/admin/documents` CRUD, Supabase storage migrations under `supabase/migrations/*`.
- **Storage:** Supabase buckets `course-videos`, `course-resources`, and default `documents` bucket used by the server/client.

Goal: validate that video/document ingestion, storage, and playback are reliable for admins and learners, with special attention to offline fallbacks, file-size enforcement, and data parity between client helpers and backend APIs.

---

## 1. Video creation & ingestion

### 1.1 Builder experience
1. `AdminCourseBuilder` lets authors add video lessons via inline editors (lines 1380–1510) and calls `handleVideoUpload` when a file is chosen.
2. `handleVideoUpload` enforces a **hard-coded 50 MB limit** even though the Supabase bucket allows 100 MB (from `COURSE_VIDEO_UPLOAD_MAX_BYTES` default). Large but valid uploads fail client-side with no retry/resume.
3. Upload order:
   - Attempt POST to `/api/admin/courses/:courseId/modules/:moduleId/lessons/:lessonId/video-upload` (multipart FormData, cookie-auth).
   - If that fails, fallback to direct Supabase storage SDK `course-videos` bucket using the browser’s anon key.
   - If both fail, fallback stores a temporary `blob:` URL in-memory and warns the admin (“saved locally”).
4. Regardless of path, builder only persists `content.videoUrl`, `fileName`, `fileSize`. **Storage path, bucket, mime-type, checksum, and upload source are never stored.**
5. `CourseEditModal`’s standalone content builder never uploads files at all—it marks uploaded videos as `videoUrl = 'uploaded:<filename>'`, causing mismatched data once the builder tries to validate/publish.

**Gaps / impact**
- No resumable uploads or chunking; high-latency or >50 MB files fail with little guidance.
- Missing metadata prevents later clean-up, signed URL refresh, or migration to a CDN/HLS pipeline.
- The fallback `blob:` URLs are non-persistent; once the admin closes the tab, the lesson references a dead link.
- Authors can create course lessons with fake `uploaded:` URLs via the modal, and builder validation doesn’t catch them until publish time.

**Recommendations**
1. Move upload orchestration into a dedicated `mediaService` that always records `{ storagePath, bucket, mimeType, bytes, checksum }` alongside the lesson.
2. Increase the enforced client limit to match Supabase (100 MB) and show progressive upload UI with pause/resume (e.g., Tus/Upload.js or Supabase Storage large-file guide).
3. When falling back to local blobs, queue the upload via `ServiceWorkerManager` + Background Sync so offline authors can retry automatically.
4. Remove the `CourseEditModal` stand-alone upload path or reuse the builder uploader so lesson content is normalized before save.

---

## 2. Server ingestion & storage configuration

### 2.1 Upload endpoint (`video-upload`)
- Uses `multer.memoryStorage()` with `COURSE_VIDEO_UPLOAD_MAX_BYTES` (default 50 MB) → inconsistent with bucket limit (100 MB). Files between 50–100 MB are accepted by storage but rejected before reaching Supabase.
- Requires `authenticate` + `requireAdmin`, but does **not** verify that the posted `courseId/moduleId/lessonId` belong to the admin’s org. Malicious admins could overwrite another org’s lesson video if they guess IDs.
- Upload path = `courses/<course>/<module>/<lesson>-<timestamp>/<filename>`; there’s no dedupe or versioning beyond timestamp.
- Response returns `{ publicUrl, storagePath }` yet builder discards `storagePath`.

### 2.2 Storage migrations
- `20250919235815_sunny_sunset.sql` creates buckets `course-videos` and `course-resources` with public read + authenticated write policies.
- `20250920000532_velvet_lake.sql` upgrades limits/MIME lists.
- **Server config mismatch:** `DOCUMENTS_BUCKET` defaults to `'documents'`, but migrations never create that bucket. Document uploads go to whatever bucket exists (likely default Supabase “documents”), while client fallbacks sometimes call `.from('documents')` and sometimes `.from('course-resources')`. This inconsistency causes 404s when the wrong bucket is provisioned.

### 2.3 Document upload endpoint
- `/api/admin/documents/upload` writes to `DOCUMENTS_BUCKET` (default `'documents'`), generates signed URLs, and returns TTL metadata.
- Front-end DAL/service still seed documents by directly writing to `/api/admin/documents` without ensuring storage objects exist.
- Supabase policies allow **public reads**, meaning any unauthenticated user can hotlink course resources. There’s no signed URL requirement or domain-restricted CDN.

**Recommendations**
1. Align environment defaults with migrations: set `DOCUMENTS_BUCKET=course-resources` (or rename the bucket) and update client/services to use the same constant.
2. Raise the server `multer` limit to 100 MB (or better, read from Supabase bucket metadata so they never drift).
3. Add org/ownership checks inside the upload endpoint before writing to storage.
4. Store upload metadata (path, bucket, TTL) in the lesson’s `content_json` so playback can request refreshed signed URLs instead of relying on public objects.
5. For documents, enforce signed URLs + short TTLs by default and add a background job to refresh `url_expires_at` before expiry (server already has helper `refreshDocumentSignedUrls`, but it is only invoked on download). Consider toggling `public=false` and fronting via signed URLs exclusively.

---

## 3. Playback & delivery

### 3.1 Learner experience
- `EnhancedVideoPlayer` and `CoursePlayer` render a standard `<video src={content.videoUrl}>` tag; there’s no adaptive bitrate, DRM, or signed URL refresh. If the stored URL expires (or points to `blob:`), learners get a blank player.
- Resume logic stores progress in `localStorage` only; there’s no server-side playback position for cross-device continuity unless `progressService` happens to sync before closing.
- Captions/transcripts rely on whatever text the author typed; there’s no auto-generation or VTT ingestion.
- `ServiceWorkerManager` doesn’t pre-cache video assets or respond to fetch events, so “offline ready” toasts are misleading—videos still fail when offline.

### 3.2 Analytics & quotas
- No instrumentation tracks upload bandwidth, storage costs, or playback errors. If Supabase throttles (429), the UI simply shows a toast.
- Because video URLs are public, any user could share them externally, counting against bandwidth quotas without analytics visibility.

**Recommendations**
1. Store `{ storagePath, bucket }` and request **signed URLs per session** (Supabase `createSignedUrl`). Refresh when `needsSignedUrlRefresh` (same helper used for documents) is true.
2. For production, generate HLS playlists (FFmpeg via Supabase Edge Functions or Render worker) and serve via a CDN with signed tokens.
3. Move resume/progress to server by default: whenever `onProgress` exceeds thresholds, call `progressService.syncProgressSnapshot` immediately rather than debounced local storage only.
4. Update the service worker to intercept video/resource fetches and either stream from cache (for small files) or show clear offline messaging.

---

## 4. Documents & downloadable resources

### Current behavior
- Builder `handleFileUpload` tries Supabase storage `course-resources`; on failure it creates a `blob:` URL (same ephemeral problem as videos).
- `documentService` and `dal/documents` sometimes hit `/api/admin/documents/upload` (good) and sometimes skip straight to `POST /api/admin/documents` with external URLs (seed data). No validation ensures `metadata.storagePath` exists when visibility is `org`/`user`.
- Signed URLs returned from the upload endpoint are stored (`url`, `urlExpiresAt`), but **there’s no automatic refresh when learners download documents** unless they go through `/api/admin/documents/:id/download` which calls `refreshDocumentSignedUrls`. Direct links will expire silently.

### Recommendations
1. Enforce a single document ingestion path: always upload via `/upload`, store the `storagePath`, and require downloads to go through the signed URL controller.
2. When admins attach external URLs, validate MIME/type + enforce HTTPS so learners don’t hit mixed content.
3. Build a cron/Edge Function that scans `documents` for soon-to-expire signed URLs and refreshes them proactively (the helper already exists server-side).
4. Extend the builder resource UI to show upload status, storage path, and TTL; allow re-signing from the admin portal without deleting and re-uploading.

---

## 5. Risk summary & remediation backlog

| Risk | Impact | Priority fix |
| --- | --- | --- |
| Video metadata discarded in lessons | Impossible to rotate URLs, audit storage, or clean up orphaned files. | Store `{bucket, storagePath, mime, bytes, uploadedBy, uploadedAt}` in `content_json`; update CourseService normalization to preserve it. |
| Bucket naming drift (`documents` vs `course-resources`) | Uploads succeed locally but fail in production when the target bucket doesn’t exist. | ✅ Default buckets now set to `course-resources`/`course-videos` and health check verifies both exist at startup (Dec 31 2025). |
| Public read for all media | Anyone with a link can hotlink or exhaust bandwidth; no revocation path. | Flip buckets to `public=false`, serve via signed URLs, and audit existing assets for exposure. |
| Offline fallbacks silently drop data | `blob:` URLs break after refresh; admins think the video is saved. | Persist offline uploads into IndexedDB + Background Sync, surface a “pending uploads” list, and warn clearly before leaving the page. |
| Multer < bucket limit | Support can’t explain why 75 MB uploads fail. | Read bucket limit from Supabase metadata (via REST) and set multer limit dynamically; show config mismatch in admin diagnostics. |
| Missing org scoping on upload API | One admin can overwrite another org’s content. | Use `requireOrgAccess` with the course’s `organization_id`, or derive it from Supabase before accepting uploads. |
| Signed URL refresh only on download endpoint | Learners hitting stale direct URLs see 403/404. | Force LMS to fetch documents/videos via proxy endpoints that refresh signed URLs on demand. |

---

## Next steps (Phase 5 preview)
- With media plumbing documented, Phase 5 will tackle permissions + org scoping. Key dependency: decisions above (bucket privacy + org validation) should be implemented so we can enforce org-level access consistently across CRUD, publish, and assignment flows.
- Begin designing an organization-aware media registry table (`course_media_assets`) to track ownership, upload metadata, and lifecycle hooks (soft delete, TTL checks). This will make future migrations (Phase 6 data integrity) straightforward.
- Prototype a job/Edge Function that scans buckets for orphaned files (no matching lesson/document) and reports them in the admin diagnostics panel.

Once these backlog items start landing, we can confidently harden streaming, analytics, and offline guarantees without risking lost uploads or public data leaks.
