create extension if not exists "pgcrypto";

create table if not exists public.team_huddle_posts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  topics text[] not null default '{}'::text[],
  pinned_at timestamptz,
  pinned_by_user_id uuid references auth.users(id) on delete set null,
  locked_at timestamptz,
  locked_by_user_id uuid references auth.users(id) on delete set null,
  hidden_at timestamptz,
  hidden_by_user_id uuid references auth.users(id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.team_huddle_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.team_huddle_posts(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  parent_comment_id uuid references public.team_huddle_comments(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  deleted_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.team_huddle_reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.team_huddle_posts(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction_type text not null check (reaction_type in ('like', 'dislike', 'love')),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  unique (post_id, user_id)
);

create table if not exists public.team_huddle_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.team_huddle_posts(id) on delete cascade,
  comment_id uuid references public.team_huddle_comments(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  reported_by_user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null,
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  resolved_at timestamptz,
  resolved_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists team_huddle_posts_org_created_idx on public.team_huddle_posts (organization_id, created_at desc);
create index if not exists team_huddle_posts_org_pinned_idx on public.team_huddle_posts (organization_id, pinned_at desc);
create index if not exists team_huddle_comments_post_created_idx on public.team_huddle_comments (post_id, created_at asc);
create index if not exists team_huddle_reactions_post_idx on public.team_huddle_reactions (post_id);
create index if not exists team_huddle_reports_org_status_idx on public.team_huddle_reports (organization_id, status, created_at desc);

alter table public.team_huddle_posts enable row level security;
alter table public.team_huddle_comments enable row level security;
alter table public.team_huddle_reactions enable row level security;
alter table public.team_huddle_reports enable row level security;

create or replace function public.team_huddle_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
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

drop trigger if exists trg_team_huddle_reactions_updated_at on public.team_huddle_reactions;
create trigger trg_team_huddle_reactions_updated_at
before update on public.team_huddle_reactions
for each row execute function public.team_huddle_set_updated_at();

drop trigger if exists trg_team_huddle_reports_updated_at on public.team_huddle_reports;
create trigger trg_team_huddle_reports_updated_at
before update on public.team_huddle_reports
for each row execute function public.team_huddle_set_updated_at();
