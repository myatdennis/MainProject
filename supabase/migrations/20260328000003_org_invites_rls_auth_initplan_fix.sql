-- Fix performance linter warnings for org_invites RLS and remove duplicate indexes.
-- 1) Replace auth.<function>() syntax with (select auth.<function>())
-- 2) Remove duplicate indexes on org_invites and organization_memberships.

BEGIN;

-- Refresh org_invites policies using per-query auth function evaluation binding.
DROP POLICY IF EXISTS "org_invites_select" ON public.org_invites;
DROP POLICY IF EXISTS "org_invites_insert" ON public.org_invites;
DROP POLICY IF EXISTS "org_invites_update" ON public.org_invites;
DROP POLICY IF EXISTS "org_invites_delete" ON public.org_invites;

CREATE POLICY "org_invites_select"
  ON public.org_invites
  FOR SELECT
  TO authenticated
  USING (
    (select auth.jwt() ->> 'role') = 'admin'
    OR EXISTS (
      SELECT 1
      FROM public.organization_memberships m
      WHERE m.organization_id = org_invites.organization_id
        AND m.user_id = (select auth.uid())
    )
  );

CREATE POLICY "org_invites_insert"
  ON public.org_invites
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = (select auth.uid())
    AND (
      organization_id = ANY(array(
        SELECT organization_id FROM get_user_organization_ids()
      ))
      OR EXISTS (
        SELECT 1
        FROM public.organization_memberships m
        WHERE m.organization_id = org_invites.organization_id
          AND m.user_id = (select auth.uid())
          AND m.role = ANY(array['owner','admin'])
      )
      OR (select auth.jwt() ->> 'role') = 'admin'
    )
  );

CREATE POLICY "org_invites_update"
  ON public.org_invites
  FOR UPDATE
  TO authenticated
  USING (
    (select auth.jwt() ->> 'role') = 'admin'
    OR inviter_id = (select auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.organization_memberships m
      WHERE m.user_id = (select auth.uid())
        AND m.organization_id = org_invites.organization_id
        AND m.role = ANY(array['owner','admin'])
    )
  )
  WITH CHECK (
    (select auth.jwt() ->> 'role') = 'admin'
    OR inviter_id = (select auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.organization_memberships m
      WHERE m.user_id = (select auth.uid())
        AND m.organization_id = org_invites.organization_id
        AND m.role = ANY(array['owner','admin'])
    )
  );

CREATE POLICY "org_invites_delete"
  ON public.org_invites
  FOR DELETE
  TO authenticated
  USING (
    (select auth.jwt() ->> 'role') = 'admin'
    OR inviter_id = (select auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.organization_memberships m
      WHERE m.user_id = (select auth.uid())
        AND m.organization_id = org_invites.organization_id
        AND m.role = ANY(array['owner','admin'])
    )
  );

-- Remove duplicate indexes on org_invites
DROP INDEX IF EXISTS idx_org_invites_org_id;
DROP INDEX IF EXISTS idx_org_invites_organization_id;

-- Remove duplicate indexes on organization_memberships
DROP INDEX IF EXISTS idx_org_members_org_id;
DROP INDEX IF EXISTS idx_org_members_user_id;
DROP INDEX IF EXISTS idx_org_memberships_user;

-- Ensure canonical indexes exist.
CREATE INDEX IF NOT EXISTS org_invites_org_idx ON public.org_invites(org_id);
CREATE INDEX IF NOT EXISTS org_invites_organization_id_idx ON public.org_invites(organization_id);
CREATE INDEX IF NOT EXISTS organization_memberships_organization_id_idx ON public.organization_memberships(organization_id);
CREATE INDEX IF NOT EXISTS organization_memberships_user_id_idx ON public.organization_memberships(user_id);

COMMIT;
