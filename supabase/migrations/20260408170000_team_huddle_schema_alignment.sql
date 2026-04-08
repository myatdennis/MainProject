create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Team Huddle schema alignment
-- - Canonical table names:
--     public.team_huddle_posts
--     public.team_huddle_comments
--     public.team_huddle_post_reactions
--     public.team_huddle_reports
-- - Canonical actor columns:
--     user_id / reporter_user_id
-- ---------------------------------------------------------------------------

-- Promote legacy reactions table name if present.
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'team_huddle_reactions'
  ) and not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'team_huddle_post_reactions'
  ) then
    execute 'alter table public.team_huddle_reactions rename to team_huddle_post_reactions';
  end if;
end
$$;

create table if not exists public.team_huddle_posts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  user_id uuid not null,
  title text null,
  body text not null,
  post_type text not null default 'text',
  link_url text null,
  video_url text null,
  status text not null default 'active',
  is_pinned boolean not null default false,
  topics text[] not null default '{}'::text[],
  pinned_at timestamptz null,
  pinned_by_user_id uuid null,
  locked_at timestamptz null,
  locked_by_user_id uuid null,
  hidden_at timestamptz null,
  hidden_by_user_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create table if not exists public.team_huddle_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.team_huddle_posts(id) on delete cascade,
  organization_id uuid not null,
  user_id uuid not null,
  parent_comment_id uuid null references public.team_huddle_comments(id) on delete cascade,
  body text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create table if not exists public.team_huddle_post_reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.team_huddle_posts(id) on delete cascade,
  organization_id uuid not null,
  user_id uuid not null,
  reaction_type text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (post_id, user_id)
);

create table if not exists public.team_huddle_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  reporter_user_id uuid not null,
  post_id uuid null references public.team_huddle_posts(id) on delete cascade,
  comment_id uuid null references public.team_huddle_comments(id) on delete cascade,
  reason text not null,
  details text null,
  status text not null default 'open',
  resolved_at timestamptz null,
  resolved_by_user_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Legacy column upgrades on existing deployments.
do $$
begin
  -- posts.author_user_id -> posts.user_id
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='team_huddle_posts' and column_name='author_user_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='team_huddle_posts' and column_name='user_id'
  ) then
    alter table public.team_huddle_posts add column user_id uuid;
    update public.team_huddle_posts set user_id = author_user_id where user_id is null;
    alter table public.team_huddle_posts alter column user_id set not null;
  end if;

  -- comments.author_user_id -> comments.user_id
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='team_huddle_comments' and column_name='author_user_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='team_huddle_comments' and column_name='user_id'
  ) then
    alter table public.team_huddle_comments add column user_id uuid;
    update public.team_huddle_comments set user_id = author_user_id where user_id is null;
    alter table public.team_huddle_comments alter column user_id set not null;
  end if;

  -- reports.reported_by_user_id -> reports.reporter_user_id
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='team_huddle_reports' and column_name='reported_by_user_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='team_huddle_reports' and column_name='reporter_user_id'
  ) then
    alter table public.team_huddle_reports add column reporter_user_id uuid;
    update public.team_huddle_reports set reporter_user_id = reported_by_user_id where reporter_user_id is null;
    alter table public.team_huddle_reports alter column reporter_user_id set not null;
  end if;

  -- Ensure required columns exist on legacy tables.
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='team_huddle_posts' and column_name='post_type'
  ) then
    alter table public.team_huddle_posts add column post_type text not null default 'text';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='team_huddle_posts' and column_name='link_url'
  ) then
    alter table public.team_huddle_posts add column link_url text null;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='team_huddle_posts' and column_name='video_url'
  ) then
    alter table public.team_huddle_posts add column video_url text null;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='team_huddle_posts' and column_name='status'
  ) then
    alter table public.team_huddle_posts add column status text not null default 'active';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='team_huddle_posts' and column_name='is_pinned'
  ) then
    alter table public.team_huddle_posts add column is_pinned boolean not null default false;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='team_huddle_comments' and column_name='status'
  ) then
    alter table public.team_huddle_comments add column status text not null default 'active';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='team_huddle_reports' and column_name='details'
  ) then
    alter table public.team_huddle_reports add column details text null;
  end if;

  -- Make reports.post_id nullable for report flexibility.
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='team_huddle_reports' and column_name='post_id' and is_nullable='NO'
  ) then
    alter table public.team_huddle_reports alter column post_id drop not null;
  end if;
end
$$;

