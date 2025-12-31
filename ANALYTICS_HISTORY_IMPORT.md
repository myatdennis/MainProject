# Analytics History Import Runbook

_Last updated: 2025-12-31_

The analytics rewrite introduced in Phases 7–8 left a backlog of legacy events (calendar year 2024) that needed to be replayed into the new `analytics_events` firehose. This runbook documents the import script, file format, validation workflow, and rollback plan so the backlog can be replayed safely in any environment.

---

## 1. Source data expectations

- **Format:** newline-delimited JSON (`.jsonl` or `.ndjson`). One event per line keeps memory usage predictable and lets us stream large exports.
- **Required fields:**
  - `event_type` – string (e.g., `lesson_started`, `quiz_submitted`).
  - `occurred_at` or `created_at` – ISO 8601 timestamp.
- **Optional fields:** `user_id`, `course_id`, `lesson_id`, `module_id`, `session_id`, `user_agent`, `payload` (object). Any unknown properties are ignored.
- See `import/analytics-history-sample.jsonl` for a minimal example.

> Tip: when exporting from Redshift/Snowflake, keep column names snake_case to avoid post-processing.

---

## 2. Import script

```
node scripts/import_analytics_history.mjs --file ./import/analytics-history-2024.jsonl \
  --chunk 1000 \
  --limit 250000
```

### Flags

| Flag | Description |
| --- | --- |
| `--file, -f` | Path to the JSONL file (required). Relative paths are resolved from repo root. |
| `--chunk` | Batch size per insert (default `500`). Tune higher (1000–2000) for faster imports on beefier DBs. |
| `--limit` | Optional hard stop to keep a test run from importing more than _N_ rows. |
| `--dry-run` | Parse + validate the file without touching the database. Useful for CI smoke tests. |
| `--verbose` | Log every skipped/invalid line for debugging malformed exports. |

### Environment

- `DATABASE_URL` must point at the Supabase/Postgres instance you want to hydrate.
- Optional: `ANALYTICS_IMPORT_POOL_SIZE` and `ANALYTICS_IMPORT_CHUNK_SIZE` tune concurrency without touching CLI args.

### Example run

```
# Validate the export
DATABASE_URL=postgres://... node scripts/import_analytics_history.mjs \
  --file ./import/analytics-history-2024.jsonl --dry-run --verbose

# Execute the import
DATABASE_URL=postgres://... node scripts/import_analytics_history.mjs \
  --file ./import/analytics-history-2024.jsonl --chunk 1500
```

The script streams the file via `readline`, inserts batches into `analytics_events`, and prints a summary (processed/imported/skipped). If the DB rejects a batch the import stops immediately with the offending error.

---

## 3. Verification checklist

1. **Row counts** – confirm imported range:
   ```sql
   select date_trunc('month', created_at) as month, count(*)
   from analytics_events
   where created_at between '2024-01-01' and '2024-12-31'
   group by 1
   order by 1;
   ```
2. **Spot check payloads** – query a few users/courses to ensure legacy metadata looks correct.
3. **Dashboard freshness** – hit `/api/admin/analytics` for the affected org and confirm the UI reflects the new history once rollups complete.
4. **Rollup worker** – run `node scripts/process_analytics_batch.mjs --once` (or let Railway cron pick it up) so derived tables ingest the freshly inserted events.

---

## 4. Rollback plan

- Imports are append-only. If something goes wrong rerun `scripts/prune_old_events.mjs --dry-run` for the time window and then rerun without `--dry-run` to delete the bad slice.
- Keep the raw JSONL export in S3 (`s3://admin-platform/analytics-history/2024/analytics-history-YYYYMMDD.jsonl`) so the import is repeatable.

---

## 5. Operational notes

- Imports are safe to run while the platform is live; the script respects Postgres backpressure and inserts in manageable chunks.
- Schedule long-running imports during the low-traffic window (02:00–04:00 UTC) to avoid noisy Grafana alerts.
- Track each run in `server_health_report.json` by appending a short entry with:
  - Date/time
  - Dataset (e.g., `analytics-history-2024-H1`)
  - Row count
  - Operator initials

With this script + checklist, the “Analytics history import” checkbox in Phase 10 can stay permanently green.
