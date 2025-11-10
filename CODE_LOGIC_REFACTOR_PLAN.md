# Code Logic Refactor Plan

This plan outlines targeted refactors to simplify the data layer, remove duplication, and standardize async and error patterns.

## Objectives
- Reduce duplicate API client usage (fetch vs axios) and converge on shared utilities.
- Centralize error handling with a single `ApiError` shape.
- Replace chatty per-event updates with batching for progress and analytics.
- Retire legacy localStorage identity reads where safe.

## Current Findings
- HTTP clients
  - `src/utils/apiClient.ts` (fetch) — now supports timeouts and cancellation; normalizes snake/camel; throws `ApiError`.
  - `src/lib/apiClient.ts` (axios) — unified headers; now wraps errors into `ApiError`.
  - `src/lib/api.ts` — thin wrappers still pointing to fetch client.
- Identity
  - Centralized via `src/utils/requestContext.ts` with secure storage + Supabase + legacy fallback.
- Progress/Analytics
  - Existing `progressService` posts snapshots and single events.
  - New `batchService.ts` adds client-side queues for progress and analytics.
- Storage
  - Non-sensitive localStorage usages remain for autosave/video resume/settings — acceptable, keep documented.

## Proposed Refactors
1. Service consolidation
   - Move per-event progress calls to `batchService.enqueueProgress`. Keep snapshot endpoint for periodic rollups.
   - Update analytics adapters to use `enqueueAnalytics`.
2. Remove duplication
   - Ensure all service modules obtain headers from `buildAuthHeaders`.
   - Prefer `apiRequest` for new calls; keep axios client for places leveraging interceptors, but standardize error handling (done).
3. Async patterns
   - Adopt AbortController `timeoutMs` in all hot-path calls (course load, progress flush).
   - Normalize retries via `NetworkErrorHandler` or React Query retry knobs, not ad-hoc setTimeouts.
4. Dead code / cleanup
   - Prune unused imports flagged by lint in admin/server paths.
   - Replace any remaining direct `fetch` usages with `apiRequest`.

## Migration Sequence
1) Wire CoursePlayer progress → `batchService.enqueueProgress` with visibility/unload flush.
2) Update analytics event emitters to `enqueueAnalytics`.
3) Remove obsolete single-event progress posts from `progressService` once parity is confirmed.
4) Tighten typing where `any` is used (batch service payloads, surveyService types).

## Acceptance Criteria
- CoursePlayer uses batching in place of per-event POSTs.
- All axios/fetch errors surface as `ApiError`.
- Lint warnings for dead imports reduced by 90% in touched modules.
- No regression in progress snapshot functionality.
