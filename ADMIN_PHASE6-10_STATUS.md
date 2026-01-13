# Admin Program – Phases 6–10 Execution Status

_Updated: 2026-01-13_

This log captures the concrete changes shipped in this pass plus what is still pending from the Phase 6–10 playbooks. Each section lists the core requirements, current status, tangible evidence, and any follow-ups needed before the next deployment window.

---

## Phase 6 – Data Integrity & Org-Scoped Remediation

| Requirement | Status | Evidence | Follow-up |
| --- | --- | --- | --- |
| Remove `organization_id IS NULL` fallbacks from analytics views/materialized data | ✅ Done | `supabase/migrations/20260113_remove_null_org_fallbacks.sql` rebuilds `view_course_*`, `view_lesson_dropoff`, `view_admin_overview`, and refreshes `org_enrollment_stats_mv` with `org_id` filters. | Monitor prod refresh time after deployment (expected <5s). |
| Ensure batched progress ingestion never writes NULL `org_id` | ✅ Done | Same migration redefines `public.upsert_progress_batch` to reject events lacking UUID `org_id`. | Staging run of `supabase db reset` before go-live. |
| API enforcement for progress batch payloads | ✅ Done | `/api/client/progress/batch` now normalizes events, validates `org_id`, and calls `supabase.rpc('upsert_progress_batch', …)` with byte + size limits (`server/index.js`). | Add integration test coverage (tracked in TODO). |

## Phase 7 – Analytics Hardening & Observability

| Requirement | Status | Evidence | Follow-up |
| --- | --- | --- | --- |
| Sanitize/tokenize PII before analytics persistence | ✅ Done | `scrubAnalyticsPayload` hashes sensitive keys and is applied in `/api/analytics/events` + `/api/analytics/events/batch` (`server/index.js`). | Extend field list if new payload keys appear. |
| Require org context for analytics ingestion | ✅ Done | `/api/analytics/events*` returns 400 when `org_id` missing/invalid and stores only UUID-backed rows. | Add client telemetry to surface 400s (pending). |
| Analytics batch endpoint parity | ⚠️ Still placeholder | Server now validates/sanitizes batch payloads but still ACKs without persistence. | Wire to Supabase ingestion queue (tracked in Phase 7 backlog). |

## Phase 8 – Performance & Batching Optimization

| Requirement | Status | Evidence | Follow-up |
| --- | --- | --- | --- |
| Progress batch endpoint uses stored procedure + metrics | ✅ Done | `/api/client/progress/batch` calls `upsert_progress_batch`, enforces payload size, and records `recordProgressBatch` metrics (`server/index.js`). | Perf-test with `tests/perf/progress-batch.js` before prod deploy. |
| Org-aware validation in ingestion pipeline | ✅ Done | Server rejects events without UUID `org_id`; stored proc enforces same. | Monitor logs for `invalid_events` response to ensure clients comply. |

## Phase 9 – Resiliency, Offline & Runtime Health

| Requirement | Status | Evidence | Follow-up |
| --- | --- | --- | --- |
| Real-time runtime health stream | ✅ Done | `/api/health/stream` SSE endpoint emits derived status with heartbeats and feature-flag metadata; `buildHealthPayload` consolidates Supabase/storage/offline queue health (`server/index.js`). | Hook client `runtimeStatus` to EventSource (pending UI work). |
| Health payload exposes org enforcement + analytics lag | ✅ Done | Health snapshot includes `orgEnforcement`, `analyticsIngestLagMs`, and offline backlog data. | Add Grafana panel subscribers once client consumes. |
| Offline queue telemetry wiring | ✅ Done | `getOfflineQueueHealth` + `getMetricsSnapshot` plumbing ensures `/api/diagnostics/metrics` + SSE share consistent backlog + thresholds. | Service worker + UI hooks tracked in Phase 9 UI issues. |

## Phase 10 – Go-Live Readiness

| Gate | Status | Notes |
| --- | --- | --- |
| Database artifacts | ✅ Migration `20260113_remove_null_org_fallbacks.sql` created; run `supabase db reset` in CI before merge. |
| Feature flags & envs | ⚠️ Pending | Need to set `PROGRESS_BATCH_MAX_SIZE/BYTES`, `HEALTH_STREAM_INTERVAL_MS`, and `ANALYTICS_PII_SALT` in Railway + Netlify before deploy. |
| Monitoring & PagerDuty wiring | ⚠️ Pending | Grafana panel + PagerDuty rule for `analyticsIngestLagMs` still needs creation (Phase 10 task tracker). |
| Final smoke + k6 runs | ⚠️ Pending | Rerun `k6` scenarios once staging migration applied. |

### Recommended Go-Live Steps
1. **Apply migrations** through `20260113_remove_null_org_fallbacks.sql` in staging, verify analytics views return only org-scoped rows, then promote to production.
2. **Deploy server** so new `/api/client/progress/batch`, `/api/health/stream`, and analytics sanitization code are live. Confirm SSE subscription from admin UI or curl.
3. **Set env vars** (`PROGRESS_BATCH_MAX_SIZE`, `PROGRESS_BATCH_MAX_BYTES`, `ANALYTICS_PII_SALT`, `HEALTH_STREAM_INTERVAL_MS`) across Railway/Netlify to match defaults checked into code.
4. **Smoke test** batched progress ingestion (happy path + invalid org) and observe `recordProgressBatch` metrics via `/api/diagnostics/metrics`.
5. **Roll forward monitoring**—add Grafana alert on `analyticsIngestLagMs > 120000` and hook to PagerDuty before flipping flags globally.
6. **Document** the remaining manual steps (client runtime SSE wiring, analytics batch persistence) in the Phase 7/9 backlog so stakeholders know what’s next.

Once the flagged follow-ups are closed, all mandatory requirements from ADMIN_PHASE6–10 will be in a “ship-ready” state.
