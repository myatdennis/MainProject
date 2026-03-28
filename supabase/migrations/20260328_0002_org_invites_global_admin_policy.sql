-- Allow platform admin users to manage org_invites for any organization.
-- This is a safe governance fix for global-admin add-user workflow.

BEGIN;

-- Drop existing org_invites policies if they already exist.
DROP POLICY IF EXISTS "org_invites_select" ON public.org_invites;
DROP POLICY IF EXISTS "org_invites_insert" ON public.org_invites;
DROP POLICY IF EXISTS "org_invites_update" ON public.org_invites;
DROP POLICY IF EXISTS "org_invites_delete" ON public.org_invites;

-- SELECT: org member OR admin user role.
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
        AND m.user_id = (SELECT auth.uid())
    )
  );

-- INSERT: org member OR org admin OR global admin.
CREATE POLICY "org_invites_insert"
  ON public.org_invites
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND (
      organization_id = ANY(array(
        SELECT organization_id FROM get_user_organization_ids()
      ))
      OR EXISTS (
        SELECT 1
        FROM public.organization_memberships m
        WHERE m.organization_id = org_invites.organization_id
          AND m.user_id = (SELECT auth.uid())
          AND m.role = ANY(array['owner','admin'])
      )
      OR (SELECT auth.jwt() ->> 'role') = 'admin'
    )
  );

-- UPDATE: are inviter or admin or global admin.
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
        AND m.role = ANY(array['owner','admin'])
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
        AND m.role = ANY(array['owner','admin'])
    )
  );

-- DELETE: are inviter or admin or global admin.
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
        AND m.role = ANY(array['owner','admin'])
    )
  );

COMMIT;
