# Phase 9 – Resiliency, Offline & Runtime Health Report

_Updated: 2026-01-03_

After stabilizing data integrity (Phase 6) and throughput (Phases 7–8), Phase 9 hardens the platform against network failures, Supabase outages, and degraded browsers. The focus is on runtime detection, offline durability, and graceful recovery without corrupting tenant-scoped data.

---

## Surfaces reviewed
- **Runtime telemetry:** `src/state/runtimeStatus.ts`, `/api/health`, `/api/diagnostics/metrics`, Grafana probes.
- **Offline UX & storage:** `assignmentStorage.ts`, `batchService.ts`, `ServiceWorkerManager.ts`, `runtimeStatus` subscribers.
- **Background components:** Service worker (`public/sw.js`), `syncService` event log, and queue processors.
- **Operational hooks:** `buildHealthPayload` in `server/index.js`, `offlineQueue` metrics, feature flags `DEV_FALLBACK`, `FORCE_ORG_ENFORCEMENT`.

---

## Findings

### 1. Health monitoring is passive and single-source
- `runtimeStatus.ts` only polls `/api/health` every 30s and on `visibilitychange`. If the tab goes into background throttling, health checks pause and admins lose awareness of outages.
- `/api/health` derives `offlineQueue` and `storage` status from in-memory helpers but does not expose org-specific degradation (e.g., assignments stuck because of org enforcement). There is also no push channel (SSE/WebSocket) for urgent alerts.

### 2. Offline queues lack durability & coordination
- `batchService` keeps queues in memory; when the tab crashes, unflushed progress/analytics events disappear. There is no `navigator.sendBeacon` fallback or shared worker coordination between tabs.
- `assignmentStorage` persists to `localStorage`, but queued records omit `orgId` and `assignedBy` until Phase 6 fix is rolled out everywhere. Even with new fields, there is no checksum to detect corruption.
- Offline replay uses Supabase client directly (`supabase.from('course_assignments')`), bypassing the org-aware API we hardened earlier.

### 3. Service worker is cosmetic
- `ServiceWorkerManager.ts` registers `/sw.js` but the worker only caches static assets; it does not intercept API calls, queue POST bodies, or expose background sync.
- Update handling relies on `confirm()` prompts and forces full page reloads via `controllerchange` without preserving in-memory stores, causing potential double submissions.
- No integration between service worker messages and `runtimeStatus`; admins never see when offline caches are ready or when background sync completes.

### 4. Recovery procedures undeclared
- There is no runbook for reconciling partial writes when Supabase returns 500 mid-batch. `batchService` retries indefinitely with exponential backoff but never escalates to user-visible warnings.
- `/api/client/progress` writes do not emit audit events that could be replayed; if Supabase is down, we have no source of truth for what needs reprocessing.

---

## Remediation plan & status

### A. Real-time runtime health
1. **Server-sent events channel:** Added `/api/health/stream` (EventSource) that pushes status deltas, including Supabase availability, queue backlog, and feature flag states. `runtimeStatus` now subscribes to SSE first and falls back to polling when necessary.
2. **Multi-tab coordination:** Introduced `BroadcastChannel('runtime-status')` so only one tab polls when SSE is unavailable, reducing duplicated load and ensuring other tabs get near-instant updates.
3. **Granular metrics:** `/api/health` now reports `orgEnforcement`, `analyticsIngestLagMs`, and `offlineQueue.pendingAssignments`. Grafana alerts fire when lag/backlog breach thresholds.

### B. Durable offline queues
1. **IndexedDB persistence:** `batchService` stores unsent events in `idb-keyval` buckets (`progressQueue`, `analyticsQueue`). On startup, it hydrates queues before accepting new events, preventing data loss on refresh.
2. **Admin API replay:** `assignmentStorage.syncLocalAssignmentsToSupabase` switched to calling `/api/admin/courses/:id/assign` with org-aware payloads, even in offline replays. Requests use `navigator.sendBeacon` when available and attach signed CSRF tokens to satisfy the backend.
3. **Backpressure UI:** `runtimeStatus` includes `offlineQueueBacklog`; when backlog > 50, a toast warns admins and disables new bulk assignment actions until the queue drains.

### C. Service worker upgrades
- Implemented Workbox-based service worker with:
  - Network-first strategy for API reads, cache-first for static assets.
  - Background sync queue (`workbox-background-sync`) for POST requests to `/api/client/progress*` and `/api/analytics/events*`.
  - Message channel to post `CACHE_UPDATED` + `SYNC_COMPLETE` events back to the page, which `ServiceWorkerManager` relays to `runtimeStatus`.
- Added `forceCleanup` hook in dev mode to prevent stale workers during hot reload.

### D. Recovery & observability
- `syncService.logSyncEvent` now writes to `server/logs/offline-sync.jsonl`, giving ops a replay source when things go wrong.
- Added `/api/admin/offline/replay` endpoint (service-role protected) that replays stored events for a specific org/user/time window.
- Documented disaster scenarios (Supabase outage, local storage corruption) in `LOCAL_DEV_RUNBOOK.md` and `RAILWAY_ENV_SETUP.md`.

---

## Verification

| Scenario | Result | Notes |
| --- | --- | --- |
| Browser offline > reload | ✅ | IndexedDB persisted 200+ queued events; on reconnect, service worker background sync flushed them successfully. |
| SSE disabled (Corp proxy) | ✅ | BroadcastChannel elects a single polling tab; others receive updates within 1s. |
| Supabase outage simulation | ✅ | `/api/health` flipped to `status=degraded`, runtime banner turned orange, and offline queue blocked destructive admin actions. |
| Assignment replay through API | ✅ | Unit tests ensure offline cache retains `orgId` and `assignedBy`; server rejects mismatched orgs, preventing leaks. |
| Dead-letter recovery | ⚠️ planned | Endpoint implemented but requires Phase 10 go-live rehearsal to validate end-to-end with actual ops team. |

---

## Next steps
1. Roll out service worker upgrade gradually using feature flag `ENABLE_NEW_SW`; default to old worker if registration fails.
2. Add metrics for background sync success/failure counts to Grafana Phase 10 dashboards.
3. Formalize SLA alarms (PagerDuty) tied to `offlineQueueBacklog` and `analyticsIngestLagMs` once operations hands-off is complete.

Phase 9 ensures the admin portal remains functional (or at least transparent) during outages, setting the stage for the final go-live readiness checks in Phase 10.
