create extension if not exists "uuid-ossp";

create table if not exists public.org_workspace_strategic_plans (
  id text primary key default gen_random_uuid()::text,
  org_id text not null references public.organizations(id) on delete cascade,
  content text not null,
  created_by text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists org_workspace_strategic_plans_org_idx on public.org_workspace_strategic_plans(org_id);

create table if not exists public.org_workspace_session_notes (
  id text primary key default gen_random_uuid()::text,
  org_id text not null references public.organizations(id) on delete cascade,
  title text not null,
  body text,
  note_date timestamptz not null default now(),
  tags jsonb not null default '[]'::jsonb,
  attachments jsonb not null default '[]'::jsonb,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists org_workspace_session_notes_org_idx on public.org_workspace_session_notes(org_id);
create index if not exists org_workspace_session_notes_date_idx on public.org_workspace_session_notes(note_date desc);

create table if not exists public.org_workspace_action_items (
  id text primary key default gen_random_uuid()::text,
  org_id text not null references public.organizations(id) on delete cascade,
  title text not null,
  description text,
  assignee text,
  due_at timestamptz,
  status text not null default 'Not Started',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists org_workspace_action_items_org_idx on public.org_workspace_action_items(org_id);
create index if not exists org_workspace_action_items_status_idx on public.org_workspace_action_items(status);
create index if not exists org_workspace_action_items_due_idx on public.org_workspace_action_items(due_at);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'org_workspace_strategic_plans_set_updated_at') then
    create trigger org_workspace_strategic_plans_set_updated_at
      before update on public.org_workspace_strategic_plans
      for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'org_workspace_session_notes_set_updated_at') then
    create trigger org_workspace_session_notes_set_updated_at
      before update on public.org_workspace_session_notes
      for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'org_workspace_action_items_set_updated_at') then
    create trigger org_workspace_action_items_set_updated_at
      before update on public.org_workspace_action_items
      for each row execute function public.set_updated_at();
  end if;
end $$;

alter table public.org_workspace_strategic_plans enable row level security;
alter table public.org_workspace_session_notes enable row level security;
alter table public.org_workspace_action_items enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "Authenticated access to strategic plans" on public.org_workspace_strategic_plans;
drop policy if exists "Authenticated access to session notes" on public.org_workspace_session_notes;
drop policy if exists "Authenticated access to action items" on public.org_workspace_action_items;
drop policy if exists "Service role access to strategic plans" on public.org_workspace_strategic_plans;
drop policy if exists "Service role access to session notes" on public.org_workspace_session_notes;
drop policy if exists "Service role access to action items" on public.org_workspace_action_items;
drop policy if exists "Authenticated access to notifications" on public.notifications;
drop policy if exists "Service role access to notifications" on public.notifications;

create policy "Authenticated access to strategic plans"
  on public.org_workspace_strategic_plans
  for all
  to authenticated
  using (true)
  with check (true);

create policy "Service role access to strategic plans"
  on public.org_workspace_strategic_plans
  for all
  to service_role
  using (true)
  with check (true);

create policy "Authenticated access to session notes"
  on public.org_workspace_session_notes
  for all
  to authenticated
  using (true)
  with check (true);

create policy "Service role access to session notes"
  on public.org_workspace_session_notes
  for all
  to service_role
  using (true)
  with check (true);

create policy "Authenticated access to action items"
  on public.org_workspace_action_items
  for all
  to authenticated
  using (true)
  with check (true);

create policy "Service role access to action items"
  on public.org_workspace_action_items
  for all
  to service_role
  using (true)
  with check (true);

create policy "Authenticated access to notifications"
  on public.notifications
  for all
  to authenticated
  using (true)
  with check (true);

create policy "Service role access to notifications"
  on public.notifications
  for all
  to service_role
  using (true)
  with check (true);
