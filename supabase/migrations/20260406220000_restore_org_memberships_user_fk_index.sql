-- Restore FK-covering index for organization_memberships.user_id
--
-- Why:
-- Supabase linter warning:
--   unindexed_foreign_keys_public_organization_memberships_organization_memberships_user_id_fkey
--
-- The FK organization_memberships_user_id_fkey points to user_id and should
-- have a dedicated index where user_id is the leading column. A composite
-- index on (organization_id, user_id) does not cover user_id-leading lookups.

BEGIN;

CREATE INDEX IF NOT EXISTS organization_memberships_user_id_idx
  ON public.organization_memberships (user_id);

COMMIT;
