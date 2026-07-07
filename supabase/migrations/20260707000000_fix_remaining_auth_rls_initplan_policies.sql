-- Migration: Wrap remaining bare auth.*() calls in RLS policies with (select ...)
-- Generated: 2026-07-07
-- Purpose: Supabase's performance linter (auth_rls_initplan) flagged 9 policies
-- that call auth.uid()/auth.role() directly, causing Postgres to re-evaluate
-- the call for every row instead of once per query. These are the specific
-- policies not covered by the prior 20260504/20260510
-- replace_policies_use_select_auth_uid.sql migrations, which only targeted
-- auth.uid()-based policies on a hardcoded table list that did not include
-- user_profiles, organizations, or organization_memberships, and never
-- handled the auth.role() = 'service_role' pattern at all.
--
-- This is a pure performance rewrite: auth.uid()/auth.role() are STABLE
-- functions, so wrapping them in (select ...) is semantically identical,
-- just evaluated once per query (as an InitPlan) instead of once per row.
-- No access-control behavior changes.

ALTER POLICY _policy_backup_service_access ON public._policy_backup
  USING ((select auth.role()) = 'service_role'::text)
  WITH CHECK ((select auth.role()) = 'service_role'::text);

ALTER POLICY audit_logs_service_access ON public.audit_logs
  USING ((select auth.role()) = 'service_role'::text)
  WITH CHECK ((select auth.role()) = 'service_role'::text);

ALTER POLICY org_invites_service_full_access ON public.org_invites
  USING ((select auth.role()) = 'service_role'::text)
  WITH CHECK ((select auth.role()) = 'service_role'::text);

ALTER POLICY organization_profiles_service_access ON public.organization_profiles
  USING ((select auth.role()) = 'service_role'::text)
  WITH CHECK ((select auth.role()) = 'service_role'::text);

ALTER POLICY memberships_read ON public.organization_memberships
  USING (user_id = (select auth.uid()));

ALTER POLICY organizations_read ON public.organizations
  USING (EXISTS (
    SELECT 1
    FROM organization_memberships m
    WHERE m.organization_id = organizations.id
      AND m.user_id = (select auth.uid())
  ));

ALTER POLICY users_insert_profile ON public.user_profiles
  WITH CHECK ((select auth.uid()) = id);

ALTER POLICY users_read_own_profile ON public.user_profiles
  USING ((select auth.uid()) = id);

ALTER POLICY users_update_own_profile ON public.user_profiles
  USING ((select auth.uid()) = id);
