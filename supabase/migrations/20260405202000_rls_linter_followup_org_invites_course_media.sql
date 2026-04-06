-- Follow-up fix for Supabase linter warnings:
--   - auth_rls_initplan on org_invites_* and course_media_assets("allow org members")
--   - duplicate_index on user_course_progress_{pkey,unique}
--
-- This migration is intentionally idempotent and safe across mixed schema states.

BEGIN;

-- ---------------------------------------------------------------------------
-- org_invites policies: use the strict wrapper form
--   ((SELECT auth.jwt()) ->> 'role')
--   (SELECT auth.uid())
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "org_invites_select" ON public.org_invites;
DROP POLICY IF EXISTS "org_invites_insert" ON public.org_invites;
DROP POLICY IF EXISTS "org_invites_update" ON public.org_invites;
DROP POLICY IF EXISTS "org_invites_delete" ON public.org_invites;

CREATE POLICY "org_invites_select"
  ON public.org_invites
  FOR SELECT
  TO authenticated
  USING (
    ((SELECT auth.jwt()) ->> 'role') = 'admin'
    OR EXISTS (
      SELECT 1
      FROM public.organization_memberships m
      WHERE m.organization_id = org_invites.organization_id
        AND m.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "org_invites_insert"
  ON public.org_invites
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND (
      organization_id = ANY (
        ARRAY(SELECT organization_id FROM get_user_organization_ids())
      )
      OR EXISTS (
        SELECT 1
        FROM public.organization_memberships m
        WHERE m.organization_id = org_invites.organization_id
          AND m.user_id = (SELECT auth.uid())
          AND m.role = ANY (ARRAY['owner', 'admin'])
      )
      OR ((SELECT auth.jwt()) ->> 'role') = 'admin'
    )
  );

CREATE POLICY "org_invites_update"
  ON public.org_invites
  FOR UPDATE
  TO authenticated
  USING (
    ((SELECT auth.jwt()) ->> 'role') = 'admin'
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
    ((SELECT auth.jwt()) ->> 'role') = 'admin'
    OR inviter_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.organization_memberships m
      WHERE m.user_id = (SELECT auth.uid())
        AND m.organization_id = org_invites.organization_id
        AND m.role = ANY (ARRAY['owner', 'admin'])
    )
  );

CREATE POLICY "org_invites_delete"
  ON public.org_invites
  FOR DELETE
  TO authenticated
  USING (
    ((SELECT auth.jwt()) ->> 'role') = 'admin'
    OR inviter_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.organization_memberships m
      WHERE m.user_id = (SELECT auth.uid())
        AND m.organization_id = org_invites.organization_id
        AND m.role = ANY (ARRAY['owner', 'admin'])
    )
  );

-- ---------------------------------------------------------------------------
-- course_media_assets policy: strict wrapped auth.uid() call
-- ---------------------------------------------------------------------------
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
        AND COALESCE(m.status, 'active') = 'active'
    )
  );

-- ---------------------------------------------------------------------------
-- duplicate_index: remove user_course_progress_unique when it duplicates pkey
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  pkey_oid oid;
  dup_oid oid;
  is_duplicate boolean := false;
  dup_constraint_name text;
BEGIN
  SELECT c.oid
    INTO pkey_oid
  FROM pg_class c
  WHERE c.relkind = 'i'
    AND c.relname = 'user_course_progress_pkey'
    AND c.relnamespace = 'public'::regnamespace;

  SELECT c.oid
    INTO dup_oid
  FROM pg_class c
  WHERE c.relkind = 'i'
    AND c.relname = 'user_course_progress_unique'
    AND c.relnamespace = 'public'::regnamespace;

  IF pkey_oid IS NULL OR dup_oid IS NULL THEN
    RETURN;
  END IF;

  SELECT (pi.indrelid = di.indrelid)
     AND (pi.indnkeyatts = di.indnkeyatts)
     AND (pi.indnatts = di.indnatts)
     AND (pi.indisunique = di.indisunique)
     AND (pi.indkey = di.indkey)
     AND (pi.indclass = di.indclass)
     AND (pi.indcollation = di.indcollation)
     AND (pi.indoption = di.indoption)
     AND (pg_get_expr(pi.indpred, pi.indrelid) IS NOT DISTINCT FROM pg_get_expr(di.indpred, di.indrelid))
     AND (pg_get_expr(pi.indexprs, pi.indrelid) IS NOT DISTINCT FROM pg_get_expr(di.indexprs, di.indrelid))
    INTO is_duplicate
  FROM pg_index pi
  JOIN pg_index di ON TRUE
  WHERE pi.indexrelid = pkey_oid
    AND di.indexrelid = dup_oid;

  IF NOT is_duplicate THEN
    RETURN;
  END IF;

  SELECT con.conname
    INTO dup_constraint_name
  FROM pg_constraint con
  WHERE con.conindid = dup_oid
  LIMIT 1;

  IF dup_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.user_course_progress DROP CONSTRAINT IF EXISTS %I', dup_constraint_name);
  ELSE
    EXECUTE 'DROP INDEX IF EXISTS public.user_course_progress_unique';
  END IF;
END $$;

COMMIT;
