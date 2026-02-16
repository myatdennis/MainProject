# Lesson Validation Matrix

The LMS enforces the same field requirements on both the frontend (`src/validation/courseValidation.ts`) and backend (`server/lib/courseValidation.js`). Use the table below to understand what must be present before a course can be saved or published.

| Lesson type | Draft requirements | Publish requirements |
| ----------- | ------------------ | -------------------- |
| **Video** | `content.videoUrl` or uploaded media reference. | Everything from draft **plus** `content.videoAsset` with `storagePath`, `bucket`, `bytes`, and `mimeType`. Optional metadata (`checksum`, `uploadedAt`, `source`) shows as warnings if missing. |
| **Text** | `content.textContent` or `content` must contain non-empty learner-facing text. | Same as draft. Modules can satisfy the “publishable media” rule with a text lesson that has content. |
| **Quiz** | At least one entry in `content.questions` with question text and answer options. | Same as draft. |
| **Document/Download** | A valid file URL: one of `documentUrl`, `fileUrl`, `downloadUrl`, or `url`. | Same as draft. |
| **Interactive / Scenario** | Must provide one of: `interactiveUrl`, `elements[]`, `scenarioText`, or `options[]`. | Same as draft. |

### Module-level rule

When publishing, every module must include at least one lesson that passes the “publishable media” check (video with metadata, quiz with questions, or text lesson with content). This is enforced via `lessonHasPublishableMedia` in both validation files.

### Autosave & persistence

The builder always canonicalizes lesson data before persisting (see `canonicalizeLessonContent` in `src/utils/lessonContent.ts`), so:

- Text editors write to both `content` and `textContent`.
- Video uploads generate the full `videoAsset` payload that the validator expects.
- Quiz editors normalize options and correct answer indexes.

Use this matrix during design reviews or when onboarding authors so the UI copy, validation panel, and error toasts all align with the enforceable rules.
