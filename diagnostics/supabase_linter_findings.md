# Supabase Database Linter Findings & Remediation

This document summarizes the linter output you attached and provides concrete, low-risk remediation options and example SQL statements you can run in your Supabase SQL editor or psql shell. Do *not* apply these to production without review and testing in a staging environment.

Each finding includes:
- a short description
- recommended remediation options (with example SQL)
- notes and testing guidance

---

## 1) function_search_path_mutable — public.get_platform_role_claims (WARN / SECURITY)
- Finding: Function relies on an uncontrolled `search_path` (mutable). This can be abused if untrusted schemas are earlier on the path.

Remediation options (pick one):
1. Constrain the function's search_path explicitly:

   Example SQL:

   ```sql
   -- Set search_path for the existing function
   ALTER FUNCTION public.get_platform_role_claims() SET search_path = public;
   ```

   Or when (re)creating the function, include:

   ```sql
   CREATE OR REPLACE FUNCTION public.get_platform_role_claims()
   RETURNS ...
   LANGUAGE plpgsql
   SECURITY DEFINER
   SET search_path = public
   AS $$
   -- function body
   $$;
   ```

2. Schema-qualify all object references inside the function (preferred long-term):
   - Edit the function body so every table/view/sequence is referenced as `schema.table_name` (e.g., `public.user_profiles`). This removes dependence on search_path.

Notes:
- `ALTER FUNCTION ... SET search_path` is usually safe and fast, but schema-qualifying references is the strongest fix.
- Test in staging; ensure the function still behaves and unit tests (if any) pass.

---

## 2) anon_security_definer_function_executable — many `public.*` functions callable by anon as SECURITY DEFINER (WARN / SECURITY)
- Findings (each row is a separate linter warning):
  - `public.analytics_events_set_owner()`
  - `public.can_invite_to_org(auth_user uuid, target_org uuid)`
  - `public.ensure_active_membership()`
  - `public.ensure_active_membership_impl()`
  - `public.get_platform_role_claims()`
  - `public.handle_new_user()`
  - `public.handle_new_user_impl()`
  - `public.is_platform_admin_inviter(inviter_id uuid)`
  - `public.log_auth_event(p_event_type text, p_user_id uuid, p_ip inet, p_user_agent text, p_details jsonb)`
  - `public.org_invites_integrity_trigger()`
  - `public.refresh_survey_assignment_aggregates(arg_text text)`
  - `public.refresh_survey_assignment_aggregates_impl(target_survey_id text)`
  - `public.rls_auto_enable()`
  - `public.rls_auto_enable_impl()`
  - `public.set_course_assignments_updated_at()`
  - `public.set_created_by_from_auth_uid()`
  - `public.set_created_by_from_auth_uid_impl()`
  - `public.sync_course_progress_percent()`
  - `public.sync_lesson_progress_status()`
  - `public.sync_membership_org_columns()`
  - `public.sync_org_invites_org_columns()`
  - `public.upsert_course_graph(p_course jsonb)`
  - `public.upsert_course_graph(p_course jsonb, p_actor uuid, p_org uuid)`
  - `public.upsert_course_graph_impl(p_course jsonb)`
  - `public.upsert_course_graph_impl(p_course jsonb, p_actor uuid, p_org uuid)`

Description: The database linter warns that these functions are `SECURITY DEFINER` and are accessible to the `anon` role (public REST access), which could allow privilege escalation or data access if not intended.

Remediation options (ordered by recommended safety):

A) Revoke EXECUTE for `anon` (fast, minimal surface change):

```sql
-- Example (no-arg function)
REVOKE EXECUTE ON FUNCTION public.analytics_events_set_owner() FROM anon;

-- Example (arg signature must match exactly)
REVOKE EXECUTE ON FUNCTION public.can_invite_to_org(uuid, uuid) FROM anon;
```

Notes:
- Use the exact function signature when revoking (arg types, ordering). The linter output includes argument lists for many entries.
- If your REST/Edge API legitimately needs to call certain RPCs via anon, consider moving them to a different schema not exposed to anon, or gate them behind RLS/policies.

B) Change function security model to `SECURITY INVOKER` (requires audit):

```sql
-- Convert a function so it runs with the invoking user's privileges
ALTER FUNCTION public.analytics_events_set_owner() SECURITY INVOKER;
```

Notes:
- `SECURITY INVOKER` prevents the function from elevating privileges; the caller's privileges apply. This is safer, but some functions intentionally rely on `SECURITY DEFINER` to perform privileged writes — confirm intent before changing.

C) Move functions out of `public` (exposed schema) into a non-public schema and grant explicit EXECUTE to roles that need them.

