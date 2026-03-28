-- Supabase migration: Add user_profiles, organization_memberships, admin_users (if missing)
-- and harmonize org_invites organization_id/org_id columns.
-- This migration is adapted from the repo-level migration and is intentionally
-- defensive to avoid failing when org_invites or columns are not present.

BEGIN;

-- Ensure a UUID generator is available. gen_random_uuid() comes from pgcrypto.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Create user_profiles table if missing (canonical user/profile data)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE,
  first_name text,
  last_name text,
  role text,
  is_active boolean DEFAULT true,
  mfa_secret text,
  organization_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles (lower(email));

-- 2) Create organization_memberships table if missing
CREATE TABLE IF NOT EXISTS public.organization_memberships (
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text DEFAULT 'member',
  status text DEFAULT 'active',
  invited_by uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON public.organization_memberships (user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON public.organization_memberships (organization_id);

-- 3) Create admin_users bookkeeping table if missing
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_users_org_id ON public.admin_users (organization_id);

-- 4) Harmonize org_invites columns safely: only operate when the table/columns exist.
DO $$
BEGIN
  -- Only proceed if the table exists in the public schema
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'org_invites') THEN
    -- Add columns if missing
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'org_invites' AND column_name = 'organization_id'
    ) THEN
      EXECUTE 'ALTER TABLE public.org_invites ADD COLUMN organization_id uuid';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'org_invites' AND column_name = 'org_id'
    ) THEN
      EXECUTE 'ALTER TABLE public.org_invites ADD COLUMN org_id uuid';
    END IF;

    -- If both columns are present, copy values between them as needed and create indexes.
    IF EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'org_invites' AND column_name = 'org_id'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'org_invites' AND column_name = 'organization_id'
    ) THEN
      -- Copy org_id -> organization_id where appropriate
      EXECUTE 'UPDATE public.org_invites SET organization_id = org_id WHERE organization_id IS NULL AND org_id IS NOT NULL';

      -- Copy organization_id -> org_id for legacy clients where appropriate
      EXECUTE 'UPDATE public.org_invites SET org_id = organization_id WHERE org_id IS NULL AND organization_id IS NOT NULL';

      -- Create indexes if they don't exist
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_org_invites_organization_id ON public.org_invites (organization_id)';
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_org_invites_org_id ON public.org_invites (org_id)';

      -- Safely set NOT NULL only when no rows would violate it
      IF (SELECT COUNT(*) FROM public.org_invites WHERE organization_id IS NULL) = 0 THEN
        EXECUTE 'ALTER TABLE public.org_invites ALTER COLUMN organization_id SET NOT NULL';
      END IF;
    END IF;
  END IF;
END$$;

COMMIT;
