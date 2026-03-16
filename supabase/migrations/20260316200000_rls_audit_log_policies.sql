-- =============================================================================
-- Migration: Add RLS policies to public.rls_audit_log
--
-- This table has RLS enabled but zero policies, which locks out all access
-- (including reads). It is an internal audit table written exclusively by
-- server-side/service-role processes (no user_id / org_id column).
--
-- Policy design:
--   SELECT  — admin users only (role = 'admin' in user_profiles)
--   INSERT  — denied via API; server uses service role which bypasses RLS
--   UPDATE  — denied for everyone
--   DELETE  — denied for everyone
-- =============================================================================

-- Allow admins to read audit entries
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'rls_audit_log'
      and policyname = 'rls_audit_log_admin_select'
  ) then
    execute $policy$
      create policy rls_audit_log_admin_select
        on public.rls_audit_log
        for select
        using (
          exists (
            select 1 from public.user_profiles
            where id   = (select auth.uid())
              and role = 'admin'
          )
        )
    $policy$;
  end if;
end $$;
