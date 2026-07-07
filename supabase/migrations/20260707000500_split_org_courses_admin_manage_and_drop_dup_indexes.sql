-- Migration: Split organization_courses_admin_manage; drop duplicate indexes
-- Generated: 2026-07-07
-- Purpose: two remaining Supabase linter categories.
--
-- 1) multiple_permissive_policies on organization_courses SELECT:
-- organization_courses_admin_manage is an ALL-type policy (owner/admin
-- active membership), so it also applies to SELECT, where its condition is
-- a strict subset of organization_courses_select_unified's (any active
-- member, or platform_admin). It can't simply be dropped though — it's the
-- only policy granting INSERT/UPDATE/DELETE to org owners/admins. ALTER
-- POLICY can't change which command a policy applies to, so this replaces
-- the single ALL policy with three action-scoped policies (INSERT/UPDATE/
-- DELETE only, same condition, same net permissions) and drops the
-- original. This removes the redundant SELECT overlap without losing any
-- write capability.
--
-- 2) duplicate_index: two identical-definition index pairs found via
-- pg_indexes + pg_constraint. organizations_slug_key backs a real UNIQUE
-- constraint (kept); organizations_slug_unique is a redundant plain unique
-- index with no constraint attached (dropped). Neither
-- organization_memberships user_id index backs a constraint; kept the one
-- matching Postgres's standard <table>_<column>_idx naming convention.

DROP POLICY IF EXISTS "organization_courses_admin_manage" ON public."organization_courses";

CREATE POLICY "organization_courses_admin_insert" ON public."organization_courses"
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM organization_memberships m
    WHERE m.organization_id = organization_courses.organization_id
      AND m.user_id = (select auth.uid())
      AND COALESCE(m.status, 'active'::text) = 'active'::text
      AND m.role = ANY (ARRAY['owner'::text, 'admin'::text])
  ));

CREATE POLICY "organization_courses_admin_update" ON public."organization_courses"
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM organization_memberships m
    WHERE m.organization_id = organization_courses.organization_id
      AND m.user_id = (select auth.uid())
      AND COALESCE(m.status, 'active'::text) = 'active'::text
      AND m.role = ANY (ARRAY['owner'::text, 'admin'::text])
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM organization_memberships m
    WHERE m.organization_id = organization_courses.organization_id
      AND m.user_id = (select auth.uid())
      AND COALESCE(m.status, 'active'::text) = 'active'::text
      AND m.role = ANY (ARRAY['owner'::text, 'admin'::text])
  ));

CREATE POLICY "organization_courses_admin_delete" ON public."organization_courses"
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM organization_memberships m
    WHERE m.organization_id = organization_courses.organization_id
      AND m.user_id = (select auth.uid())
      AND COALESCE(m.status, 'active'::text) = 'active'::text
      AND m.role = ANY (ARRAY['owner'::text, 'admin'::text])
  ));

DROP INDEX IF EXISTS public."organizations_slug_unique";
DROP INDEX IF EXISTS public."idx_org_memberships_user_id";