```sql
-- Example approach (requires re-creating or replacing function in another schema)
CREATE SCHEMA private_functions;
-- create function in private_functions and then grant to authenticated role only
GRANT EXECUTE ON FUNCTION private_functions.analytics_events_set_owner() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.analytics_events_set_owner() FROM public;
```

D) Add strict RLS / policy controls and ensure REST exposure doesn't allow anonymous RPC execution for privileged operations.

---

## 3) authenticated_security_definer_function_executable — functions callable by signed-in users as SECURITY DEFINER (WARN)
- Similar to the anon findings, but the risk model is different: signed-in users may be able to call these functions and cause privileged behavior if the function elevates rights.

Remediation options:
- Same as above (A/B/C) — either revoke execution for roles that should not call them, change to SECURITY INVOKER, or move to a controlled schema.
- Additionally, add input validation inside functions and explicit permission checks (e.g., verify caller is an admin in the function body or via a helper check).

Example SQL to revoke from `authenticated` role (if present):

```sql
REVOKE EXECUTE ON FUNCTION public.sync_course_progress_percent() FROM authenticated;
```

---

## 4) auth_leaked_password_protection — Leaked Password Protection Disabled (WARN)
- Finding: Supabase leaked-password protection is disabled. This helps prevent users from reusing compromised passwords.

Remediation:
- Enable leaked password protection in Supabase Auth settings. See Supabase docs:
  https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

Notes:
- This is a dashboard setting in the Supabase project. Enabling is recommended for production.

---

# Guidance & rollout plan
1. Audit each function and decide per-function intent:
   - Is the function supposed to be callable by public/anonymous clients? (rare — most should not)
   - Does the function need elevated privileges (SECURITY DEFINER) to perform its work? If so, ensure only trusted roles can execute it.
2. For low-risk quick wins:
   - Revoke `EXECUTE` from `anon` for the listed functions. This is reversible and can be tested immediately.
3. For higher-confidence fixes:
   - Convert functions to `SECURITY INVOKER` where appropriate and/or move them to a non-public schema and grant EXECUTE only to `authenticated` or specific roles.
4. After changes:
   - Re-run your DB linter and integration test suite.
   - Test UI flows that rely on RPC endpoints (course upsert, progress sync, etc.) in a staging environment.

# Example batch commands (run in psql or Supabase SQL editor)
-- Revoke anon execute on a few example functions (edit signatures to match your DB exactly)
REVOKE EXECUTE ON FUNCTION public.analytics_events_set_owner() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_platform_role_claims() FROM anon;
REVOKE EXECUTE ON FUNCTION public.upsert_course_graph(jsonb) FROM anon;

-- Convert a function to SECURITY INVOKER (audit-first)
ALTER FUNCTION public.analytics_events_set_owner() SECURITY INVOKER;

-- Lock down search_path for a function
ALTER FUNCTION public.get_platform_role_claims() SET search_path = public;


---

If you want, I can:
- generate a ready-to-run SQL script containing exact REVOKE/ALTER statements for each function listed (I will need exact function signatures if the linter output omits them), or
- run a safer repo change that documents these in code or automation (CI job) that re-runs the linter and fails PRs when regressions appear.

Tell me which remediation approach you'd like me to prepare (quick REVOKE script, ALTER -> SECURITY INVOKER script, move to private schema plan, or just run the linter again and produce a refined list).

---

## Additional: RLS initplan warnings & Multiple Permissive Policies (PERFORMANCE)

Summary from the linter: several row-level security (RLS) policies call `current_setting()` or `auth.<function>()` *per row*, which forces PostgreSQL to re-evaluate those functions for each row and can severely degrade query performance at scale. The recommended pattern is to call such functions once per statement using a sub-select form: `(select auth.<function>())` or move the value into a local variable in the policy definition by wrapping the call in a select.

Findings reported (examples):
- `public.organizations` policy `platform_admin_full_access_orgs`
- `public.user_profiles` policy `platform_admin_full_access_users`
- `public.courses` policy `platform_admin_full_access`
- `public.assignments` policies `assignments_delete_mya_admin`, `assignments_insert_mya_admin`, `assignments_select_mya_admin`, `assignments_update_mya_admin`

Additionally, the linter found tables with *multiple permissive policies* for the same `role`/`action` combination (for example `courses` and `organizations` have more than one permissive `SELECT` policy). Each permissive policy must be evaluated by Postgres for relevant queries which is suboptimal; combine or consolidate policies where possible.

Remediation recommendations (safe, incremental):

1) Convert inline `auth.<function>()` calls to statement-level sub-selects

   - Bad (re-evaluated per-row):

      USING (auth.is_platform_admin())

   - Good (evaluated once):

      USING ((select auth.is_platform_admin()))

   - Action: inspect each flagged policy definition and replace bare `auth.*()` calls with `(select auth.*())` inside the `USING` and `WITH CHECK` clauses.

