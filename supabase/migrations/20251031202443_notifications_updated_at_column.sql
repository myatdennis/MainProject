-- Ensure notifications table exposes updated_at for trigger logic
alter table public.notifications
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'notifications_set_updated_at'
      and tgrelid = 'public.notifications'::regclass
  ) then
    create trigger notifications_set_updated_at
      before update on public.notifications
      for each row execute function public.set_updated_at();
  end if;
end $$;
