-- 2026-01-07 Additional invite acceptance metadata
alter table if exists public.org_invites
  add column if not exists accepted_at timestamptz,
  add column if not exists accepted_user_id uuid references auth.users(id) on delete set null;

create index if not exists org_invites_token_idx on public.org_invites(invite_token);
