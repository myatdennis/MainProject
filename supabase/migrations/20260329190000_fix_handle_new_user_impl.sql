-- Fix handle_new_user_impl to satisfy user_profiles NOT NULL email constraint and be resilient to missing metadata
-- Incident: Supabase auth user creation failed with database error due to trigger insert

CREATE OR REPLACE FUNCTION public.handle_new_user_impl()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'auth'
AS $$
DECLARE
  v_email text;
  v_first_name text;
  v_last_name text;
  v_role text;
  v_org_id uuid;
  v_active_org_id uuid;
  v_is_admin boolean;
  v_metadata jsonb;
BEGIN
  -- ensure a safe search_path for the duration of this function invocation
  SET LOCAL search_path = pg_catalog, public, auth;

  v_email := COALESCE(
    NULLIF(NEW.email, ''),
    NULLIF(NEW.raw_user_meta_data->>'email', ''),
    CONCAT('user-', NEW.id, '@placeholder.local')
  );
  v_first_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'first_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'given_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'firstName', '')
  );
  v_last_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'last_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'family_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'lastName', '')
  );
  v_role := COALESCE(NULLIF(NEW.raw_user_meta_data->>'role', ''), 'learner');
  v_org_id := NULLIF(COALESCE(NEW.raw_user_meta_data->>'organization_id', NEW.raw_user_meta_data->>'org_id'), '')::uuid;
  v_active_org_id := NULLIF(
    COALESCE(NEW.raw_user_meta_data->>'active_organization_id', NEW.raw_user_meta_data->>'activeOrgId'),
    ''
  )::uuid;
  v_is_admin := (
    LOWER(COALESCE(NEW.raw_app_meta_data->>'platform_role', '')) = 'platform_admin'
    OR LOWER(COALESCE(NEW.raw_user_meta_data->>'is_admin', 'false')) IN ('true', '1', 'yes')
  );
  v_metadata := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);

  INSERT INTO public.user_profiles (
    id,
    email,
    first_name,
    last_name,
    role,
    organization_id,
    is_active,
    metadata,
    created_at,
    updated_at,
    is_admin,
    active_organization_id
  )
  VALUES (
    NEW.id,
    v_email,
    v_first_name,
    v_last_name,
    v_role,
    v_org_id,
    true,
    v_metadata,
    now(),
    now(),
    v_is_admin,
    v_active_org_id
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    first_name = COALESCE(EXCLUDED.first_name, public.user_profiles.first_name),
    last_name = COALESCE(EXCLUDED.last_name, public.user_profiles.last_name),
    role = COALESCE(EXCLUDED.role, public.user_profiles.role),
    organization_id = COALESCE(EXCLUDED.organization_id, public.user_profiles.organization_id),
    is_active = COALESCE(EXCLUDED.is_active, public.user_profiles.is_active),
    metadata = COALESCE(public.user_profiles.metadata, '{}'::jsonb) || COALESCE(EXCLUDED.metadata, '{}'::jsonb),
    updated_at = now(),
    is_admin = COALESCE(EXCLUDED.is_admin, public.user_profiles.is_admin),
    active_organization_id = COALESCE(EXCLUDED.active_organization_id, public.user_profiles.active_organization_id);

  RETURN NEW;
END;
$$;