-- Optional foreign keys (safe if parent tables exist)
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='organizations') then
    if not exists (
      select 1 from pg_constraint where conname = 'team_huddle_posts_organization_id_fkey'
    ) then
      alter table public.team_huddle_posts
        add constraint team_huddle_posts_organization_id_fkey
        foreign key (organization_id) references public.organizations(id) on delete cascade;
    end if;

    if not exists (
      select 1 from pg_constraint where conname = 'team_huddle_comments_organization_id_fkey'
    ) then
      alter table public.team_huddle_comments
        add constraint team_huddle_comments_organization_id_fkey
        foreign key (organization_id) references public.organizations(id) on delete cascade;
    end if;

    if not exists (
      select 1 from pg_constraint where conname = 'team_huddle_post_reactions_organization_id_fkey'
    ) then
      alter table public.team_huddle_post_reactions
        add constraint team_huddle_post_reactions_organization_id_fkey
        foreign key (organization_id) references public.organizations(id) on delete cascade;
    end if;

    if not exists (
      select 1 from pg_constraint where conname = 'team_huddle_reports_organization_id_fkey'
    ) then
      alter table public.team_huddle_reports
        add constraint team_huddle_reports_organization_id_fkey
        foreign key (organization_id) references public.organizations(id) on delete cascade;
    end if;
  end if;
end
$$;

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='auth' and table_name='users') then
    if not exists (
      select 1 from pg_constraint where conname = 'team_huddle_posts_user_id_fkey'
    ) then
      alter table public.team_huddle_posts
        add constraint team_huddle_posts_user_id_fkey
        foreign key (user_id) references auth.users(id) on delete cascade;
    end if;

    if not exists (
      select 1 from pg_constraint where conname = 'team_huddle_comments_user_id_fkey'
    ) then
      alter table public.team_huddle_comments
        add constraint team_huddle_comments_user_id_fkey
        foreign key (user_id) references auth.users(id) on delete cascade;
    end if;

    if not exists (
      select 1 from pg_constraint where conname = 'team_huddle_post_reactions_user_id_fkey'
    ) then
      alter table public.team_huddle_post_reactions
        add constraint team_huddle_post_reactions_user_id_fkey
        foreign key (user_id) references auth.users(id) on delete cascade;
    end if;

    if not exists (
      select 1 from pg_constraint where conname = 'team_huddle_reports_reporter_user_id_fkey'
    ) then
      alter table public.team_huddle_reports
        add constraint team_huddle_reports_reporter_user_id_fkey
        foreign key (reporter_user_id) references auth.users(id) on delete cascade;
    end if;
  end if;
end
$$;

create index if not exists team_huddle_posts_org_created_idx
  on public.team_huddle_posts (organization_id, created_at desc);
create index if not exists team_huddle_comments_post_created_idx
  on public.team_huddle_comments (post_id, created_at);
create index if not exists team_huddle_post_reactions_post_idx
  on public.team_huddle_post_reactions (post_id);
create index if not exists team_huddle_reports_org_status_idx
  on public.team_huddle_reports (organization_id, status);

create or replace function public.team_huddle_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_team_huddle_posts_updated_at on public.team_huddle_posts;
create trigger trg_team_huddle_posts_updated_at
before update on public.team_huddle_posts
for each row execute function public.team_huddle_set_updated_at();

drop trigger if exists trg_team_huddle_comments_updated_at on public.team_huddle_comments;
create trigger trg_team_huddle_comments_updated_at
before update on public.team_huddle_comments
for each row execute function public.team_huddle_set_updated_at();

drop trigger if exists trg_team_huddle_post_reactions_updated_at on public.team_huddle_post_reactions;
create trigger trg_team_huddle_post_reactions_updated_at
before update on public.team_huddle_post_reactions
for each row execute function public.team_huddle_set_updated_at();

drop trigger if exists trg_team_huddle_reports_updated_at on public.team_huddle_reports;
create trigger trg_team_huddle_reports_updated_at
before update on public.team_huddle_reports
for each row execute function public.team_huddle_set_updated_at();

alter table public.team_huddle_posts enable row level security;
alter table public.team_huddle_comments enable row level security;
alter table public.team_huddle_post_reactions enable row level security;
alter table public.team_huddle_reports enable row level security;

create or replace function public.team_huddle_is_org_member(org_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.organization_memberships m
    where m.organization_id = org_id
      and m.user_id = (select auth.uid())
      and coalesce(m.status, 'active') = 'active'
      and coalesce(m.is_active, true) = true
  );
$$;

create or replace function public.team_huddle_is_org_admin(org_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.organization_memberships m
    where m.organization_id = org_id
      and m.user_id = (select auth.uid())
      and coalesce(m.status, 'active') = 'active'
      and coalesce(m.is_active, true) = true
      and lower(coalesce(m.role, 'member')) in ('admin', 'owner', 'platform_admin')
  );
$$;

-- Clear and recreate policies idempotently.
drop policy if exists team_huddle_posts_service_all on public.team_huddle_posts;
drop policy if exists team_huddle_posts_member_read on public.team_huddle_posts;
drop policy if exists team_huddle_posts_member_insert on public.team_huddle_posts;
drop policy if exists team_huddle_posts_owner_admin_update on public.team_huddle_posts;
drop policy if exists team_huddle_posts_owner_admin_delete on public.team_huddle_posts;

create policy team_huddle_posts_service_all
on public.team_huddle_posts
for all
to service_role
using (true)
with check (true);

