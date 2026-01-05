-- 2026-01-04 Expand user_profiles with organization + preference fields
alter table if exists public.user_profiles
  add column if not exists organization_id text references public.organizations(id) on delete set null,
  add column if not exists title text,
  add column if not exists department text,
  add column if not exists location text,
  add column if not exists timezone text,
  add column if not exists phone text,
  add column if not exists language text,
  add column if not exists pronouns text,
  add column if not exists preferences jsonb not null default '{}'::jsonb,
  add column if not exists accessibility_prefs jsonb not null default '{}'::jsonb,
  add column if not exists notification_settings jsonb not null default '{}'::jsonb;

-- helper view for quick access to preference summaries
create or replace view public.user_profile_preferences_vw as
select
  up.id as profile_id,
  up.user_id,
  up.organization_id,
  coalesce(up.preferences, '{}'::jsonb) as preferences,
  coalesce(up.accessibility_prefs, '{}'::jsonb) as accessibility_prefs,
  coalesce(up.notification_settings, '{}'::jsonb) as notification_settings,
  up.updated_at
from public.user_profiles up;