2) Consolidate multiple permissive policies for the same role/action

   - If you have two permissive `SELECT` policies that both grant matching access rules for `authenticated`, consider merging them into a single `USING` expression that ORs the conditions, or narrow one policy to a specific role/condition so only one policy applies for a given request.

3) Test on staging and measure

   - After making the change, re-run representative queries (list endpoints, catalog queries) and the DB linter. Compare EXPLAIN ANALYZE for slow queries before/after.

Example checklist and safe edit process

- Step 0: Get current policy definition (run in psql / Supabase SQL editor):

```sql
SELECT polname, pg_get_expr(polqual, polrelid) AS using_expr, pg_get_expr(polwithcheck, polrelid) AS with_check
FROM pg_policy
WHERE polrelid = 'public.organizations'::regclass;
```

- Step 1: Produce corrected USING and WITH CHECK expressions replacing `auth.func()` with `(select auth.func())`.

- Step 2: Apply the change with `ALTER POLICY` (safe, targeted):

```sql
-- Example for a single policy (replace REPLACEME_USING_EXPR with your corrected expression)
ALTER POLICY platform_admin_full_access_orgs ON public.organizations
   USING ( REPLACEME_USING_EXPR );

-- If the policy also has a WITH CHECK, apply similarly:
ALTER POLICY platform_admin_full_access_orgs ON public.organizations
   WITH CHECK ( REPLACEME_WITH_CHECK_EXPR );
```

Notes:
- `ALTER POLICY` will replace only the specified clause; you can safely update `USING` or `WITH CHECK` independently.
- Keep an audit log / schema migration entry with the exact previous definition in case you need to roll back.

Template SQL for flagged policies

Below are templated `ALTER POLICY` statements for each flagged policy from the linter output. Each contains a `-- TODO:` placeholder where you must paste the corrected expression (with `(select auth.<function>())` style). Review and replace the placeholder before running.

```sql
-- Replace the USING/WITH CHECK expression placeholders with the corrected expressions

-- organizations: platform_admin_full_access_orgs
ALTER POLICY platform_admin_full_access_orgs ON public.organizations
   USING ( -- TODO: paste corrected USING expression here (use (select auth.<func>()) where appropriate) 
   );

-- user_profiles: platform_admin_full_access_users
ALTER POLICY platform_admin_full_access_users ON public.user_profiles
   USING ( -- TODO: paste corrected USING expression here
   );

-- courses: platform_admin_full_access
ALTER POLICY platform_admin_full_access ON public.courses
   USING ( -- TODO: paste corrected USING expression here
   );

-- assignments: assignments_delete_mya_admin
ALTER POLICY assignments_delete_mya_admin ON public.assignments
   USING ( -- TODO: paste corrected USING expression here
   );

-- assignments: assignments_insert_mya_admin
ALTER POLICY assignments_insert_mya_admin ON public.assignments
   USING ( -- TODO: paste corrected USING expression here
   );

-- assignments: assignments_select_mya_admin
ALTER POLICY assignments_select_mya_admin ON public.assignments
   USING ( -- TODO: paste corrected USING expression here
   );

-- assignments: assignments_update_mya_admin
ALTER POLICY assignments_update_mya_admin ON public.assignments
   USING ( -- TODO: paste corrected USING expression here
   );
```

Consolidation example (merge multiple permissive SELECT policies into one)

```sql
-- Suppose you have two permissive policies: courses_select_member and platform_admin_full_access.
-- You can drop one and create a single policy expressing both conditions.

BEGIN;

-- capture existing definitions first (manual step)

-- Drop the redundant policy
DROP POLICY IF EXISTS courses_select_member ON public.courses;

-- Recreate a single consolidated policy for authenticated SELECT
CREATE POLICY courses_select_authenticated ON public.courses
   FOR SELECT
   TO authenticated
   USING ( (
      -- member-visible condition
      /* existing member condition here */
   ) OR (
      -- platform admin condition (ensure the call is statement-level)
      (select auth.is_platform_admin())
   ) );

COMMIT;
```

Final notes

- These changes are low-risk when applied carefully and tested in a staging environment. The most common safe edit is replacing `auth.foo()` with `(select auth.foo())` in `USING`/`WITH CHECK` clauses and then measuring query plans.
- If you'd like, I can:
   - generate a fully-populated SQL script by fetching current policy `USING`/`WITH CHECK` values and performing the substitution automatically (I will need DB access or pasted current definitions), or
   - create a guided checklist and a small Node.js script that uses `pg` to read current policies, generate proposed ALTERs, and optionally apply them in a transaction after your confirmation.

Which option would you like? I can prepare the SQL template (with placeholders filled from current policy definitions if you paste them) or draft the safe migration script next.