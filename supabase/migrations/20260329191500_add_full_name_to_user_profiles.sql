-- Add missing full_name column used by application provisioning

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS full_name text;

-- Optional backfill for existing rows
UPDATE public.user_profiles
SET full_name = COALESCE(full_name, CONCAT_WS(' ', first_name, last_name))
WHERE full_name IS NULL;
