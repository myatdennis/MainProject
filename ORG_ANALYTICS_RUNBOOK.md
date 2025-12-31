# Org-Level Analytics & Reporting Runbook

_Last updated: 2025-12-31_

This runbook teaches Customer Success, Support, and Operations teammates how to use the hardened analytics stack (Phases 6–10) to answer tenant-specific questions without engineering help.

## 1. Prerequisites

1. **Permissions:** You must be an org admin or platform admin. Verify by loading `/admin/dashboard`; the runtime banner shows your active organization.
2. **Org context:** Keep the org selector in the global header aligned with the customer you are supporting. All analytics APIs now enforce membership (`withOrgContext`).
3. **Feature flags:** Ensure `USE_ASSIGNMENTS_API`, `FORCE_ORG_ENFORCEMENT`, and `ENABLE_NEW_SW` are enabled in the environment you are querying. Health panel → “Flags” row lists current values.
4. **Fresh data:** Check the Analytics dashboard freshness badge. Yellow means data is older than 10 minutes—pause customer conversations until the ingest backlog clears.

## 2. Daily workflow

1. **Select the tenant** via the org switcher (top-right) or pass `?orgId=...` when deep-linking dashboards.
2. **Open Admin → Analytics.** The dashboard now defaults to the active org and shows the freshness timestamp plus queue depth indicators.
3. **Filter views:**
   - Completion/Drop-off cards: use the new org-aware filter chips in the header. They translate to `org_id` filters server-side.
   - Course drill-down: click a course row → modal displays completion, lesson drop-off, and assignment uptake scoped to the active org.
4. **Export data:** Use “Export CSV” which now includes `org_id` and `org_name`. File names include the org slug for auditing.
5. **Share insights:** Include freshness timestamp and the `analyticsIngestLagMs` metric (available via `/api/health` or Health drawer) in customer notes so engineering can trace context.

## 3. Troubleshooting checklist

| Symptom | Checks | Resolution |
| --- | --- | --- |
| Dashboard shows global data | Confirm org chip in header matches customer. Verify network request `GET /api/admin/analytics?orgId=...` (should include orgId). | Re-select org; if API lacks `orgId`, log a bug—route now rejects requests without membership. |
| “Data older than X minutes” warning | Inspect `/api/health` → `analyticsIngestLagMs`. | If >120000 ms, run `npm run retention:events` (if backlog due to bloat) or page on-call per PagerDuty rule. |
| Missing assignments | Confirm assignments were created via `/api/admin/courses/:id/assign` (server logs). | Re-sync via Admin → Courses → Assign; offline queue banner should be green before retrying. |
| Export lacks PII masking | Reminder: PII tokenization is Phase 9 follow-up. Ensure files stay internal; escalate to engineering if customer requests raw data. |

## 4. Reference commands

Use these when on support rotations (from repo root):

```bash
# Check analytics freshness/lag locally
curl -s http://localhost:8888/api/health | jq '.analyticsIngestLagMs, .offlineQueue.backlog'

# Prune historic analytics/progress data (mirrors production cron)
npm run retention:events -- --dry-run
```

## 5. Escalation paths

1. If org scoping looks wrong, capture:
   - Screenshot of dashboard
   - `Request-Id` header from failed API response
   - Output of `/api/health`
2. Post findings in `#admin-analytics` with severity.
3. Page the Platform on-call when both `analyticsIngestLagMs > 120000` **and** `offlineQueue.backlog > 100`.

Document owners: @admin-platform-team. Update this file whenever analytics filters or health signals change.