create policy team_huddle_posts_member_read
on public.team_huddle_posts
for select
to authenticated
using (
  public.team_huddle_is_org_member(organization_id)
  and deleted_at is null
  and coalesce(status, 'active') = 'active'
);

create policy team_huddle_posts_member_insert
on public.team_huddle_posts
for insert
to authenticated
with check (
  public.team_huddle_is_org_member(organization_id)
  and user_id = (select auth.uid())
);

create policy team_huddle_posts_owner_admin_update
on public.team_huddle_posts
for update
to authenticated
using (
  user_id = (select auth.uid())
  or public.team_huddle_is_org_admin(organization_id)
)
with check (
  public.team_huddle_is_org_member(organization_id)
);

create policy team_huddle_posts_owner_admin_delete
on public.team_huddle_posts
for delete
to authenticated
using (
  user_id = (select auth.uid())
  or public.team_huddle_is_org_admin(organization_id)
);


drop policy if exists team_huddle_comments_service_all on public.team_huddle_comments;
drop policy if exists team_huddle_comments_member_read on public.team_huddle_comments;
drop policy if exists team_huddle_comments_member_insert on public.team_huddle_comments;
drop policy if exists team_huddle_comments_owner_admin_update on public.team_huddle_comments;
drop policy if exists team_huddle_comments_owner_admin_delete on public.team_huddle_comments;

create policy team_huddle_comments_service_all
on public.team_huddle_comments
for all
to service_role
using (true)
with check (true);

create policy team_huddle_comments_member_read
on public.team_huddle_comments
for select
to authenticated
using (
  public.team_huddle_is_org_member(organization_id)
  and deleted_at is null
  and coalesce(status, 'active') = 'active'
);

create policy team_huddle_comments_member_insert
on public.team_huddle_comments
for insert
to authenticated
with check (
  public.team_huddle_is_org_member(organization_id)
  and user_id = (select auth.uid())
);

create policy team_huddle_comments_owner_admin_update
on public.team_huddle_comments
for update
to authenticated
using (
  user_id = (select auth.uid())
  or public.team_huddle_is_org_admin(organization_id)
)
with check (
  public.team_huddle_is_org_member(organization_id)
);

create policy team_huddle_comments_owner_admin_delete
on public.team_huddle_comments
for delete
to authenticated
using (
  user_id = (select auth.uid())
  or public.team_huddle_is_org_admin(organization_id)
);


drop policy if exists team_huddle_reactions_service_all on public.team_huddle_post_reactions;
drop policy if exists team_huddle_reactions_member_read on public.team_huddle_post_reactions;
drop policy if exists team_huddle_reactions_member_insert on public.team_huddle_post_reactions;
drop policy if exists team_huddle_reactions_owner_admin_update on public.team_huddle_post_reactions;
drop policy if exists team_huddle_reactions_owner_admin_delete on public.team_huddle_post_reactions;

create policy team_huddle_reactions_service_all
on public.team_huddle_post_reactions
for all
to service_role
using (true)
with check (true);

create policy team_huddle_reactions_member_read
on public.team_huddle_post_reactions
for select
to authenticated
using (
  public.team_huddle_is_org_member(organization_id)
);

create policy team_huddle_reactions_member_insert
on public.team_huddle_post_reactions
for insert
to authenticated
with check (
  public.team_huddle_is_org_member(organization_id)
  and user_id = (select auth.uid())
  and lower(reaction_type) in ('like', 'dislike', 'love')
);

create policy team_huddle_reactions_owner_admin_update
on public.team_huddle_post_reactions
for update
to authenticated
using (
  user_id = (select auth.uid())
  or public.team_huddle_is_org_admin(organization_id)
)
with check (
  public.team_huddle_is_org_member(organization_id)
  and lower(reaction_type) in ('like', 'dislike', 'love')
);

create policy team_huddle_reactions_owner_admin_delete
on public.team_huddle_post_reactions
for delete
to authenticated
using (
  user_id = (select auth.uid())
  or public.team_huddle_is_org_admin(organization_id)
);


drop policy if exists team_huddle_reports_service_all on public.team_huddle_reports;
drop policy if exists team_huddle_reports_admin_read on public.team_huddle_reports;
drop policy if exists team_huddle_reports_member_insert on public.team_huddle_reports;
drop policy if exists team_huddle_reports_admin_update on public.team_huddle_reports;

create policy team_huddle_reports_service_all
on public.team_huddle_reports
for all
to service_role
using (true)
with check (true);

create policy team_huddle_reports_admin_read
on public.team_huddle_reports
for select
to authenticated
using (
  public.team_huddle_is_org_admin(organization_id)
);

create policy team_huddle_reports_member_insert
on public.team_huddle_reports
for insert
to authenticated
with check (
  public.team_huddle_is_org_member(organization_id)
  and reporter_user_id = (select auth.uid())
);

create policy team_huddle_reports_admin_update
on public.team_huddle_reports
for update
to authenticated
using (
  public.team_huddle_is_org_admin(organization_id)
)
with check (
  public.team_huddle_is_org_admin(organization_id)
);
