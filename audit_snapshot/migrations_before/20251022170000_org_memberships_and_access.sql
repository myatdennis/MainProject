create extension if not exists "uuid-ossp";

create table if not exists public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  org_id text not null references public.organizations(id) on delete cascade,
  user_id uuid not null,
  role text not null default 'member',
  invited_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists organization_memberships_unique on public.organization_memberships(org_id, user_id);
create index if not exists organization_memberships_user_idx on public.organization_memberships(user_id);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'organization_memberships_set_updated_at') then
    create trigger organization_memberships_set_updated_at
      before update on public.organization_memberships
      for each row execute function public.set_updated_at();
  end if;
end $$;

alter table public.organization_memberships enable row level security;

drop policy if exists "Members can view their membership" on public.organization_memberships;
drop policy if exists "Org admins manage memberships" on public.organization_memberships;
drop policy if exists "Service role access to memberships" on public.organization_memberships;

create policy "Members can view their membership"
  on public.organization_memberships
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "Org admins manage memberships"
  on public.organization_memberships
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.organization_memberships m
      where m.org_id = organization_memberships.org_id
        and m.user_id = auth.uid()
        and lower(coalesce(m.role, 'member')) in ('admin', 'owner')
    )
  )
  with check (
    exists (
      select 1
      from public.organization_memberships m
      where m.org_id = organization_memberships.org_id
        and m.user_id = auth.uid()
        and lower(coalesce(m.role, 'member')) in ('admin', 'owner')
    )
  );

create policy "Service role access to memberships"
  on public.organization_memberships
  for all
  to service_role
  using (true)
  with check (true);

-- Harden workspace policies to leverage organization membership roles
drop policy if exists "Authenticated access to strategic plans" on public.org_workspace_strategic_plans;
drop policy if exists "Service role access to strategic plans" on public.org_workspace_strategic_plans;
drop policy if exists "Authenticated access to session notes" on public.org_workspace_session_notes;
drop policy if exists "Service role access to session notes" on public.org_workspace_session_notes;
drop policy if exists "Authenticated access to action items" on public.org_workspace_action_items;
drop policy if exists "Service role access to action items" on public.org_workspace_action_items;

create policy "Members read strategic plans"
  on public.org_workspace_strategic_plans
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.organization_memberships m
      where m.org_id = org_workspace_strategic_plans.org_id
        and m.user_id = auth.uid()
    )
  );

create policy "Editors manage strategic plans"
  on public.org_workspace_strategic_plans
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.organization_memberships m
      where m.org_id = org_workspace_strategic_plans.org_id
        and m.user_id = auth.uid()
        and lower(coalesce(m.role, 'member')) in ('owner', 'admin', 'editor', 'manager')
    )
  )
  with check (
    exists (
      select 1
      from public.organization_memberships m
      where m.org_id = org_workspace_strategic_plans.org_id
        and m.user_id = auth.uid()
        and lower(coalesce(m.role, 'member')) in ('owner', 'admin', 'editor', 'manager')
    )
  );

create policy "Members read session notes"
  on public.org_workspace_session_notes
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.organization_memberships m
      where m.org_id = org_workspace_session_notes.org_id
        and m.user_id = auth.uid()
    )
  );

create policy "Editors manage session notes"
  on public.org_workspace_session_notes
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.organization_memberships m
      where m.org_id = org_workspace_session_notes.org_id
        and m.user_id = auth.uid()
        and lower(coalesce(m.role, 'member')) in ('owner', 'admin', 'editor', 'manager')
    )
  )
  with check (
    exists (
      select 1
      from public.organization_memberships m
      where m.org_id = org_workspace_session_notes.org_id
        and m.user_id = auth.uid()
        and lower(coalesce(m.role, 'member')) in ('owner', 'admin', 'editor', 'manager')
    )
  );

create policy "Members read action items"
  on public.org_workspace_action_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.organization_memberships m
      where m.org_id = org_workspace_action_items.org_id
        and m.user_id = auth.uid()
    )
  );

create policy "Editors manage action items"
  on public.org_workspace_action_items
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.organization_memberships m
      where m.org_id = org_workspace_action_items.org_id
        and m.user_id = auth.uid()
        and lower(coalesce(m.role, 'member')) in ('owner', 'admin', 'editor', 'manager')
    )
  )
  with check (
    exists (
      select 1
      from public.organization_memberships m
      where m.org_id = org_workspace_action_items.org_id
        and m.user_id = auth.uid()
        and lower(coalesce(m.role, 'member')) in ('owner', 'admin', 'editor', 'manager')
    )
  );

create policy "Service role access to strategic plans"
  on public.org_workspace_strategic_plans
  for all
  to service_role
  using (true)
  with check (true);

create policy "Service role access to session notes"
  on public.org_workspace_session_notes
  for all
  to service_role
  using (true)
  with check (true);

create policy "Service role access to action items"
  on public.org_workspace_action_items
  for all
  to service_role
  using (true)
  with check (true);

-- Align notifications table to membership awareness
alter table public.notifications
  alter column user_id type uuid using nullif(user_id, '')::uuid;

alter table public.notifications enable row level security;

drop policy if exists "Authenticated access to notifications" on public.notifications;
drop policy if exists "Service role access to notifications" on public.notifications;

create policy "Users read their notifications"
  on public.notifications
  for select
  to authenticated
  using (
    (user_id is not null and user_id = auth.uid())
    or (
      org_id is not null and exists (
        select 1
        from public.organization_memberships m
        where m.org_id = notifications.org_id
          and m.user_id = auth.uid()
      )
    )
  );

create policy "Org editors manage notifications"
  on public.notifications
  for all
  to authenticated
  using (
    org_id is null and user_id = auth.uid()
    or (
      org_id is not null and exists (
        select 1
        from public.organization_memberships m
        where m.org_id = notifications.org_id
          and m.user_id = auth.uid()
          and lower(coalesce(m.role, 'member')) in ('owner', 'admin', 'editor', 'manager')
      )
    )
  )
  with check (
    org_id is null and user_id = auth.uid()
    or (
      org_id is not null and exists (
        select 1
        from public.organization_memberships m
        where m.org_id = notifications.org_id
          and m.user_id = auth.uid()
          and lower(coalesce(m.role, 'member')) in ('owner', 'admin', 'editor', 'manager')
      )
    )
  );

create policy "Service role access to notifications"
  on public.notifications
  for all
  to service_role
  using (true)
  with check (true);
