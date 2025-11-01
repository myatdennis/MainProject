create extension if not exists "uuid-ossp";

create table if not exists public.surveys (
  id text primary key default gen_random_uuid()::text,
  title text not null,
  description text,
  type text,
  status text not null default 'draft',
  sections jsonb not null default '[]'::jsonb,
  branding jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  assigned_to jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists surveys_status_idx on public.surveys(status);
create index if not exists surveys_type_idx on public.surveys(type);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'surveys_set_updated_at') then
    create trigger surveys_set_updated_at
    before update on public.surveys
    for each row execute function public.set_updated_at();
  end if;
end$$;
