-- Migration: Merge remaining multiple_permissive_policies pairs via OR
-- Generated: 2026-07-07
-- Purpose: The last 5 multiple_permissive_policies lint findings
-- (org_invites x4 actions, user_profiles SELECT) were left unmerged in
-- earlier passes on the assumption that their differing conditions needed
-- a product decision. That reasoning was wrong: PostgreSQL always
-- evaluates permissive policies for the same command as an OR of all of
-- them, so folding two permissive policies' conditions into one policy
-- with an explicit OR is mathematically identical to leaving them as two
-- separate policies — it changes no access outcome for any user, it only
-- removes the redundant per-policy evaluation the linter flags. Unlike
-- dropping one policy (a real behavior change), merging is always safe.
--
-- Each pair below is folded into the more descriptively-named policy
-- (the one already named after the table, e.g. org_invites_delete) via
-- ALTER POLICY ... USING/WITH CHECK (existing_condition OR other_condition),
-- and the redundant "_consolidated" or duplicate policy is dropped.

-- org_invites DELETE: org_invites_delete (jwt admin OR inviter_id=self OR
-- org owner/admin membership) OR authenticated_delete_consolidated (org
-- owner/admin/editor membership OR created_by=self).
ALTER POLICY "org_invites_delete" ON public."org_invites"
  USING (
    (((select auth.jwt()) ->> 'role'::text) = 'admin'::text)
    OR (inviter_id = (select auth.uid()))
    OR (EXISTS (
      SELECT 1 FROM organization_memberships m
      WHERE m.user_id = (select auth.uid())
        AND m.organization_id = org_invites.organization_id
        AND m.role = ANY (ARRAY['owner'::text, 'admin'::text])
    ))
    OR (EXISTS (
      SELECT 1 FROM organization_memberships m
      WHERE m.user_id = (select auth.uid())
        AND lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])
        AND (m.organization_id)::text = (org_invites.organization_id)::text
    ))
    OR ((select auth.uid())::text = (created_by)::text)
  );
DROP POLICY IF EXISTS "authenticated_delete_consolidated" ON public."org_invites";

-- org_invites INSERT: org_invites_insert (created_by=self AND org
-- affiliation check) OR authenticated_insert_consolidated (org owner/
-- admin/editor membership OR created_by=self).
ALTER POLICY "org_invites_insert" ON public."org_invites"
  WITH CHECK (
    (
      (created_by = (select auth.uid()))
      AND (
        (organization_id = ANY (ARRAY(SELECT org_invites.organization_id FROM get_user_organization_ids() get_user_organization_ids(org_id))))
        OR (EXISTS (
          SELECT 1 FROM organization_memberships m
          WHERE m.organization_id = org_invites.organization_id
            AND m.user_id = (select auth.uid())
            AND m.role = ANY (ARRAY['owner'::text, 'admin'::text])
        ))
        OR (((select auth.jwt()) ->> 'role'::text) = 'admin'::text)
      )
    )
    OR (EXISTS (
      SELECT 1 FROM organization_memberships m
      WHERE m.user_id = (select auth.uid())
        AND lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])
        AND (m.organization_id)::text = (org_invites.organization_id)::text
    ))
    OR ((select auth.uid())::text = (created_by)::text)
  );
DROP POLICY IF EXISTS "authenticated_insert_consolidated" ON public."org_invites";

-- org_invites SELECT: org_invites_select (jwt admin OR org membership via
-- org_invites.organization_id) OR authenticated_select_consolidated (org
-- membership, any role/status OR created_by=self).
ALTER POLICY "org_invites_select" ON public."org_invites"
  USING (
    (((select auth.jwt()) ->> 'role'::text) = 'admin'::text)
    OR (EXISTS (
      SELECT 1 FROM organization_memberships m
      WHERE m.organization_id = org_invites.organization_id
        AND m.user_id = (select auth.uid())
    ))
    OR (EXISTS (
      SELECT 1 FROM organization_memberships m
      WHERE m.user_id = (select auth.uid())
        AND (m.organization_id)::text = (org_invites.organization_id)::text
    ))
    OR ((select auth.uid())::text = (created_by)::text)
  );
DROP POLICY IF EXISTS "authenticated_select_consolidated" ON public."org_invites";

-- org_invites UPDATE: org_invites_update (jwt admin OR inviter_id=self OR
-- org owner/admin membership) OR authenticated_update_consolidated (org
-- owner/admin/editor membership OR created_by=self). Both USING and WITH
-- CHECK merged identically (authenticated_update_consolidated had no
-- explicit WITH CHECK, so Postgres used its USING clause as an implicit
-- check — same net effect as merging it into the WITH CHECK here too).
ALTER POLICY "org_invites_update" ON public."org_invites"
  USING (
    (((select auth.jwt()) ->> 'role'::text) = 'admin'::text)
    OR (inviter_id = (select auth.uid()))
    OR (EXISTS (
      SELECT 1 FROM organization_memberships m
      WHERE m.user_id = (select auth.uid())
        AND m.organization_id = org_invites.organization_id
        AND m.role = ANY (ARRAY['owner'::text, 'admin'::text])
    ))
    OR (EXISTS (
      SELECT 1 FROM organization_memberships m
      WHERE m.user_id = (select auth.uid())
        AND lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])
        AND (m.organization_id)::text = (org_invites.organization_id)::text
    ))
    OR ((select auth.uid())::text = (created_by)::text)
  )
  WITH CHECK (
    (((select auth.jwt()) ->> 'role'::text) = 'admin'::text)
    OR (inviter_id = (select auth.uid()))
    OR (EXISTS (
      SELECT 1 FROM organization_memberships m
      WHERE m.user_id = (select auth.uid())
        AND m.organization_id = org_invites.organization_id
        AND m.role = ANY (ARRAY['owner'::text, 'admin'::text])
    ))
    OR (EXISTS (
      SELECT 1 FROM organization_memberships m
      WHERE m.user_id = (select auth.uid())
        AND lower(COALESCE(m.role, 'member'::text)) = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text])
        AND (m.organization_id)::text = (org_invites.organization_id)::text
    ))
    OR ((select auth.uid())::text = (created_by)::text)
  );
DROP POLICY IF EXISTS "authenticated_update_consolidated" ON public."org_invites";

-- user_profiles SELECT: users_read_own_profile (self) OR
-- platform_admin_full_access_users (platform_admin via JWT claims).
ALTER POLICY "users_read_own_profile" ON public."user_profiles"
  USING (
    ((select auth.uid()) = id)
    OR (
      ((((select current_setting('request.jwt.claims'::text, true))::json -> 'app_metadata'::text) ->> 'platform_role'::text) = 'platform_admin'::text)
    )
  );
DROP POLICY IF EXISTS "platform_admin_full_access_users" ON public."user_profiles";
