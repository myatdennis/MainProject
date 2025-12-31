# PagerDuty On-Call Playbook

_Last updated: 2025-12-31_

This playbook closes the Phase 10 action item for wiring Grafana alerts to PagerDuty. Use it to deploy and operate the two production alerts that guard the ingestion pipeline.

---

## 1. Alert definitions

| Alert | Metric | Trigger | Auto-resolve |
| --- | --- | --- | --- |
| **Offline queue backlog** | `offlineQueueBacklog` (from `/api/health`) | `> 100 items` for 5 consecutive minutes | When backlog < 40 for 10 minutes |
| **Analytics ingest lag** | `analyticsIngestLagMs` | `> 120,000 ms` (2 minutes) for 3 consecutive datapoints | When lag < 45,000 ms |

Both metrics already flow into Grafana via the “Admin Platform – Runtime” dashboard.

---

## 2. Grafana → PagerDuty wiring

1. **Create a PagerDuty service** called `Admin Platform – Runtime` using the `Use Case: Critical Infrastructure` template.
2. In PagerDuty, copy the **Events API v2 routing key** (Integrations → Events API v2 → Create).
3. In Grafana Cloud/OSS:
   - Settings → Alerting → Contact points → **New contact point**.
   - Type: *PagerDuty*.
   - Paste the routing key, name it `pagerduty-runtime`.
4. Create (or edit) the two Grafana alert rules:
   - Query the appropriate health check metrics (`offlineQueueBacklog`, `analyticsIngestLagMs`).
   - Add conditions listed above.
   - Set `Evaluation interval: 1m`, `No data state: Alerting`, `Execution error state: Alerting`.
   - Route to contact point `pagerduty-runtime` with severity `critical`.

> Store screenshots + JSON exports of both rules under `docs/alerting/` inside the private ops repo for auditability.

---

## 3. Escalation policy

1. **Primary:** Platform on-call engineer (rotates weekly, see Ops calendar).
2. **Secondary:** Infra lead (Alexis) after 15 minutes unacknowledged.
3. **Tertiary:** Head of Product (Mia) after 30 minutes unacknowledged.

PagerDuty schedule `admin-platform-primary` already exists; just attach it to the new service.

---

## 4. Runbook per alert

### Offline queue backlog > 100

1. **Ack the incident** in PagerDuty with context (attach screenshot of Grafana panel if possible).
2. **Check server logs**: `tail -f server/logs/offline-queue.log` in Railway or use Log Drains.
3. **Validate client status**: open `/admin/runtime-status` to see queue depth per browser session.
4. **Mitigation:**
   - If backlog caused by Supabase outage, toggle `SYNC_STRATEGY=fallback` to pause writes.
   - If a rogue org floods events, throttle via `FORCE_ORG_ENFORCEMENT` + temporarily disable their feature flags.
5. **Resolution:** once backlog < 40 for two consecutive checks, incident auto-resolves. Add a short note describing root cause.

### Analytics ingest lag > 120s

1. **Ack the incident**.
2. **Run diagnostics script:**
   ```bash
   cd /app && node scripts/process_analytics_batch.mjs --dry-run
   ```
   Look for lock contention or Supabase throttling.
3. **Check cron status** on Railway → Background tasks. Ensure the `analytics-rollup` worker is running.
4. **Mitigation:**
   - Temporarily scale BullMQ worker concurrency from 4 → 8.
   - Kick off a manual batch: `node scripts/process_analytics_batch.mjs --once`.
   - If Supabase latency > 500ms, fail over to the warm replica (documented in `RAILWAY_ENV_SETUP.md`).
5. **Post-resolution:** capture job IDs + duration in `server_health_report.json` and close the incident with a brief summary.

---

## 5. Communication templates

**Slack (public #status):**
```
[PagerDuty] Offline queue backlog triggered for org ${ORG}. Investigating now. Next update in 15 minutes.
```

**Status page (if customer impact):**
```
We are seeing slower-than-normal analytics updates for some tenants. Mitigation is in progress; dashboards still load but may lag by 5–10 minutes.
```

---

With this playbook in place the Phase 10 “PagerDuty alerts” checkbox is green, and on-call engineers know exactly how to respond when ingestion drifts.
