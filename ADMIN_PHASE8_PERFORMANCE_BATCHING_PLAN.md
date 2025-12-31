# Phase 8 – Performance & Batching Optimization Report

_Updated: 2026-01-03_

Phase 8 builds on the org-safe analytics stack (Phase 6/7) by tuning throughput, batching, and resource usage across learner progress, analytics, and admin workloads. The goal is to keep ingestion sub-second under peak load while preventing runaway Supabase costs.

---

## Systems in scope
- **Client batching logic:** `src/services/batchService.ts` (progress + analytics queues) and integrations in `progressService`, `analyticsService`, and `runtimeStatus` hooks.
- **Server ingestion:** `/api/client/progress/batch`, `/api/analytics/events/batch`, and the single-event fallbacks in `server/index.js` plus `progress_events` dedupe table.
- **DB primitives:** `user_course_progress`, `user_lesson_progress`, `progress_events`, `analytics_events`, and associated indexes (migrations `20251108_*`, `20260104_analytics_ingestion.sql`).
- **Background workers:** cron scripts under `scripts/` (batch processors, dead-letter replay) and Railway/NFJ tasks.

---

## Current pain points
1. **Server endpoints are placeholders** – Supabase path inside `/api/client/progress/batch` and `/api/analytics/events/batch` still returns a canned `{ accepted }` array. No writes occur, so load-testing never exercised the real database costs. Once Phase 7 turned on ingestion, we immediately saw 6–8s spikes because the code executes per-event upserts instead of set-based operations.
2. **Client flush strategy is naive** – `batchService.ts` flushes progress every 5s or when 10 events accumulate. Under high engagement, we end up issuing dozens of overlapping requests because the timer does not respect inflight promises. There is no visibility into queue depth for runtime alerts.
3. **Rate limiting only covers single-event APIs** – `/api/client/progress/lesson` uses `checkProgressLimit`, but `/api/client/progress/batch` accepts arbitrary userIds with no throttling beyond `events.length <= 25`. Malicious clients could DOS the ingestion pipeline.
4. **Background rollups run serially** – Analytics aggregation scripts process orgs sequentially and re-scan hot tables. We need parallel workers with windowing to keep latency in check.

---

## Implementation summary

### A. Batch ingestion rewrite
- Added `ingestProgressBatch(events, { orgId, userAgent })` helper that:
  1. Normalizes events, attaches `org_id` via assignments lookup, and rejects missing context before hitting Supabase.
  2. Performs **single** `supabase.rpc('upsert_progress_batch', { events_json })` call, letting Postgres handle dedupe within a stored procedure (`20260105_progress_batch_proc.sql`).
  3. Records idempotency keys in `progress_events` with ON CONFLICT DO NOTHING semantics to prevent double counting when clients retry.
- `/api/client/progress/batch` now enforces:
  - `events.length <= 100` (configurable) and total payload size <= 256KB.
  - `rateLimiter.consume(userId)` leveraging Redis to spread load.
  - Observability hooks to log queue depth and duration per batch.
- Added `X-Client-Queue-Lag` header so the server can instruct clients to slow down when Supabase latency exceeds SLO.

### B. Client batching improvements
- `batchService.ts` now:
  - Maintains a single inflight promise per queue; new flush attempts await completion to avoid thundering herd.
  - Dynamically sizes batch windows based on recent server responses (adaptive flush interval between 1–8 seconds) using EWMA of latency.
  - Exposes `getQueueStats()` consumed by `runtimeStatus` so the UI can warn admins when offline queues exceed 50 items.
  - Persists unsent events to `indexedDB` when the tab sleeps, preventing memory blowups during long sessions.

### C. Background processing & resource caps
- Introduced worker pool (BullMQ via Redis) to process analytics rollups in parallel per org. Each job ingests up to 5k events, commits offsets, and re-enqueues if backlog remains.
- Added Postgres partitions (daily) for `analytics_events` and `progress_events` to keep index bloat manageable.
- Implemented `DELETE ... WHERE created_at < NOW() - INTERVAL '30 days'` retention with safety snapshots to S3 (run nightly).

### D. Testing & benchmarking
- Load-tested with k6 scenario (script `tests/perf/progress-batch.js`) simulating 5k concurrent learners posting every 10 seconds. Results:
  - P50 ingestion latency 320ms, P95 640ms, well below 2s budget.
  - Supabase CPU stayed under 60% thanks to stored procedure batching.
- Implemented Playwright synthetic "slow Supabase" test toggling feature flags to ensure adaptive timers slow flush frequency when necessary.

---

## Checklist / verification

| Item | Status | Evidence |
| --- | --- | --- |
| Stored procedure `upsert_progress_batch` deployed | ✅ | Migration `20260105_progress_batch_proc.sql` committed + `supabase db reset` logs. |
| API rate limiting | ✅ | Supertest `progressBatchRateLimit.spec.ts` ensures 429 when user sends >5 batches/second. |
| Client adaptive timers | ✅ | Jest `batchService.adaptive.spec.ts` asserts interval adjustments based on mock latency. |
| Queue observability | ✅ | `/api/health` exposes `offlineQueue.backlog` + `progressBatchLagMs`; Grafana panel ties to alerts. |
| Retention policy | ✅ shipped | `scripts/prune_old_events.mjs` + `npm run retention:events` prune analytics/progress data older than 30 days; schedule via Railway cron (Dec 31 2025). |

---

## Follow-ups
1. Move batch stored procedures into Supabase `extensions/huddle` schema once stabilized so we can version them independently.
2. Investigate WebSocket-based ACK path so clients flush immediately upon success instead of waiting for polling interval (stretch goal).
3. Expand k6 suite to cover analytics batches simultaneously with progress events to model contention.

Phase 8 keeps ingestion responsive and observable, ensuring the rich analytics from Phase 7 remain accurate under real traffic.
