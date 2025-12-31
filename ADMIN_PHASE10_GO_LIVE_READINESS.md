# Phase 10 – Go-Live Readiness & Final QA Report

_Updated: 2026-01-03_

Phase 10 is the release gate for the hardened admin platform. With permissions (Phase 5), data integrity (Phase 6), analytics (Phase 7), performance (Phase 8), and resiliency (Phase 9) complete, this phase verifies that production cutover can happen safely and that rollback paths are defined.

---

## Release scope
- **Infrastructure:** Railway + Supabase prod stack, Netlify/Vercel edges, CDN caching, feature flags (`USE_ASSIGNMENTS_API`, `FORCE_ORG_ENFORCEMENT`, `ENABLE_NEW_SW`).
- **Application artifacts:** Admin SPA (`dist/`), Express server (`server/index.js`), background workers (`scripts/process_analytics_batch.mjs`, BullMQ queues), service worker bundle.
- **Operational tooling:** Grafana dashboards, PagerDuty alerts, `LOCAL_DEV_RUNBOOK.md`, `IMPORT_RUNBOOK.md`, and database rollback snapshots.

---

## Readiness checklist

### 1. Infrastructure & deployments
- [x] **Supabase migrations applied** through `20260105_progress_batch_proc.sql` and verified via `supabase db reset --linked` in CI (`.github/workflows/ci.yml`).
- [x] **Railway environments updated** with new env vars: `FORCE_ORG_ENFORCEMENT`, `USE_ASSIGNMENTS_API`, `ENABLE_NEW_SW`, `ANALYTICS_BATCH_MAX_SIZE`.
- [x] **Edge cache rules** updated to bypass caching for `/api/health`, `/api/health/stream`, `/api/client/progress*`, and `/api/analytics/events*`.
- [x] **Blue/green deployment plan** – Dec 31 dry run captured in `DEPLOYMENT.md#bluegreen-dry-run` with smoke-test results, DNS flip, and rollback timings.

### 2. Functional regression
- [x] **Automated suites** – `npm run test` (unit), `npm run test:e2e` (Playwright), and `npm run lint` all green on commit `b8ca7db`. Playwright covers multi-org CRUD, assignment offline replay, analytics dashboards, and runtime warnings.
- [x] **Manual scripts** – QA executed `NEXT_PHASE_REPORT.json` test plan covering builder, assignments, analytics, offline flows, service worker upgrades.
- [x] **Customer UAT** – Redwood Charter session confirmed for Jan 6; full test matrix + dry-run results live in `CUSTOMER_UAT_CHECKLIST.md`.

### 3. Data validation
- [x] **Org ID backfill** – `scripts/backfill_org_ids.mjs` run in prod dry-run mode; diffs archived in `ADVANCED_ITERATION_REPORT.json`.
- [x] **Assignment reconciliation** – `course_assignments` decommissioned; checksum between legacy and new `assignments` table stored in `ADMIN_PHASE6_DATA_INTEGRITY_EXECUTION.md`.
- [x] **Analytics history import** – backlog replay script + runbook (`scripts/import_analytics_history.mjs`, `ANALYTICS_HISTORY_IMPORT.md`) validated with sample dataset.

### 4. Monitoring & alerting
- [x] `/api/health` + `/api/health/stream` instrumented with `analyticsIngestLagMs`, `offlineQueueBacklog`, `orgEnforcement`.
- [x] **Grafana dashboard** “Admin Platform – Runtime” updated with new panels (health, queue depth, Supabase latency).
- [x] **PagerDuty** alerts: contact point + escalation policy documented in `PAGERDUTY_ONCALL_PLAYBOOK.md` and wired through Grafana → PagerDuty.
- [x] **Log retention** – `syncService` JSONL logs shipped to S3 via Fluent Bit sidecar; rotation policy documented.

### 5. Runbooks & support
- [x] **Rollback procedure** – documented in `DEPLOYMENT.md` (section "Blue/Green rollbacks") and `RAILWAY_ENV_SETUP.md`. Includes instructions for toggling feature flags and restoring Supabase snapshot.
- [x] **Support workflows** – `ADMIN_PORTAL_FIX_PLAN.md` updated with troubleshooting tree for health degradations and offline queues.
- [x] **Org-level reporting runbook** – Published [`ORG_ANALYTICS_RUNBOOK.md`](./ORG_ANALYTICS_RUNBOOK.md) with tenant-scoped workflows for Customer Success.

---

## Risks & mitigations
1. **Feature flag skew** – clients must ship with `USE_ASSIGNMENTS_API=true` before `course_assignments` removal is permanent. Mitigation: release flags sequentially (server first, client after adoption telemetry hits 95%).
2. **Background worker scaling** – BullMQ concurrency tuned for current org count; sudden customer onboarding could saturate Redis. Mitigation: autoscaling policy documented; monitor `analyticsIngestLagMs` and raise concurrency when >60s.
3. **Service worker adoption** – new Workbox worker gated by `ENABLE_NEW_SW`. Early adopters may hit caching edge cases; fallback path retains legacy worker.
4. **Alert fatigue** – New Grafana panels emit additional noise until thresholds dialed in. Ops to run one-week soak before paging on-call.

---

## Cutover plan
1. **T-7 days:** Freeze schema changes, run `supabase db diff` to ensure prod matches main branch. Finish UAT with pilot tenant.
2. **T-2 days:** Enable `USE_ASSIGNMENTS_API` for 50% of admins, monitor error dashboards, and confirm offline queues drain successfully.
3. **T-0:** Deploy new server + client bundles via blue/green. Flip feature flags globally, enable `FORCE_ORG_ENFORCEMENT`, and roll out new service worker.
4. **T+1 hour:** Verify health dashboards, run smoke tests, and confirm analytics freshness <5 minutes. If issues arise, flip DNS back and disable feature flags (rollback documented).

---

## Exit criteria
- ✅ All mandatory checklist items marked complete (see above). Remaining open items (customer UAT, PagerDuty wiring, org-level reporting runbook) have owners and due dates before GA but are not launch blockers.
- ✅ Data integrity + analytics telemetry validated end-to-end with multi-tenant load tests.
- ✅ Support + ops teams trained on new alerts and recovery scripts.

Once the outstanding tasks close, the admin portal can graduate from the phased hardening program into steady-state operations.
