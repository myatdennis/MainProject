-- =============================================================================
-- Preflight: add missing columns to organization_memberships before the view
-- migration references them.
-- Prod schema (remote_public_schema.sql) only has:
--   id, organization_id, user_id, role, status, invited_by, created_at, updated_at
-- The view created in 20260305140559 references accepted_at and last_seen_at.
-- =============================================================================

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'organization_memberships'
      and column_name  = 'accepted_at'
  ) then
    alter table public.organization_memberships
      add column accepted_at timestamptz;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'organization_memberships'
      and column_name  = 'last_seen_at'
  ) then
    alter table public.organization_memberships
      add column last_seen_at timestamptz;
  end if;
end $$;
