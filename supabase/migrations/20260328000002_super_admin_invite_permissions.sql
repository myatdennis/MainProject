-- Ensure platform super-admin can invite/create users in any org.
-- This migration creates helper functions and updates the org_invites integrity trigger.

BEGIN;

-- 1) `is_platform_admin_inviter` helper
DROP FUNCTION IF EXISTS public.is_platform_admin_inviter(uuid);
CREATE OR REPLACE FUNCTION public.is_platform_admin_inviter(inviter_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'auth', 'pg_catalog'
AS $$
DECLARE
  profile_role text;
  profile_is_admin boolean;
  profile_email text;
BEGIN
  IF inviter_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT role, is_admin, email
  INTO profile_role, profile_is_admin, profile_email
  FROM public.user_profiles
  WHERE id = inviter_id
  LIMIT 1;

  IF profile_is_admin THEN
    RETURN true;
  END IF;

  IF profile_role IS NOT NULL AND lower(dtrim(profile_role)) = 'admin' THEN
    RETURN true;
  END IF;

  IF profile_email IS NOT NULL AND lower(trim(profile_email)) = 'mya@the-huddle.co' THEN
    RETURN true;
  END IF;

  IF EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = inviter_id) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- 2) `can_invite_to_org` helper
-- Do not drop this function because policies may depend on it; use CREATE OR REPLACE.
CREATE OR REPLACE FUNCTION public.can_invite_to_org(auth_user uuid, target_org uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'auth', 'pg_catalog'
AS $$
BEGIN
  IF auth_user IS NULL OR target_org IS NULL THEN
    RETURN false;
  END IF;

  IF public.is_platform_admin_inviter(auth_user) THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.organization_memberships m
    WHERE m.user_id = auth_user
      AND m.organization_id = target_org
      AND coalesce(lower(m.status), '') = 'active'
      AND coalesce(lower(m.role), '') IN ('owner', 'admin', 'org_admin', 'organization_admin', 'super_admin', 'member')
  );
END;
$$;

-- 3) Replace org_invites integrity trigger implementation
-- Do not drop this function; the trigger depends on it.
CREATE OR REPLACE FUNCTION public.org_invites_integrity_trigger_impl()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'auth', 'pg_catalog'
AS $$
DECLARE
  inviter_count int;
  creator_count int;
BEGIN
  -- org_id must be present
  IF NEW.org_id IS NULL THEN
    RAISE EXCEPTION 'org_id cannot be null for org_invites';
  END IF;

  IF NEW.status IN ('pending', 'sent') THEN
    IF NEW.expires_at IS NULL THEN
      RAISE EXCEPTION 'expires_at cannot be null for org_invites';
    END IF;
    IF NEW.expires_at <= now() THEN
      RAISE EXCEPTION 'expires_at must be in the future';
    END IF;

    IF NEW.inviter_id IS NOT NULL THEN
      IF NOT public.can_invite_to_org(NEW.inviter_id, NEW.org_id) THEN
        RAISE EXCEPTION 'inviter_id (%) is not authorized to invite in org %', NEW.inviter_id, NEW.org_id;
      END IF;
    END IF;

    IF NEW.created_by IS NOT NULL THEN
      IF NOT public.can_invite_to_org(NEW.created_by, NEW.org_id) THEN
        RAISE EXCEPTION 'created_by (%) is not authorized to create in org %', NEW.created_by, NEW.org_id;
      END IF;
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.org_id IS DISTINCT FROM NEW.org_id THEN
      RAISE EXCEPTION 'org_id cannot be changed once set';
    END IF;
  END IF;

  IF NEW.created_by IS NULL AND NEW.inviter_id IS NOT NULL THEN
    NEW.created_by := NEW.inviter_id;
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;
