-- Fix Supabase linter warning: auth_rls_initplan
-- Replaces bare auth.<function>() calls with (SELECT auth.<function>()) in RLS policies
-- so Postgres evaluates them once per query instead of once per row.
-- Affected tables: public.org_invites (4 policies), public.course_media_assets (1 policy)
-- See: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

BEGIN;

-- ============================================================
-- public.org_invites — drop and re-create all four policies
-- ============================================================
DROP POLICY IF EXISTS "org_invites_select" ON public.org_invites;
DROP POLICY IF EXISTS "org_invites_insert" ON public.org_invites;
DROP POLICY IF EXISTS "org_invites_update" ON public.org_invites;
DROP POLICY IF EXISTS "org_invites_delete" ON public.org_invites;

-- SELECT: org member OR platform admin
CREATE POLICY "org_invites_select"
  ON public.org_invites
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.jwt() ->> 'role') = 'admin'
    OR EXISTS (
      SELECT 1
      FROM public.organization_memberships m
      WHERE m.organization_id = org_invites.organization_id
        AND m.user_id = (SELECT auth.uid())
    )
  );

-- INSERT: creator is self AND (is org admin/owner OR is in org OR is platform admin)
CREATE POLICY "org_invites_insert"
  ON public.org_invites
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND (
      organization_id = ANY (
        SELECT organization_id FROM get_user_organization_ids()
      )
      OR EXISTS (
        SELECT 1
        FROM public.organization_memberships m
        WHERE m.organization_id = org_invites.organization_id
          AND m.user_id = (SELECT auth.uid())
          AND m.role = ANY (ARRAY['owner', 'admin'])
      )
      OR (SELECT auth.jwt() ->> 'role') = 'admin'
    )
  );

-- UPDATE: is inviter, org admin/owner, or platform admin
CREATE POLICY "org_invites_update"
  ON public.org_invites
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT auth.jwt() ->> 'role') = 'admin'
    OR inviter_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.organization_memberships m
      WHERE m.user_id = (SELECT auth.uid())
        AND m.organization_id = org_invites.organization_id
        AND m.role = ANY (ARRAY['owner', 'admin'])
    )
  )
  WITH CHECK (
    (SELECT auth.jwt() ->> 'role') = 'admin'
    OR inviter_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.organization_memberships m
      WHERE m.user_id = (SELECT auth.uid())
        AND m.organization_id = org_invites.organization_id
        AND m.role = ANY (ARRAY['owner', 'admin'])
    )
  );

-- DELETE: is inviter, org admin/owner, or platform admin
CREATE POLICY "org_invites_delete"
  ON public.org_invites
  FOR DELETE
  TO authenticated
  USING (
    (SELECT auth.jwt() ->> 'role') = 'admin'
    OR inviter_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.organization_memberships m
      WHERE m.user_id = (SELECT auth.uid())
        AND m.organization_id = org_invites.organization_id
        AND m.role = ANY (ARRAY['owner', 'admin'])
    )
  );

-- ============================================================
-- public.course_media_assets — drop and re-create "allow org members"
-- ============================================================
DROP POLICY IF EXISTS "allow org members" ON public.course_media_assets;

CREATE POLICY "allow org members"
  ON public.course_media_assets
  USING (
    org_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.organization_memberships m
      WHERE m.org_id = course_media_assets.org_id
        AND m.user_id = (SELECT auth.uid())
        AND coalesce(m.status, 'active') = 'active'
    )
  );

COMMIT;
