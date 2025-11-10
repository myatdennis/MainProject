## API Batching & Caching Plan

### Objectives
1. Reduce high-frequency network calls for incremental progress and analytics events.
2. Provide consistent, cache-friendly endpoints with predictable invalidation keys.
3. Support eventual request cancellation & timeout controls without rewriting existing call sites.
4. Maintain backward compatibility: existing single-event endpoints keep working until full migration.

### Target Event Categories For Batching
| Category | Current Pattern | Pain Point | Proposed Batch Endpoint | Batch Trigger Heuristics |
|----------|-----------------|------------|-------------------------|--------------------------|
| Lesson progress (percent/position) | Multiple per minute from `CoursePlayer` time updates | Chatty; duplicates; no debounce | `POST /api/client/progress/batch` | Flush every 5s or on page hide/unload; max 25 events per payload |
| Lesson completion | Immediate single POST inside completion flow | Low volume (keep single) | (Included in progress batch if queued) | Always flush immediately if completion occurs |
| Course resumed/started/completed analytics | Separate calls via analytics DAL | Burst at start / end | `POST /api/analytics/events/batch` | Flush after 3 events or 3s timeout |
| Generic user analytics (navigation, bookmarks) | Individual calls | Overhead & latency | `POST /api/analytics/events/batch` | Coalesce by 3s window |
| Assignment progress updates | Local calc + potential future remote update | Potential future expansion | `POST /api/client/assignments/progress/batch` (phase 2) | Flush when overall course percent changes by >=5% or after lesson completion |

### Data Shapes

#### Progress Event (single)
```jsonc
{
  "type": "lesson_progress",          // or "lesson_completed"
  "courseId": "foundations",          // canonical course id
  "courseSlug": "foundations-of-inclusive-leadership", // for legacy compatibility
  "lessonId": "lesson-video",         // unique lesson id
  "userId": "demo-user",              // normalized lowercase id/email
  "percent": 42,                        // 0..100 integer
  "position": 185,                      // seconds into lesson (optional)
  "clientEventId": "uuid-or-hash",     // idempotency; client generated
  "timestamp": 1730956800000            // ms epoch
}
```

#### Progress Batch Request
```jsonc
{
  "events": [ /* array of Progress Event */ ]
}
```

#### Progress Batch Response
```jsonc
{
  "accepted": ["clientEventId1", "clientEventId2"],
  "duplicates": ["clientEventIdExisting"],
  "failed": [{"id": "clientEventIdX", "reason": "validation_error"}]
}
```

#### Analytics Event (single)
```jsonc
{
  "type": "course_started" | "course_resumed" | "course_completed" | "user_progress" | "user_bookmark" | "error_occurred",
  "courseId": "foundations",
  "userId": "demo-user",
  "data": { /* arbitrary small JSON */ },
  "clientEventId": "uuid-or-hash",
  "timestamp": 1730956800000
}
```

#### Analytics Batch Request / Response
Same envelope as progress batch.

### Server-Side Implementation (Phase 1)
Add handlers inside `server/index.js` near existing progress endpoints:
```js
app.post('/api/client/progress/batch', (req, res) => { /* validate, dedupe, persist, return status */ });
app.post('/api/analytics/events/batch', (req, res) => { /* validate, dedupe, persist */ });
```
Use existing `e2eStore.progressEvents` Set for idempotency (store `clientEventId`).
Validation: reject payloads > 25 events or events older than 24h.
Rate limit: reuse `checkProgressLimit` per user (aggregate tokens consumed = number of events).

### Client-Side Batching Service (Phase 1)
Create `src/services/batchService.ts`:
- Queue arrays: `progressQueue`, `analyticsQueue`.
- `enqueueProgress(event)`, `enqueueAnalytics(event)` adds & schedules flush.
- Flush strategy:
  - Progress: flush if queue length >= 10, or 5s elapsed, or `visibilitychange` hidden, or `beforeunload`.
  - Analytics: flush if length >= 8 or 3s elapsed.
- Use `apiRequest` with timeouts & abort support (added in later todo) to send batch.
- On success: remove accepted ids; on partial failure: retain failed for next flush with exponential backoff (cap 30s).

### React Query Caching Strategy
New keys to extend `queryKeys`:
```ts
batch: {
  progressPreview: (userId: string, courseId: string) => ['batch','progress','preview', userId, courseId],
  analyticsPreview: (userId: string) => ['batch','analytics','preview', userId]
}
```
These are ephemeral read models (OPTIONAL). In Phase 1 we may skip adding dedicated preview endpoints and just keep queues in memory; keys reserved for future.

### Invalidation Rules
| Mutation | Invalidate Keys |
|----------|-----------------|
| Progress batch flush | `queryKeys.courses.progress(userId, courseId)` for affected pairs |
| Lesson completion | Same as above + assignments progress key (future) |
| Analytics batch flush | (No invalidation now; events append-only) |

### Error & Retry Strategy
| Error Type | Handling |
|------------|----------|
| Network failure | Retain queue; schedule retry (linear backoff: 2s, 5s, 10s, 20s) |
| 4xx validation | Drop offending events; log to console with summary |
| 429 rate limit | Requeue all; backoff + jitter (base 5s + random 0-2s) |
| 5xx server | Keep queue; escalate after 3 consecutive failures (log warning) |

### Security & Integrity
- Enforce `clientEventId` presence – reject events without it.
- Cap body size: server rejects if JSON > 64KB or events > 25.
- Ignore duplicate IDs (return in `duplicates`).
- Ensure `percent` bounded 0–100; coerce floats via `Math.round`.

### Phase Roadmap
| Phase | Deliverables |
|-------|--------------|
| 1 | Plan document (this), batching service client stub, server endpoints (E2E/demo only) |
| 2 | Integrate CoursePlayer progress -> batching (replace direct per-update analytics user_progress), add abort/timeout per request |
| 3 | Persist batched events in Supabase tables (production path) + preview read endpoints |
| 4 | Assignment progress batching + React Query invalidations + optimistic UI hints |

### Minimal Client Stub (Preview)
```ts
// src/services/batchService.ts (excerpt outline)
type ProgressEvent = { type: 'lesson_progress'|'lesson_completed'; courseId: string; courseSlug?: string; lessonId: string; userId: string; percent: number; position?: number; clientEventId: string; timestamp: number; };
type AnalyticsEvent = { type: string; courseId?: string; userId: string; data?: any; clientEventId: string; timestamp: number; };

const progressQueue: ProgressEvent[] = [];
const analyticsQueue: AnalyticsEvent[] = [];

export function enqueueProgress(evt: Omit<ProgressEvent,'clientEventId'|'timestamp'> & { clientEventId?: string; timestamp?: number }) {
  const event: ProgressEvent = { ...evt, clientEventId: evt.clientEventId || crypto.randomUUID(), timestamp: evt.timestamp || Date.now(), percent: Math.min(100, Math.max(0, Math.round(evt.percent))) };
  progressQueue.push(event); scheduleProgressFlush();
}
```

### Acceptance Criteria (Phase 1)
- Document committed.
- Stub file created (ready for future integration) without breaking existing builds.
- No runtime behavior change yet (opt-in integration forthcoming).

---
Prepared: Phase 1 of API batching & caching task.
Next: Implement server endpoints + stub client service (if approved) then integrate CoursePlayer progress calls.
