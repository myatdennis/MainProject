create extension if not exists "uuid-ossp";

create table if not exists public.notifications (
  id text primary key default gen_random_uuid()::text,
  title text not null,
  body text,
  org_id text,
  user_id text,
  created_at timestamptz not null default now(),
  read boolean not null default false
);

create index if not exists notifications_org_idx on public.notifications(org_id);
create index if not exists notifications_user_idx on public.notifications(user_id);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'notifications_set_updated_at') then
    create trigger notifications_set_updated_at
    before update on public.notifications
    for each row execute function public.set_updated_at();
  end if;
end$$;
