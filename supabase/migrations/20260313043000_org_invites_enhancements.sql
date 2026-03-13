-- Enhance organization invite storage and expose a canonical view for admin APIs.
alter table public.org_invites
  add column if not exists invited_by uuid references auth.users (id);

alter table public.org_invites
  add column if not exists invited_at timestamptz not null default timezone('utc', now());

alter table public.org_invites
  add column if not exists accepted_at timestamptz;

alter table public.org_invites
  add column if not exists accepted_user_id uuid references auth.users (id);

alter table public.org_invites
  add column if not exists note text;

update public.org_invites
set invited_at = coalesce(invited_at, created_at)
where invited_at is null;

drop view if exists public.organization_invites;

create view public.organization_invites as
select
  i.id,
  i.org_id as organization_id,
  i.org_id,
  i.email,
  i.role,
  i.status,
  i.invite_token as token,
  coalesce(i.invited_by, i.inviter_id) as invited_by,
  coalesce(i.invited_at, i.created_at) as invited_at,
  i.accepted_at,
  i.accepted_user_id,
  i.expires_at,
  i.last_sent_at,
  i.reminder_count,
  i.duplicate_of,
  i.metadata,
  i.inviter_id,
  i.inviter_email,
  i.invited_name,
  i.note,
  i.created_at,
  i.updated_at
from public.org_invites i;

grant select on public.organization_invites to service_role;
grant select on public.organization_invites to authenticated;
