DB Hardening for Supabase - README

This folder contains scripts and instructions to perform the repository-wide database hardening steps you requested for a Supabase Postgres database. These scripts are intentionally conservative: they print recommended SQL changes by default and only execute modifications when explicitly enabled.

Files
- harden_all.sql - Combined script that implements Steps 1-9. By default it operates in "preview" mode and prints RAISE NOTICE output. Edit `perform_changes` variables in the DO blocks to `true` or extract generated SQL to run it manually.

How to use (safe workflow)
1) Backup: take a DB logical backup / snapshot before making changes.
2) Run preview: psql 'postgresql://<user>:<pass>@<host>:<port>/<db>' -f scripts/db_hardening/harden_all.sql
   - This prints RAISE NOTICE logs and lists candidate statements (REVOKE/ALTER/ALTER POLICY/CREATE POLICY/DROP INDEX statements)
3) Review output: carefully inspect the printed SQL.
4) Apply changes: either set `perform_changes := true` inside the DO blocks you want to apply and re-run the script, or copy specific SQL statements and run them manually in psql (recommended).
5) Verify: run the verification steps in the script and exercises queries as platform_admin and regular users.

Caveats
- The script provides textual replacements for auth.uid(), auth.role() and current_setting() calls in policy expressions. Complex policy expressions may need manual adjustment.
- Consolidating policies requires manual review; the script lists candidates and prints suggested merged policy examples, but does not auto-merge.
- Dropping indexes uses pg_stat_user_indexes.idx_scan = 0 as a heuristic. Ensure an index is not used by foreign key or supporting queries before dropping.
- Always snapshot before applying any changes.

If you'd like, I can:
- Run an initial preview and extract the generated SQL here for review.
- Attempt to connect to your database (you must supply a connection string) and run the preview or apply changes.
- Produce per-table patch suggestions and a plan to run them safely with rollbacks.
