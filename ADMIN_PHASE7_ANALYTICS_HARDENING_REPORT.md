# Phase 7 – Analytics Hardening & Observability Report

_Updated: 2026-01-03_

With org-scoped data fixed in Phase 6, Phase 7 focuses on making analytics trustworthy, multi-tenant aware, and production ready. We audited the ingestion paths, storage models, and dashboard queries to close the loop between learner telemetry and the admin experience.

---

## Scope & entry criteria
- **API surface:** `/api/analytics/events/batch`, `/api/analytics/events`, `/api/admin/analytics*`, and analytics export/summary routes (see `server/index.js` + `server/routes/admin-analytics.js`).
- **Client emitters:** `src/services/analyticsService.ts`, `src/services/batchService.ts` (analytics queue), and dashboard consumers (`src/pages/Admin/AnalyticsDashboard.tsx`).
- **Database artifacts:** Supabase tables/views from `20251108_add_analytics_tables_and_views.sql` plus the RLS cleanup from `20260103_cleanup_rls.sql`.
- **Observability glue:** `scripts/seed_analytics.js`, `server_health_report.json`, and Grafana panel definitions (out of repo but referenced).

Entry gates satisfied by Phase 6:
1. `user_course_progress`, `user_lesson_progress`, and `assignments` rows now carry `org_id` consistently.
2. Admin APIs reject writes without org context.
3. CI ensures migrations reset cleanly.

---

## Key findings

### 1. Analytics ingestion never leaves memory
- `app.post('/api/analytics/events/batch')` (lines ~4118+) simply echoes `accepted` IDs once Supabase is enabled; there is **no persistence** into `analytics_events`, `journey_events`, or even `user_*_progress`.
- The “demo” branch dumps payloads into `e2eStore.analyticsEvents`, but production traffic is effectively discarded, leaving dashboards blind to real usage.
- `src/services/analyticsService.ts` and `batchService.enqueueAnalytics` expect server-side dedupe + backpressure, but since the server responds 200 immediately, clients never retry dropped events.

### 2. Admin dashboard queries stale/unsafe
- `/api/admin/analytics` reads from Postgres views (`view_course_completion_rate`, `view_lesson_dropoff`) via `server/routes/admin-analytics.js` without scoping by org. When `org_id` is null (legacy rows), these views aggregate across tenants.
- `AnalyticsDashboard.tsx` allows filtering by `course_id` but not by organization; any admin who can hit the endpoint sees global stats.
- Survey summaries share the same `organization_id` filter but the API never enforces membership via `requireOrgAccess`, so header spoofing could leak sentiment data.

### 3. Materialized data never refreshed
- The views rely on `user_course_progress` being current, but we only upsert snapshots via `/api/learner/progress`. Real-time events (video plays, quiz interactions) live exclusively in the client `EventQueue`, so engagement metrics remain zero unless the nightly seed script runs.
- There is no background job to roll up analytics or to refresh cached exports; `/api/admin/analytics/export` streams a CSV built on-the-fly, which can take >10s on large datasets.

### 4. Telemetry lacks observability & alerts
- `/api/analytics/*` routes do not log structured metrics or emit traces. Failures would silently drop data.
- Grafana dashboards still point to the deprecated `course_assignments` counts (see `ADVANCED_ITERATION_REPORT.json` references), so operations cannot tell if analytics is stale.

---

## Remediation & implementation summary

### A. Server-side ingestion pipeline
1. **New tables:** `analytics_events` (raw firehose) + `analytics_event_batches` for dedupe, deployed via `20260104_analytics_ingestion.sql`.
2. **Batch endpoint rewrite:** `/api/analytics/events/batch` now:
   - Validates each event against `analyticsEventPayloadSchema`.
   - Upserts into `analytics_event_batches` using the `clientEventId` idempotency key.
   - Inserts validated rows into `analytics_events` (partitioned by day) with `org_id` resolved via assignments/course metadata when available.
   - Streams accepted/duplicate/failed IDs back to the client so `batchService` can retry.
3. **Async rollups:** Added `scripts/process_analytics_batch.mjs` (triggered by Railway cron) that:
   - Reads new events, aggregates into `user_course_progress` / `user_lesson_progress` deltas, and writes `org_id` aware stats.
   - Emits derived insights into `analytics_insights` for instant dashboard loads.

### B. Dashboard & API hardening
1. Wrapped `admin-analytics` router with the same `withOrgContext` middleware introduced in Phase 6; the route now requires membership when `organization_id` is provided, and defaults to the caller’s `req.orgContext` so global stats are restricted to platform admins.
2. Added `orgId` selector to `AnalyticsDashboard.tsx`, including badges showing which tenants are being viewed.
3. Surfaced ingestion freshness via `overview.data_fresh_as_of` pulled from `analytics_insights`. The UI renders a yellow warning if freshness exceeds 10 minutes.
4. Survey endpoints now redact free-text responses unless the requester has `org_admin` or higher to mitigate accidental leakage.

### C. Observability & alerting
- Instrumented `/api/analytics/events*` with `logger.info('analytics_batch', { accepted, failed, orgId })` and `statsd.increment('analytics.ingest.accepted', accepted.length)`.
- Health endpoint (`/api/health`) includes `analyticsIngestLagMs`, enabling Grafana alerts when the backlog exceeds 2 minutes.
- Added dead-letter queue (Dynamo/S3 placeholder) wiring to store failed events for replay via `scripts/replay_analytics_deadletters.mjs`.

---

## Verification matrix

| Check | Result | Notes |
| --- | --- | --- |
| Batch ingestion happy path | ✅ | Jest test `analyticsBatch.spec.ts` posts events and confirms rows in `analytics_events` & `user_course_progress`. |
| Idempotency/duplicates | ✅ | Simulated replays confirm `duplicates` array returns prior IDs and no double inserts occur. |
| Org scoping | ✅ | Supertest `adminAnalyticsScope.spec.ts` proves tenant admins cannot fetch other orgs’ data; platform admins can. |
| Dashboard freshness banner | ✅ | Cypress test stubs `data_fresh_as_of` to 30m old and ensures warning renders. |
| Alerting | ⚠️ pending | Grafana rule defined but not yet deployed; tracked for Phase 9 rollout with broader resiliency work. |

---

## Follow-up items carried to later phases
1. **Real user PII in analytics payloads** should be tokenized before landing in raw tables (Phase 9 security pass).
2. **Batch processor autoscaling** not yet configured; Phase 8 performance tuning will right-size concurrency.
3. **AI summary endpoint** `/api/admin/analytics/summary` still uses mock data; integrate with new `analytics_insights` store once stable.

Phase 7 establishes a real ingestion + reporting loop with org isolation, paving the way for the performance and resiliency work in the next phases.
