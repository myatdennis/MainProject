# Initial DB Inventory & Findings

Date: 2026-03-14
Scope: `supabase_audit/exports/prod_schema.sql` (full schema export) and `supabase/migrations/` (migrations folder)

## Quick summary
- Schema export contains ~42 CREATE TABLE entries across schemas: `auth`, `public`, and `storage`.
- Core application tables (public schema) include: `courses`, `lessons`, `modules`, `organization_memberships`, `organizations`, `user_profiles`, `analytics_events`, `audit_logs`, `course_engagement`, `org_invites`, and related tables.
- Observed advisory warning surfaced by the server: `schema_doctor_check_warn table: course_assignments column: updated_at ok:false` — indicates `course_assignments.updated_at` may be missing or not kept up-to-date by a trigger.
- There are RLS-related artifacts: `rls_auto_enable` function, baseline RLS policies migrations (e.g., `add_baseline_rls_policies.sql`, `add_write_rls_policies.sql`, `harden_org_scoped_rls.sql`, `surveys_org_rls.sql`), and `rls_policy_templates.sql` suggests deliberate RLS usage.

## High-level counts
- CREATE TABLE occurrences found: 42 (auth + public + storage)
- Notable schemas:
  - `auth` — user/session and auth internals (many tables, refresh tokens, sessions, sso providers, etc.)
  - `public` — application domain tables
  - `storage` — Supabase storage tables

## Immediate findings & recommendations (priority)
1. course_assignments.updated_at issue (High)
   - Server schema_doctor warned `course_assignments.updated_at ok:false`.
   - Action: inspect `supabase/migrations/*` for migrations that create/alter `course_assignments` and ensure a `updated_at` column exists and a `set_updated_at` trigger is attached.
   - Quick remediation: add `updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()` and the `set_updated_at` trigger if missing; or repair the trigger attachment via migration. Add a migration `repair_course_assignments_updated_at.sql` (already present: `20260304170500_repair_course_assignments_updated_at.sql` — review and apply).

2. RLS policies (High)
   - Many RLS-related migrations are present. Perform a policy-by-policy review to ensure there are no overly-permissive policies (e.g., allowing public read/write) and confirm service-role-only operations are protected server-side.
   - Action: produce a table-by-table RLS matrix (policy name, effect, role, notes).

3. Index & foreign-key review (Medium)
   - Ensure foreign keys have supporting indexes (FK columns often need indexes for join performance).
   - Identify high-cardinality search/filter columns (e.g., user_id, organization_id, course_id) and verify appropriate indexes exist.
   - Action: run `pg_indexes` and `pg_stat_user_indexes` in production to find missing or unused indexes.

4. Audit & retention (Medium)
   - `audit_logs` exists. Confirm retention policy and whether PII is scrubbed per retention rules.
   - Action: ensure `audit_logs` has controlled lifecycle (partitioning or prune job).

5. Backups & migrations (High)
   - Confirm scheduled backups and point-in-time recovery are enabled. Ensure migration rollforward/revert steps are tested in staging.

## Next steps (concrete, ordered)
1. Run a targeted check for `course_assignments`:
   - Open `supabase/migrations/20260303174500_add_course_assignments_updated_at.sql` and `20260304170500_repair_course_assignments_updated_at.sql` and evaluate.
2. Produce a table inventory CSV with columns: schema, table, columns, primary_key, foreign_keys, indexes, rls_policies.
   - I can generate this by parsing `prod_schema.sql` and correlating with `supabase/migrations/` files.
3. Generate an RLS policy matrix from migrations (scan for `CREATE POLICY` and policy ALTER statements).
4. Propose prioritized remediation SQL (e.g., add missing updated_at trigger, add indexes, tighten RLS) and a migration plan.

## Artifacts I will produce next if you want me to continue
- `supabase_audit/reports/table_inventory.csv` (machine-readable table inventory)
- `supabase_audit/reports/rls_policy_matrix.md` (per-table policy summary)
- `supabase_audit/migrations/XXXX_fix_course_assignments_updated_at.sql` (migration to remediate updated_at if needed)
- Actionable priority list with estimated effort and risk for each fix

---

If you want me to continue I will: (A) parse the `prod_schema.sql` to produce the CSV inventory, (B) run a RLS policy extraction, and (C) draft specific SQL migrations for the top 2-3 priority issues. Confirm and I'll proceed.
