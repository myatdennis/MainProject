-- 2026-01-04 Organization profile + branding tables
create extension if not exists "uuid-ossp";

create table if not exists public.organization_profiles (
  org_id text primary key references public.organizations(id) on delete cascade,
  mission text,
  vision text,
  core_values jsonb not null default '[]'::jsonb,
  dei_priorities jsonb not null default '[]'::jsonb,
  tone_guidelines text,
  accessibility_commitments text,
  preferred_languages text[] not null default '{}'::text[],
  audience_segments jsonb not null default '[]'::jsonb,
  ai_context jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  last_ai_refresh_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'organization_profiles_set_updated_at'
  ) then
    create trigger organization_profiles_set_updated_at
      before update on public.organization_profiles
      for each row execute function public.set_updated_at();
  end if;
end$$;

create table if not exists public.organization_branding (
  org_id text primary key references public.organizations(id) on delete cascade,
  logo_url text,
  primary_color text,
  secondary_color text,
  accent_color text,
  typography jsonb not null default '{}'::jsonb,
  media jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'organization_branding_set_updated_at'
  ) then
    create trigger organization_branding_set_updated_at
      before update on public.organization_branding
      for each row execute function public.set_updated_at();
  end if;
end$$;

create table if not exists public.organization_contacts (
  id uuid primary key default gen_random_uuid(),
  org_id text not null references public.organizations(id) on delete cascade,
  name text not null,
  email text not null,
  role text,
  type text,
  phone text,
  is_primary boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_contacts_unique_email unique (org_id, email)
);

create index if not exists organization_contacts_org_id_idx on public.organization_contacts(org_id);

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'organization_contacts_set_updated_at'
  ) then
    create trigger organization_contacts_set_updated_at
      before update on public.organization_contacts
      for each row execute function public.set_updated_at();
  end if;
end$$;

-- Seed rows for existing orgs so RLS lookups succeed
insert into public.organization_profiles (org_id)
select id from public.organizations
on conflict (org_id) do nothing;

insert into public.organization_branding (org_id)
select id from public.organizations
on conflict (org_id) do nothing;

insert into public.organization_contacts (org_id, name, email, role, type, phone, is_primary)
select
  id as org_id,
  contact_person,
  contact_email,
  case when contact_person is not null then 'primary_contact' else null end,
  'primary',
  contact_phone,
  true
from public.organizations
where contact_person is not null and contact_email is not null
on conflict (org_id, email) do nothing;

-------------------------------------------------------------------------------
-- Row Level Security
-------------------------------------------------------------------------------
alter table public.organization_profiles enable row level security;
alter table public.organization_branding enable row level security;
alter table public.organization_contacts enable row level security;

create policy "org_profiles_service"
  on public.organization_profiles
  for all
  to service_role
  using (true)
  with check (true);

create policy "org_profiles_member_read"
  on public.organization_profiles
  for select
  to authenticated
  using (
    public._is_org_member(organization_profiles.org_id)
    or public._is_org_admin(organization_profiles.org_id)
  );

create policy "org_profiles_admin_manage"
  on public.organization_profiles
  for all
  to authenticated
  using (public._is_org_admin(organization_profiles.org_id))
  with check (public._is_org_admin(organization_profiles.org_id));

create policy "org_branding_service"
  on public.organization_branding
  for all
  to service_role
  using (true)
  with check (true);

create policy "org_branding_member_read"
  on public.organization_branding
  for select
  to authenticated
  using (
    public._is_org_member(organization_branding.org_id)
    or public._is_org_admin(organization_branding.org_id)
  );

create policy "org_branding_admin_manage"
  on public.organization_branding
  for all
  to authenticated
  using (public._is_org_admin(organization_branding.org_id))
  with check (public._is_org_admin(organization_branding.org_id));

create policy "org_contacts_service"
  on public.organization_contacts
  for all
  to service_role
  using (true)
  with check (true);

create policy "org_contacts_member_read"
  on public.organization_contacts
  for select
  to authenticated
  using (
    public._is_org_member(organization_contacts.org_id)
    or public._is_org_admin(organization_contacts.org_id)
  );

create policy "org_contacts_admin_manage"
  on public.organization_contacts
  for all
  to authenticated
  using (public._is_org_admin(organization_contacts.org_id))
  with check (public._is_org_admin(organization_contacts.org_id));
