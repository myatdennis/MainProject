-- Add admin flag to user_profiles for consistent portal access
alter table if exists public.user_profiles
  add column if not exists is_admin boolean not null default false;

create index if not exists user_profiles_is_admin_idx
  on public.user_profiles (is_admin);

comment on column public.user_profiles.is_admin is
  'Grants Huddle admin portal access when true';
